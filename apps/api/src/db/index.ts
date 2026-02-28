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

export async function ensureBundleTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_bundles (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id             UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      ticket_ref               TEXT NOT NULL,
      spec_ref                 TEXT NOT NULL DEFAULT '',
      version                  INTEGER NOT NULL,
      content_hash             TEXT NOT NULL,
      tasks                    JSONB NOT NULL,
      dependencies             JSONB,
      acceptance_criteria_refs JSONB NOT NULL DEFAULT '[]',
      context                  JSONB,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(workspace_id, ticket_ref, version)
    );
    CREATE INDEX IF NOT EXISTS idx_bundles_workspace_ticket
      ON workspace_bundles(workspace_id, ticket_ref);
    CREATE INDEX IF NOT EXISTS idx_bundles_hash
      ON workspace_bundles(workspace_id, ticket_ref, content_hash);
    CREATE INDEX IF NOT EXISTS idx_bundles_created
      ON workspace_bundles(workspace_id, created_at DESC);
  `);
}

export async function ensureApiTokenTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_api_tokens (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL DEFAULT 'Untitled token',
      token_hash    TEXT NOT NULL UNIQUE,
      token_prefix  TEXT NOT NULL,
      expires_at    TIMESTAMPTZ,
      last_used_at  TIMESTAMPTZ,
      revoked_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wat_workspace ON workspace_api_tokens(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_wat_hash ON workspace_api_tokens(token_hash);
  `);
}

export async function ensureEvidenceTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_evidence (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      repo                TEXT NOT NULL,
      branch              TEXT,
      commit_sha          TEXT,
      pr_id               TEXT,
      ticket_id           TEXT NOT NULL,
      test_results        JSONB NOT NULL,
      coverage            JSONB,
      ci_logs             TEXT,
      validation_signals  JSONB,
      ci_status           TEXT NOT NULL CHECK (ci_status IN ('success', 'failure', 'cancelled')),
      artifact_urls       JSONB,
      timestamp           TIMESTAMPTZ NOT NULL,
      lifecycle           TEXT NOT NULL DEFAULT 'created' CHECK (lifecycle IN ('created', 'validated', 'linked')),
      bundle_id           UUID,
      bundle_version      INTEGER,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_workspace_ticket
      ON workspace_evidence(workspace_id, ticket_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_repo_pr
      ON workspace_evidence(workspace_id, repo, pr_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_repo_commit
      ON workspace_evidence(workspace_id, repo, commit_sha);
    CREATE INDEX IF NOT EXISTS idx_evidence_bundle
      ON workspace_evidence(workspace_id, bundle_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_created
      ON workspace_evidence(workspace_id, created_at DESC);
  `);
}

export async function ensureChatTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_chat_conversations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title        TEXT NOT NULL DEFAULT 'New conversation',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conv_workspace_user
      ON workspace_chat_conversations(workspace_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_conv_updated
      ON workspace_chat_conversations(workspace_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS workspace_chat_messages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES workspace_chat_conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_msg_conversation
      ON workspace_chat_messages(conversation_id, created_at ASC);
  `);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
