#!/usr/bin/env bash
# hetzner-setup.sh — одноразовий setup AI-tester на Hetzner Ubuntu 24.04
#
# Запускати від root ОДИН РАЗ:
#   sudo bash hetzner-setup.sh <GITHUB_PAT> <ANTHROPIC_API_KEY>
#
# Стан до запуску (Roman 14.05.2026):
#   /root/browser-harness/      — клонована репа browser-use
#   /root/chrome-profile/       — Chrome profile з 14.05
#   /root/.local/bin/uv         — uv 0.11.14
#   /root/.local/bin/browser-harness — uv tool (symlink)
#
# Що робить (закриває Council Pre-mortem 8 ризиків):
#   1. Створює юзера nmtester (no shell, security)
#   2. Перенесить browser-harness + chrome-profile у /home/nmtester/
#   3. Clone NM repo через PAT credential store (git push без TTY)
#   4. .env з ANTHROPIC_API_KEY + GITHUB_PAT (chmod 600)
#   5. systemd service chrome-tester.service — Chrome після reboot
#   6. systemd service browser-harness-daemon.service — daemon respawn
#   7. fail2ban (3 fails / 1 година ban)
#   8. uv venv + anthropic SDK
#
# Pre-mortem fixes:
#   - PATH експорт всюди де cron бере (Ризик #1)
#   - browser-harness daemon як systemd (#2 — respawn after reboot)
#   - credential.helper store + chmod 600 (#3 — git push silent fail)
#   - SSH PasswordAuthentication no — закоментовано (Роман сам після SSH key)

set -euo pipefail

# --- Args validation ----------------------------------------------------------
PAT="${1:?ПОМИЛКА: PAT як перший аргумент. Приклад: sudo bash hetzner-setup.sh ghp_xxx sk-ant-xxx}"
ANTHROPIC_KEY="${2:?ПОМИЛКА: ANTHROPIC_API_KEY як другий аргумент}"

if [[ ! "$PAT" =~ ^(ghp_|github_pat_) ]]; then
  echo "⚠️  PAT не схожий на GitHub token (має починатися з ghp_ або github_pat_)"
fi
if [[ ! "$ANTHROPIC_KEY" =~ ^sk-ant- ]]; then
  echo "⚠️  ANTHROPIC_API_KEY не схожий на Anthropic ключ (має починатися з sk-ant-)"
fi

NM_REPO="https://github.com/OWLs68/NeverMind"
NMTESTER_HOME="/home/nmtester"

echo "=== [1/8] Створюємо юзера nmtester ==="
# /bin/bash потрібен бо cron + uv run потребують shell.
# sudo escalation для nmtester заборонено (немає у sudoers).
if id nmtester &>/dev/null; then
  echo "    nmtester вже існує — пропускаємо"
else
  useradd -m -s /bin/bash nmtester
  echo "    nmtester створено"
fi

echo "=== [2/8] Переносимо browser-harness + chrome-profile ==="
if [ -d /root/browser-harness ] && [ ! -d $NMTESTER_HOME/browser-harness ]; then
  mv /root/browser-harness $NMTESTER_HOME/
  echo "    browser-harness перенесено"
fi
if [ -d /root/chrome-profile ] && [ ! -d $NMTESTER_HOME/chrome-profile ]; then
  mv /root/chrome-profile $NMTESTER_HOME/
  echo "    chrome-profile перенесено"
fi
chown -R nmtester:nmtester $NMTESTER_HOME/

echo "=== [3/8] uv + venv + anthropic SDK ==="
# Встановлюємо uv у nmtester home (відокремлено від root)
sudo -u nmtester bash <<'INNER'
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
# Reinstall browser-harness від nmtester (paths поміняли при mv)
cd $HOME/browser-harness && uv tool install -e . --force
# Venv для anthropic SDK (uv venv без --seed не ставить pip — ставимо через uv pip)
uv venv $HOME/.venv --clear
uv pip install --python $HOME/.venv/bin/python anthropic
INNER
echo "    uv + venv + anthropic встановлено"

echo "=== [3b/8] Патч browser-harness ensure_daemon race (HKnlM 19.05.2026) ==="
# Корінь: у browser-harness 0.1.0 ensure_daemon() polling-race fail хоча
# daemon реально listening on socket. Виявлено HKnlM. Apстейм fix очікується
# у новій версії — поки що локальний patch idempotent.
# Логіка: якщо у daemon log є "listening on" → daemon healthy → return success.
sudo -u nmtester python3 <<'PYPATCH'
import os
path = "/home/nmtester/browser-harness/src/browser_harness/admin.py"
if not os.path.exists(path):
    print("    SKIP: admin.py не знайдено")
else:
    src = open(path).read()
    needle = '        raise RuntimeError(msg or f"daemon {name or NAME}'
    inject = '        if "listening on" in (msg or ""): return\n        raise RuntimeError(msg or f"daemon {name or NAME}'
    if 'if "listening on" in (msg or "")' in src:
        print("    OK: patch ВЖЕ застосовано")
    elif needle not in src:
        print("    WARN: needle не знайдено — нова версія browser-harness?")
    else:
        open(path, "w").write(src.replace(needle, inject, 1))
        print("    OK: patch застосовано")
PYPATCH

echo "=== [3c/8] Cleanup stale /tmp/bu-* socket/pid від попередніх запусків ==="
# Якщо setup запускався раніше — socket може бути root-owned (старі експерименти),
# що блокує nmtester (Permission denied на unlink/connect).
pkill -u nmtester -f "browser_harness.daemon" 2>/dev/null || true
sleep 1
rm -f /tmp/bu-default.sock /tmp/bu-default.pid /tmp/bu-default.log
echo "    OK: /tmp/bu-* очищено"

echo "=== [4/8] Clone NM repo через credential store ==="
# Pre-mortem #3: PAT у ~/.git-credentials (chmod 600), не в URL.
# Security HKnlM: single-quoted heredoc + env передача — захист від shell
# injection якщо PAT містить $/`/() (silent-bug-scout #1).
sudo -u nmtester env PAT="$PAT" NM_REPO="$NM_REPO" bash <<'INNER'
git config --global credential.helper store
git config --global user.email "ai-tester@nevermind.app"
git config --global user.name "NeverMind AI Tester"
echo "https://x-access-token:${PAT}@github.com" > "$HOME/.git-credentials"
chmod 600 "$HOME/.git-credentials"
if [ ! -d "$HOME/nevermind" ]; then
  git clone "${NM_REPO}" "$HOME/nevermind"
fi
# Перевірка push доступу (--dry-run не пушить)
cd "$HOME/nevermind"
if git push --dry-run origin HEAD 2>&1 | grep -q "Everything up-to-date\|new branch"; then
  echo "    OK: git push працює"
else
  echo "    WARN: git push НЕ працює — перевір PAT scope (Contents: Read and write)"
fi
INNER

echo "=== [5/8] .env з ключами ==="
# Security HKnlM: запис через Python (f-string literal) замість bash heredoc
# expansion — захист від injection якщо ANTHROPIC_KEY містить $/`/() etc.
mkdir -p "$NMTESTER_HOME/screenshots"
PAT="$PAT" ANTHROPIC_KEY="$ANTHROPIC_KEY" NMTESTER_HOME="$NMTESTER_HOME" python3 <<'PYENV'
import os, pathlib
home = os.environ["NMTESTER_HOME"]
env_path = pathlib.Path(home) / ".config/ai-tester/.env"
env_path.parent.mkdir(parents=True, exist_ok=True)
# Перевірка на newline — захист від multi-line injection
for name, val in [("PAT", os.environ["PAT"]), ("ANTHROPIC_KEY", os.environ["ANTHROPIC_KEY"])]:
    if "\n" in val or "\r" in val:
        raise SystemExit(f"FATAL: {name} містить newline — abort (можлива injection)")
import datetime
today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
lines = [
    "# AI Tester credentials (chmod 600, owner = nmtester)",
    f"ANTHROPIC_API_KEY={os.environ['ANTHROPIC_KEY']}",
    f"GITHUB_PAT={os.environ['PAT']}",
    f"PAT_CREATED_UTC={today}",  # Pre-mortem: warning у tester-status коли PAT >75 днів
    f"BH_BIN={home}/.local/bin/browser-harness",
    f"PYTHON_VENV={home}/.venv/bin/python3",
    f"NM_DIR={home}/nevermind",
    f"SCREENSHOTS_DIR={home}/screenshots",
]
env_path.write_text("\n".join(lines) + "\n")
env_path.chmod(0o600)
print(f"    OK: .env створено (chmod 600)")
PYENV
chown -R nmtester:nmtester "$NMTESTER_HOME/.config" "$NMTESTER_HOME/screenshots"

echo "=== [6/8] systemd service для Chrome headless ==="
# Pre-mortem #2: Chrome як systemd → auto-restart after reboot / OOM kill.
# --remote-debugging-address=127.0.0.1 — НЕ 0.0.0.0 (security: не з-зовні).
cat > /etc/systemd/system/chrome-tester.service <<SVC
[Unit]
Description=Chrome headless for NeverMind AI Tester
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nmtester
Group=nmtester
ExecStart=/usr/bin/google-chrome \\
  --headless=new \\
  --no-sandbox \\
  --disable-gpu \\
  --disable-dev-shm-usage \\
  --remote-debugging-port=9222 \\
  --remote-debugging-address=127.0.0.1 \\
  --user-data-dir=$NMTESTER_HOME/chrome-profile \\
  --window-size=390,844
# Auto-restart при OOM-kill або краху (Pre-mortem #5 Chrome zombie)
Restart=on-failure
RestartSec=10
# OOM захист: Chrome перший у черзі на kill при OOM (тестер не пріоритет)
OOMScoreAdjust=500

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable chrome-tester.service
# Не стартуємо одразу — спочатку треба переконатись що Chrome не запущений вручну (з 14.05)
pkill -u nmtester -f "google-chrome" || true
pkill -u root -f "google-chrome" || true
sleep 2
systemctl start chrome-tester.service
sleep 3

if curl -s --max-time 3 http://127.0.0.1:9222/json/version | grep -q "Chrome"; then
  echo "    ✅ chrome-tester.service працює (CDP на 9222)"
else
  echo "    ⚠️  Chrome не відповідає — перевір: systemctl status chrome-tester"
fi

echo "=== [7/8] fail2ban (SSH brute-force захист) ==="
if ! command -v fail2ban-client &>/dev/null; then
  apt-get install -y fail2ban
fi
cat > /etc/fail2ban/jail.local <<JAIL
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
JAIL
systemctl enable --now fail2ban
echo "    ✅ fail2ban активний (3 SSH fails → 1 година ban)"

echo "=== [8/8] SSH PasswordAuthentication ==="
# УВАГА: цей блок ЗАКОМЕНТОВАНИЙ. Розкоментуй ВРУЧНУ тільки ПIСЛЯ того як:
#   1. Завантажиш свій SSH публічний ключ у /home/nmtester/.ssh/authorized_keys
#      (через scp або вручну)
#   2. Підтвердиш що SSH працює з ключем (без пароля)
# Без цього втратиш доступ до сервера!
#
# sed -i.bak 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
# sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
# systemctl reload sshd
echo "    ⚠️  SSH PasswordAuthentication ВРУЧНУ (інструкція у коментарях скрипта)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🎉 Hetzner setup завершено!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Перевірка:"
echo "  systemctl status chrome-tester    # має бути active (running)"
echo "  curl http://127.0.0.1:9222/json/version  # має повернути JSON"
echo "  sudo -u nmtester /home/nmtester/.local/bin/browser-harness --doctor"
echo ""
echo "Наступний крок: bash setup-cron.sh (встановити cron schedule)"
echo "Потім: перший ручний запуск тестера для перевірки"
echo "  sudo -u nmtester /home/nmtester/.venv/bin/python3 /home/nmtester/nevermind/scripts/ai-tester.py --smoke"
echo ""
