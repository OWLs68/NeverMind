#!/bin/bash
# context-warning.sh
# UserPromptSubmit hook: попереджає коли контекст наближається до ліміту
# Працює через читання transcript_path з JSON input і оцінку розміру у токенах

# JSON input через stdin
input=$(cat)

# Витягаємо transcript_path
transcript_path=""
if command -v python3 >/dev/null 2>&1; then
  transcript_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('transcript_path',''))" 2>/dev/null)
fi

# Якщо немає файлу — тихо вийти
if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
  exit 0
fi

# Рахуємо розмір файлу у байтах
bytes=$(wc -c < "$transcript_path" 2>/dev/null || echo 0)

# Апроксимація: transcript містить JSON metadata + текст
# Для суміші укр/англ з JSON-overhead: ~3.5 байта на токен
# Підкалібруємо порівнюючи з реальним /context (можна міняти BYTES_PER_TOKEN)
BYTES_PER_TOKEN=3
tokens=$((bytes / BYTES_PER_TOKEN))

# Пороги (калібровано під розширений режим 1M Opus 4.7 → ~1.6M реальний ліміт)
# 85% від 1.6M = 1,360,000 токенів
WARN_THRESHOLD=1200000      # ~75% від 1.6M — жовте попередження
CRITICAL_THRESHOLD=1360000  # ~85% від 1.6M — червоне критичне

# Форматуємо число у тисячах для читабельності
tokens_k=$((tokens / 1000))

if [[ $tokens -gt $CRITICAL_THRESHOLD ]]; then
  cat <<EOF

🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴
🚨 КОНТЕКСТ КРИТИЧНО ЗАПОВНЕНИЙ 🚨
🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴⚠️🔴

   ~${tokens_k}K токенів / 1.6M (~85%+)

⚡ ДІЯ: викликати /finish і починати новий чат.
   Auto-compaction (автоматичне стиснення старих
   повідомлень) — близько 1.5M. Claude може втратити
   контекст і плутатись.

📊 Точне значення: /context

EOF
elif [[ $tokens -gt $WARN_THRESHOLD ]]; then
  cat <<EOF

🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡
⚠️  КОНТЕКСТ ЗАПОВНЕНО НА ~75%+  ⚠️
🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡⚠️🟡

   ~${tokens_k}K токенів / 1.6M

💡 Скоро доцільно завершувати сесію через /finish.
   Критичний поріг — ~1.36M (85%).
   Auto-compaction — близько 1.5M.

📊 Точне значення: /context

EOF
fi
