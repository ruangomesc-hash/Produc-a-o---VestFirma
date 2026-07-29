#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  VestFirma Kanban"
echo "  ─────────────────────────────────────"
echo ""

if [ ! -d "node_modules" ]; then
  echo "Instalando dependências..."
  npm install || exit 1
fi

echo "Gerando site atualizado (build)..."
npm run build || exit 1

# Encerra preview antigo na mesma porta (evita versão velha em cache)
if command -v lsof >/dev/null 2>&1; then
  OLD_PID=$(lsof -ti:4199 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    echo "Encerrando servidor antigo na porta 4199..."
    kill $OLD_PID 2>/dev/null || true
    sleep 1
  fi
fi

URL="http://127.0.0.1:4199"
echo ""
echo "  Abra: $URL"
echo "  Se não mudou o visual: Cmd+Shift+R no navegador"
echo "  ⚠️  NÃO FECHE esta janela — se fechar, o site some do navegador."
echo ""

open "$URL" 2>/dev/null || true
npm run server
