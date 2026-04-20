#!/bin/bash
# md-index-reminder.sh
# PostToolUse(Write) hook: нагадує додати новий .md файл у INDEX.md

input=$(cat)

# Витягаємо tool_name і file_path
tool_name=""
file=""
if command -v python3 >/dev/null 2>&1; then
  tool_name=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
  file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path','') or d.get('file_path',''))" 2>/dev/null)
fi

# Тригеримось ТІЛЬКИ на Write нового .md
if [[ "$tool_name" != "Write" ]]; then exit 0; fi
if [[ "$file" != *.md ]]; then exit 0; fi

# Пропустити файли які вже у індексі
case "$file" in
  *"/CLAUDE.md"|*"/README.md"|*"/START_HERE.md"|*"/ROADMAP.md"|*"/ROADMAP_DONE.md"|*"/NEVERMIND_BUGS.md"|*"/NEVERMIND_LOGIC.md"|*"/CONCEPTS_ACTIVE.md"|*"/lessons.md"|*"/РОМАН_ПРОФІЛЬ.md")
    exit 0 ;;
esac

cat <<EOF
📇 INDEX нагадування: створено новий файл $file

Не забудь додати його у:
1. _ai-tools/INDEX.md — семантичний індекс "куди йти за чим"
2. CLAUDE.md → секція "Карта документації"

Без цього файл загубиться у новій сесії — Claude не знатиме що він існує.
EOF
