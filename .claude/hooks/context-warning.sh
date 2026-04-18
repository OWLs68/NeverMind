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

# Пороги (можна міняти)
WARN_THRESHOLD=800000      # 80% від 1M
CRITICAL_THRESHOLD=900000  # 90% від 1M

# Форматуємо число у тисячах для читабельності
tokens_k=$((tokens / 1000))

if [[ $tokens -gt $CRITICAL_THRESHOLD ]]; then
  cat <<EOF
🚨 КОНТЕКСТ КРИТИЧНО ЗАПОВНЕНИЙ (~${tokens_k}K токенів / 1M, ~90%)

Час викликати /finish і починати новий чат. Auto-compaction (автоматичне стиснення старих повідомлень) почнеться близько 950K — Claude може втратити контекст і плутатись.

Точне значення: /context
EOF
elif [[ $tokens -gt $WARN_THRESHOLD ]]; then
  cat <<EOF
⚠️ КОНТЕКСТ ЗАПОВНЕНИЙ НА ~80% (~${tokens_k}K токенів / 1M)

Скоро доцільно завершувати сесію через /finish. Auto-compaction почнеться близько 950K.

Точне значення: /context
EOF
fi
