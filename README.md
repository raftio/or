# Orqestra

Control Plane for the product flow: Intent → Execution → Evidence → Outcome → Feedback. Orchestrates tickets, specs, execution bundles, and evidence validation (see [docs/orqestra.md](docs/orqestra.md)).

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

## Setup

```bash
pnpm install
```

## Development

From repo root:

- **API only:** `pnpm dev:api` — runs the Control Plane API at `http://localhost:3000`.
- **Web only:** `pnpm dev:web` — runs the Next.js app at `http://localhost:3001`.
- **Both:** `pnpm dev` — runs API and Web in parallel (Turborepo).

The browser will call the API; ensure the API is running and CORS allows the web origin (default `http://localhost:3001`). Set `NEXT_PUBLIC_API_URL=http://localhost:3000` in `apps/web/.env.local` (see `apps/web/.env.example`).

## Build and run

```bash
pnpm build
pnpm start
```

Builds all workspace packages (domain, api, web). `pnpm start` runs the API; for production web run `pnpm --filter @orqestra/web start`.

## Configuration (env)

| Variable | Description |
|----------|-------------|
| `TICKET_PROVIDER` | `stub` (default), `linear`, or `jira` |
| `LINEAR_API_KEY` | Required when `TICKET_PROVIDER=linear` |
| `JIRA_BASE_URL` | e.g. `https://your-domain.atlassian.net`; required when `TICKET_PROVIDER=jira` |
| `JIRA_EMAIL` | Atlassian account email for Jira |
| `JIRA_API_TOKEN` | Jira Cloud API token |
| `DOCUMENT_PROVIDER` | `stub` (default), `confluence`, or `notion` |
| `CONFLUENCE_BASE_URL` | e.g. `https://your-domain.atlassian.net/wiki`; required when `DOCUMENT_PROVIDER=confluence` |
| `CONFLUENCE_EMAIL` | Atlassian account email for Confluence |
| `CONFLUENCE_API_TOKEN` | Confluence API token |
| `NOTION_API_KEY` | Required when `DOCUMENT_PROVIDER=notion` |
| `GIT_PROVIDER` | `stub` (default) or `github` |
| `GITHUB_TOKEN` | Required when `GIT_PROVIDER=github`; also used by GitHub webhook to resolve PRs for releases |
| `GITHUB_WEBHOOK_SECRET` | Secret to verify GitHub webhook (X-Hub-Signature-256); required for POST /v1/webhooks/github |
| `CI_WEBHOOK_SECRET` | Optional; if set, POST /v1/evidence requires header X-Orqestra-Webhook-Secret or Bearer to match |
| `CONTEXT_CACHE_TTL_MINUTES` | Context cache TTL (default: 5) |
| `REQUIRE_AUTH` | If `true` or `1`, all `/v1/*` (except webhooks) require `Authorization: Bearer <key>` or `X-API-Key` |
| `ORQESTRA_API_KEYS` | Comma-separated API keys; optional `key:tenant_id` (e.g. `sk-abc,sk-xyz:team2`) |
| `NOTIFICATION_WEBHOOK_URL` | Optional; POST notification payload on state transitions |
| `SLACK_WEBHOOK_URL` | Optional; post message to Slack on state transitions |
| `CORS_ORIGIN` | Allowed origin for browser requests (default: `http://localhost:3001`) |

**Web (apps/web):** `NEXT_PUBLIC_API_URL` – API base URL (default: `http://localhost:3000`).

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/version` | Service name and version |
| GET | `/metrics` | Prometheus-format request counts and duration |
| GET | `/v1/context?ticketId=<id>&spec_ref=<ref>` | Synthesized context for ticket (optional spec) |
| POST | `/v1/bundles` | Create bundle (body: `ticket_ref`, optional `spec_ref`, `build_from_ticket: true` to use engine) |
| GET | `/v1/bundles/:id` | Get bundle by id |
| GET | `/v1/bundles?ticketId=<id>` | List bundles for a ticket |
| POST | `/v1/evidence` | Ingest evidence (RFC-004); returns stored payload with id |
| GET | `/v1/evidence?ticketId=<id>` | List evidence for a ticket |
| GET | `/v1/evidence?repo=<r>&prId=<p>` | List evidence for a repo+PR |
| GET | `/v1/evidence/status?ticketId=<id>` | Evidence complete status for ticket |
| GET | `/v1/evidence/:id` | Get evidence by id |
| POST | `/v1/evidence/validate` | Validate evidence payload (RFC-004 body) |
| GET | `/v1/pr?repo=<r>&prId=<p>` | PR metadata + extracted ticket_id (Git adapter) |
| GET | `/v1/pr-intelligence?repo=<r>&prId=<p>&ticketId=<id>` | PR summary, risk flags, evidence validation |
| POST | `/v1/pr-intelligence` | Same (body: `repo`, `pr_id`, optional `ticket_id`, `pr_title`, `pr_description`) |
| GET | `/v1/state?ticketId=<id>` | Current flow state for ticket (RFC-007) |
| POST | `/v1/state/events` | Emit event (body: `ticket_id`, `event`, optional `event_id`); returns state and transitioned |
| POST | `/v1/workflow/trigger` | Workflow trigger (body: `trigger_type`, `ticket_id`, optional `pr_id`, `repo`, `action`, `event_id`); maps to state machine |
| GET | `/v1/outcomes?releaseId=<id>` | List outcome records for a release |
| GET | `/v1/outcomes?ticketId=<id>` | List releases and outcomes attributed to a ticket |
| POST | `/v1/outcomes` | Ingest one or more outcome records (body: RFC-005 schema or array) |
| POST | `/v1/releases` | Create/link release (body: `id`, optional `ticket_ids`) |
| GET | `/v1/traceability?ticketId=` | AC traceability for ticket (AC → evidence, code refs) |
| GET | `/v1/traceability?repo=&prId=` | AC traceability for PR |
| GET | `/v1/traceability/ac/:acId` | Traceability for a single AC |
| POST | `/v1/webhooks/github` | GitHub webhook: on release/tag event, create release and link tickets (send as Content-Type: application/json) |

### Examples (curl)

```bash
# Health and version
curl http://localhost:3000/health
curl http://localhost:3000/version

# Context for ticket (uses ticket adapter; stub by default)
curl "http://localhost:3000/v1/context?ticketId=PROJ-123"

# Create a bundle from ticket (bundling engine)
curl -X POST http://localhost:3000/v1/bundles \
  -H "Content-Type: application/json" \
  -d '{"ticket_ref": "PROJ-123", "build_from_ticket": true}'

# Create a bundle manually (no engine)
curl -X POST http://localhost:3000/v1/bundles \
  -H "Content-Type: application/json" \
  -d '{"ticket_ref": "PROJ-123", "spec_ref": "https://confluence.example.com/page/1"}'

# Get bundle by id (use id from create response)
curl http://localhost:3000/v1/bundles/<bundle-id>

# List bundles for a ticket
curl "http://localhost:3000/v1/bundles?ticketId=PROJ-123"

# Ingest evidence
curl -X POST http://localhost:3000/v1/evidence \
  -H "Content-Type: application/json" \
  -d '{"repo":"org/repo","ticket_id":"PROJ-123","test_results":{"pass":10,"fail":0},"ci_status":"success","timestamp":"2025-01-01T00:00:00.000Z"}'

# Evidence status for ticket
curl "http://localhost:3000/v1/evidence/status?ticketId=PROJ-123"

# Validate evidence
curl -X POST http://localhost:3000/v1/evidence/validate \
  -H "Content-Type: application/json" \
  -d '{"repo":"org/repo","ticket_id":"PROJ-123","test_results":{"pass":10,"fail":0},"ci_status":"success","timestamp":"2025-01-01T00:00:00.000Z"}'

# PR metadata (stub returns mock PR; use GIT_PROVIDER=github + GITHUB_TOKEN for real)
curl "http://localhost:3000/v1/pr?repo=owner/repo&prId=1"

# PR intelligence (summary, risk flags, evidence validation)
curl "http://localhost:3000/v1/pr-intelligence?repo=owner/repo&prId=1&ticketId=PROJ-123"
curl -X POST http://localhost:3000/v1/pr-intelligence \
  -H "Content-Type: application/json" \
  -d '{"repo":"owner/repo","pr_id":"1","ticket_id":"PROJ-123"}'

# State machine (RFC-007): query state, emit event
curl "http://localhost:3000/v1/state?ticketId=PROJ-123"
curl -X POST http://localhost:3000/v1/state/events \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"PROJ-123","event":"ticket_created"}'
curl -X POST http://localhost:3000/v1/state/events \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"PROJ-123","event":"spec_ready","event_id":"evt-1"}'
```

## License

See [LICENSE](LICENSE).
