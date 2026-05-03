#!/bin/bash
# statusLine hook: постійний рядок внизу екрану з реальним % контексту.
# Формат: "📊 34% · 342K/1M"
# Тиха невдача якщо нема transcript_path / нема assistant.usage.

input=$(cat)

transcript_path=""
if command -v python3 >/dev/null 2>&1; then
  transcript_path=$(echo "$input" | python3 -c "import sys,json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(d.get('transcript_path') or '')
" 2>/dev/null)
fi

if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
  exit 0
fi

result=$(bash "$(dirname "$0")/lib/compute-context-pct.sh" "$transcript_path" 2>/dev/null)

if [[ -z "$result" ]]; then
  exit 0
fi

percent=$(echo "$result" | awk '{print $1}')
tokens=$(echo "$result" | awk '{print $2}')
tokens_k=$((tokens / 1000))

echo "📊 ${percent}% · ${tokens_k}K/1M"
