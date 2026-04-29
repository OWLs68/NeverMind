#!/bin/bash
# .claude/hooks/show-violations.sh
#
# UserPromptSubmit hook: при кожному новому повідомленні Романа перевіряє
# чи є файл .claude/last-violations.txt (його записує check-response-violations.js
# у Stop-хуку якщо моє попереднє повідомлення містило порушення правила
# «пояснення в дужках»).
#
# Якщо файл існує — друкує його зміст (стає системним нагадуванням для мене)
# і видаляє файл (щоб не показувати повторно).
#
# Створено: 29.04.2026 m4Q1o.

VIOLATIONS_FILE=".claude/last-violations.txt"
ESTIMATE_WARNINGS_FILE=".claude/last-estimate-warnings.txt"

if [[ -f "$VIOLATIONS_FILE" ]]; then
  cat "$VIOLATIONS_FILE"
  rm -f "$VIOLATIONS_FILE"
fi

if [[ -f "$ESTIMATE_WARNINGS_FILE" ]]; then
  cat "$ESTIMATE_WARNINGS_FILE"
  rm -f "$ESTIMATE_WARNINGS_FILE"
fi
