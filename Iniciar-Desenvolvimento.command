#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  npm install || exit 1
fi

echo "Desenvolvimento: http://127.0.0.1:5199"
echo "API local (porta 8787) — mantenha esta janela aberta."
echo ""

if command -v lsof >/dev/null 2>&1; then
  OLD_PID=$(lsof -ti:8787 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    kill $OLD_PID 2>/dev/null || true
    sleep 1
  fi
fi

npm run server:api &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

sleep 1
open "http://127.0.0.1:5199" 2>/dev/null || true
npm run dev
