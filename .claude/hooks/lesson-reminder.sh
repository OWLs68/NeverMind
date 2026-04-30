#!/bin/bash
# lesson-reminder.sh
# PostToolUse hook: після `git commit` з fix:/feat:/refactor: нагадує спитати Романа
# чи варто записати урок у lessons.md. Claude НЕ записує сам — спочатку перепитує.

input=$(cat)

cmd=""
if command -v python3 >/dev/null 2>&1; then
  cmd=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
fi

# Тригеримось тільки на git commit
if [[ "$cmd" != *"git commit"* ]]; then exit 0; fi

# Перевіряємо префікс коміт-повідомлення (fix/feat/refactor — потенційно урокові)
trigger=0
if echo "$cmd" | grep -qE '\-m[[:space:]]*["'\''"]?(fix|feat|refactor)'; then trigger=1; fi
if echo "$cmd" | grep -qE '(корінь|повторн|знову|вдруге|вкотре|граблі)'; then trigger=1; fi

if [[ $trigger -eq 0 ]]; then exit 0; fi

cat <<'EOF'
🧠 LESSON-REMINDER: щойно зробив коміт що може бути уроковим (fix/feat/refactor або згадка "корінь/повторне").

ПРАВИЛА запису у lessons.md:
- Тільки коли (а) граблі вдруге, (б) Роман сказав "я ж тобі казав", (в) патерн 3+ сесій.
- Одноразова помилка — НЕ пишемо.

ДІЯ: перш ніж писати у lessons.md — СПИТАЙ Романа коротко:
   "Це повторне? Записати урок у lessons.md? Якщо так — формула: помилка → причина → правило (1 рядок)"

Якщо Роман каже "ні" або "одноразово" — не пишемо.
Якщо "так" — Edit lessons.md, додаємо у відповідну секцію (патерни / анти-патерни / журнал рішень).
EOF
