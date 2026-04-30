#!/bin/bash
# lesson-reminder.sh + testing-reminder
# PostToolUse hook: після `git commit` нагадує:
#   1) для fix:/feat:/refactor: — чи варто записати УРОК у lessons.md
#   2) для feat: (нова фіча/функціонал) — додати ТЕСТ у TESTING_LOG.md
# Claude НЕ записує сам — спочатку додає у TESTING_LOG автоматично; для уроків питає.

input=$(cat)

cmd=""
if command -v python3 >/dev/null 2>&1; then
  cmd=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
fi

# Тригеримось тільки на git commit
if [[ "$cmd" != *"git commit"* ]]; then exit 0; fi

# === Lesson-trigger (fix/feat/refactor + слова коріня) ===
lesson_trigger=0
if echo "$cmd" | grep -qE '\-m[[:space:]]*["'\''"]?(fix|feat|refactor)'; then lesson_trigger=1; fi
if echo "$cmd" | grep -qE '(корінь|повторн|знову|вдруге|вкотре|граблі)'; then lesson_trigger=1; fi

# === Testing-trigger (feat: — нова фіча яку треба перевірити на iPhone) ===
testing_trigger=0
if echo "$cmd" | grep -qE '\-m[[:space:]]*["'\''"]?feat'; then testing_trigger=1; fi
# Перевірка чи коміт чіпає src/ (UI/функціонал) — git diff HEAD~1..HEAD
if [[ $testing_trigger -eq 1 ]]; then
  changed_src=$(git -C "$(dirname "$0")/../.." diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E '^(src/|index\.html|style\.css)' | head -3)
  if [[ -z "$changed_src" ]]; then testing_trigger=0; fi
fi

# Якщо жодного тригера — мовчимо
if [[ $lesson_trigger -eq 0 && $testing_trigger -eq 0 ]]; then exit 0; fi

if [[ $testing_trigger -eq 1 ]]; then
  cat <<'EOF'
🧪 TESTING_LOG REMINDER: щойно зафіксована фіча яка чіпає UI/функціонал (feat: + src/).

ОБОВʼЯЗКОВО ОДРАЗУ ДОДАЙ у TESTING_LOG.md секцію «⏳ Чекає тесту» (НЕ питай — додавай автоматично):
   - Який сценарій юзер має перевірити рукою на iPhone (тап / свайп / введення / перехід)
   - Що має бути «правильно» (якщо успіх) і що «зламано» (якщо ні)
   - Версію (з cache_name або deploy log) + дату

Без запису → завтра забудеться. Це правило закону, не побажання.
EOF
fi

if [[ $lesson_trigger -eq 1 ]]; then
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
fi
