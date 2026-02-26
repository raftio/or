# IDE / Agent Integration (RFC-013)

Orqestra exposes REST APIs that IDEs (VSCode, Cursor, JetBrains) or agents can use to fetch execution bundles and submit evidence. No custom extension is required for basic integration; an extension or agent can call these endpoints with an API key (when `REQUIRE_AUTH` is enabled).

## Receive execution bundle

**Trigger:** User or agent selects a ticket and wants the execution bundle (tasks, acceptance criteria, context).

### Option 1: List bundles for ticket

```
GET /v1/bundles?ticketId=<ticket_id>
```

Returns `{ bundles: ExecutionBundle[] }`. Use the latest by version if multiple exist.

### Option 2: Get synthesized context (for display or to build bundle client-side)

```
GET /v1/context?ticketId=<ticket_id>&spec_ref=<optional_spec_ref>
```

Returns synthesized context (ticket title, description, acceptance criteria, sections). The execution bundle is built from this; for full RFC-002 bundle use GET/POST bundles.

### Option 3: Create bundle from ticket (if not yet built)

```
POST /v1/bundles
Content-Type: application/json
{ "ticket_ref": "PROJ-123", "build_from_ticket": true }
```

Returns the created bundle (tasks, acceptance_criteria_refs, context).

**Pin version:** Each bundle has `id`, `version`, `created_at`. Store `bundle.id` or `version` in session to avoid mid-session changes when spec/ticket updates.

## Submit evidence

IDE or local test run can send a minimal evidence payload (RFC-004):

```
POST /v1/evidence
Content-Type: application/json
{
  "repo": "org/repo",
  "ticket_id": "PROJ-123",
  "test_results": { "pass": 10, "fail": 0 },
  "ci_status": "success",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

Optional: add `pr_id`, `branch`, `commit_sha`, or a `meta` field with `source: "ide"` or `source: "local"` to distinguish from CI evidence.

When `REQUIRE_AUTH` is true, include:

- `Authorization: Bearer <api_key>`, or  
- `X-API-Key: <api_key>`

## Example: curl (agent or script)

```bash
# Get bundles for ticket
curl -s "http://localhost:3000/v1/bundles?ticketId=PROJ-123" \
  -H "X-API-Key: your-key"

# Get context
curl -s "http://localhost:3000/v1/context?ticketId=PROJ-123"

# Submit local evidence
curl -X POST "http://localhost:3000/v1/evidence" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"repo":"org/repo","ticket_id":"PROJ-123","test_results":{"pass":5,"fail":0},"ci_status":"success","timestamp":"2025-01-15T12:00:00.000Z"}'
```

## VSCode / Cursor / JetBrains

A future Orqestra extension or plugin can:

1. Let the user set API base URL and API key in settings.
2. On "Get bundle for ticket", call GET `/v1/bundles?ticketId=` or GET `/v1/context?ticketId=` and show tasks/AC in a sidebar or webview.
3. Optionally offer "Submit evidence" (e.g. after local tests) with POST `/v1/evidence`.

The same HTTP API is used; no additional Orqestra endpoints are required for IDE integration.
