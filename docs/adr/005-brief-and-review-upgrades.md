# ADR-005: Ранковий брифінг + 7 портів рев'ю/потоку (26yz5s, 04.07.2026)

## Контекст
Три задачі за погодженим планом Романа 04.07: (А) ранковий брифінг репо через
Claude Code Routine; (Б) 4 механізми з alibaba/open-code-review (читано реальний
код через raw); (В) 3 механізми з gstack + claude-code-best-practice.
**Залізне правило Романа:** нуль нових РУЧНИХ слеш-команд — усе нове як АВТО-кроки
всередині існуючих потоків (/byyou, Council, /audit, /qa-explore, CI, хуки).
Виняток: /brief (його викликає Routine, не Роман щодня).

## Рішення

### А — /brief + Routine (окремий деплой, Потік 1)
`.claude/commands/brief.md` — read-only протокол: стан CI (E2E/канарейка/gitleaks/
ai-smoke) + 17 сторожів локально + беклог за пріоритетом (🔴 баги → canary+security
Issues → SESSION_STATE → ROADMAP) → звіт у чат за фіксованим форматом (стан / топ-3 /
готова byyou-чернетка / чекає тебе). Жодних змін файлів. Routine 04:00 UTC = 06:00
Амстердам щодня, свіжа сесія, промпт «виконай /brief». Звіт лише у чат (без файла в
репо — щоб не плодити деплой щоранку). Значення Routine Роман вставляє руками
(з хмарної сесії розклад не створити).

### Б — alibaba/open-code-review
- **P1 асиметричний фактчек** (замінив симетричний верифікатор 03.07): фактчекер
  бачить тільки код+знахідки(JSON ID), вбиває ТІЛЬКИ за прямим контрдоказом,
  «не можу перевірити» ≠ «неправда». `scripts/lib/refute-parser.js` (fail-open:
  будь-який збій → усі знахідки живі). byyou 3.5 + CLAUDE.md. Тест 8/8.
- **P2 якорі-сніпети**: агент дає existing_code, не номер рядка; `scripts/resolve-anchor.js`
  (порт resolver.go) резолвить детерміновано — **нуль regex** (клас \b-кирилиця
  неможливий за конструкцією). Тест 10/10. byyou 3.7.
- **P3 мапа глоб→чекліст**: `_ai-tools/review-rules/` (rules.json + js/hooks/render/
  security/default md), засіяно шрамами з lessons; `scripts/lib/glob-match.js` без
  regex. Інжект: byyou 3.6 + /audit крок 0. Тест 12/12.
- **P4 оцінка+ранній handoff**: (1) груба оцінка обсягу на брамі плану (N×35K, без
  доларів); (2) мʼякий поріг 60-74% у context-guard — одноразове «пиши handoff
  ЗАРАЗ», прапорець самоскидається <60%; жорсткий 75/exit2 не чіпано. Тест 6/6.

### В — gstack + best-practice
- **P5 безпека як авто-крок**: `security.md` = CSO-методологія (4 фази, поріг 8/10,
  12 hard-exclusions) адаптована під наш стек (XSS-innerHTML, ключ у localStorage,
  prompt-injection, \b-кирилиця, CI-інʼєкція). Тригер — security_sensitive глоби у
  rules.json → авто security-агент у byyou Фаза 4 крок 0. НЕ ставили весь gstack.
- **P6 JSONL-журнал хуків**: `.claude/hooks/log-event.js` — 6 подій (Pre/Post/Stop/
  PostToolUseFailure/SubagentStart/Stop), позначка субагента, fail-open, лог у
  .gitignore. Тест 4/4. Оцінка каталогу подій: PreCompact відкладено (окреме рішення
  після обкатки P4-2), PostToolUseFailure+Subagent* взяті разом з P6.
- **P7 QA паралельно**: /qa-explore збагачено методологією gstack /qa (рівні Quick/
  Standard/Exhaustive, скріншот до/після, health-рядок). WebKit у CI-матриці ВЖЕ був
  з 16.06 (Mobile Safari iPhone-13 + канарейка) — окремий крок не потрібен.

## Відкинуто
Нові ручні команди (нуль) · повний gstack (23 команди) · PreCompact-подія (поки) ·
крос-модельні роутери · симетричний крос-чек (P1 його і замінив).

## Наслідки
- Сторожів у CI: 16 node → 21 (+refute/review-rules/context-guard/anchor/hooks-log) + ESLint.
- Council/byyou тепер: чеклісти-шрами у промпті · асиметричний фактчек · сніпет-якорі ·
  оцінка обсягу · авто-security для чутливих файлів.
- Рев'ю-інфраструктура (glob-match, resolve-anchor, refute-parser) — чисті модулі без
  regex, Supabase-сумісні (переїдуть у Edge Function без переписування).
- Межа незмінна: справжній iOS-тест (тач/гума/PWA-standalone) — тільки живий iPhone.
