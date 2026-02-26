# CI/CD Integration (RFC-012)

Orqestra accepts evidence from CI pipelines via **push**: your pipeline sends an RFC-004 evidence payload to the Control Plane.

## Endpoint

- **POST** `/v1/evidence` — same as manual evidence ingestion.
- **Auth (optional):** If `CI_WEBHOOK_SECRET` is set in the API env, the request must include either:
  - Header `X-Orqestra-Webhook-Secret: <secret>`, or
  - Header `Authorization: Bearer <secret>`

If the secret is set and the header is missing or wrong, the API returns **401 Unauthorized**.

## Payload (RFC-004)

Body must be JSON with at least:

- `repo` (string) — e.g. `owner/repo`
- `ticket_id` (string) — from branch name or PR title
- `test_results` — `{ pass: number, fail: number }`
- `ci_status` — `"success"` | `"failure"` | `"cancelled"`
- `timestamp` — ISO 8601 datetime

Optional: `pr_id`, `branch`, `commit_sha`, `coverage`, `artifact_urls`, etc. See [RFC-004](../rfc/rfc-004.md).

## Getting ticket_id and repo in CI

- **Branch:** e.g. `feature/PROJ-123-description` → extract `PROJ-123`.
- **PR:** Use GitHub/GitLab API or env (e.g. `GITHUB_HEAD_REF`, PR title) to get ticket id.
- **Repo:** Usually `$GITHUB_REPOSITORY` or `$CI_PROJECT_PATH`.

## Example: curl

```bash
curl -X POST "https://your-orqestra-api/v1/evidence" \
  -H "Content-Type: application/json" \
  -H "X-Orqestra-Webhook-Secret: your-secret" \
  -d '{
    "repo": "org/repo",
    "ticket_id": "PROJ-123",
    "pr_id": "42",
    "test_results": { "pass": 10, "fail": 0 },
    "ci_status": "success",
    "timestamp": "2025-01-15T12:00:00.000Z"
  }'
```

## Example: GitHub Actions

```yaml
- name: Send evidence to Orqestra
  env:
    ORQESTRA_URL: ${{ secrets.ORQESTRA_API_URL }}
    ORQESTRA_SECRET: ${{ secrets.CI_WEBHOOK_SECRET }}
    TICKET_ID: ${{ env.TICKET_ID }}   # set earlier from branch or PR title
  run: |
    curl -X POST "$ORQESTRA_URL/v1/evidence" \
      -H "Content-Type: application/json" \
      -H "X-Orqestra-Webhook-Secret: $ORQESTRA_SECRET" \
      -d "{
        \"repo\": \"${{ github.repository }}\",
        \"ticket_id\": \"$TICKET_ID\",
        \"pr_id\": \"${{ github.event.pull_request.number }}\",
        \"test_results\": { \"pass\": 10, \"fail\": 0 },
        \"ci_status\": \"success\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
      }"
```

Add `ORQESTRA_API_URL` and `CI_WEBHOOK_SECRET` (if you use it) as repository secrets.
