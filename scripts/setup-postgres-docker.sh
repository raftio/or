#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Starting PostgreSQL + pgvector (Docker)..."
docker compose up -d postgres pgvector

echo "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U orca -d orca >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for PostgreSQL." >&2
    exit 1
  fi
done
echo "PostgreSQL is ready."

echo "Waiting for pgvector to be ready..."
for i in {1..30}; do
  if docker compose exec -T pgvector pg_isready -U orca -d orca_vectors >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for pgvector." >&2
    exit 1
  fi
done
echo "pgvector is ready."

echo ""
echo "Connection:"
echo "  DATABASE_URL=postgresql://orca:orca@localhost:5432/orca"
echo "  VECTOR_DATABASE_URL=postgresql://orca:orca@localhost:5434/orca_vectors"
echo ""
echo "Stop:  docker compose stop postgres pgvector"
echo "Logs:  docker compose logs -f postgres pgvector"
