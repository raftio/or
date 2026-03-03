/**
 * Repository indexing orchestrator.
 *
 * Crawl → Chunk → Embed → Store, with incremental support:
 * files whose SHA hasn't changed are skipped.
 */
import type { CodeProvider } from "../../adapters/code/contract.js";
import type { EmbeddingProvider, VectorEntry, VectorStore } from "../vector/contract.js";
import { chunkCode, type CodeChunk, type ChunkOptions } from "./chunker.js";
import { chunkTypeScript } from "./chunker-ast.js";
import { chunkGo } from "./chunker-ast-go.js";
import { chunkProto } from "./chunker-proto.js";
import { chunkCss } from "./chunker-css.js";
import { chunkHtml } from "./chunker-html.js";
import { vectorQuery as query } from "../../db/index.js";

const TS_JS_RE = /\.[tj]sx?$/;
const GO_RE = /\.go$/;
const PROTO_RE = /\.proto$/;
const CSS_RE = /\.(css|scss|less)$/;
const HTML_RE = /\.(html|htm|gohtml|tmpl|hbs|ejs|njk)$/;

const SKIP_EXTENSIONS = new Set([
  ".pb.go", ".pb.ts",
  ".lock", ".sum",
  ".min.js", ".min.css", ".bundle.js", ".chunk.js",
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot",
  ".pdf", ".zip", ".tar", ".gz", ".br",
  ".map",
  ".snap",
  ".csv", ".tsv",
  ".bot", ".mk", ".patch", ".diff",
]);

/** Extensions we know how to chunk (AST or structure-aware + generic text). */
const INDEXABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".go",
  ".proto",
  ".css", ".scss", ".less",
  ".html", ".htm", ".gohtml", ".tmpl", ".hbs", ".ejs", ".njk",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".mdx", ".txt", ".rst",
  ".py", ".rb", ".rs", ".java", ".kt", ".scala", ".c", ".cpp", ".h", ".hpp",
  ".sh", ".bash", ".zsh", ".fish",
  ".sql",
  ".xml",
  ".env.example", ".gitignore", ".dockerignore",
  ".dockerfile",
  ".tf", ".hcl",
  ".lua", ".php", ".swift", ".dart", ".ex", ".exs", ".erl",
  ".r", ".R",
  ".vue", ".svelte", ".astro",
]);

function shouldSkip(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of SKIP_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  if (lower.includes("/vendor/") || lower.includes("/node_modules/") || lower.includes("/dist/")) return true;
  // Skip unknown extensions — only index files we recognise
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx !== -1) {
    const ext = lower.slice(dotIdx);
    if (!INDEXABLE_EXTENSIONS.has(ext)) return true;
  }
  // No extension (e.g. Makefile, Dockerfile) — allow through for generic chunker
  return false;
}

export interface IndexResult {
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  removedFiles: number;
  totalChunks: number;
}

export interface IndexerOptions {
  chunkOptions?: ChunkOptions;
  /** Max files to embed per batch before flushing to the store (default 20). */
  batchSize?: number;
}

const DEFAULT_BATCH = 20;

async function updateStatus(
  workspaceId: string,
  repo: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 3}`);
  const values = keys.map((k) => fields[k]);

  await query(
    `INSERT INTO workspace_code_index_status (workspace_id, repo, ${keys.join(", ")})
     VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(", ")})
     ON CONFLICT (workspace_id, repo)
     DO UPDATE SET ${sets.join(", ")}`,
    [workspaceId, repo, ...values],
  );
}

export class CodeIndexer {
  constructor(
    private codeProvider: CodeProvider,
    private vectorStore: VectorStore,
    private embeddingProvider: EmbeddingProvider,
    private options: IndexerOptions = {},
  ) {}

  async indexRepository(workspaceId: string, repo: string, commitSha?: string, force?: boolean): Promise<IndexResult> {
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH;
    const result: IndexResult = {
      totalFiles: 0,
      indexedFiles: 0,
      skippedFiles: 0,
      removedFiles: 0,
      totalChunks: 0,
    };

    await updateStatus(workspaceId, repo, {
      status: "indexing",
      started_at: new Date().toISOString(),
      error: null,
    });

    try {
      if (force) {
        await this.vectorStore.deleteByRepo(workspaceId, repo);
      }
      const existingFiles = force
        ? new Map<string, string>()
        : await this.vectorStore.getIndexedFiles(workspaceId, repo);
      const seenPaths = new Set<string>();

      let pendingEntries: Omit<VectorEntry, "embedding">[] = [];
      let pendingTexts: string[] = [];

      const flush = async () => {
        if (pendingTexts.length === 0) return;

        try {
          const embeddings = await this.embeddingProvider.embed(pendingTexts);
          const entries: VectorEntry[] = pendingEntries.map((e, i) => ({
            ...e,
            embedding: embeddings[i],
          }));

          await this.vectorStore.upsert(entries);
          result.totalChunks += entries.length;
        } catch (err) {
          const files = [...new Set(pendingEntries.map((e) => e.filePath))];
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Embedding failed for ${files.length} file(s): ${files.join(", ")} — ${message}`,
          );
        } finally {
          pendingEntries = [];
          pendingTexts = [];
        }
      };

      for await (const file of this.codeProvider.listFiles()) {
        result.totalFiles++;
        seenPaths.add(file.path);

        if (shouldSkip(file.path)) {
          result.skippedFiles++;
          continue;
        }

        if (existingFiles.get(file.path) === file.sha) {
          result.skippedFiles++;
          continue;
        }

        // Remove stale chunks for this file before re-indexing
        if (existingFiles.has(file.path)) {
          await this.vectorStore.deleteByFile(workspaceId, repo, file.path);
        }

        const chunks: CodeChunk[] = TS_JS_RE.test(file.path)
          ? chunkTypeScript(file.path, file.content, file.language, this.options.chunkOptions?.chunkSize, this.options.chunkOptions)
          : GO_RE.test(file.path)
            ? await chunkGo(file.path, file.content, file.language, this.options.chunkOptions?.chunkSize, this.options.chunkOptions)
            : PROTO_RE.test(file.path)
              ? chunkProto(file.path, file.content, file.language, this.options.chunkOptions?.chunkSize, this.options.chunkOptions)
              : CSS_RE.test(file.path)
                ? chunkCss(file.path, file.content, file.language, this.options.chunkOptions?.chunkSize, this.options.chunkOptions)
                : HTML_RE.test(file.path)
                  ? chunkHtml(file.path, file.content, file.language, this.options.chunkOptions?.chunkSize, this.options.chunkOptions)
                  : chunkCode(file.path, file.content, file.language, this.options.chunkOptions);
        result.indexedFiles++;

        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci];
          pendingEntries.push({
            id: "",
            workspaceId,
            repo,
            filePath: file.path,
            chunkIndex: ci,
            content: chunk.content,
            language: file.language,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            fileSha: file.sha,
            metadata: chunk.symbol ? { symbol: chunk.symbol } : undefined,
          });
          pendingTexts.push(chunk.content);
        }

        if (pendingTexts.length >= batchSize * 5) {
          await flush();
        }

        await updateStatus(workspaceId, repo, {
          total_files: result.totalFiles,
          indexed_files: result.indexedFiles,
        });
      }

      await flush();

      // Remove chunks for files that no longer exist in the repo
      for (const [path] of existingFiles) {
        if (!seenPaths.has(path)) {
          await this.vectorStore.deleteByFile(workspaceId, repo, path);
          result.removedFiles++;
        }
      }

      await updateStatus(workspaceId, repo, {
        status: "ready",
        total_files: result.totalFiles,
        indexed_files: result.indexedFiles,
        completed_at: new Date().toISOString(),
        error: null,
        ...(commitSha ? { last_commit_sha: commitSha } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateStatus(workspaceId, repo, {
        status: "failed",
        error: message.slice(0, 1000),
      }).catch(() => {});
      throw err;
    }

    return result;
  }
}
