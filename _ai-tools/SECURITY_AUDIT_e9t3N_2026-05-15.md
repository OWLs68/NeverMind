# SECURITY AUDIT — e9t3N · 15.05.2026

> **Що це:** звіт Council 5 паралельних агентів Sonnet security аудиту NeverMind.
> **Тригер:** запит Романа «перевірити проект на безпеку, забезпечити сильну безпеку персональних даних, унеможливити хакерські атаки».
> **Методологія:** 5 ролей паралельно + 1 WebSearch OWASP 2026 + Голова синтез.

---

## 🤖 Council склад

1. **🔐 Secret/Key auditor** — куди ходять ключі, чи витекли у git
2. **🕵️ XSS/Injection auditor** — як NM обробляє юзерський інпут, AI-відповіді, innerHTML
3. **🌐 Network/CSP auditor** — HTTPS, CSP, CORS, mixed content
4. **📦 Supply chain auditor** — npm audit, GitHub Actions, transitive deps
5. **☁️ Supabase + Hetzner auditor** — готовність до міграції + безпека нової інфраструктури

---

## 📊 ТОП знахідки

### 🔴 CRITICAL (закрити перед публічним beta)

**C-1. Stored XSS у notes.js:186** (XSS auditor)
- `dl.innerHTML = getFolders().map(f => `<option value="${f}">`)`
- Юзер створює папку `"><img src=x onerror=alert(1)>` → виконується при кожному boot
- **Статус:** ✅ Закрито `3aa1569` (escapeHtml у template literal)

**C-2. Немає Content-Security-Policy header** (Network auditor)
- Жодного `Content-Security-Policy` meta-тегу
- Будь-який XSS → крадіжка OpenAI ключа за 1 рядок
- **Блокер:** 185 inline `onclick` зламуть strict CSP — потрібен Event Delegation refactor спочатку
- **Статус:** ⏳ У ROADMAP як Active блок «🛡️ Security Hardening»

**C-3. OpenAI ключ `nm_gemini_key` у localStorage** (Secret auditor)
- Видно через DevTools → Application → Local Storage
- При фізичному доступі = крадіжка
- **Статус:** ⏳ Закриється під час Supabase міграції (Edge Function proxy-openai)

**C-4. AI-тестер screenshots можуть мати PHI у публічному репо** (Hetzner auditor)
- Контракт каже `screenshot_b64` (max 500KB) у `tester-status.json`
- Скрін Health-картки = GDPR Article 9 Special Category у public GitHub
- **Статус:** ⏳ У роботі — оновлення контракту base64 → локальний шлях

**C-5. AI-тестер на Hetzner запускається як root** (Hetzner auditor)
- Будь-який bug → root shell → весь сервер
- **Статус:** ⏳ Brain-Claude робить у Hetzner-сесії (BLOCKER перед першим запуском тестера)

### 🟡 HIGH (до Supabase)

**H-1. Prompt injection не захищено** (XSS auditor)
- Юзер пише у нотатку «Ignore previous instructions» → AI може почати ламатись
- **Статус:** ⏳ У роботі — anti-injection правило у 8 системних промптів

**H-2. `user_id` колонка не на всіх entities** (Supabase auditor)
- Без user_id у кожному рядку — RLS неможливий
- **Статус:** ⏳ Architecture Refactor Сесія 8

**H-3. Auth flow не зафіксовано** (Supabase auditor)
- Magic link vs email/password vs OAuth — не обрано
- **Статус:** ⏳ ROADMAP пункт перед Supabase

**H-4. Fine-grained PAT scope обмеження слабше за контракт** (Hetzner auditor)
- GitHub UI не дає обмежити PAT до конкретних гілок, тільки до репо
- **Статус:** ⏳ Workflow `auto-merge-tester.yml` має whitelist guard як другий рівень

**H-5. GDPR/DPA з Supabase** (Supabase auditor)
- Health дані = Special Category, потрібен DPA + EU регіон
- **Статус:** ⏳ ROADMAP «🚨 БЕЗПЕКА перед Supabase»

**H-6. Backup механізм для міграції** (Supabase auditor)
- `nm_backup_v*` не реалізовано — нема rollback при невдалій міграції
- **Статус:** ⏳ Окрема сесія перед стартом Supabase

### 🟢 MEDIUM/LOW

**M-1. GitHub Actions без SHA pin** (Supply chain auditor)
- `actions/checkout@v4` — рухомий тег
- **Статус:** ⏳ У роботі

**M-2. Dependabot не налаштований** (Supply chain auditor)
- Нові CVE не побачимо автоматично
- **Статус:** ⏳ У роботі

**M-3. `npm audit` не у CI** (Supply chain auditor)
- При новій CVE деплой пройде
- **Статус:** ⏳ У роботі

**M-4. Google Fonts без SRI** (Network auditor)
- Якщо CDN компроментують — підстановка шкідливого CSS
- **Статус:** 📋 Окрема сесія (нерелевантно перед Supabase)

**M-5. `BroadcastChannel('nm_sync')` без префіксу** (Network auditor)
- Низький ризик через GitHub Pages domain isolation
- **Статус:** 📋 Точковий фікс пізніше

---

## ✅ Що знайшли ЧИСТИМ

- **Жодних реальних витоків ключів у git history** (перевірено 3 grep'и патернів `sk-proj-`, `sk_live_`, `AKIA`)
- **0 critical/high/medium/low CVE** у залежностях (npm audit clean)
- **Немає `eval()` / `new Function()`** — RCE неможливе
- **Service Worker** не пересилає токени, не зберігає sensitive дані
- **`escapeHtml()` / `escapeJsArg()` хелпери** є і вживаються у більшості місць (XSS-агент знайшов 1 пропуск з ~50 точок використання)
- **AI chat responses** проходять через `escapeHtml()` перед innerHTML у всіх 8 чатах
- **AI-тестер workflow** має whitelist guard `_ai-tools/` only
- **HTTPS-only** через GitHub Pages
- **No `<iframe>`** використання — frame injection неможливе
- **No `dangerouslySetInnerHTML`** — це не React, але аналоги відсутні

---

## 📈 Рейтинг безпеки

**Поточний:** 5/10 (для single-user PWA) → **3/10** (якщо публічний beta з health/finance даними)

**Цільовий до Supabase:** 8/10 (після закриття 4 CRITICAL + 6 HIGH)

**Цільовий до GDPR-compliant launch:** 9/10 (+ DPA, EU регіон, MFA, audit logs)

---

## 🎯 Дії по результатах

1. ✅ Stored XSS закрито у поточній сесії
2. ⏳ Системна документація створена: `docs/SECURITY.md`
3. ⏳ ROADMAP оновлено: Active блок «🛡️ Security Hardening»
4. ⏳ INDEX.md оновлено: посилання на SECURITY.md
5. ⏳ Дрібні фікси у поточній сесії (prompt injection, tester contract, supply chain, Claude Security Action)
6. 📋 Великі задачі винесені в окремі сесії:
   - Event Delegation Refactor (6-8 год)
   - Backup mechanism для міграції (3-4 год)
   - `user_id` на всі entities (Architecture Refactor Сесія 8)

---

## 🔗 Джерела

- [OWASP Top 10 for AI Apps 2026](https://techbytes.app/posts/owasp-top-10-ai-apps-2026-security-cheat-sheet/)
- [OWASP LLM Top 10 (2026)](https://elevateconsult.com/insights/owasp-llm-top-10-security-vulnerabilities-every-ai-developer-must-know-in-2026/)
- [OWASP Top 10 for Agentic Applications 2026](https://www.practical-devsecops.com/owasp-top-10-agentic-applications/)
- [Anthropic Claude Security](https://www.anthropic.com/news/claude-code-security)
- [claude-code-security-review GitHub Action](https://github.com/anthropics/claude-code-security-review)
