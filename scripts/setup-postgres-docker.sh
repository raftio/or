#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Starting PostgreSQL (Docker)..."
docker compose up -d postgres

echo "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U orca -d orca >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    echo ""
    echo "Connection:"
    echo "  DATABASE_URL=postgresql://orca:orca@localhost:5432/orca"
    echo ""
    echo "Stop:  docker compose stop postgres"
    echo "Logs:  docker compose logs -f postgres"
    exit 0
  fi
  sleep 1
done

echo "Timeout waiting for PostgreSQL." >&2
exit 1
