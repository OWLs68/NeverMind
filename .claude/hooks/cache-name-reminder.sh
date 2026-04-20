#!/bin/bash
# cache-name-reminder.sh
# PostToolUse hook: нагадує оновити CACHE_NAME у sw.js при зміні коду

# JSON input через stdin
input=$(cat)

# Витягаємо file_path
file=""
if command -v python3 >/dev/null 2>&1; then
  file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path','') or d.get('file_path',''))" 2>/dev/null)
fi

# Якщо не знайшли шлях — тихо вийти
if [[ -z "$file" ]]; then exit 0; fi

# Тригеримось тільки на файли що впливають на PWA-кеш
trigger=0
if [[ "$file" == *"/src/"* && "$file" == *.js ]]; then trigger=1; fi
if [[ "$file" == *.css ]]; then trigger=1; fi
if [[ "$file" == *"/sw.js" ]]; then trigger=1; fi
if [[ "$file" == *"/index.html" ]]; then trigger=1; fi

if [[ $trigger -eq 1 ]]; then
  now=$(date +"%Y%m%d-%H%M")
  cat <<EOF
🔄 CACHE_NAME нагадування: змінено $file

Перед пушем онови CACHE_NAME у sw.js на: nm-$now

Формат: nm-YYYYMMDD-HHMM. Виняток: чисто .md або .claude/ — не чіпати.
EOF
fi
