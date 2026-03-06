import { vectorQuery as query } from "../../db/index.js";
import type { VectorStore } from "./contract.js";

const BATCH_SIZE = 50;

export function createPgVectorStore(): VectorStore {
  return {
    async upsert(entries) {
      if (entries.length === 0) return;

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);

        const values: unknown[] = [];
        const placeholders: string[] = [];

        for (let j = 0; j < batch.length; j++) {
          const e = batch[j];
          const offset = j * 11;
          placeholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, ` +
            `$${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, ` +
            `$${offset + 9}, $${offset + 10}::vector, $${offset + 11})`,
          );
          values.push(
            e.workspaceId,
            e.repo,
            e.filePath,
            e.chunkIndex,
            e.content,
            e.language,
            e.startLine,
            e.endLine,
            e.fileSha,
            JSON.stringify(e.embedding),
            JSON.stringify(e.metadata ?? {}),
          );
        }

        await query(
          `INSERT INTO workspace_code_chunks
             (workspace_id, repo, file_path, chunk_index, content, language,
              start_line, end_line, file_sha, embedding, metadata)
           VALUES ${placeholders.join(", ")}
           ON CONFLICT (workspace_id, repo, file_path, chunk_index)
           DO UPDATE SET
             content    = EXCLUDED.content,
             language   = EXCLUDED.language,
             start_line = EXCLUDED.start_line,
             end_line   = EXCLUDED.end_line,
             file_sha   = EXCLUDED.file_sha,
             embedding  = EXCLUDED.embedding,
             metadata   = EXCLUDED.metadata,
             indexed_at = now()`,
          values,
        );
      }
    },

    async search(queryEmbedding, options) {
      const { workspaceId, repo, limit = 10, threshold = 0.3 } = options;

      const conditions = [`workspace_id = $1`];
      const params: unknown[] = [workspaceId];
      let idx = 2;

      if (repo) {
        conditions.push(`repo = $${idx}`);
        params.push(repo);
        idx++;
      }

      const embeddingParam = `$${idx}`;
      params.push(JSON.stringify(queryEmbedding));
      idx++;

      const thresholdParam = `$${idx}`;
      params.push(threshold);
      idx++;

      const limitParam = `$${idx}`;
      params.push(limit);

      const result = await query<{
        id: string;
        filePath: string;
        content: string;
        startLine: number;
        endLine: number;
        language: string | null;
        score: number;
      }>(
        `SELECT
           id,
           file_path   AS "filePath",
           content,
           start_line  AS "startLine",
           end_line    AS "endLine",
           language,
           1 - (embedding <=> ${embeddingParam}::vector) AS score
         FROM workspace_code_chunks
         WHERE ${conditions.join(" AND ")}
           AND 1 - (embedding <=> ${embeddingParam}::vector) > ${thresholdParam}
         ORDER BY embedding <=> ${embeddingParam}::vector
         LIMIT ${limitParam}`,
        params,
      );

      return result.rows;
    },

    async deleteByFile(workspaceId, repo, filePath) {
      await query(
        `DELETE FROM workspace_code_chunks
         WHERE workspace_id = $1 AND repo = $2 AND file_path = $3`,
        [workspaceId, repo, filePath],
      );
    },

    async deleteByRepo(workspaceId, repo) {
      await query(
        `DELETE FROM workspace_code_chunks WHERE workspace_id = $1 AND repo = $2`,
        [workspaceId, repo],
      );
    },

    async getIndexedFiles(workspaceId, repo) {
      const result = await query<{ file_path: string; file_sha: string }>(
        `SELECT DISTINCT file_path, file_sha
         FROM workspace_code_chunks
         WHERE workspace_id = $1 AND repo = $2`,
        [workspaceId, repo],
      );

      const map = new Map<string, string>();
      for (const row of result.rows) {
        map.set(row.file_path, row.file_sha);
      }
      return map;
    },
  };
}
