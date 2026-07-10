#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ".env"
  set +a
fi

PORT="${PORT:-3000}"
NGROK_BIN="${NGROK_BIN:-}"

if [ -z "$NGROK_BIN" ]; then
  if command -v ngrok >/dev/null 2>&1; then
    NGROK_BIN="ngrok"
  elif command -v ngrok.exe >/dev/null 2>&1; then
    NGROK_BIN="ngrok.exe"
  fi
fi

if [ -z "$NGROK_BIN" ]; then
  echo "ngrok command not found. Install ngrok first, then run this again." >&2
  exit 1
fi

if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  "$NGROK_BIN" config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
else
  echo "NGROK_AUTHTOKEN is empty in .env. Add your token before sharing externally." >&2
  exit 1
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

PORT="$PORT" npm start &
SERVER_PID="$!"

echo "App started at http://localhost:${PORT}"
echo "Starting ngrok tunnel..."

if [ -n "${NGROK_DOMAIN:-}" ]; then
  "$NGROK_BIN" http --domain="$NGROK_DOMAIN" "$PORT"
else
  "$NGROK_BIN" http "$PORT"
fi
