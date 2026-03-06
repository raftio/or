# Development Reference

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (with pgvector for vector search)

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` in `apps/api` and fill in the required values (at minimum `DATABASE_URL` and `JWT_SECRET`).

## Development

```bash
pnpm dev          # build packages + run API with hot reload
pnpm dev:web      # run Next.js web app
pnpm dev:worker   # run background worker
```

API runs at `http://localhost:3000`.

## Build and run

```bash
pnpm build
pnpm start   # starts @or/api
```

## Configuration (env)

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | JWT signing secret (min 16 chars) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_DATABASE_URL` | `DATABASE_URL` | Separate DB for pgvector (falls back to `DATABASE_URL`) |
| `TICKET_PROVIDER` | `stub` | `stub`, `linear`, `jira`, or `github` |
| `LINEAR_API_KEY` | — | Required when `TICKET_PROVIDER=linear` |
| `DOCUMENT_PROVIDER` | `stub` | `stub`, `notion`, or `confluence` |
| `NOTION_API_KEY` | — | Required when `DOCUMENT_PROVIDER=notion` |
| `CONFLUENCE_BASE_URL` | — | Required when `DOCUMENT_PROVIDER=confluence` |
| `CONFLUENCE_EMAIL` | — | Required when `DOCUMENT_PROVIDER=confluence` |
| `CONFLUENCE_API_TOKEN` | — | Required when `DOCUMENT_PROVIDER=confluence` |
| `AI_DECOMPOSER_PROVIDER` | `stub` | `stub`, `openai`, or `anthropic` — AI bundle decomposition |
| `AI_DECOMPOSER_MODEL` | provider default | Override decomposer model |
| `AI_CHAT_PROVIDER` | `stub` | `stub`, `openai`, or `anthropic` — AI chat agent |
| `AI_CHAT_MODEL` | provider default | Override chat model (`gpt-4o-mini` / `claude-sonnet-4-20250514`) |
| `OPENAI_API_KEY` | — | Required for OpenAI providers |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic providers |
| `CONTEXT_CACHE_TTL_MINUTES` | `5` | Context synthesis cache TTL |

## API endpoints

All endpoints below are under `http://localhost:3000`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account; returns JWT + auto-created personal workspace |
| POST | `/login` | Authenticate; returns JWT |
| GET | `/me` | Get current user (requires `Authorization: Bearer <token>`) |

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces` | Create workspace |
| GET | `/v1/workspaces` | List workspaces for current user |
| GET | `/v1/workspaces/:id` | Get workspace |
| PATCH | `/v1/workspaces/:id` | Update name/slug (owner/admin) |
| DELETE | `/v1/workspaces/:id` | Delete workspace (owner only) |
| GET | `/v1/workspaces/:id/members` | List members |
| PATCH | `/v1/workspaces/:id/members/:memberId` | Update member role |
| DELETE | `/v1/workspaces/:id/members/:memberId` | Remove member |
| POST | `/v1/workspaces/:id/invitations` | Invite user by email |
| GET | `/v1/workspaces/:id/invitations` | List pending invitations |
| POST | `/v1/invitations/:token/accept` | Accept invitation |

### Bundles

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces/:wsId/bundles` | Create bundle (`build_from_ticket: true` to use AI engine) |
| GET | `/v1/workspaces/:wsId/bundles` | List bundles (supports `?ticketRef`, `?status`, `?search`, pagination) |
| GET | `/v1/workspaces/:wsId/bundles/:id` | Get bundle |
| GET | `/v1/workspaces/:wsId/bundles/:ticketRef/history` | Version history for a ticket |
| PATCH | `/v1/workspaces/:wsId/bundles/:id/status` | Update bundle status |
| PATCH | `/v1/workspaces/:wsId/bundles/by-ticket/:ticketRef/status` | Update all versions of a ticket |
| POST | `/v1/bundles/sync` | Sync all tickets from provider into bundles (API token) |

### Evidence

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/evidence` | Ingest evidence |
| GET | `/v1/evidence` | List evidence (`?ticketId` or `?repo&prId`) |
| GET | `/v1/evidence/status` | Evidence complete status (`?ticketId`) |
| GET | `/v1/evidence/:id` | Get evidence by id |
| POST | `/v1/evidence/validate` | Validate evidence payload |

### Tickets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/tickets` | List tickets from configured provider |
| GET | `/v1/tickets/:id` | Get ticket by id |

### Context

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/context` | Synthesized context (`?ticketId`, optional `?spec_ref`) |

### AI Chat Agent

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces/:id/chat` | Send message; streams AI response with bundle/evidence context |
| GET | `/v1/workspaces/:id/chat/conversations` | List conversations |
| GET | `/v1/workspaces/:id/chat/conversations/:cid` | Get conversation with messages |
| DELETE | `/v1/workspaces/:id/chat/conversations/:cid` | Delete conversation |
| GET | `/v1/workspaces/:id/chat/memories` | List agent memories |
| POST | `/v1/workspaces/:id/chat/images` | Upload image for chat |

### Integrations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/workspaces/:id/integrations` | List configured integrations |
| PUT | `/v1/workspaces/:id/integrations/jira` | Configure Jira |
| PUT | `/v1/workspaces/:id/integrations/github` | Configure GitHub (tickets) |
| PUT | `/v1/workspaces/:id/integrations/gitlab` | Configure GitLab (tickets) |
| PUT | `/v1/workspaces/:id/integrations/github-code` | Configure GitHub (code index) |
| PUT | `/v1/workspaces/:id/integrations/gitlab-code` | Configure GitLab (code index) |
| PUT | `/v1/workspaces/:id/integrations/notion` | Configure Notion |
| PUT | `/v1/workspaces/:id/integrations/confluence` | Configure Confluence |

### Code Index

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces/:id/code-index/sync` | Trigger code indexing |
| GET | `/v1/workspaces/:id/code-index/search` | Semantic code search |

### API Tokens

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces/:id/api-tokens` | Create API token for workspace |
| GET | `/v1/workspaces/:id/api-tokens` | List API tokens |
| DELETE | `/v1/workspaces/:id/api-tokens/:tokenId` | Revoke token |

### Events & System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/workspaces/:id/events` | Activity event feed |
| GET | `/health` | Liveness check |
| GET | `/version` | Service name and version |

## Packages

| Package | Description |
|---------|-------------|
| `@or/agent` | Standalone AI chat agent (provider-agnostic, streamable) |
| `@or/domain` | Shared Zod schemas and types |
| `@or/sdk` | Typed API client |
| `@or/code-chunker` | Code chunking for vector indexing |
| `@or/ui` | Shared UI components (used by `@or/web`) |

## Apps

| App | Description |
|-----|-------------|
| `@or/api` | Hono API server |
| `@or/web` | Next.js web dashboard |
| `@or/worker` | Background worker |
