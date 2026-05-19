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
