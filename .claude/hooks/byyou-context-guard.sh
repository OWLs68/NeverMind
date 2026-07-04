#!/bin/bash
# .claude/hooks/byyou-context-guard.sh
#
# Stop hook — запускається ПІСЛЯ кожного мого ходу.
# Під час АКТИВНОГО потоку /byyou: якщо контекст ≥75% — гучно попереджає, щоб
# робота не обірвалась посеред кроку і Роман не пропустив сигнал серед пульсів.
# Зʼявляється як «Stop hook feedback» (бачать і Claude, і Роман).
#
# Чому хук, а не «я сам звіряю /cc»: під час потоку між повідомленнями Романа
# context-warning.sh (UserPromptSubmit) НЕ спрацьовує, а дисципліна Claude на
# високому контексті деградує. Сторож не залежить від памʼяті Claude.
#
# Поза /byyou мовчить (звичайний context-warning.sh покриває ввід Романа).
# Створено: 23.06.2026 gfrvu5.

input=$(cat)
dir="$(dirname "$0")"
plan="$dir/../../_ai-tools/BYYOU_PLAN.md"

# Тільки під час АКТИВНОГО потоку (Статус: active). paused/done/idle → мовчимо.
[[ -f "$plan" ]] || exit 0
grep -qiE '^\*\*Статус:\*\*[[:space:]]*(🟢[[:space:]]*)?active' "$plan" || exit 0

# transcript_path зі stdin (той самий патерн що context-warning.sh)
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
[[ -n "$transcript_path" && -f "$transcript_path" ]] || exit 0

result=$(bash "$dir/lib/compute-context-pct.sh" "$transcript_path" 2>/dev/null)
[[ -n "$result" ]] || exit 0
percent=$(echo "$result" | awk '{print $1}')
tokens=$(echo "$result" | awk '{print $2}')
tokens_k=$((tokens / 1000))

THRESHOLD=75
SOFT=60   # P4-2 (26yz5s 04.07): рання підготовка handoff ДО деградації контексту
SOFT_FLAG="$dir/.byyou-handoff-warned"

if [[ "$percent" -ge "$THRESHOLD" ]]; then
  # exit 2 = БЛОКУЄ завершення ходу → Claude зобовʼязаний обробити (не тихо
  # згорнутись). stderr показується моделі. Розблокується коли Статус стане
  # paused (active-гейт вище перестане матчити). Це «loop що не дає зупинитись
  # тихо» (Anthropic harness practice) + чистий handoff через BYYOU_PLAN.
  {
    echo "🛑🛑🛑 КОНТЕКСТ ${percent}% (${tokens_k}K/1M) — /byyou ПОРА ЗУПИНИТИ 🛑🛑🛑"
    echo "Дія ПЕРЕД зупинкою (інакше цей блок повторюється):"
    echo "1) дозаповни BYYOU_PLAN.md «Де зупинились» ПОВНІСТЮ (це handoff для нового чату);"
    echo "2) постав Статус: paused;"
    echo "3) скажи Роману ОКРЕМИМ помітним 🛑-повідомленням (не в рядку пульсу), і зупинись."
    echo "Роман: відкрий НОВИЙ чат → «/byyou» → підхопить рівно з цього місця."
  } >&2
  exit 2
fi

# М'який діапазон 60-74%: попереджаємо ОДИН раз (прапорець) — щоб handoff
# «Де зупинились» писався ПОКИ контекст ще свіжий, а не вже деградованим на 75%.
# НЕ блокує (exit 0). Прапорець самоскидається коли контекст <60 (новий потік
# стартує низько) — тому наступний потік знову отримає своє одне попередження.
if [[ "$percent" -ge "$SOFT" ]]; then
  if [[ ! -f "$SOFT_FLAG" ]]; then
    touch "$SOFT_FLAG"
    {
      echo "⏳ КОНТЕКСТ ${percent}% (${tokens_k}K/1M) — /byyou наближається до стопу (75%)."
      echo "ЗАРАЗ (поки контекст свіжий, не на 75%): дозаповни BYYOU_PLAN.md «Де зупинились»"
      echo "як готовий handoff. Роботу НЕ зупиняй — просто тримай handoff актуальним щокроку."
      echo "Це одноразове нагадування; жорсткий стоп спрацює на 75%."
    } >&2
  fi
else
  # Контекст нижче м'якого порога → скидаємо прапорець (новий/свіжий потік).
  [[ -f "$SOFT_FLAG" ]] && rm -f "$SOFT_FLAG"
fi
exit 0
