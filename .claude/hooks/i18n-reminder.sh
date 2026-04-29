#!/bin/bash
# .claude/hooks/i18n-reminder.sh
#
# Створено: 29.04.2026 m4Q1o (Phase 4 i18n-інфраструктури).
# Мета: автоматично нагадувати Claude обгорнути українські рядки у t() коли
# Claude правлю файл у src/. Закриває урок №1 з UG1Fr — «декларативне правило
# без автоматичного контролю розкладається».
#
# Логіка:
#   - Тригериться через PostToolUse на Edit/Write
#   - Якщо змінений файл — *.js → викликає node scripts/check-i18n.js --report <file>
#   - Скрипт сам вирішує: чи у whitelist (тиха відсутність), чи показати кількість
#     необгорнутих з прикладами і командою --update-baseline.

file="$CLAUDE_TOOL_INPUT_FILE_PATH"

# Тільки JS-файли. Решту (md/css/json/sh) ігноруємо.
if [[ "$file" != *.js ]]; then
  exit 0
fi

# Файл має існувати (Edit/Write міг бути відмінений)
if [[ ! -f "$file" ]]; then
  exit 0
fi

# Викликаємо --report. Скрипт сам відфільтрує файли поза src/ і whitelist-директорії.
# stdout/stderr показуються Claude як hook output.
node scripts/check-i18n.js --report "$file" 2>&1 || true
