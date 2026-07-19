#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${PORT:-}" ]]; then
  PORT="${PORT}"
else
  PORT="$(( 5050 + (RANDOM % 1000) ))"
fi

# Run from backend folder so `node src/index.js` works.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting backend on port $PORT ..."
PORT="$PORT" node src/index.js &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Waiting for /health ..."
for _ in $(seq 1 80); do
  if curl -fsS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -fsS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  echo "Backend did not become ready in time." >&2
  exit 1
fi

echo "Calling POST /ask ..."
curl -sS -X POST "http://localhost:${PORT}/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "what is the father of economy?",
    "standard": 9,
    "subject": "Geography",
    "topK": 3
  }' \
  || true

echo
echo "Test done."

