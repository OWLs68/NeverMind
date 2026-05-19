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
        lines.append(f"  🗑 Cleanup: видалено {removed} screenshots старіших {MAX_AGE_DAYS}д")

    # Логуємо тільки якщо щось не OK або був cleanup — інакше spam у cron.log
    if not all_ok or removed:
        print("\n".join(lines))

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
