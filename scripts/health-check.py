#!/usr/bin/env python3
"""
health-check.py — watchdog для AI-tester інфраструктури.

Викликається cron'ом кожні 15 хв (setup-cron.sh).
Перевіряє:
  - Chrome CDP на 9222 відповідає
  - browser-harness daemon живий
  - Диск /home/nmtester < 80%
  - Виконує cleanup старих screenshots

exit 0 = все OK (silent у cron)
exit 1 = щось не так → cron не reentr, але systemd restart chrome-tester
        автоматично спрацює якщо chrome-tester.service впав.

Pre-mortem #2: окремий health-check вирішує "browser-harness daemon не живе
після reboot" — systemd chrome-tester.service має Restart=on-failure, але
якщо процес "висить" без crash — systemd не побачить. Health-check бачить.
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

SCREENSHOTS_DIR = Path(os.environ.get("SCREENSHOTS_DIR", "/home/nmtester/screenshots"))
BH_BIN = os.environ.get("BH_BIN", "/home/nmtester/.local/bin/browser-harness")
NM_DIR = Path(os.environ.get("NM_DIR", "/home/nmtester/nevermind"))
PYTHON_VENV = os.environ.get("PYTHON_VENV", "/home/nmtester/.venv/bin/python3")
TESTER_SCRIPT = NM_DIR / "scripts/ai-tester.py"
TRIGGER_FILE = NM_DIR / "_ai-tools/tester-trigger.json"
STATUS_FILE = NM_DIR / "_ai-tools/tester-status.json"
MAX_AGE_DAYS = 7
DISK_THRESHOLD_PCT = 80


def check_chrome_cdp() -> tuple[bool, str]:
    """Chrome відповідає на CDP /json/version?"""
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=3) as r:
            data = json.loads(r.read())
            if "Browser" not in data:
                return False, "Chrome відповів, але не JSON Browser"
            return True, data["Browser"]
    except Exception as e:
        return False, f"Chrome CDP unreachable: {e}"


def check_browser_harness() -> tuple[bool, str]:
    """browser-harness CLI живий?"""
    try:
        r = subprocess.run(
            [BH_BIN], input='import json; print(json.dumps({"ok": True}))',
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode != 0:
            return False, f"browser-harness exit {r.returncode}: {r.stderr[:100]}"
        last = [l for l in r.stdout.splitlines() if l.strip()][-1]
        result = json.loads(last)
        if result.get("ok") is True:
            return True, "OK"
        return False, "browser-harness returned wrong result"
    except Exception as e:
        return False, f"browser-harness fail: {e}"


def check_disk() -> tuple[bool, str]:
    """Диск /home/nmtester < threshold%?"""
    total, used, free = shutil.disk_usage("/home/nmtester")
    pct = used / total * 100
    if pct > DISK_THRESHOLD_PCT:
        return False, f"Disk {pct:.0f}% used (threshold {DISK_THRESHOLD_PCT}%)"
    return True, f"Disk {pct:.0f}% used"


def check_on_demand_trigger() -> str:
    """On-demand trigger від NM-Claude (HKnlM 20.05.2026).

    NM-Claude під час сесії може робити commit + push у `tester-trigger.json`
    з новим `trigger_ts`. Health-check бачить його (на наступному cron-cycle),
    git pull → запускає ai-tester.py позачергово.

    Latency: ~60-90 секунд (cron interval + git pull + run).

    Returns:
        '' = no trigger (silent)
        'started' = trigger новий, ai-tester.py запущено асинхронно
        'skipped: <reason>' = trigger є але не новий або інше
    """
    # 1) Спочатку pull щоб бачити свіжий trigger.json (NM-Claude commit'нув)
    try:
        subprocess.run(
            ["git", "-C", str(NM_DIR), "fetch", "origin", "main"],
            check=False, capture_output=True, timeout=15,
        )
        subprocess.run(
            ["git", "-C", str(NM_DIR), "reset", "--hard", "origin/main"],
            check=False, capture_output=True, timeout=10,
        )
    except Exception:
        return "skipped: git fetch failed"

    if not TRIGGER_FILE.exists():
        return ""

    try:
        trigger = json.loads(TRIGGER_FILE.read_text())
    except Exception as e:
        return f"skipped: trigger malformed ({e})"

    trigger_ts = trigger.get("trigger_ts")
    if not trigger_ts:
        return "skipped: trigger без trigger_ts"

    # Порівняти з last_run_utc у status — якщо вже виконували → skip
    last_run = ""
    if STATUS_FILE.exists():
        try:
            status = json.loads(STATUS_FILE.read_text())
            last_run = status.get("last_run_utc", "")
        except Exception:
            pass

    # trigger новий якщо trigger_ts > last_run_utc (лексикографічне порівняння
    # ISO-8601 з Z-суфіксом коректне).
    if trigger_ts <= last_run:
        return ""  # silent — вже виконали

    # Trigger новий → запустити ai-tester (асинхронно, ми не чекаємо результат)
    target = trigger.get("target_scenarios", [])
    env = os.environ.copy()
    if target:
        env["TARGET_SCENARIOS"] = ",".join(target)

    try:
        subprocess.Popen(
            [PYTHON_VENV, str(TESTER_SCRIPT), "--smoke", "--force"],
            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return f"started (ts={trigger_ts}, target={target or 'all-active'})"
    except Exception as e:
        return f"skipped: subprocess fail ({e})"


def cleanup_screenshots() -> int:
    """Видалити screenshots старіші MAX_AGE_DAYS. Returns count видалених."""
    if not SCREENSHOTS_DIR.exists():
        return 0
    cutoff = time.time() - MAX_AGE_DAYS * 86400
    removed = 0
    for f in SCREENSHOTS_DIR.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            try:
                f.unlink()
                removed += 1
            except Exception:
                pass
    return removed


def main():
    all_ok = True
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    lines = [f"[{timestamp}] health-check:"]

    for name, fn in [
        ("Chrome CDP", check_chrome_cdp),
        ("browser-harness", check_browser_harness),
        ("Disk", check_disk),
    ]:
        ok, msg = fn()
        lines.append(f"  {'✅' if ok else '❌'} {name}: {msg}")
        if not ok:
            all_ok = False

    removed = cleanup_screenshots()
    if removed:
        lines.append(f"  Cleanup: видалено {removed} screenshots старіших {MAX_AGE_DAYS}д")

    # On-demand trigger check (HKnlM)
    trigger_result = check_on_demand_trigger()
    if trigger_result and trigger_result.startswith("started"):
        lines.append(f"  TRIGGER: {trigger_result}")

    # Логуємо тільки якщо щось не OK / cleanup / trigger fired — інакше spam у cron.log
    if not all_ok or removed or trigger_result.startswith("started"):
        print("\n".join(lines))

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
