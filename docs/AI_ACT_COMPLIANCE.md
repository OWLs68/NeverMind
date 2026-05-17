# AI Act + GDPR Compliance — Health Isolation

> **Створено:** 2026-05-17 (сесія JMQuT). Стратегічне рішення Романа після Council 6 агентів Sonnet + 4 WebSearch EU AI Act / GDPR / Annex III / productivity apps classification.

---

## TL;DR

**NeverMind = Limited Risk AI system** (productivity app). UI Health-вкладка залишається повністю функціональною — юзер сам редагує медкартки/алергії/ліки. **AI повністю ізольовано від health-даних** на 7 рівнях.

---

## Юридичний контекст

### EU AI Act (Annex III + Article 6)

NeverMind за дефолтом — productivity app з **Minimal/Limited risk** класифікацією. Стає **High-risk** якщо AI:

- **Profiling** — автоматична обробка health-даних для рішень в інших контекстах
- **Clinical decision support** — інтерпретація симптомів, рекомендація лікування
- **Medical Device (SaMD)** — діагностика, treatment recommendations
- **Risk assessment** для health insurance
- **Emergency triage**

[Annex III](https://artificialintelligenceact.eu/annex/3/) + [Article 6](https://artificialintelligenceact.eu/article/6/).

### GDPR Article 9 (Special Categories)

Health дані = **special category data** → потребує **explicit consent** для будь-якої обробки AI системою. Solely automated decisions з health = ще жорсткіші правила (Article 22).

[Art. 9 GDPR](https://gdpr-info.eu/art-9-gdpr/).

---

## Що ВИДАЛЕНО (створювало ризик)

### 1. AI Tools (11 функцій) — `src/ai/prompts.js`

| Tool | Що робило |
|------|-----------|
| `create_health_card` | AI створював медкартку за фразою юзера → health decision |
| `edit_health_card` | AI редагував картку → modification of health data |
| `delete_health_card` | AI видаляв картку |
| `update_health_card_status` | AI оцінював стан → clinical judgement |
| `add_medication` | AI додавав ліки за рецептом → medication management |
| `edit_medication` | AI міняв дозування → automated dose recommendation |
| `delete_medication` | AI відміняв ліки |
| `log_medication_dose` | AI фіксував прийом дози |
| `add_allergy` | AI створював алергію → record of medical condition |
| `delete_allergy` | AI видаляв алергію |
| `add_health_history_entry` | AI писав у timeline історії здоровʼя |

### 2. AI Context — `src/ai/core.js`

- **`getHealthContext()`** видалено з `getAIContext()` → PHI (картки + алергії + ліки + рекомендації лікаря) більше НЕ надходить у промпт жодного з 8 чатів. Це був **головний канал profiling**.

### 3. Brain Signals — `src/owl/brain-signals.js`

- **`_collectAppointmentSoon()`** видалено → AI більше не нагадує про прийом лікаря з імʼям лікаря + датою у промпті.

### 4. Clarify Guard — `src/owl/clarify-guard.js`

- **`DOCTOR_MENTION_RE`** (regex 26 медспеціальностей) видалено
- **`_buildDoctorChips()`** видалено → AI не пропонує чіпи з реальних імен лікарів з `nm_health_cards.doctor`

### 5. OWL Proactive — `src/owl/proactive.js`

- Видалено health з `getTabBoardContext()` (передавав «Карточок здоровʼя: N»)
- Видалено `_isTabActive('health')` (Health більше не активна AI-вкладка)
- Видалено OWL onboarding question «Як у тебе зі здоровʼям?»

### 6. Memory Facts — `src/ai/memory.js`

- Видалено `category: 'health'` з `FACT_CATEGORIES` + `CATEGORY_ORDER` → AI не запамʼятовує health-факти у `nm_facts`
- Migration v18 видаляє існуючі facts з `category='health'`

### 7. Inbox Classifier — `src/ai/prompts.js INBOX_SYSTEM_PROMPT`

- Видалено health-секцію decision tree («алергія X → add_allergy», «симптом 3+ днів → create_health_card» тощо)
- Нове правило: будь-який медичний контент → `save_note(folder='Здоровʼя')` з оригінальним текстом юзера (без AI judgement)

### 8. Health Chat-bar — `src/tabs/health.js` + `index.html`

- Видалено `#health-ai-bar` HTML (input + send button + chat-window + messages container)
- Видалено `addHealthChatMsg`, `sendHealthBarMessage` (no-op stubs)
- Видалено `getHealthChatSystem` промпт (stub)
- Видалено AI-інтерв'ю 3-крокове (`startHealthInterview` + `applyHealthInterviewChoice` + `_finishInterview` + `_aggregateInterviewStatus`)
- Видалено «Запитати OWL про цей стан» UI блок

### 9. Finance → Health sync — `src/tabs/finance.js`

- Видалено `syncHealthFinanceToHistory` → медичні витрати більше НЕ автоматично пишуть запис у health-картку

### 10. Cross-tab cleanup — Migration v18 у `src/core/boot.js`

- Видаляє `nm_chat_health` (історія чату Health)
- Видаляє `nm_health_interview_pending` (стан інтерв'ю)
- Видаляє факти з `nm_facts` де `category='health'`

---

## Що ЗАЛИШЕНО (Limited risk — безпечно)

| Що | Чому безпечно |
|----|---------------|
| UI Health-вкладка (картки/ліки/алергії CRUD) | Юзер сам редагує — не AI обробка |
| `nm_health_cards`, `nm_allergies` storage | Дані юзера — не для AI |
| `nm_health_log` (cleanup flag) | Legacy дані |
| `boot.js` міграції v8-v17 nm_health | Одноразові структурні зміни, не AI flow |
| `restoreFromTrash` cases `health_card`/`medication`/`allergy` | Pure storage undo, не AI |
| `switch_tab('health')` UI tool | Навігація, не data processing |
| Health-папка у Notes (`folder='Здоровʼя'`) | AI просто зберігає текст як нотатку, без judgement |
| Експорт PDF/JSON через UI кнопку | Юзер прямо просить (Article 6 GDPR — consent) |

---

## Що AI робить з health-фразами зараз

| Юзер пише | Поведінка AI |
|-----------|--------------|
| «Болить горло» | `save_note(folder='Здоровʼя')` з оригінальним текстом. Без створення картки. |
| «Приймаю парацетамол» | `save_note(folder='Здоровʼя')`. Без `add_medication`. |
| «У мене алергія на горіхи» | `save_note(folder='Здоровʼя')`. Без `add_allergy`. |
| «Запамʼятай що у мене алергія» | «🚫 AI більше не запамʼятовує медичних фактів». |
| «Експортуй медкартку» | «Відкрий Здоровʼя і експортуй через UI». |
| «Чи це нормально, що...?» | «Я не лікар. Питай свого лікаря — не самолікуйся». БЕЗ tool calls. |

---

## Compliance Status

- ✅ **EU AI Act:** Limited Risk (productivity app). Transparency обовʼязок виконано (юзер знає що говорить з AI).
- ✅ **GDPR Article 9:** AI не обробляє special category data. Health-дані залишаються тільки у локальному UI (під контролем юзера).
- ✅ **Profiling:** AI не читає health-картки для рішень в інших контекстах.
- ✅ **Automated decisions:** AI не приймає рішень про стан здоровʼя.

---

## Версія + Сесія

- **Гілка:** `claude/start-session-JMQuT`
- **Дата:** 2026-05-17
- **CACHE_NAME:** `nm-20260517-2330` і пізніше
- **Council:** 6 паралельних агентів Sonnet (Critic + Pre-mortem + Strategist + UI-Map + OWL-Map + Inbox-classifier)
- **WebSearch:** 4 запити (EU AI Act + GDPR Art.9 + Annex III + productivity apps classification)

## Залежні документи

- `docs/SECURITY.md` — PHI розділ (Health = Limited risk через ізоляцію)
- `docs/AI_TOOLS.md` — таблиця AI tools (11 health видалено)
- `docs/ARCHITECTURE.md` — Health = AI-isolated
- `ROADMAP.md` — позначено DONE: Health AI isolation block
