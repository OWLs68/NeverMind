#!/bin/bash
# skill-triggers.sh
# UserPromptSubmit hook: детектує тригери скілів і слово "Роби"
# Працює паралельно з rules-reminder.sh (не замінює)

input=$(cat)

prompt=""
if command -v python3 >/dev/null 2>&1; then
  prompt=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prompt',''))" 2>/dev/null)
fi

if [[ -z "$prompt" ]]; then exit 0; fi

prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')
messages=()

# Тригери для скілів (з CLAUDE.md "Скіли — коли які спрацьовують")
if echo "$prompt_lower" | grep -qE "модалк|стиль|колір|фон|дизайн|анімаці"; then
  messages+=("🎨 ТРИГЕР СКІЛА /ux-ui — задача про UI/дизайн. Прочитай docs/DESIGN_SYSTEM.md + докрутити через скіл.")
fi
if echo "$prompt_lower" | grep -qE "промпт|галюцину|тон|особистіст|owl.*кажи|owl.*відповіда"; then
  messages+=("🧠 ТРИГЕР СКІЛА /prompt-engineer — задача про промпт OWL. Правити у src/ai/prompts.js, не core.js.")
fi
if echo "$prompt_lower" | grep -qE "ios|pwa|safari|bfcache|iphone.*не працю|не оновлю"; then
  messages+=("📱 ТРИГЕР СКІЛА /pwa-ios-fix — iOS/PWA баг. Читай чеклист скіла.")
fi
if echo "$prompt_lower" | grep -qE "рефакторинг|розбити файл|розділити файл"; then
  messages+=("♻️ ТРИГЕР СКІЛА /refactor-large — рефакторинг великого файлу. Skeleton+Edit, checkpoint-коміти.")
fi
if echo "$prompt_lower" | grep -qE "supabase|backend|offline|синхронізаці"; then
  messages+=("☁️ ТРИГЕР СКІЛА /supabase-prep — Supabase тема. Читай скіл перед першими міграціями.")
fi

# Детекція "Роби" (окрема гілка)
# Перевіряємо слово роби як окреме слово, не частину іншого (наприклад "робимо")
if echo "$prompt_lower" | grep -qE "(^| )роби($|[,. !?])"; then
  messages+=("✅ ДОЗВІЛ НА КОД ОТРИМАНО — слово 'Роби' знайдено у повідомленні. Можна чіпати код без додаткових підтверджень (у межах саме цієї задачі).")
fi

# Виводимо тільки якщо щось знайшли
if [[ ${#messages[@]} -gt 0 ]]; then
  echo ""
  for msg in "${messages[@]}"; do
    echo "$msg"
  done
fi
