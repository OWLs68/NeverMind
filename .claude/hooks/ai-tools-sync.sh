#!/bin/bash
# ai-tools-sync.sh
# PostToolUse(Edit) hook: нагадує оновити docs/AI_TOOLS.md при зміні промптів/tools

input=$(cat)

file=""
if command -v python3 >/dev/null 2>&1; then
  file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path','') or d.get('file_path',''))" 2>/dev/null)
fi

if [[ -z "$file" ]]; then exit 0; fi

# Тригер — зміни у src/ai/prompts.js або src/ai/ui-tools.js
trigger=0
if [[ "$file" == *"/src/ai/prompts.js" ]]; then trigger=1; fi
if [[ "$file" == *"/src/ai/ui-tools.js" ]]; then trigger=1; fi

if [[ $trigger -eq 1 ]]; then
  cat <<EOF
📘 AI_TOOLS синхронізація: змінено $file

Якщо додав/змінив/видалив tool — онови:
1. docs/AI_TOOLS.md → таблиця tools (категорію, параметри)
2. docs/AI_TOOLS.md → секція "Історія змін" (дата + що саме)

Інакше довідник застаріє. Робити у тому ж коміті щоб не забути.
EOF
fi
