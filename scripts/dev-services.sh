#!/usr/bin/env bash
# Starts the local services SAVE US needs: Postgres (required) and Redis
# (optional). Safe to run repeatedly.
set -euo pipefail

if command -v pg_isready >/dev/null 2>&1 && ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  (service postgresql start >/dev/null 2>&1 || pg_ctlcluster 16 main start >/dev/null 2>&1) || true
  for _ in $(seq 1 20); do pg_isready -q 2>/dev/null && break; sleep 0.5; done
fi

if command -v redis-server >/dev/null 2>&1 && ! redis-cli ping >/dev/null 2>&1; then
  echo "Starting Redis..."
  redis-server --daemonize yes >/dev/null 2>&1 || true
fi

# Provision the role and databases the default DATABASE_URL points at.
if pg_isready -q 2>/dev/null && command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='saveus'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "psql -c \"CREATE ROLE saveus LOGIN PASSWORD 'saveus' SUPERUSER;\"" >/dev/null 2>&1 || true
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='saveus'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "psql -c 'CREATE DATABASE saveus OWNER saveus;'" >/dev/null 2>&1 || true
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='saveus_test'\"" 2>/dev/null | grep -q 1 \
    || su postgres -c "psql -c 'CREATE DATABASE saveus_test OWNER saveus;'" >/dev/null 2>&1 || true
fi

pg_isready 2>/dev/null || echo "PostgreSQL is not running. Start it before pnpm db:seed."
