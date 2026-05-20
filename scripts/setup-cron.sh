#!/usr/bin/env bash
# setup-cron.sh — встановити cron schedule для NM AI Tester
#
# Запускати ПIСЛЯ hetzner-setup.sh (від root):
#   sudo bash setup-cron.sh
#
# Стратегія: cron щогодини викликає ai-tester.py, який САМ перевіряє
# tester-config.schedule_per_day (3 = кожні 8 год). Це простіше за
# systemd .timer і легше дебажити (cron логи прозоріші).

set -euo pipefail

NMTESTER_HOME="/home/nmtester"
ENV_FILE="$NMTESTER_HOME/.config/ai-tester/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE не існує — запусти hetzner-setup.sh спочатку"
  exit 1
fi

# Pre-mortem #1: повні шляхи у crontab (PATH мінімальний у cron env)
PYTHON="$NMTESTER_HOME/.venv/bin/python3"
TESTER="$NMTESTER_HOME/nevermind/scripts/ai-tester.py"
HEALTH="$NMTESTER_HOME/nevermind/scripts/health-check.py"
LOG="$NMTESTER_HOME/cron.log"

# Crontab для nmtester (replace any existing)
crontab -u nmtester - <<CRONTAB
# Path explicit (cron env минимальний — Pre-mortem #1)
PATH=/home/nmtester/.local/bin:/usr/local/bin:/usr/bin:/bin
SHELL=/bin/bash

# === NeverMind AI Tester ===
# Cron щогодини, але tester-config.schedule_per_day обмежує реальний запуск.
# Logs у cron.log, ротація раз на тиждень.
0 * * * * $PYTHON $TESTER --smoke >> $LOG 2>&1

# === Health check + On-demand trigger watcher ===
# Кожну хвилину:
# - Chrome CDP + browser-harness daemon + disk + cleanup screenshots
# - Перевірити tester-trigger.json — якщо NM-Claude запитав on-demand → запустити ai-tester
# Latency on-demand: ~90 сек (cron 60s + git pull + ai-tester run).
# Якщо Chrome мертвий — systemd chrome-tester.service Restart=on-failure підхопить.
* * * * * $PYTHON $HEALTH >> $LOG 2>&1

# === Лог ротація ===
# Раз на тиждень обрізаємо cron.log до 1000 останніх рядків + chmod 600 (security).
0 4 * * 0 tail -1000 $LOG > ${LOG}.tmp && mv ${LOG}.tmp $LOG && chmod 600 $LOG
CRONTAB

# Security HKnlM: chmod 600 на cron.log щоб PAT/секрети у git stderr (якщо просочаться)
# не були видимі іншим юзерам системи (silent-bug-scout #3).
sudo -u nmtester touch "$LOG"
chmod 600 "$LOG"
chown nmtester:nmtester "$LOG"
echo "    OK: $LOG chmod 600 (security)"
echo ""

echo "Cron встановлено для nmtester:"
echo ""
crontab -u nmtester -l
echo ""
echo "Поточний UTC час: $(date -u)"
echo "Наступна година (0-та хвилина) = перший запуск smoke-test."
echo ""
echo "Перевірка:"
echo "  tail -f $LOG"
echo "  systemctl status cron"
echo ""
echo "Ручний запуск ЗАРАЗ (для перевірки що все працює):"
echo "  sudo -u nmtester $PYTHON $TESTER --smoke --force"
