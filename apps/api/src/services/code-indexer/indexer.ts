/**
 * Repository indexing orchestrator.
 *
 * Crawl → Chunk → Embed → Store, with incremental support:
 * files whose SHA hasn't changed are skipped.
 */
import type { CodeProvider } from "../../adapters/code/contract.js";
import type { EmbeddingProvider, VectorEntry, VectorStore } from "../vector/contract.js";
import { chunkCode, type ChunkOptions } from "./chunker.js";
import { vectorQuery as query } from "../../db/index.js";

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

  async indexRepository(workspaceId: string, repo: string, commitSha?: string): Promise<IndexResult> {
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
      const existingFiles = await this.vectorStore.getIndexedFiles(workspaceId, repo);
      const seenPaths = new Set<string>();

      let pendingEntries: Omit<VectorEntry, "embedding">[] = [];
      let pendingTexts: string[] = [];

      const flush = async () => {
        if (pendingTexts.length === 0) return;

        const embeddings = await this.embeddingProvider.embed(pendingTexts);
        const entries: VectorEntry[] = pendingEntries.map((e, i) => ({
          ...e,
          embedding: embeddings[i],
        }));

        await this.vectorStore.upsert(entries);
        result.totalChunks += entries.length;

        pendingEntries = [];
        pendingTexts = [];
      };

      for await (const file of this.codeProvider.listFiles()) {
        result.totalFiles++;
        seenPaths.add(file.path);

        if (existingFiles.get(file.path) === file.sha) {
          result.skippedFiles++;
          continue;
        }

        // Remove stale chunks for this file before re-indexing
        if (existingFiles.has(file.path)) {
          await this.vectorStore.deleteByFile(workspaceId, repo, file.path);
        }

        const chunks = chunkCode(file.path, file.content, file.language, this.options.chunkOptions);
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
