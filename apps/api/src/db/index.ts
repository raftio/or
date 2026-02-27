import pg from "pg";
import { getDatabaseUrl } from "../config.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Create users table if not exists. Run once on startup or via migration.
 */
export async function ensureUsersTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
  `);
}

export async function ensureWorkspaceTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
    CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

    CREATE TABLE IF NOT EXISTS workspace_members (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
      joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);

    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      email        TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      invited_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token        TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
    );
    CREATE INDEX IF NOT EXISTS idx_wi_workspace ON workspace_invitations(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_wi_token ON workspace_invitations(token);
    CREATE INDEX IF NOT EXISTS idx_wi_email ON workspace_invitations(email);
  `);
}

export async function ensureIntegrationTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_integrations (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider      TEXT NOT NULL,
      config        JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, provider)
    );
    CREATE INDEX IF NOT EXISTS idx_wi_provider_workspace
      ON workspace_integrations(workspace_id, provider);
  `);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
