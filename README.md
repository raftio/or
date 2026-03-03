# OR

Control Plane for the product flow: Intent → Execution → Evidence → Outcome → Feedback. Orchestrates tickets, specs, execution bundles, and evidence validation (see [docs/orca.md](docs/orca.md)).

## Prerequisites

- Node.js 20+

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs the API with hot reload (tsx watch) at `http://localhost:3000`.

## Build and run

```bash
npm run build
npm start
```

## Configuration (env)

| Variable | Description |
|----------|-------------|
| `TICKET_PROVIDER` | `stub` (default), `linear`, or `jira` |
| `LINEAR_API_KEY` | Required when `TICKET_PROVIDER=linear` |
| `CONTEXT_CACHE_TTL_MINUTES` | Context cache TTL (default: 5) |
| `AI_CHAT_PROVIDER` | `stub` (default), `openai`, or `anthropic` |
| `AI_CHAT_MODEL` | Override chat model (defaults: `gpt-4o-mini` / `claude-sonnet-4-20250514`) |
| `OPENAI_API_KEY` | Required for OpenAI providers |
| `ANTHROPIC_API_KEY` | Required for Anthropic providers |

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/version` | Service name and version |
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
| POST | `/v1/workflow/trigger` | Workflow orchestration (501 stub) |
| GET | `/v1/outcomes?releaseId=<id>` | Outcome tracking (501 stub) |

### AI Chat Agent

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/workspaces/:id/chat` | Send messages, receive streaming AI response |
| GET | `/v1/workspaces/:id/chat/conversations` | List chat conversations |
| GET | `/v1/workspaces/:id/chat/conversations/:id` | Get conversation with messages |
| DELETE | `/v1/workspaces/:id/chat/conversations/:id` | Delete conversation |

The chat agent is workspace-aware and injects bundle/evidence context into its responses. Configure `AI_CHAT_PROVIDER` to enable. See [RFC-022](docs/rfc/rfc-022.md) for details.

### Packages

| Package | Description |
|---------|-------------|
| `@or/agent` | Standalone AI chat agent (provider-agnostic, streamable) |
| `@or/domain` | Shared Zod schemas and types |
| `@or/sdk` | Typed API client |

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
```

## License

See [LICENSE](LICENSE).
