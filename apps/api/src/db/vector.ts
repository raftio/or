import pg from "pg";
import { getVectorDatabaseUrl } from "../config.js";

let vectorPool: pg.Pool | null = null;

const { Pool } = pg;

export function getVectorPool(): pg.Pool {
  if (!vectorPool) {
    const url = getVectorDatabaseUrl();
    if (!url) throw new Error("VECTOR_DATABASE_URL (or DATABASE_URL) is required for vector operations");
    vectorPool = new Pool({
      connectionString: url,
      max: 5,
    });
  }
  return vectorPool;
}

export async function vectorQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getVectorPool().query<T>(text, params);
}


export async function ensureVectorTables(): Promise<void> {
    await vectorQuery(`CREATE EXTENSION IF NOT EXISTS vector`);
  
    // No FK to workspaces — this is a separate database
    await vectorQuery(`
      CREATE TABLE IF NOT EXISTS workspace_code_chunks (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    UUID NOT NULL,
        repo            TEXT NOT NULL,
        file_path       TEXT NOT NULL,
        chunk_index     INTEGER NOT NULL,
        content         TEXT NOT NULL,
        language        TEXT,
        start_line      INTEGER NOT NULL,
        end_line        INTEGER NOT NULL,
        file_sha        TEXT NOT NULL,
        embedding       vector(1536) NOT NULL,
        metadata        JSONB NOT NULL DEFAULT '{}',
        indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(workspace_id, repo, file_path, chunk_index)
      );
      CREATE INDEX IF NOT EXISTS idx_code_chunks_workspace_repo
        ON workspace_code_chunks(workspace_id, repo);
      CREATE INDEX IF NOT EXISTS idx_code_chunks_file
        ON workspace_code_chunks(workspace_id, repo, file_path);
    `);
  
    await vectorQuery(`
      CREATE TABLE IF NOT EXISTS workspace_code_index_status (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id    UUID NOT NULL,
        repo            TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','indexing','ready','failed')),
        last_commit_sha TEXT,
        total_files     INTEGER DEFAULT 0,
        indexed_files   INTEGER DEFAULT 0,
        error           TEXT,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(workspace_id, repo)
      );
    `);
  }
  
  export async function closeVectorPool(): Promise<void> {
    if (vectorPool) {
      await vectorPool.end();
      vectorPool = null;
    }
  }
  