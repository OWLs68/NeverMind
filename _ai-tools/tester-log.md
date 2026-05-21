# Журнал AI-тестера

> Людиночитальний журнал останніх 7 днів запусків AI-тестера.
> Старіше → автоматично у `_ai-tools/tester-log/YYYY-MM-DD.md`.
>
> **Хто пише:** AI-тестер на Hetzner після кожного запуску.
> **Хто читає:** Роман для огляду, NM-Claude у `/start` для аналізу фейлів.

---

## Очікую перший запуск

Тестер ще не запущений. Після першого запуску тут з'являться записи у форматі:

```
## 2026-05-16 03:00 UTC · v879 · Run #1

✅ Готові сценарії: 10/10 пройшло
✅ Команди з черги: 0/0
📊 OpenAI: $0.00 (тільки готові сценарії, без LLM)
⏱ Час: 4 хв 23 сек

Деталі по тестах:
1. ✅ Сайт відкрився, OWL-табло видно
2. ✅ Перехід між 8 вкладками: 0 console.error
3. ✅ Створив задачу "Тестова" → у списку → reload → залишилась
...
```

---

## 2026-05-19 17:26 UTC · vnm-20260519-0300 · 0/5 pass
- ❌ `test-1-boot-health`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 124, in main
    ensure_daemon()
  File "/home/nmtester/browser-harness/src/br
- ❌ `test-2-navigation`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 124, in main
    ensure_daemon()
  File "/home/nmtester/browser-harness/src/br
- ❌ `test-3-create-task`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 124, in main
    ensure_daemon()
  File "/home/nmtester/browser-harness/src/br
- ❌ `test-4-backup-create`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 124, in main
    ensure_daemon()
  File "/home/nmtester/browser-harness/src/br
- ❌ `test-5-trash-restore`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 124, in main
    ensure_daemon()
  File "/home/nmtester/browser-harness/src/br

## 2026-05-19 18:04 UTC · vnm-20260519-0300 · 0/5 pass
- ❌ `test-1-boot-health`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-2-navigation`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 6, in <module>

- ❌ `test-3-create-task`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-4-backup-create`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-5-trash-restore`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 4, in <module>


## 2026-05-20 19:17 UTC · vnm-20260519-0300 · 0/5 pass
- ❌ `test-1-boot-health`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-2-navigation`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 6, in <module>

- ❌ `test-3-create-task`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-4-backup-create`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 3, in <module>

- ❌ `test-5-trash-restore`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 4, in <module>


## 2026-05-20 19:24 UTC · vnm-20260519-0300 · 3/5 pass
- ✅ `test-1-boot-health`: ok
- ✅ `test-2-navigation`: ok
- ❌ `test-3-create-task`: ASSERTION_FAIL: задача не зявилась у nm_tasks
- ❌ `test-4-backup-create`: ASSERTION_FAIL: backup не створено у localStorage
- ✅ `test-5-trash-restore`: ok

## 2026-05-20 19:50 UTC · vnm-20260519-0300 · 4/10 pass
- ✅ `test-1-boot-health`: ok
- ✅ `test-2-navigation`: ok
- ❌ `test-3-create-task`: ASSERTION_FAIL: задача не зявилась у nm_tasks
- ❌ `test-4-backup-create`: ASSERTION_FAIL: backup не створено у localStorage
- ✅ `test-5-trash-restore`: ok
- ❌ `test-6-owl-swipe`: OWL не згорнувся (touch-detect.js bug?)
- ❌ `test-7-modal-backdrop`: close-backdrop НЕ працює (Pre-mortem ризик)
- ✅ `test-8-clear-data`: ok
- ❌ `test-9-inbox-finance`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 48, in <module>
  File "<string>", line 23, in wait_for_js_expr
RuntimeError: wait_for_js timeout: (JSON.parse(localStorage.getItem('nm_finance') || '[]')).some(function(x){return
- ❌ `test-10-task-classify`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 49, in <module>
  File "<string>", line 23, in wait_for_js_expr
RuntimeError: wait_for_js timeout: (JSON.parse(localStorage.getItem('nm_tasks') || '[]')).length > 2

## 2026-05-20 19:57 UTC · vnm-20260519-0300 · 4/10 pass
- ✅ `test-1-boot-health`: ok
- ✅ `test-2-navigation`: ok
- ❌ `test-3-create-task`: ASSERTION_FAIL: задача не зявилась у nm_tasks
- ❌ `test-4-backup-create`: ASSERTION_FAIL: backup count 0->0 (delta 0)
- ✅ `test-5-trash-restore`: ok
- ❌ `test-6-owl-swipe`: OWL не згорнувся (touch-detect.js bug?)
- ❌ `test-7-modal-backdrop`: close-backdrop НЕ працює (Pre-mortem ризик)
- ✅ `test-8-clear-data`: ok
- ❌ `test-9-inbox-finance`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 50, in <module>
  File "<string>", line 23, in wait_for_js_expr
RuntimeError: wait_for_js timeout: (JSON.parse(localStorage.getItem('nm_finance') || '[]')).length > 0
- ❌ `test-10-task-classify`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 51, in <module>
  File "<string>", line 23, in wait_for_js_expr
RuntimeError: wait_for_js timeout: (JSON.parse(localStorage.getItem('nm_tasks') || '[]')).length > 3

## 2026-05-20 20:02 UTC · vnm-20260519-0300 · 4/6 pass
- ✅ `test-1-boot-health`: ok
- ✅ `test-2-navigation`: ok
- ❌ `test-3-create-task`: ASSERTION_FAIL: задача не зявилась у nm_tasks
- ❌ `test-4-backup-create`: ASSERTION_FAIL: backup count 0->0 (delta 0)
- ✅ `test-5-trash-restore`: ok
- ✅ `test-8-clear-data`: ok

## 2026-05-20 20:53 UTC · vnm-20260520-2100 · 4/6 pass
- ✅ `test-1-boot-health`: ok
- ✅ `test-2-navigation`: ok
- ❌ `test-3-create-task`: ASSERTION_FAIL: задача не зявилась у nm_tasks
- ❌ `test-4-backup-create`: ASSERTION_FAIL: backup count 0->0 (delta 0)
- ✅ `test-5-trash-restore`: ok
- ✅ `test-8-clear-data`: ok

## 2026-05-21 04:18 UTC · vnm-20260520-2100 · 0/2 pass
- ❌ `test-3-create-task`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 51, in <module>
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 435, in js
    return _runtime_evaluate(expression, session_id=sid, await_promise=True)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 117, in _runtime_evaluate
    return _runtime_value(r, expression)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 104, in _runtime_value
    raise RuntimeError(f"JavaScript evaluation failed{loc}: {desc}; expression: {_js_snippet(expression)}")
RuntimeError: JavaScript evaluation failed at line 0, column 93: SyntaxError: missing ) after argument list; expression: (function(){var i=document.getElementById("task-input-title");var btn=document.querySelector("button[data-fn="saveTask"]");var ov=document.getElementById("ta...
- ❌ `test-4-backup-create`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 51, in <module>
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 435, in js
    return _runtime_evaluate(expression, session_id=sid, await_promise=True)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 117, in _runtime_evaluate
    return _runtime_value(r, expression)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/helpers.py", line 104, in _runtime_value
    raise RuntimeError(f"JavaScript evaluation failed{loc}: {desc}; expression: {_js_snippet(expression)}")
RuntimeError: JavaScript evaluation failed at line 0, column 244: SyntaxError: Invalid or unexpected token; expression: (function(){try{var r=window.createFullBackupUI?window.createFullBackupUI():"NO_FN";return {ok:true,return_val:typeof r==="object"?JSON.stringify(r):String(r...

## 2026-05-21 04:26 UTC · vnm-20260520-2100 · 0/2 pass
- ❌ `test-3-create-task`: EXCEPTION: bh exit 1: Traceback (most recent call last):
  File "/home/nmtester/.local/bin/browser-harness", line 10, in <module>
    sys.exit(main())
             ^^^^^^
  File "/home/nmtester/browser-harness/src/browser_harness/run.py", line 125, in main
    exec(code, globals())
  File "<string>", line 99
    js("var __t=JSON.parse(localStorage.getItem('nm_tasks')||'[]');localStorage.setItem('nm_tasks',JSON.stringify(__t.filter(function(x){return x.title!=="AI-Tester 20260521-042603";})));")
                                                                                                                                                                              ^
SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers
- ❌ `test-4-backup-create`: NO_BACKUP: UI_fn=function BE_fn=undefined call_ok=True ret=undefined err=None settings_len=0 keys_b=3 keys_a=0 errs=[] log=[{'ts': 1779336180046, 'type': 'log', 'msg': '[brain-pulse] skip: no-api-key', 'src': '', 'tab': 'inbox', 'stack': None, 'actions': []}, {'ts': 1779336780046, 'type': 'log', 'msg': '[brain-pulse] skip: no-api-key', 'src': '', 'tab': 'inbox', 'stack': None, 'actions': []}, {'ts': 1779337136346, 'type': 'log', 'msg': '[brain-pulse] skip: no-api-key', 'src': '', 'tab': 'inbox', 'stack': None, 'actions': []}]
