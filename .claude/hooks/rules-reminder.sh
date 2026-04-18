#!/bin/bash
# rules-reminder.sh
# UserPromptSubmit hook: нагадує Claude про ключові правила
# Спрацьовує: (а) кожне 5-те повідомлення, (б) коли Роман скаржиться на якість відповідей

# JSON input через stdin
input=$(cat)

# Витягаємо prompt юзера (через python3 якщо є, інакше grep)
prompt=""
if command -v python3 >/dev/null 2>&1; then
  prompt=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt',''))" 2>/dev/null)
fi
if [[ -z "$prompt" ]]; then
  # fallback: простий grep (не завжди надійний для складного JSON)
  prompt=$(echo "$input" | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Лічильник
COUNTER_FILE=".claude/hook-counter"
counter=0
if [[ -f "$COUNTER_FILE" ]]; then
  counter=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
fi
counter=$((counter + 1))
echo "$counter" > "$COUNTER_FILE"

# Тригер-слова (індикатори що Клод поламав правило)
trigger_match=""
prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')
for word in "простіше" "коротше" "не розумію" "довго" "технічно" "простирадло" "поясни як людині" "кілометров" "не читаю" "коротко" "скороти"; do
  if [[ "$prompt_lower" == *"$word"* ]]; then
    trigger_match="$word"
    break
  fi
done

# Спрацьовуємо якщо кожне 5-те АБО знайдено тригер
reason=""
if [[ -n "$trigger_match" ]]; then
  reason="тригер: '$trigger_match'"
elif [[ $((counter % 5)) -eq 0 ]]; then
  reason="кожне 5-те (#$counter)"
fi

if [[ -n "$reason" ]]; then
  cat <<EOF
📋 НАГАДУВАННЯ ПРАВИЛ CLAUDE.md ($reason):

📏 РОЗМІР — 5-15 рядків для звичайної відповіді. Не простирадла, не мікро-відмашка.
🎯 UI — описуй ЩО ЮЗЕР БАЧИТЬ на екрані, не назви функцій/класів/HEX-кодів.
🧠 ГЛИБИНА — перед оцінкою читай реальний код, не "на пам'ять".
🔒 БЕЗ "РОБИ" — не чіпати код. Тільки обговорення до явного "Роби".
⚙️ ВЕЛИКІ ФАЙЛИ — >250 рядків через skeleton+Edit. Checkpoint-коміти після кожної фази.

Самоперевірка ПЕРЕД надсиланням: чи є англ. слова без пояснень у дужках? Чи це ≤15 рядків? Чи описую ВИГЛЯД чи НАЗВИ?
EOF
fi
