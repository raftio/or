# Orqestra

Control Plane for the product flow: Intent → Execution → Evidence → Outcome → Feedback. Orchestrates tickets, specs, execution bundles, and evidence validation (see [docs/orqestra.md](docs/orqestra.md)).

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

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/version` | Service name and version |
| GET | `/v1/context?ticketId=<id>` | Context synthesis (stub) |
| POST | `/v1/bundles` | Create execution bundle (body: `ticket_ref`, optional `spec_ref`, etc.) |
| GET | `/v1/bundles/:id` | Get bundle by id |
| GET | `/v1/bundles?ticketId=<id>` | List bundles for a ticket |
| POST | `/v1/evidence/validate` | Validate evidence payload (RFC-004 body) |
| POST | `/v1/workflow/trigger` | Workflow orchestration (501 stub) |
| GET | `/v1/outcomes?releaseId=<id>` | Outcome tracking (501 stub) |

### Examples (curl)

```bash
# Health and version
curl http://localhost:3000/health
curl http://localhost:3000/version

# Create a bundle
curl -X POST http://localhost:3000/v1/bundles \
  -H "Content-Type: application/json" \
  -d '{"ticket_ref": "PROJ-123", "spec_ref": "https://confluence.example.com/page/1"}'

# Get bundle by id (use id from create response)
curl http://localhost:3000/v1/bundles/<bundle-id>

# List bundles for a ticket
curl "http://localhost:3000/v1/bundles?ticketId=PROJ-123"

# Validate evidence
curl -X POST http://localhost:3000/v1/evidence/validate \
  -H "Content-Type: application/json" \
  -d '{"repo":"org/repo","ticket_id":"PROJ-123","test_results":{"pass":10,"fail":0},"ci_status":"success","timestamp":"2025-01-01T00:00:00.000Z"}'
```

## License

See [LICENSE](LICENSE).
