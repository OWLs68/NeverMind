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

# iOS Safari ВІЗУАЛЬНІ симптоми — RULES_UI §5 30-сек чек ПЕРЕД CSS-патчем
# (myshu 11.05 — dyhJu Calendar 3 ітерації position:absolute false leads).
# Триггериться на симптомі БЕЗ явного «iOS» — щоб не пропустити коли Роман
# просто описує що бачить на телефоні («модалка скаче», «верх ходить»).
if echo "$prompt_lower" | grep -qE "не фіксується|не фіксуєтьcя|клипається|клипаєт|клипає|не реагує на тап|мерехтить|мерехтит|стрибає|стискається|обрізається|глючит|верх ходит|низ ходит"; then
  messages+=("🚨 iOS SAFARI ВІЗУАЛЬНИЙ БАГ (RULES_UI §5) — ОБОВ'ЯЗКОВО 30-сек чек ПЕРЕД першим CSS-патчем:
  1) grep ':active|:focus|:hover' style.css на universal selectors ([onclick], button, *)
  2) grep 'backdrop-filter' style.css + перевір parent ланцюжок (nested blur clip)
  3) Composite layers: чи parent має transform/backdrop-filter/filter (клипає absolute дітей)
Кейси false leads: Settings scale (4 ітерації), Chips clipping (4 ітерації), dyhJu Calendar (3 ітерації position:absolute). Не повторюй.")
fi
if echo "$prompt_lower" | grep -qE "рефакторинг|розбити файл|розділити файл"; then
  messages+=("♻️ ТРИГЕР СКІЛА /refactor-large — рефакторинг великого файлу. Skeleton+Edit, checkpoint-коміти.")
fi
if echo "$prompt_lower" | grep -qE "supabase|backend|offline|синхронізаці"; then
  messages+=("☁️ ТРИГЕР СКІЛА /supabase-prep — Supabase тема. Читай скіл перед першими міграціями.")
fi

# nliW8 13.05: тригери на «системно vs латки» — Roman повторює ці фрази
# регулярно щоб зупинити мене перед поверхневим фіксом. Інжектимо 3 питання
# перед першим Edit щоб я думав ширше до коду.
if echo "$prompt_lower" | grep -qE "ніяких латок|не латкою|копай глибше|дивись широко|дивись ширше|дивись глибше|системно( |$)|латка|перевір уважно|не поспішай|фундамент"; then
  messages+=("🛑 ПЕРЕД ФIКСОМ — 3 ПИТАННЯ (системно, не латка):
  1. Це поламано в 1 місці чи у кількох (подібний код в інших файлах)?
  2. Чи моє рішення закриває корінь чи лише ховає симптом?
  3. Чи код повторюється у 2+ файлах (DRY)?
Якщо хоча б 1 «можливо» → Council 2-3 паралельні агенти ПЕРЕД першим Edit. Не лізти у код одразу.")
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
