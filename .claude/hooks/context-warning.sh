#!/bin/bash
# context-warning.sh
# UserPromptSubmit hook: попереджає коли контекст наближається до ліміту.
# Те саме джерело цифри що statusline.sh — через lib/compute-context-pct.sh
# (assistant.message.usage у транскрипті, НЕ байти файлу).
# Стара версія брала wc -c і показувала «99%» при реальних 34% — фікс.

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

WARN_THRESHOLD=80
CRITICAL_THRESHOLD=90

if [[ $percent -gt $CRITICAL_THRESHOLD ]]; then
  cat <<EOF
🚨 КОНТЕКСТ КРИТИЧНО ЗАПОВНЕНИЙ (${percent}% · ${tokens_k}K/1M)

Час викликати /finish і починати новий чат. Auto-compaction (автоматичне стиснення старих повідомлень) почнеться близько 95% — Claude може втратити контекст.

Точне значення: /context
EOF
elif [[ $percent -gt $WARN_THRESHOLD ]]; then
  cat <<EOF
⚠️ КОНТЕКСТ ${percent}% (${tokens_k}K/1M)

Скоро доцільно завершувати сесію через /finish. Auto-compaction почнеться близько 95%.

Точне значення: /context
EOF
fi
