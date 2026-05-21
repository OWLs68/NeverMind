#!/usr/bin/env python3
"""
ai-tester.py — NeverMind AI Tester (Hetzner brain)

Контракт: _ai-tools/AI_TESTER_INTEGRATION.md
Реалізує: 10 готових сценаріїв + natural-language команди з tester-commands.md.

Запуск (з cron або вручну):
    /home/nmtester/.venv/bin/python3 ai-tester.py --smoke      # 10 сценаріїв
    /home/nmtester/.venv/bin/python3 ai-tester.py --full       # + LLM команди
    /home/nmtester/.venv/bin/python3 ai-tester.py --cmd "X"    # 1 LLM-команда (тест)

Council Pre-mortem fixes у коді:
  #1 PATH у cron      — повні шляхи з .env
  #2 daemon respawn   — systemd handles, тестер просто перевіряє CDP alive
  #3 git push silent  — check returncode + log_fail
  #4 model mismatch   — guard на ai_provider
  #5 Chrome zombie    — finally: НЕ kill Chrome (systemd керує). Закриваємо CDP sessions.
  #6 selector break   — fail_reason типізовано (SELECTOR_STALE / ASSERTION_FAIL)
  #7 git conflict     — окрема branch claude/ai-tester-{ts} + retry pull
  #8 disk             — cleanup screenshots старіше 7 днів у кінці запуску
"""
import argparse
import datetime
import fcntl
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# --- Config / shared state ----------------------------------------------------
ENV_FILE = Path("/home/nmtester/.config/ai-tester/.env")
TESTER_VERSION = "0.2.0-HKnlM-20.05.2026"
NEVERMIND_URL = "https://owls68.github.io/NeverMind/"
MAX_SCREENSHOTS_AGE_DAYS = 7
LOCK_PATH = "/tmp/nm-tester.lock"
PAT_EXPIRATION_WARN_DAYS = 15  # попередження якщо PAT створено >75 днів тому (90-day TTL)


def _now_utc() -> "datetime.datetime":
    """tz-aware UTC datetime — заміна deprecated datetime.utcnow() (Python 3.12+)."""
    import datetime as _dt
    return _dt.datetime.now(_dt.timezone.utc)


def _now_iso_z() -> str:
    """ISO-8601 з Z-суфіксом (NM-Claude чекає формат '...Z')."""
    return _now_utc().isoformat().replace("+00:00", "Z")


def acquire_lock_or_exit():
    """flock щоб cron-запуск + manual --force одночасно не ламали Chrome state.
    Pre-mortem silent-bug-scout #2: два tester instance =
    CDP session conflict + status counter loss + git checkout race.
    """
    fd = open(LOCK_PATH, "w")
    try:
        fcntl.flock(fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        fd.write(str(os.getpid()))
        fd.flush()
        return fd  # тримати відкритим до завершення процесу
    except BlockingIOError:
        print("[SKIP] інший AI-tester instance вже працює (flock)")
        sys.exit(0)


def load_env():
    """Завантажити .env у os.environ (без python-dotenv — зайва залежність)."""
    if not ENV_FILE.exists():
        sys.exit(f"FATAL: {ENV_FILE} не існує. Запусти hetzner-setup.sh спочатку.")
    for line in ENV_FILE.read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


# --- Browser-harness CDP helper ----------------------------------------------
BH_BIN = None  # ініціалізується у load_env через os.environ

# Inline-helpers що додаються до КОЖНОГО payload — реальний API browser-harness
# має тільки: goto_url, js, fill_input, click_at_xy, wait, wait_for_element,
# capture_screenshot, list_tabs, switch_tab. Ми будуємо вищерівневі helpers
# через js() — щоб сценарії читалися як Playwright-style.
PAYLOAD_PRELUDE = """
import time as _t
import json as _json

# JS-click — browser-harness не має click(selector), емулюємо через DOM.
def click_sel(selector):
    js('document.querySelector(' + _json.dumps(selector) + ')?.click()')

# localStorage.getItem — повертає string або None.
def get_ls(key):
    return js('localStorage.getItem(' + _json.dumps(key) + ')')

# Polling expr → truthy. Raises RuntimeError якщо не дочекався.
def wait_for_js_expr(expr, timeout_s=5.0):
    deadline = _t.time() + timeout_s
    while _t.time() < deadline:
        try:
            if js(expr):
                return True
        except Exception:
            pass
        wait(0.2)
    raise RuntimeError('wait_for_js timeout: ' + expr[:80])

# Idempotent: window.onerror + unhandledrejection listeners. Викликати на старті
# КОЖНОГО сценарію — listener збережеться у tab до reload/navigate.
def inject_error_capture():
    js('(function(){if(window._jsErrors)return;window._jsErrors=[];'
       'window.addEventListener("error",function(e){window._jsErrors.push(String(e.message||e.error||"unknown"));});'
       'window.addEventListener("unhandledrejection",function(e){window._jsErrors.push("promise: "+String(e.reason));});'
       '})();')

# Список error messages зібраних inject_error_capture().
def get_console_errs():
    raw = js('JSON.stringify(window._jsErrors || [])')
    try:
        return _json.loads(raw or '[]')
    except Exception:
        return []
"""


def bh(code: str, timeout: int = 60) -> dict:
    """
    Виконати Python через browser-harness CDP.
    Автоматично додає PAYLOAD_PRELUDE (helpers).
    Останній рядок stdout = JSON результат.

    Raises RuntimeError при non-zero exit або empty stdout.
    """
    global BH_BIN
    if BH_BIN is None:
        BH_BIN = os.environ.get("BH_BIN", "/home/nmtester/.local/bin/browser-harness")

    full_code = PAYLOAD_PRELUDE + "\n" + code
    r = subprocess.run(
        [BH_BIN], input=full_code, capture_output=True,
        encoding="utf-8", timeout=timeout,  # explicit UTF-8 — locale у cron може бути ASCII
        env={**os.environ, "BU_CDP_URL": "http://127.0.0.1:9222"},
    )
    if r.returncode != 0:
        raise RuntimeError(f"bh exit {r.returncode}: {_mask_secrets(r.stderr.strip())[:2000]}")
    lines = [l.strip() for l in r.stdout.strip().splitlines() if l.strip()]
    if not lines:
        raise RuntimeError("bh returned empty output")
    # Беремо ОСТАННІЙ JSON-rядок (попередні можуть бути логами browser-harness)
    for line in reversed(lines):
        if line.startswith("{") or line.startswith("["):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    raise RuntimeError(f"bh: no JSON in output. Last line: {lines[-1][:200]}")


def screenshot(name: str) -> str:
    """
    Зберегти скрін локально на сервері. PHI НЕ йде у git (security e9t3N).
    Повертає лише шлях — щоб NM-Claude знав де шукати при дебагу.
    """
    shots_dir = Path(os.environ.get("SCREENSHOTS_DIR", "/home/nmtester/screenshots"))
    shots_dir.mkdir(parents=True, exist_ok=True)
    ts = _now_utc().strftime("%Y%m%d-%H%M%S")
    path = shots_dir / f"{name}-{ts}.png"
    # bh() exec'ується у browser-harness globals — capture_screenshot(path: str, full: bool=False).
    # str(path)!r дає чистий рядковий літерал замість PosixPath('...') (Path не у harness globals).
    try:
        bh(f"capture_screenshot({str(path)!r})\nprint(_json.dumps({{}}))")
    except Exception as e:
        # Коротке повідомлення — JSON у tester-status.json не повинен містити 500-char traceback.
        msg = str(e).splitlines()[0][:120]
        return f"[screenshot failed: {msg}]"
    return str(path)


# --- Config + scheduling ------------------------------------------------------
def get_nm_dir() -> Path:
    return Path(os.environ.get("NM_DIR", "/home/nmtester/nevermind"))


def read_config() -> dict:
    return json.loads((get_nm_dir() / "_ai-tools/tester-config.json").read_text())


def read_status() -> dict:
    p = get_nm_dir() / "_ai-tools/tester-status.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def check_schedule(cfg: dict, status: dict) -> bool:
    """True = час запускатись. Cron щогодини, але config обмежує."""
    if not cfg.get("enabled", False):
        print("[SKIP] tester-config.enabled = false")
        return False
    last = status.get("last_run_utc")
    if not last:
        return True  # перший запуск
    try:
        last_dt = datetime.datetime.fromisoformat(last.replace("Z", "+00:00"))
    except Exception:
        return True  # corrupt last_run → не блокуємо
    schedule_per_day = cfg.get("schedule_per_day", 3)
    interval_sec = 86400 / schedule_per_day
    elapsed = (datetime.datetime.now(datetime.timezone.utc) - last_dt).total_seconds()
    if elapsed < interval_sec:
        print(f"[SKIP] минуло {elapsed:.0f}с, інтервал {interval_sec:.0f}с")
        return False
    return True


def assert_provider(cfg: dict):
    """Pre-mortem #4: захист від model/provider mismatch."""
    model = cfg.get("ai_model", "")
    provider = cfg.get("ai_provider", "anthropic")
    if "claude" in model and provider != "anthropic":
        sys.exit(f"FATAL: model={model} але provider={provider}. Виправ tester-config.json")
    if "gpt" in model and provider != "openai":
        sys.exit(f"FATAL: model={model} але provider={provider}. Виправ tester-config.json")


# --- Git ops ------------------------------------------------------------------
def git(*args, check=True, timeout=30) -> subprocess.CompletedProcess:
    """Wrapper для git. Працює у NM repo директорії."""
    return subprocess.run(
        ["git", "-C", str(get_nm_dir())] + list(args),
        check=check, capture_output=True, text=True, timeout=timeout,
    )


def git_pull_safely():
    """Pull з main. Без TTY — не interactive. При конфлікті — abort + продовжуємо."""
    try:
        git("fetch", "origin", "main")
        git("checkout", "main")
        git("reset", "--hard", "origin/main")  # hard reset бо тестер не редагує main
        print("[OK] git pull main")
    except subprocess.CalledProcessError as e:
        print(f"[WARN] git pull failed: {e.stderr[:200]}")


def git_commit_push(passed: int, total: int) -> bool:
    """
    Pre-mortem #3 + #7: окрема гілка claude/ai-tester-{ts} → auto-merge workflow.
    Перевіряємо returncode явно — без silent fail.
    Returns True if push succeeded.
    """
    ts = _now_utc().strftime("%Y%m%d-%H%M%S")
    branch = f"claude/ai-tester-{ts}"
    try:
        # Стартуємо з origin/main щоб уникнути конфліктів
        git("checkout", "-b", branch, "origin/main")
        # ТIЛЬКИ _ai-tools/ — захист whitelist (тестер не чіпає код)
        git("add", "_ai-tools/")
        # Перевірка чи є зміни (інакше commit падає)
        diff = git("diff", "--cached", "--name-only", check=False)
        if not diff.stdout.strip():
            print("[SKIP] git: нічого комітити")
            return True
        git("commit", "-m", f"tester: {passed}/{total} pass · {ts}")
        git("push", "origin", branch)
        print(f"[OK] pushed to {branch}")
        return True
    except subprocess.CalledProcessError as e:
        # Pre-mortem #3: explicit fail logging
        # Security HKnlM: маскуємо PAT з git URL (x-access-token:TOKEN@github)
        # перед записом у tester-log.md та cron.log (silent-bug-scout #3).
        safe_stderr = _mask_secrets(e.stderr or "")
        log_path = get_nm_dir() / "_ai-tools/tester-log.md"
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"\n## GIT PUSH FAILED {ts}\n```\n{safe_stderr[:500]}\n```\n")
        print(f"[FAIL] git push: {safe_stderr[:300]}")
        return False


def _mask_secrets(text: str) -> str:
    """Маскує credentials у логах перед записом на диск.
    - x-access-token:TOKEN@github.com → x-access-token:***@github.com
    - github_pat_XXX / ghp_XXX literal → github_pat_***
    - sk-ant-api03-XXX → sk-ant-api03-***
    """
    text = re.sub(r"x-access-token:[^@\s]+@", "x-access-token:***@", text)
    text = re.sub(r"\b(github_pat_|ghp_|ghs_|gho_|ghu_)[A-Za-z0-9_]{20,}", r"\1***", text)
    text = re.sub(r"\b(sk-ant-[a-z0-9-]+-)[A-Za-z0-9_-]{20,}", r"\1***", text)
    return text


# --- Status + log writers -----------------------------------------------------
def write_status(cfg: dict, prev_status: dict, results: list):
    """Перезаписати tester-status.json."""
    passed = sum(1 for r in results if r["passed"])
    failed = len(results) - passed
    failures = [
        {
            "test_name": r["name"],
            "fail_reason": r.get("reason", "")[:1500],
            "category": r.get("category", "smoke"),
            "ts_utc": r.get("ts_utc"),
            "screenshot_path": r.get("screenshot_path"),
        }
        for r in results if not r["passed"]
    ][-5:]  # max 5

    # Інкремент денного лічильника (reset о півночі UTC)
    today = datetime.date.today().isoformat()
    prev_day = (prev_status.get("summary", {}) or {}).get("date_utc")
    if prev_day == today:
        total_runs = prev_status["summary"]["total_runs_today"] + 1
        passed_total = prev_status["summary"]["passed_today"] + passed
        failed_total = prev_status["summary"]["failed_today"] + failed
    else:
        total_runs, passed_total, failed_total = 1, passed, failed

    status = {
        "_comment": "Stamped by ai-tester.py. NM-Claude reads at /start.",
        "last_run_utc": _now_iso_z(),
        "tester_version": TESTER_VERSION,
        "ai_tester_app_version": _read_app_version(),
        "summary": {
            "date_utc": today,
            "total_runs_today": total_runs,
            "passed_today": passed_total,
            "failed_today": failed_total,
            "openai_spent_today_usd": 0.0,
            "openai_budget_remaining_usd": cfg.get("daily_budget_usd", 2.0),
        },
        "last_failures": failures,
        "warnings": _collect_warnings(),
    }
    path = get_nm_dir() / "_ai-tools/tester-status.json"
    path.write_text(json.dumps(status, ensure_ascii=False, indent=2))


def _collect_warnings() -> list:
    """Попередження для NM-Claude /start (PAT expiration, browser errors)."""
    warnings = []
    # Pre-mortem #4: PAT expiration alert
    pat_created = os.environ.get("PAT_CREATED_UTC")
    if pat_created:
        try:
            import datetime as _dt
            created = _dt.datetime.fromisoformat(pat_created).replace(tzinfo=_dt.timezone.utc)
            age_days = (_now_utc() - created).days
            remaining = 90 - age_days  # GitHub fine-grained PAT default = 90 днів
            if remaining <= PAT_EXPIRATION_WARN_DAYS:
                warnings.append(
                    f"PAT_EXPIRES_SOON: GitHub PAT створено {age_days}д тому, "
                    f"залишилось ~{remaining}д. Перегенеруй у github.com/settings/personal-access-tokens"
                )
        except Exception:
            warnings.append(f"PAT_CREATED_UTC malformed: {pat_created}")
    # Production telemetry (Gemini рекомендація HKnlM): nm_error_log polling.
    # Замість Telegram (CORS+GDPR) — читаємо локальний логер NM з Chrome profile.
    warnings.extend(_collect_browser_errors())
    return warnings


def _collect_browser_errors() -> list:
    """Прочитати nm_error_log з Chrome profile localStorage → PHI-sanitized list[str].

    NM логер (B-185 fix у boot.js:1195) пише errors у nm_error_log. Тестер на cron-run
    зчитує останні 5 → sanitize (cyrillic >=3 chars, numbers >=4 digits) → push у
    tester-status.warnings[]. NM-Claude бачить на /start.

    Sanitization rationale: stack/context можуть містити PHI (health words, finance
    amounts). Беремо ТIЛЬКИ message + ts + type. Заміна cyrillic >=3 chars + numbers
    >=4 digits на ***. EU Compliance — error не залишає GitHub репо у plain text.
    """
    try:
        raw = bh(
            'errs = JSON.parse(localStorage.getItem("nm_error_log") || "[]");\n'
            'print(_json.dumps(errs[-5:] if len(errs) >= 5 else errs))',
            timeout=10,
        )
    except Exception:
        return []  # silent — не блокуємо tester. browser-harness daemon може бути closed.
    if not isinstance(raw, list):
        return []
    out = []
    for e in raw:
        if not isinstance(e, dict):
            continue
        ts = str(e.get("ts", "?"))[:19]
        etype = str(e.get("type", "error"))[:20]
        msg = str(e.get("message", ""))[:150]
        # PHI mask
        msg = re.sub(r"[Ѐ-ӿ]{3,}", "***", msg)  # cyrillic substring 3+ chars
        msg = re.sub(r"\d{4,}", "***", msg)  # numbers 4+ digits (phone/amounts)
        out.append(f"BROWSER_ERR[{ts}][{etype}]: {msg}")
    return out


def _read_app_version() -> str:
    """CACHE_NAME з sw.js — версія NM що тестуємо."""
    try:
        sw = (get_nm_dir() / "sw.js").read_text()
        m = re.search(r"CACHE_NAME\s*=\s*['\"]([^'\"]+)", sw)
        return m.group(1) if m else "unknown"
    except Exception:
        return "unknown"


def append_log(results: list):
    """Дописати у tester-log.md (append-only, ротація — cron weekly)."""
    log_path = get_nm_dir() / "_ai-tools/tester-log.md"
    ts = _now_utc().strftime("%Y-%m-%d %H:%M UTC")
    passed = sum(1 for r in results if r["passed"])
    lines = [f"\n## {ts} · v{_read_app_version()} · {passed}/{len(results)} pass\n"]
    for r in results:
        icon = "✅" if r["passed"] else "❌"
        lines.append(f"- {icon} `{r['name']}`: {r.get('reason', 'ok')}\n")
    with log_path.open("a", encoding="utf-8") as f:
        f.writelines(lines)


# --- 10 готових сценаріїв (GROUND_TRUTH з AI_TESTER_INTEGRATION.md) ----------
SCENARIOS = []


def scenario(category="smoke"):
    """Декоратор для реєстрації сценаріїв."""
    def wrap(fn):
        fn._category = category
        SCENARIOS.append(fn)
        return fn
    return wrap


def _result(name, passed, reason="ok", screenshot_path=None, category="smoke"):
    return {
        "name": name,
        "passed": passed,
        "reason": reason,
        "ts_utc": _now_iso_z(),
        "screenshot_path": screenshot_path,
        "category": category,
    }


@scenario("boot")
def test_1_boot_health():
    """Сценарій 1: сайт відкривається, OWL-табло видно, 0 console.error."""
    try:
        r = bh(f"""
goto_url({NEVERMIND_URL!r})
inject_error_capture()
try:
    wait_for_js_expr('window.NM_BOOT_DONE === true', timeout_s=10)
    booted = True
except Exception:
    booted = False
visible = js('!!document.querySelector("#owl-board")')
errs = get_console_errs()
print(_json.dumps({{"booted": booted, "visible": bool(visible), "errors": errs[:3]}}))
""")
        if not r["booted"]:
            return _result("test-1-boot-health", False, "BOOT_TIMEOUT: window.NM_BOOT_DONE не встановлено за 10с")
        if not r["visible"]:
            return _result("test-1-boot-health", False, "SELECTOR_STALE: #owl-board not found")
        if r["errors"]:
            return _result("test-1-boot-health", False, f"console.error: {r['errors'][:2]}")
        return _result("test-1-boot-health", True)
    except Exception as e:
        return _result("test-1-boot-health", False, f"EXCEPTION: {e}")


@scenario("nav")
def test_2_navigation_8_tabs():
    """Сценарій 2: перехід між 8 вкладками без console.error."""
    tabs = ["inbox", "tasks", "notes", "health", "finance", "evening", "me", "projects"]
    try:
        r = bh(f"""
inject_error_capture()
tabs = {tabs!r}
for tab in tabs:
    click_sel('[data-tab="' + tab + '"]')
    wait(0.4)
errs = get_console_errs()
print(_json.dumps({{"errors": errs[:5]}}))
""")
        if r["errors"]:
            return _result("test-2-navigation", False, f"errors: {r['errors']}")
        return _result("test-2-navigation", True)
    except Exception as e:
        return _result("test-2-navigation", False, f"EXCEPTION: {e}")


@scenario("crud")
def test_3_create_task_persistence():
    """Сценарій 3: створити задачу → reload → залишилася → CLEANUP (Pre-mortem #3).

    Унікальний title з timestamp щоб НЕ false-pass з минулих запусків
    (стара "Тестова задача AI" могла залишитись у nm_tasks). У кінці —
    видалити саме цю задачу через JS щоб localStorage не ріс.

    Ug2Jw debug: рясні diagnostics поля у JSON output щоб без SSH-скрінів
    бачити чому saveTask мовчить (HKnlM хвіст).
    """
    unique_title = f"AI-Tester {datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    title_js = json.dumps(unique_title)
    # КРИТИЧНО: усі JS string literals single-quote, CSS attr value без лапок
    # (button[data-fn=saveTask], не data-fn="saveTask") — інакше CDP JSON
    # serialization ламає escape (підтверджено Ug2Jw 04:18 SyntaxError).
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=tasks]')
wait(0.5)
click_sel('#prod-add-btn')
wait(0.8)
diag_pre = js("(function(){var i=document.getElementById('task-input-title');var btn=document.querySelector('button[data-fn=saveTask]');var ov=document.getElementById('task-overlay');return {input_exists:!!i,input_readonly:i?i.readOnly:null,input_visible:i?i.offsetParent!==null:null,save_btn_count:document.querySelectorAll('button[data-fn=saveTask]').length,overlay_visible:ov?getComputedStyle(ov).display!=='none':null,saveTask_fn_type:typeof window.saveTask,addTask_fn_type:typeof window.addTask,switchTab_fn_type:typeof window.switchTab,active_tab:document.querySelector('.tab-btn.active')?document.querySelector('.tab-btn.active').getAttribute('data-tab'):null};})()")
input_ready = diag_pre and diag_pre.get('input_exists') and not diag_pre.get('input_readonly') and diag_pre.get('input_visible')
before_raw = get_ls('nm_tasks') or '[]'
try:
    before_arr_pre = _json.loads(before_raw)
    before_count_pre = len(before_arr_pre) if isinstance(before_arr_pre,list) else -1
except Exception:
    before_count_pre = -1
if not input_ready:
    errs_pre = get_console_errs()[:3]
    err_log_raw = get_ls('nm_error_log') or '[]'
    try:
        err_log_pre = _json.loads(err_log_raw)
        err_log_tail_pre = err_log_pre[-3:] if isinstance(err_log_pre,list) else []
    except Exception:
        err_log_tail_pre = []
    print(_json.dumps({"step":"input_not_ready","diag_pre":diag_pre,"before_count":before_count_pre,"console_errors":errs_pre,"nm_error_log_tail":err_log_tail_pre}))
    raise SystemExit(0)
# Ug2Jw v3: fill_input browser-harness ПОДВОЮЄ chars (підтверджено run 04:35:
# input_val='AAII--TTeesstteerr...'). JS-direct value + dispatchEvent bypass.
js("(function(){var el=document.getElementById('task-input-title');el.value=`__TITLE_RAW__`;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return el.value;})()")
wait(0.2)
input_value = js("document.getElementById('task-input-title').value")
click_sel('button[data-fn=saveTask]')
wait(1.2)
before_raw = get_ls('nm_tasks') or '[]'
try:
    before_arr = _json.loads(before_raw)
    before_titles = [x.get('title','') for x in before_arr] if isinstance(before_arr,list) else []
except Exception:
    before_arr = []
    before_titles = []
title_in_before = __TITLE_PY__ in before_titles
errs_after_save = get_console_errs()[:5]
err_log_raw = get_ls('nm_error_log') or '[]'
try:
    err_log = _json.loads(err_log_raw)
    err_log_tail = err_log[-3:] if isinstance(err_log,list) else []
except Exception:
    err_log_tail = []
goto_url(__URL__)
wait(2.5)
inject_error_capture()
after_raw = get_ls('nm_tasks') or '[]'
try:
    after_arr = _json.loads(after_raw)
    after_titles = [x.get('title','') for x in after_arr] if isinstance(after_arr,list) else []
except Exception:
    after_arr = []
    after_titles = []
title_in_after = __TITLE_PY__ in after_titles
js("var __t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');localStorage.setItem('nm_tasks',JSON.stringify(__t.filter(function(x){return x.title!==`__TITLE_RAW__`;})));")
print(_json.dumps({
    "step":"complete",
    "diag_pre":diag_pre,
    "input_value_after_fill":input_value,
    "before_count":len(before_arr) if isinstance(before_arr,list) else -1,
    "after_count":len(after_arr) if isinstance(after_arr,list) else -1,
    "title_in_before":title_in_before,
    "title_in_after":title_in_after,
    "console_errors":errs_after_save,
    "nm_error_log_tail":err_log_tail,
}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__TITLE_REPR__", repr(unique_title))
    payload = payload.replace("__TITLE_PY__", repr(unique_title))
    # __TITLE_RAW__ — без лапок (вставляється у JS backtick template literal)
    payload = payload.replace("__TITLE_RAW__", unique_title)
    try:
        r = bh(payload, timeout=90)
        # Скорочений summary у reason — повний debug у JSON output (видно у cron.log)
        if r.get("step") == "input_not_ready":
            diag = r.get("diag_pre", {}) or {}
            return _result("test-3-create-task", False,
                f"INPUT_NOT_READY: input_exists={diag.get('input_exists')} readonly={diag.get('input_readonly')} visible={diag.get('input_visible')} saveTask_fn={diag.get('saveTask_fn_type')} errs={r.get('console_errors')}")
        if not r.get("title_in_before"):
            diag = r.get("diag_pre", {}) or {}
            return _result("test-3-create-task", False,
                f"NO_WRITE: input_val={r.get('input_value_after_fill')!r} save_btn={diag.get('save_btn_count')} saveTask_fn={diag.get('saveTask_fn_type')} before={r.get('before_count')} errs={r.get('console_errors')} log={r.get('nm_error_log_tail')}")
        if not r.get("title_in_after"):
            return _result("test-3-create-task", False,
                f"PERSISTENCE_FAIL: before_count={r.get('before_count')} after_count={r.get('after_count')} errs={r.get('console_errors')}")
        return _result("test-3-create-task", True)
    except Exception as e:
        return _result("test-3-create-task", False, f"EXCEPTION: {e}")


@scenario("crud")
def test_4_backup_create():
    """Сценарій 4 (OBErR fresh): створити backup → є у nm_backup_* → CLEANUP.

    Implementer: createFullBackupUI на <div data-action="call" data-fn="...">
    (НЕ <button>). Sync — wait(0.5) досить.
    Pre-mortem #3: cleanup щоб backup не накопичувались (max 3 у backup.js TTL).

    Ug2Jw debug: dump fn_types, return value, error_log, console errors.
    """
    # КРИТИЧНО: усі JS strings single-quote, NM_KEYS.data ключі через
    # JS variable assignment щоб уникнути escape проблем (Ug2Jw 04:18 урок).
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
# Ug2Jw v3: explicit cleanup nm_backup_* ДО seed — гіпотеза квоти
# (run 04:35: keys_b=3 → keys_a=0 — quota path видаляє і retry setItem fail).
seed_result = js("(function(){try{var removed=0;Object.keys(localStorage).filter(function(k){return k.indexOf('nm_backup_')===0;}).forEach(function(k){localStorage.removeItem(k);removed++;});localStorage.setItem('nm_settings','{}');localStorage.setItem('nm_tasks','[]');localStorage.setItem('nm_chat','{}');return {ok:true,backups_removed:removed,after_settings:localStorage.getItem('nm_settings'),after_tasks:localStorage.getItem('nm_tasks')};}catch(e){return {ok:false,err:String(e.message||e)};}})()")
wait(0.3)
diag = js("(function(){var keys=Object.keys(localStorage);var bk=keys.filter(function(k){return k.indexOf('nm_backup_')===0;});var nmK=window.NM_KEYS;var nmSet=localStorage.getItem('nm_settings');var nmTasks=localStorage.getItem('nm_tasks');return {createFullBackup_fn:typeof window.createFullBackup,createFullBackupUI_fn:typeof window.createFullBackupUI,createSelectiveBackup_fn:typeof window.createSelectiveBackup,NM_KEYS_present:!!nmK,NM_KEYS_data_len:nmK&&nmK.data?nmK.data.length:0,NM_KEYS_data_sample:nmK&&nmK.data?nmK.data.slice(0,3):null,nm_settings_value:nmSet,nm_settings_len:nmSet?nmSet.length:0,nm_tasks_value:nmTasks,nm_tasks_len:nmTasks?nmTasks.length:0,backup_keys_before:bk,ls_total_keys:keys.length,ls_all_keys:keys.slice(0,15),ls_size_kb:Math.round(JSON.stringify(localStorage).length/1024),boot_done:typeof window.bootApp,delegation_ready:typeof window.initDelegation};})()")
call_result = js("(function(){try{if(typeof window.createFullBackupUI!=='function')return {ok:false,err:'NO_FN',fn_type:typeof window.createFullBackupUI};var nmK=window.NM_KEYS;var keys_arg=nmK?[].concat(nmK.data||[],nmK.settings||[],nmK.chat||[]):['nm_tasks','nm_settings'];var snapshot={};var hasData=false;keys_arg.forEach(function(k){if(typeof k!=='string'||!k.startsWith('nm_'))return;if(k.startsWith('nm_backup_'))return;var v=localStorage.getItem(k);if(v!==null){snapshot[k]=v;hasData=true;}});var keys_b4=Object.keys(localStorage).filter(function(k){return k.indexOf('nm_backup_')===0;}).length;var r=window.createFullBackupUI();var keys_af=Object.keys(localStorage).filter(function(k){return k.indexOf('nm_backup_')===0;}).length;return {ok:true,return_val:r===undefined?'undefined':String(r),keys_arg_count:keys_arg.length,snapshot_keys_count:Object.keys(snapshot).length,snapshot_keys_sample:Object.keys(snapshot).slice(0,8),hasData:hasData,keys_b4_call:keys_b4,keys_af_call:keys_af};}catch(e){return {ok:false,err:String(e.message||e),stack:String(e.stack||'').substring(0,300)};}})()")
wait(0.8)
after_keys_raw = js("JSON.stringify(Object.keys(localStorage).filter(function(k){return k.indexOf('nm_backup_')===0;}))")
try:
    after_keys = _json.loads(after_keys_raw) if after_keys_raw else []
except Exception:
    after_keys = []
errs = get_console_errs()[:5]
err_log_raw = get_ls('nm_error_log') or '[]'
try:
    err_log = _json.loads(err_log_raw)
    err_log_tail = err_log[-3:] if isinstance(err_log,list) else []
except Exception:
    err_log_tail = []
before_keys = diag.get('backup_keys_before',[]) if isinstance(diag,dict) else []
print(_json.dumps({
    "seed_result":seed_result,
    "diag":diag,
    "call_result":call_result,
    "backup_keys_after":after_keys,
    "delta":len(after_keys) - (len(before_keys) if isinstance(before_keys,list) else 0),
    "console_errors":errs,
    "nm_error_log_tail":err_log_tail,
}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    try:
        r = bh(payload, timeout=60)
        if r.get("delta", 0) < 1:
            diag = r.get("diag", {}) or {}
            call = r.get("call_result", {}) or {}
            seed = r.get("seed_result", {}) or {}
            return _result("test-4-backup-create", False,
                f"NO_BACKUP: seed_ok={seed.get('ok')} seed_backups_removed={seed.get('backups_removed')} call_ok={call.get('ok')} ret={call.get('return_val')} keys_arg={call.get('keys_arg_count')} snap_count={call.get('snapshot_keys_count')} snap_sample={call.get('snapshot_keys_sample')} hasData={call.get('hasData')} b4_call={call.get('keys_b4_call')} af_call={call.get('keys_af_call')} err={call.get('err')} NM_KEYS_data_len={diag.get('NM_KEYS_data_len')} settings_val={diag.get('nm_settings_value')!r} tasks_val={diag.get('nm_tasks_value')!r} ls_keys={diag.get('ls_total_keys')} ls_sample={diag.get('ls_all_keys')} ls_size_kb={diag.get('ls_size_kb')} keys_b={len(diag.get('backup_keys_before',[]))} keys_a={len(r.get('backup_keys_after',[]))} errs={r.get('console_errors')} log={r.get('nm_error_log_tail')}")
        return _result("test-4-backup-create", True)
    except Exception as e:
        return _result("test-4-backup-create", False, f"EXCEPTION: {e}")


@scenario("crud")
def test_5_trash_restore():
    """Сценарій 5 (B-179): trash modal відкривається без console.error."""
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-tab="tasks"]')
wait(0.3)
click_sel('[data-action="open-settings"]')
wait(0.5)
click_sel('[data-fn="openTrashModal"]')
wait(0.8)
visible = js('(function(){var m=document.getElementById("trash-modal");return !!m && getComputedStyle(m).display!=="none";})()')
errs = get_console_errs()
print(_json.dumps({"modal_visible": bool(visible), "errors": errs[:2]}))
""")
        if not r["modal_visible"]:
            return _result("test-5-trash-restore", False, "SELECTOR_STALE: #trash-modal не відкрився")
        if r["errors"]:
            return _result("test-5-trash-restore", False, f"console.error: {r['errors']}")
        return _result("test-5-trash-restore", True)
    except Exception as e:
        return _result("test-5-trash-restore", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_6_owl_swipe():
    """Сценарій 6: вертикальний свайп OWL у Inbox → згортання. CDP Input.dispatchTouchEvent."""
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-tab="inbox"]')
wait(0.5)
# Знайти центр swipe-target через DOM
rect = js('(function(){var e=document.querySelector(\\'[data-swipe-detect][data-swipe-tab="inbox"]\\');if(!e)return null;var r=e.getBoundingClientRect();return [r.left+r.width/2, r.top+r.height/2];})()')
if not rect:
    print(_json.dumps({"collapsed": False, "errors": ["swipe target not found"]}))
else:
    x, y = int(rect[0]), int(rect[1])
    # Touch sequence: start → move up 60px → end
    cdp("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y,"id":1,"radiusX":1,"radiusY":1}])
    wait(0.05)
    cdp("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y-60,"id":1,"radiusX":1,"radiusY":1}])
    wait(0.05)
    cdp("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    wait(0.5)
    collapsed = js('(function(){var e=document.getElementById("owl-tab-collapsed-inbox");return !!e && getComputedStyle(e).display==="flex";})()')
    errs = get_console_errs()
    print(_json.dumps({"collapsed": bool(collapsed), "errors": errs[:2]}))
""")
        if not r["collapsed"]:
            return _result("test-6-owl-swipe", False, "OWL не згорнувся (touch-detect.js bug?)")
        return _result("test-6-owl-swipe", True)
    except Exception as e:
        return _result("test-6-owl-swipe", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_7_modal_close_backdrop():
    """Сценарій 7 (OBErR): close-backdrop pattern працює."""
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-action="open-settings"]')
wait(0.5)
opened = js('(function(){var e=document.getElementById("settings-overlay");return !!e && getComputedStyle(e).display!=="none";})()')
# Тап на backdrop (верхній лівий кут — гарантовано на overlay, не на content card)
click_at_xy(20, 100)
wait(0.5)
closed = js('(function(){var e=document.getElementById("settings-overlay");return !e || getComputedStyle(e).display==="none";})()')
print(_json.dumps({"opened": bool(opened), "closed_on_backdrop": bool(closed)}))
""")
        if not r["opened"]:
            return _result("test-7-modal-backdrop", False, "Settings не відкрилися")
        if not r["closed_on_backdrop"]:
            return _result("test-7-modal-backdrop", False, "close-backdrop НЕ працює (Pre-mortem ризик)")
        return _result("test-7-modal-backdrop", True)
    except Exception as e:
        return _result("test-7-modal-backdrop", False, f"EXCEPTION: {e}")


@scenario("smoke")
def test_8_clear_all_data_guards():
    """Сценарій 8: clearAllData кнопка наявна (B-184). НЕ виконуємо — це знищить тестові дані."""
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-action="open-settings"]')
wait(0.5)
btn_present = js('!!document.querySelector(\\'[data-fn="clearAllData"]\\')')
print(_json.dumps({"btn_present": bool(btn_present)}))
""")
        if not r["btn_present"]:
            return _result("test-8-clear-data", False, "SELECTOR_STALE: clearAllData кнопка зникла")
        return _result("test-8-clear-data", True)
    except Exception as e:
        return _result("test-8-clear-data", False, f"EXCEPTION: {e}")


@scenario("ai")
def test_9_inbox_finance_subcategory():
    """
    Сценарій 9 (B-180 regression): 'купив каву 50' → save_finance →
    subcategory у whitelist {Кафе, Ресторан, '', None}.

    Pre-mortem CRITICAL #1: попередня версія перевіряла «ЧИ Є amount=50»
    замість «ЧИ ДОДАВСЯ новий». Після першого PASS — завжди PASS навіть
    якщо AI мертвий. Фікс — before_count + after_count > before.
    Також cleanup — видалити доданий запис у кінці.
    """
    ALLOWED = {"Кафе", "Ресторан", "Доставка", "", None}
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-tab="inbox"]')
wait(0.5)
before_finance = _json.loads(get_ls('nm_finance') or '[]')
before_count = len(before_finance)
fill_input('#inbox-input', 'купив каву 50')
click_sel('button[data-fn="sendToAI"]')
# Чекаємо НОВИЙ запис (не існуючий старий) — Pre-mortem #1 fix
wait_for_js_expr("(JSON.parse(localStorage.getItem('nm_finance') || '[]')).length > " + str(before_count), timeout_s=25)
after_finance = _json.loads(get_ls('nm_finance') or '[]')
# Знайти ДОДАНИЙ запис — порівняння IDs не у before
before_ids = set(x.get('id') for x in before_finance)
new_records = [x for x in after_finance if x.get('id') not in before_ids and x.get('amount') == 50]
match = new_records[0] if new_records else None
# Cleanup — видалити саме цей запис
if match and match.get('id'):
    js('var __f=JSON.parse(localStorage.getItem("nm_finance")||"[]");localStorage.setItem("nm_finance",JSON.stringify(__f.filter(function(x){return x.id!==' + _json.dumps(match['id']) + ';})));')
print(_json.dumps({"match": match, "added": len(new_records)}))
""", timeout=45)
        match = r.get("match")
        if not match:
            return _result("test-9-inbox-finance", False,
                          f"ASSERTION_FAIL: AI не додав amount=50 (added={r.get('added',0)})")
        subcat = match.get("subcategory")
        if subcat not in ALLOWED:
            return _result("test-9-inbox-finance", False,
                          f"B-180 REGRESSION: AI вигадав subcategory='{subcat}'")
        return _result("test-9-inbox-finance", True, f"subcategory='{subcat}'")
    except Exception as e:
        return _result("test-9-inbox-finance", False, f"EXCEPTION: {e}")


@scenario("ai")
def test_10_inbox_task_classification():
    """
    Сценарій 10 (B-115 regression): 'поприбирати у кімнаті' → save_task,
    НЕ save_event (доконаний факт vs майбутня дія).

    Pre-mortem #3 cleanup: видалити саме доданий task (за title), щоб
    nm_tasks не ріс при cron-running.
    """
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-tab="inbox"]')
wait(0.5)
before_tasks_arr = _json.loads(get_ls('nm_tasks') or '[]')
before_tasks = len(before_tasks_arr)
before_event_ids = set(x.get('id') for x in _json.loads(get_ls('nm_events') or '[]'))
before_task_ids = set(x.get('id') for x in before_tasks_arr)
fill_input('#inbox-input', 'поприбирати у кімнаті')
click_sel('button[data-fn="sendToAI"]')
wait_for_js_expr("(JSON.parse(localStorage.getItem('nm_tasks') || '[]')).length > " + str(before_tasks), timeout_s=25)
after_tasks_arr = _json.loads(get_ls('nm_tasks') or '[]')
after_events_arr = _json.loads(get_ls('nm_events') or '[]')
new_task_ids = [x.get('id') for x in after_tasks_arr if x.get('id') not in before_task_ids]
new_event_ids = [x.get('id') for x in after_events_arr if x.get('id') not in before_event_ids]
# Cleanup нових записів
if new_task_ids:
    ids_js = _json.dumps(new_task_ids)
    js('var __t=JSON.parse(localStorage.getItem("nm_tasks")||"[]");var __ids=' + ids_js + ';localStorage.setItem("nm_tasks",JSON.stringify(__t.filter(function(x){return __ids.indexOf(x.id)===-1;})));')
if new_event_ids:
    ids_js = _json.dumps(new_event_ids)
    js('var __e=JSON.parse(localStorage.getItem("nm_events")||"[]");var __ids=' + ids_js + ';localStorage.setItem("nm_events",JSON.stringify(__e.filter(function(x){return __ids.indexOf(x.id)===-1;})));')
print(_json.dumps({"tasks_added": len(new_task_ids), "events_added": len(new_event_ids)}))
""", timeout=45)
        if r["events_added"] > 0:
            return _result("test-10-task-classify", False,
                          "B-115 REGRESSION: AI створив event замість task")
        if r["tasks_added"] < 1:
            return _result("test-10-task-classify", False, "ASSERTION_FAIL: task не створено")
        return _result("test-10-task-classify", True)
    except Exception as e:
        return _result("test-10-task-classify", False, f"EXCEPTION: {e}")


# === Batch 1 (Ug2Jw 21.05.2026) — Globals + Settings UI scenarios =============
# Per TESTER_SCENARIOS_PLAN.md — UI-first assertions (DOM visibility), не localStorage.

@scenario("ui")
def test_11_header_buttons():
    """Header має ⚙️ Settings + ? Help — обидві відкривають свої модалки на Inbox tab.

    UI-first: assertion на display:flex модалок, НЕ на localStorage. Виживає Supabase.
    """
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-tab=inbox]')
wait(0.4)
click_sel('[data-action=open-settings]')
wait(0.6)
settings_visible = js("(function(){var o=document.getElementById('settings-overlay');return !!o && getComputedStyle(o).display!=='none';})()")
click_sel('[data-action=close-backdrop][data-fn=closeSettings]')
wait(0.5)
settings_closed = js("(function(){var o=document.getElementById('settings-overlay');return !o || getComputedStyle(o).display==='none';})()")
click_sel('[data-action=open-help]')
wait(0.6)
help_visible = js("(function(){var o=document.getElementById('help-drawer-panel');return !!o && getComputedStyle(o).display!=='none' && getComputedStyle(o).transform!=='matrix(0, 0, 0, 0, 0, 0)';})()")
errs = get_console_errs()
print(_json.dumps({"settings_visible":bool(settings_visible),"settings_closed":bool(settings_closed),"help_visible":bool(help_visible),"errors":errs[:3]}))
""")
        if not r["settings_visible"]:
            return _result("test-11-header-buttons", False, f"SETTINGS_NOT_OPEN: errors={r.get('errors')}")
        if not r["settings_closed"]:
            return _result("test-11-header-buttons", False, "SETTINGS_NOT_CLOSED: backdrop tap не закрив модалку")
        if not r["help_visible"]:
            return _result("test-11-header-buttons", False, f"HELP_NOT_OPEN: errors={r.get('errors')}")
        if r["errors"]:
            return _result("test-11-header-buttons", False, f"console.error: {r['errors']}")
        return _result("test-11-header-buttons", True)
    except Exception as e:
        return _result("test-11-header-buttons", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_12_language_switch():
    """Settings → Мова → перемикач UK↔EN → перевір що nm_settings.lang оновлюється.

    Pre-mortem: не очищаємо state — повертаємо UK назад наприкінці.
    """
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-action=open-settings]')
wait(0.6)
lang_btns = js("(function(){var b=document.querySelectorAll('[data-action=set-language]');return Array.from(b).map(function(x){return x.getAttribute('data-lang')||x.textContent.trim();});})()")
click_sel('[data-action=set-language][data-lang=en]')
wait(0.4)
lang_after_en = js("(function(){try{var s=JSON.parse(localStorage.getItem('nm_settings')||'{}');return s.language||null;}catch(e){return 'ERR:'+e.message;}})()")
click_sel('[data-action=set-language][data-lang=uk]')
wait(0.4)
lang_after_uk = js("(function(){try{var s=JSON.parse(localStorage.getItem('nm_settings')||'{}');return s.language||null;}catch(e){return 'ERR:'+e.message;}})()")
errs = get_console_errs()
print(_json.dumps({"lang_btns":lang_btns,"lang_after_en":lang_after_en,"lang_after_uk":lang_after_uk,"errors":errs[:3]}))
""")
        if not r["lang_btns"] or len(r["lang_btns"]) < 2:
            return _result("test-12-language-switch", False, f"SELECTOR_STALE: language buttons не знайдено (found={r.get('lang_btns')})")
        if r["lang_after_en"] != "en":
            return _result("test-12-language-switch", False, f"EN_NOT_SET: nm_settings.lang={r['lang_after_en']!r}")
        if r["lang_after_uk"] != "uk":
            return _result("test-12-language-switch", False, f"UK_NOT_RESTORED: nm_settings.lang={r['lang_after_uk']!r}")
        if r["errors"]:
            return _result("test-12-language-switch", False, f"console.error: {r['errors']}")
        return _result("test-12-language-switch", True)
    except Exception as e:
        return _result("test-12-language-switch", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_13_legal_pages():
    """Settings → Юридична інформація → 3 модалки (Impressum / Privacy / Terms) open/close.

    Перевіряє що openImpressum/openPrivacyPolicy/openTerms коректно відкривають
    #legal-overlay з відповідним body. Передумова: EU Compliance pre-MVP (OBErR).
    """
    try:
        r = bh("""
inject_error_capture()
click_sel('[data-action=open-settings]')
wait(0.6)
click_sel('[data-fn=openImpressum]')
wait(0.5)
impressum_visible = js("(function(){var o=document.getElementById('legal-overlay');return !!o && getComputedStyle(o).display!=='none';})()")
impressum_body = js("(function(){var b=document.getElementById('legal-overlay-body');return b?(b.textContent||'').slice(0,100):null;})()")
click_sel('[data-fn=closeLegal]')
wait(0.4)
click_sel('[data-fn=openPrivacyPolicy]')
wait(0.5)
privacy_visible = js("(function(){var o=document.getElementById('legal-overlay');return !!o && getComputedStyle(o).display!=='none';})()")
click_sel('[data-fn=closeLegal]')
wait(0.4)
click_sel('[data-fn=openTerms]')
wait(0.5)
terms_visible = js("(function(){var o=document.getElementById('legal-overlay');return !!o && getComputedStyle(o).display!=='none';})()")
click_sel('[data-fn=closeLegal]')
wait(0.3)
final_closed = js("(function(){var o=document.getElementById('legal-overlay');return !o || getComputedStyle(o).display==='none';})()")
errs = get_console_errs()
print(_json.dumps({"impressum_visible":bool(impressum_visible),"impressum_body_sample":impressum_body,"privacy_visible":bool(privacy_visible),"terms_visible":bool(terms_visible),"final_closed":bool(final_closed),"errors":errs[:3]}))
""")
        if not r["impressum_visible"]:
            return _result("test-13-legal-pages", False, f"IMPRESSUM_NOT_OPEN body={r.get('impressum_body_sample')!r} errs={r.get('errors')}")
        if not r["privacy_visible"]:
            return _result("test-13-legal-pages", False, "PRIVACY_NOT_OPEN")
        if not r["terms_visible"]:
            return _result("test-13-legal-pages", False, "TERMS_NOT_OPEN")
        if not r["final_closed"]:
            return _result("test-13-legal-pages", False, "LEGAL_OVERLAY_STUCK_OPEN")
        if r["errors"]:
            return _result("test-13-legal-pages", False, f"console.error: {r['errors']}")
        return _result("test-13-legal-pages", True)
    except Exception as e:
        return _result("test-13-legal-pages", False, f"EXCEPTION: {e}")


# === Batch 2 (Ug2Jw 21.05.2026) — Inbox + Tasks UI scenarios ==================

@scenario("ui")
def test_14_inbox_chat_input():
    """Inbox → tap chat-bar → fill input → перевір що value у DOM (JS-direct, B-191 workaround).

    UI-only: НЕ send, лише input persistence у полі. Send потребує AI ключ.
    """
    test_text = "AI-Tester chat input " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=inbox]')
wait(0.4)
input_exists = js("(function(){var i=document.getElementById('inbox-input');return !!i && i.tagName==='TEXTAREA';})()")
js("(function(){var el=document.getElementById('inbox-input');el.focus();el.value=`__TEXT__`;el.dispatchEvent(new Event('input',{bubbles:true}));return el.value;})()")
wait(0.3)
value_after = js("document.getElementById('inbox-input').value")
chat_window_open = js("(function(){var w=document.getElementById('inbox-chat-window');return !!w && getComputedStyle(w).display!=='none';})()")
js("(function(){var el=document.getElementById('inbox-input');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));})()")
errs = get_console_errs()
print(_json.dumps({"input_exists":bool(input_exists),"value_after":value_after,"chat_window_open":bool(chat_window_open),"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__TEXT__", test_text)
    try:
        r = bh(payload, timeout=60)
        if not r["input_exists"]:
            return _result("test-14-inbox-chat-input", False, "SELECTOR_STALE: #inbox-input відсутній або не textarea")
        if r["value_after"] != test_text:
            return _result("test-14-inbox-chat-input", False, f"INPUT_VALUE_MISMATCH: expected={test_text!r} got={r['value_after']!r}")
        if r["errors"]:
            return _result("test-14-inbox-chat-input", False, f"console.error: {r['errors']}")
        return _result("test-14-inbox-chat-input", True)
    except Exception as e:
        return _result("test-14-inbox-chat-input", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_15_tasks_edit():
    """Створити задачу через UI → tap на картку → edit modal → змінити title → Save → новий title у списку.

    UI-first: assertion на DOM текст у списку, не localStorage.
    """
    orig_title = "AI-T Edit Orig " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    new_title = orig_title + " UPD"
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=tasks]')
wait(0.5)
click_sel('#prod-add-btn')
wait(0.8)
js("(function(){var el=document.getElementById('task-input-title');el.value=`__ORIG__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('button[data-fn=saveTask]')
wait(1.0)
created_id = js("(function(){var t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');var f=t.find(function(x){return x.title===`__ORIG__`;});return f?f.id:null;})()")
if not created_id:
    print(_json.dumps({"step":"create_failed","created_id":created_id}))
    raise SystemExit(0)
click_sel('[data-action=task-card-click][data-id="' + str(created_id) + '"]')
wait(0.6)
modal_title = js("(function(){var t=document.getElementById('task-modal-title');return t?t.textContent:null;})()")
input_value = js("document.getElementById('task-input-title').value")
js("(function(){var el=document.getElementById('task-input-title');el.value=`__NEW__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('button[data-fn=saveTask]')
wait(1.0)
list_has_new = js("(function(){var items=document.querySelectorAll('[id^=task-item-]');return Array.from(items).some(function(el){return (el.textContent||'').indexOf(`__NEW__`)>=0;});})()")
js("(function(){var t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');localStorage.setItem('nm_tasks',JSON.stringify(t.filter(function(x){return x.title!==`__NEW__` && x.title!==`__ORIG__`;})));})()")
errs = get_console_errs()
print(_json.dumps({"step":"complete","created_id":str(created_id),"modal_title":modal_title,"input_value":input_value,"list_has_new":bool(list_has_new),"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__ORIG__", orig_title)
    payload = payload.replace("__NEW__", new_title)
    try:
        r = bh(payload, timeout=90)
        if r.get("step") == "create_failed":
            return _result("test-15-tasks-edit", False, "CREATE_FAILED: задача не створилась перед edit (test_3 проблема?)")
        if r.get("modal_title") != "Редагувати задачу":
            return _result("test-15-tasks-edit", False, f"EDIT_MODAL_TITLE_WRONG: expected='Редагувати задачу' got={r.get('modal_title')!r}")
        if r.get("input_value") != orig_title:
            return _result("test-15-tasks-edit", False, f"EDIT_INPUT_NOT_PREFILLED: expected={orig_title!r} got={r.get('input_value')!r}")
        if not r.get("list_has_new"):
            return _result("test-15-tasks-edit", False, "LIST_NOT_UPDATED: новий title не зявився у списку Tasks")
        if r.get("errors"):
            return _result("test-15-tasks-edit", False, f"console.error: {r['errors']}")
        return _result("test-15-tasks-edit", True)
    except Exception as e:
        return _result("test-15-tasks-edit", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_16_tasks_steps_add():
    """Створити задачу → додати 3 кроки через addTaskStep → save → перевір steps у задачі.

    БЕЗ toggle (потребує touch-detect — нестабільно як test_6/7). Тільки add+persist.
    """
    title = "AI-T Steps " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=tasks]')
wait(0.5)
click_sel('#prod-add-btn')
wait(0.8)
js("(function(){var el=document.getElementById('task-input-title');el.value=`__TITLE__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
addStepFn_type = js("typeof window.addTaskStep")
js("(function(){var el=document.getElementById('task-step-input');el.value='Step 1';el.dispatchEvent(new Event('input',{bubbles:true}));if(window.addTaskStep)window.addTaskStep();})()")
wait(0.2)
js("(function(){var el=document.getElementById('task-step-input');el.value='Step 2';el.dispatchEvent(new Event('input',{bubbles:true}));if(window.addTaskStep)window.addTaskStep();})()")
wait(0.2)
js("(function(){var el=document.getElementById('task-step-input');el.value='Step 3';el.dispatchEvent(new Event('input',{bubbles:true}));if(window.addTaskStep)window.addTaskStep();})()")
wait(0.3)
steps_in_list = js("(function(){var list=document.getElementById('task-steps-list');return list?list.children.length:0;})()")
click_sel('button[data-fn=saveTask]')
wait(1.0)
saved_steps_count = js("(function(){var t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');var f=t.find(function(x){return x.title===`__TITLE__`;});return f&&f.steps?f.steps.length:-1;})()")
js("(function(){var t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');localStorage.setItem('nm_tasks',JSON.stringify(t.filter(function(x){return x.title!==`__TITLE__`;})));})()")
errs = get_console_errs()
print(_json.dumps({"addStepFn_type":addStepFn_type,"steps_in_modal":steps_in_list,"saved_steps_count":saved_steps_count,"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__TITLE__", title)
    try:
        r = bh(payload, timeout=90)
        if r.get("addStepFn_type") != "function":
            return _result("test-16-tasks-steps", False, f"addTaskStep_NOT_FN: type={r.get('addStepFn_type')}")
        if r.get("steps_in_modal") != 3:
            return _result("test-16-tasks-steps", False, f"STEPS_NOT_RENDERED: expected 3 children у task-steps-list, got {r.get('steps_in_modal')}")
        if r.get("saved_steps_count") != 3:
            return _result("test-16-tasks-steps", False, f"STEPS_NOT_SAVED: expected 3 у task.steps, got {r.get('saved_steps_count')}")
        if r.get("errors"):
            return _result("test-16-tasks-steps", False, f"console.error: {r['errors']}")
        return _result("test-16-tasks-steps", True)
    except Exception as e:
        return _result("test-16-tasks-steps", False, f"EXCEPTION: {e}")


# === Batch 3 (Ug2Jw 21.05.2026) — Notes + Habits UI scenarios =================

@scenario("ui")
def test_17_notes_add():
    """Notes → ➕ → fill textarea → Save → нотатка у списку (DOM assertion)."""
    text = "AI-T Note " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=notes]')
wait(0.5)
click_sel('[data-fn=openAddNote]')
wait(0.6)
modal_visible = js("(function(){var o=document.getElementById('note-modal');return !!o && getComputedStyle(o).display!=='none';})()")
js("(function(){var el=document.getElementById('note-input-text');el.value=`__TEXT__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('[data-fn=saveNote]')
wait(0.8)
modal_closed = js("(function(){var o=document.getElementById('note-modal');return !o || getComputedStyle(o).display==='none';})()")
note_in_list = js("(function(){return (document.body.textContent||'').indexOf(`__TEXT__`)>=0;})()")
js("(function(){var n=JSON.parse(localStorage.getItem('nm_notes')||'[]');localStorage.setItem('nm_notes',JSON.stringify(n.filter(function(x){return (x.text||x.body||'').indexOf(`__TEXT__`)===-1;})));})()")
errs = get_console_errs()
print(_json.dumps({"modal_visible":bool(modal_visible),"modal_closed":bool(modal_closed),"note_in_list":bool(note_in_list),"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__TEXT__", text)
    try:
        r = bh(payload, timeout=60)
        if not r["modal_visible"]:
            return _result("test-17-notes-add", False, "MODAL_NOT_OPEN: #note-modal не відкрилась")
        if not r["modal_closed"]:
            return _result("test-17-notes-add", False, "MODAL_NOT_CLOSED: після saveNote модалка залишилась")
        if not r["note_in_list"]:
            return _result("test-17-notes-add", False, f"NOTE_NOT_VISIBLE: текст {text!r} не з'явився у DOM")
        if r["errors"]:
            return _result("test-17-notes-add", False, f"console.error: {r['errors']}")
        return _result("test-17-notes-add", True)
    except Exception as e:
        return _result("test-17-notes-add", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_18_notes_view():
    """Створити нотатку → tap [data-action=open-note] → відкриває #note-view-modal (read-only).

    Виправлено Ug2Jw: open-note → openNoteView, не openEditNote. Edit flow окремий
    (через menu з view-modal) — covered separately якщо потрібно.
    """
    text = "AI-T View Note " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=notes]')
wait(0.5)
click_sel('[data-fn=openAddNote]')
wait(0.6)
js("(function(){var el=document.getElementById('note-input-text');el.value=`__TEXT__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('[data-fn=saveNote]')
wait(0.8)
note_id = js("(function(){var n=JSON.parse(localStorage.getItem('nm_notes')||'[]');var f=n.find(function(x){return (x.text||x.body||'').indexOf(`__TEXT__`)>=0;});return f?f.id:null;})()")
if not note_id:
    print(_json.dumps({"step":"create_failed"}))
    raise SystemExit(0)
click_sel('[data-action=open-note][data-id="' + str(note_id) + '"]')
wait(0.6)
view_modal_visible = js("(function(){var o=document.getElementById('note-view-modal');return !!o && getComputedStyle(o).display!=='none';})()")
view_text = js("(function(){var el=document.getElementById('note-view-text');return el?(el.textContent||el.value||''):null;})()")
js("(function(){var n=JSON.parse(localStorage.getItem('nm_notes')||'[]');localStorage.setItem('nm_notes',JSON.stringify(n.filter(function(x){return (x.text||x.body||'').indexOf(`__TEXT__`)===-1;})));})()")
errs = get_console_errs()
print(_json.dumps({"step":"complete","note_id":str(note_id),"view_modal_visible":bool(view_modal_visible),"view_text_contains_orig":bool(view_text and `__TEXT__` in view_text),"errors":errs[:3]}))
'''.replace("`__TEXT__`", repr(text))
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__TEXT__", text)
    try:
        r = bh(payload, timeout=60)
        if r.get("step") == "create_failed":
            return _result("test-18-notes-view", False, "CREATE_FAILED")
        if not r.get("view_modal_visible"):
            return _result("test-18-notes-view", False, "VIEW_MODAL_NOT_OPEN: open-note не відкрив #note-view-modal")
        if not r.get("view_text_contains_orig"):
            return _result("test-18-notes-view", False, "VIEW_TEXT_MISSING: оригінальний текст не у note-view-text")
        if r.get("errors"):
            return _result("test-18-notes-view", False, f"console.error: {r['errors']}")
        return _result("test-18-notes-view", True)
    except Exception as e:
        return _result("test-18-notes-view", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_19_habits_add():
    """Tasks tab → switch-prod-tab=habits → ➕ → fill habit name → Save → habit у списку."""
    name = "AI-T Habit " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=tasks]')
wait(0.5)
click_sel('[data-action=switch-prod-tab][data-tab=habits]')
wait(0.5)
prod_btn_fn = js("(function(){var b=document.getElementById('prod-add-btn');return b?b.getAttribute('data-fn'):null;})()")
click_sel('#prod-add-btn')
wait(0.7)
modal_visible = js("(function(){var o=document.getElementById('habit-modal');return !!o && getComputedStyle(o).display!=='none';})()")
js("(function(){var el=document.getElementById('habit-input-name');el.value=`__NAME__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('[data-fn=saveHabit]')
wait(0.8)
habit_in_storage = js("(function(){var h=JSON.parse(localStorage.getItem('nm_habits2')||'[]');return h.some(function(x){return x.name===`__NAME__`;});})()")
habit_in_dom = js("(function(){return (document.body.textContent||'').indexOf(`__NAME__`)>=0;})()")
js("(function(){var h=JSON.parse(localStorage.getItem('nm_habits2')||'[]');localStorage.setItem('nm_habits2',JSON.stringify(h.filter(function(x){return x.name!==`__NAME__`;})));})()")
errs = get_console_errs()
print(_json.dumps({"prod_btn_fn":prod_btn_fn,"modal_visible":bool(modal_visible),"habit_in_storage":bool(habit_in_storage),"habit_in_dom":bool(habit_in_dom),"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__NAME__", name)
    try:
        r = bh(payload, timeout=60)
        if r.get("prod_btn_fn") != "openAddHabit":
            return _result("test-19-habits-add", False, f"PROD_TAB_NOT_SWITCHED: prod-add-btn data-fn={r.get('prod_btn_fn')!r} (expected openAddHabit)")
        if not r["modal_visible"]:
            return _result("test-19-habits-add", False, "HABIT_MODAL_NOT_OPEN")
        if not r["habit_in_storage"]:
            return _result("test-19-habits-add", False, "HABIT_NOT_SAVED: nm_habits2 не містить нову звичку")
        if not r["habit_in_dom"]:
            return _result("test-19-habits-add", False, "HABIT_NOT_IN_DOM: звичка не відображається у списку Me/Habits")
        if r["errors"]:
            return _result("test-19-habits-add", False, f"console.error: {r['errors']}")
        return _result("test-19-habits-add", True)
    except Exception as e:
        return _result("test-19-habits-add", False, f"EXCEPTION: {e}")


@scenario("ui")
def test_20_habits_toggle_done():
    """Створити звичку → tap [toggle-entity-done] → counter збільшується (через delegation, не touch-detect)."""
    name = "AI-T Toggle " + datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')
    payload = '''
inject_error_capture()
goto_url(__URL__)
wait(2.0)
inject_error_capture()
click_sel('[data-tab=tasks]')
wait(0.4)
click_sel('[data-action=switch-prod-tab][data-tab=habits]')
wait(0.4)
click_sel('#prod-add-btn')
wait(0.7)
js("(function(){var el=document.getElementById('habit-input-name');el.value=`__NAME__`;el.dispatchEvent(new Event('input',{bubbles:true}));})()")
wait(0.2)
click_sel('[data-fn=saveHabit]')
wait(0.8)
habit_id = js("(function(){var h=JSON.parse(localStorage.getItem('nm_habits2')||'[]');var f=h.find(function(x){return x.name===`__NAME__`;});return f?f.id:null;})()")
if not habit_id:
    print(_json.dumps({"step":"create_failed"}))
    raise SystemExit(0)
log_before = js("(function(){try{var l=JSON.parse(localStorage.getItem('nm_habit_log2')||'{}');return l['" + str(habit_id) + "']?Object.keys(l['" + str(habit_id) + "']).length:0;}catch(e){return -1;}})()")
click_sel('[data-action=toggle-entity-done][data-entity=habit-prod][data-id="' + str(habit_id) + '"]')
wait(0.6)
log_after = js("(function(){try{var l=JSON.parse(localStorage.getItem('nm_habit_log2')||'{}');return l['" + str(habit_id) + "']?Object.keys(l['" + str(habit_id) + "']).length:0;}catch(e){return -1;}})()")
js("(function(){var h=JSON.parse(localStorage.getItem('nm_habits2')||'[]');localStorage.setItem('nm_habits2',JSON.stringify(h.filter(function(x){return x.name!==`__NAME__`;})));try{var l=JSON.parse(localStorage.getItem('nm_habit_log2')||'{}');delete l['" + str(habit_id) + "'];localStorage.setItem('nm_habit_log2',JSON.stringify(l));}catch(e){}})()")
errs = get_console_errs()
print(_json.dumps({"step":"complete","habit_id":str(habit_id),"log_before":log_before,"log_after":log_after,"errors":errs[:3]}))
'''
    payload = payload.replace("__URL__", repr(NEVERMIND_URL))
    payload = payload.replace("__NAME__", name)
    try:
        r = bh(payload, timeout=60)
        if r.get("step") == "create_failed":
            return _result("test-20-habits-toggle", False, "CREATE_FAILED: звичка не створилась")
        if r.get("log_after", -1) <= r.get("log_before", 0):
            return _result("test-20-habits-toggle", False, f"TOGGLE_NO_EFFECT: log_before={r.get('log_before')} log_after={r.get('log_after')}")
        if r.get("errors"):
            return _result("test-20-habits-toggle", False, f"console.error: {r['errors']}")
        return _result("test-20-habits-toggle", True)
    except Exception as e:
        return _result("test-20-habits-toggle", False, f"EXCEPTION: {e}")


# --- AI command execution (опційно, з tester-commands.md) ---------------------
SYSTEM_PROMPT = """Ти — AI-тестувальник NeverMind PWA. Користувач описує сценарій українською.
Поверни ТIЛЬКИ Python-код для browser-harness CDP (без markdown fence, без пояснень).

Доступні функції (browser-harness 0.1.0 API + custom helpers):
- goto_url(url) — перейти на URL
- click_sel(selector) — клік по CSS-селектору (через DOM .click())
- fill_input(selector, text) — заповнити input/textarea (clear_first=True за замовч)
- click_at_xy(x, y) — клік за координатами (для tests backdrop)
- js(expression) — виконати JS, повертає результат
- wait(seconds) — пауза у СЕКУНДАХ (не ms!): wait(0.5) = 500мс
- wait_for_js_expr(expr, timeout_s=5) — polling поки JS expr → truthy
- get_ls(key) — localStorage.getItem (string або None)
- inject_error_capture() — встановити listener на window.error/unhandledrejection (одноразово на старті)
- get_console_errs() — list[str] помилок з window._jsErrors
- capture_screenshot(path, full=False) — зберегти PNG
- cdp(method, **params) — низькорівневий CDP виклик (Input.dispatchTouchEvent etc)
- _json — модуль json (рrefix щоб не конфліктувати з імпортами користувача)

ВАЖЛИВО:
- wait() приймає секунди (float), НЕ мілісекунди
- Викликай inject_error_capture() ОДРАЗУ після goto_url або на старті сценарію
- В кінці завжди print(_json.dumps({"passed": bool, "reason": str}))
"""


def _anthropic_client():
    from anthropic import Anthropic
    return Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def run_ai_command(cmd_text: str, cfg: dict) -> dict:
    """Перекласти natural language → Python code → exec через bh()."""
    client = _anthropic_client()
    model = cfg.get("ai_model", "claude-haiku-4-5-20251001")
    msg = client.messages.create(
        model=model,
        max_tokens=1500,
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},  # cache (90% economy on repeat)
        }],
        messages=[{"role": "user", "content": cmd_text}],
    )
    code = msg.content[0].text.strip()
    # Стрипаємо markdown fence якщо AI попри інструкцію додав
    code = re.sub(r"^```(?:python)?\n|```$", "", code, flags=re.MULTILINE).strip()
    try:
        r = bh(code, timeout=60)
        passed = r.get("passed", False)
        return _result(f"ai-cmd: {cmd_text[:50]}", passed, r.get("reason", "ok"), category="ai-cmd")
    except Exception as e:
        shot = screenshot("ai-cmd-fail")
        return _result(f"ai-cmd: {cmd_text[:50]}", False, f"EXCEPTION: {e}",
                      screenshot_path=shot, category="ai-cmd")


# --- Cleanup ------------------------------------------------------------------
def cleanup_old_screenshots():
    """Pre-mortem #8: видалити screenshots старіші 7 днів."""
    shots_dir = Path(os.environ.get("SCREENSHOTS_DIR", "/home/nmtester/screenshots"))
    if not shots_dir.exists():
        return
    cutoff = time.time() - MAX_SCREENSHOTS_AGE_DAYS * 86400
    removed = 0
    for f in shots_dir.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            f.unlink()
            removed += 1
    if removed:
        print(f"[CLEANUP] видалено {removed} старих screenshots")


# --- Pre-flight check ---------------------------------------------------------
def preflight() -> bool:
    """Перевірити що Chrome CDP + browser-harness daemon живі (Pre-mortem #2 + #5).

    Якщо daemon тримає stale CDP сесію після Chrome restart (systemd OOM/respawn) —
    detect через bh() з мінімальним payload + auto-restart daemon через pkill.
    """
    import urllib.request
    # 1) Chrome CDP HTTP endpoint
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=3) as r:
            data = json.loads(r.read())
            if "Browser" not in data:
                print("[FAIL preflight] Chrome CDP повернув незрозумілу відповідь")
                return False
    except Exception as e:
        print(f"[FAIL preflight] Chrome CDP мертвий: {e}")
        print("  Спробуй: sudo systemctl restart chrome-tester")
        return False
    # 2) browser-harness daemon — Pre-mortem #5 detection
    try:
        bh('print(_json.dumps({"ok": True}))', timeout=15)
        return True
    except Exception as e:
        print(f"[WARN preflight] daemon broken: {_mask_secrets(str(e))[:200]}")
        print("  Спроба автовідновлення (pkill + retry)...")
        try:
            subprocess.run(["pkill", "-u", "nmtester", "-f", "browser_harness.daemon"],
                           check=False, timeout=5)
            time.sleep(2)
            # Cleanup stale socket (root-owned race scenario)
            for p in ("/tmp/bu-default.sock", "/tmp/bu-default.pid"):
                try:
                    os.unlink(p)
                except FileNotFoundError:
                    pass
                except PermissionError:
                    pass  # nmtester може не мати дозволу — chrome-tester service спробує
            bh('print(_json.dumps({"ok": True}))', timeout=15)
            print("  [OK preflight] daemon відновлено")
            return True
        except Exception as e2:
            print(f"[FAIL preflight] daemon не відновлюється: {_mask_secrets(str(e2))[:200]}")
            return False


# --- main() -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="10 готових сценаріїв")
    parser.add_argument("--full", action="store_true", help="Сценарії + AI-команди")
    parser.add_argument("--cmd", type=str, help="Одна AI-команда (для тесту)")
    parser.add_argument("--force", action="store_true", help="Ігнорувати schedule")
    args = parser.parse_args()

    # Pre-mortem: lock щоб cron+manual не зіткнулись (Chrome CDP race + git race + status counter)
    _lock_fd = acquire_lock_or_exit()  # noqa: F841 — тримати fd живим до process end

    load_env()

    if not preflight():
        sys.exit(2)

    git_pull_safely()

    cfg = read_config()
    assert_provider(cfg)
    status = read_status()

    if not args.cmd and not args.force and not check_schedule(cfg, status):
        sys.exit(0)

    results = []

    if args.cmd:
        # Один AI-command — тестовий запуск без сценаріїв
        results.append(run_ai_command(args.cmd, cfg))
    else:
        # Smoke або Full — виконуємо сценарії
        max_tests = cfg.get("max_tests_per_run", 10)
        disabled = set(cfg.get("disabled_scenarios", []))
        # On-demand: TARGET_SCENARIOS env var звужує до specific тестів (HKnlM trigger)
        target_env = os.environ.get("TARGET_SCENARIOS", "").strip()
        if target_env:
            targets = set(s.strip() for s in target_env.split(",") if s.strip())
            active = [fn for fn in SCENARIOS if fn.__name__ in targets and fn.__name__ not in disabled]
            print(f"[TARGET] on-demand: {sorted(fn.__name__ for fn in active)}")
        else:
            active = [fn for fn in SCENARIOS[:max_tests] if fn.__name__ not in disabled]
            skipped = [fn.__name__ for fn in SCENARIOS[:max_tests] if fn.__name__ in disabled]
            if skipped:
                print(f"[SKIP] {len(skipped)} disabled scenarios: {', '.join(skipped)}")
        for fn in active:
            print(f"--- {fn.__name__} ---")
            r = fn()
            if not r["passed"] and not r.get("screenshot_path"):
                r["screenshot_path"] = screenshot(r["name"])
            results.append(r)
            print(f"{'PASS' if r['passed'] else 'FAIL'} {r['name']}: {r['reason']}")

        if args.full:
            # TODO: parse tester-commands.md і виконати [ ] команди
            pass

    write_status(cfg, status, results)
    append_log(results)
    cleanup_old_screenshots()

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    pushed = git_commit_push(passed, total)

    print(f"\n=== {passed}/{total} pass · pushed={pushed} ===")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
