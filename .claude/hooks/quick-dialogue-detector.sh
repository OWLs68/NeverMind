#!/bin/bash
# quick-dialogue-detector.sh
# UserPromptSubmit hook: детектує коли Роман у режимі швидкого діалогу
# і нагадує Claude дати коротку відповідь без преамбули.
#
# Тригери (хоча б один):
#   1. Поточне повідомлення ≤10 слів
#   2. Тригер-слова: "коротко", "швидко", "по суті", "конкретика", "без розжовування" тощо
#   3. Закрите питання: закінчується на "?" + ≤8 слів + без слів "чому/поясни/розкажи/порівняй"

input=$(cat)

prompt=""
if command -v python3 >/dev/null 2>&1; then
  prompt=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt',''))" 2>/dev/null)
fi
if [[ -z "$prompt" ]]; then
  prompt=$(echo "$input" | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[[ -z "$prompt" ]] && exit 0

prompt_clean=$(echo "$prompt" | tr -d '\r')
prompt_lower=$(echo "$prompt_clean" | tr '[:upper:]' '[:lower:]')

word_count=$(echo "$prompt_clean" | wc -w | tr -d ' ')

trigger=""

# Тригер 1: тригер-слова явні
for w in "коротко" "швидко" "по суті" "конкретика" "без розжовування" "без розмосолювання" "лише конкретика" "не розтягуй" "стисло" "тезово" "одним реченням"; do
  if [[ "$prompt_lower" == *"$w"* ]]; then
    trigger="слово: '$w'"
    break
  fi
done

# Тригер 2: дуже коротке повідомлення (≤10 слів)
if [[ -z "$trigger" && $word_count -le 10 && $word_count -ge 1 ]]; then
  # виключити випадки коли ≤10 слів І це відкрите питання що вимагає розгорнутої відповіді
  is_open=0
  for w in "чому" "поясни" "розкажи" "порівняй" "детально" "докладно" "проаналізуй"; do
    if [[ "$prompt_lower" == *"$w"* ]]; then
      is_open=1
      break
    fi
  done
  if [[ $is_open -eq 0 ]]; then
    trigger="коротке повідомлення ($word_count слів)"
  fi
fi

# Тригер 3: закрите питання (≤8 слів + закінчується на ?)
if [[ -z "$trigger" && "$prompt_clean" == *"?" && $word_count -le 8 ]]; then
  trigger="закрите питання"
fi

if [[ -n "$trigger" ]]; then
  cat <<EOF
⚡ ШВИДКИЙ ДІАЛОГ — режим увімкнено ($trigger)

ПРАВИЛА:
• Відповідь ≤3 рядки
• БЕЗ преамбули («Зрозумів / Прийнято / Записав / Окей»)
• БЕЗ резюме і повторів
• Тільки конкретика, варіанти або уточнююче питання
• Пояснення в дужках — тільки для реально нового коду (snake_case/camelCase назви функцій), не для загальних слів

ВИХІД З РЕЖИМУ — коли Роман задасть відкрите питання («чому / поясни / розкажи / порівняй / детально») або сам напише довгий контекст (>30 слів).
EOF
fi
