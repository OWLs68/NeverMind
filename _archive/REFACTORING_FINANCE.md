# План рефакторингу `finance.js`

> Створено 17.04.2026 (сесія cnTkD). Роман сказав: _"Файл фінанси занадто великий, все легко ламається"_. Цей документ — конкретний план як розбити.

---

## Поточний стан (17.04.2026)

**`src/tabs/finance.js` = 2443 рядки.** Після 15 закритих багів (B-32..B-72) — файл зріс з 1928 до 2443. Всі зміни в одному файлі, складно орієнтуватись.

**Структура зараз (13 логічних секцій):**

| Секція | Рядки (приблизно) | Що всередині |
|--------|-------------------|--------------|
| 1. Категорії — бібліотека іконок + палітра | ~60 | `FIN_CAT_ICONS` (41 SVG), `FIN_CAT_PALETTE` (14 кольорів), `FIN_DEFAULT_ICONS`, `FIN_DEFAULT_SUBCATS` |
| 2. Категорії — CRUD + міграція | ~190 | `_makeCatObj`, `_migrateFinCats`, `getFinCats`, `saveFinCats`, `findFinCatById`, `createFinCategory`, `updateFinCategory`, `deleteFinCategory`, `mergeFinCategories`, `addFinSubcategory`, `findFinCatByName` |
| 3. State + currency | ~30 | `currentFinTab`, `currentFinPeriod`, `currentFinPeriodOffset`, `_finEditMode`, `getCurrency`, `setCurrency`, `formatMoney` |
| 4. Періоди (window) | ~50 | `_MONTH_NAMES`, `_getFinPeriodWindow`, `getFinPeriodRange`, `getFilteredTransactions`, `switchFinTab`, `setFinPeriod`, `shiftFinPeriod` |
| 5. Головний рендер | ~300 | `_hideOldFinBlocks`, `renderFinance`, `_finCatsGrid` (Hero donut + сітка), `toggleFinTabType`, `_finEmptyState`, `_finEmptyTxsHint`, `_finTxsBlock`, `openAllTransactions`, `_attachFinSwipe`, `moveFinCategory` |
| 6. Свайп-видалення | ~100 | `_deleteFinTxById`, `_attachFinTxSwipeDelete`, константи |
| 7. Інсайт дня (AI) | ~130 | `FIN_INSIGHT_TTL`, `_finInsightHash`, `_finDailyInsight`, `_refreshFinInsight` |
| 8. Модалка транзакції | ~400 | `openAddTransaction`, `openEditTransaction`, `_showTransactionModal`, `_renderTransactionModalBody`, `_refreshTransactionModal`, калькулятор (`_safeFinCalc`, `finCalcAppend`, `finCalcBackspace`), `selectFinTxMainCat`, `selectFinTxSubcat`, дата-пікер (`_finTxDateLabel`, `openFinDateModal`, `closeFinDateModal`, `setFinTxDateOffset`, `setFinTxDateFromInput`), `saveFinTransaction`, `deleteFinTransaction`, `closeFinTxModal` |
| 9. Модалка бюджету | ~60 | `openFinBudgetModal`, `saveFinBudgetFromModal`, `closeFinBudgetModal` |
| 10. processFinanceAction (з Inbox) | ~70 | `_resolveFinanceDate`, `processFinanceAction`, `checkFinBudgetWarning` |
| 11. getFinanceContext (для AI) | ~30 | `getFinanceContext` |
| 12. Chat bar (Finance AI) | ~150 | `_financeTypingEl`, `financeBarHistory`, `financeBarLoading`, `addFinanceChatMsg`, `sendFinanceBarMessage` |
| 13. Модалка категорії + Аналітика | ~700 | `toggleFinEditMode`, `openCategoryEditModal`, `_renderCatEditModalBody`, `_refreshCatEditModal` (+ точкові updates), обробники, `_finCatModalPositionInfo`, `moveCatModalUp/Down`, `saveCategoryFromModal`, `deleteCategoryFromModal`, `closeCategoryEditModal`, вся Аналітика (`openFinAnalytics`, `closeFinAnalytics`, `_buildAnalyticsContent`, `_analyticsChart`, `_analyticsMiniMetrics`, `_getBenchmarkConfig`, `_analyticsBenchmark`, + обробники) |
| 14. Window exports | ~30 | Вивантаження у global scope для HTML handlers |

---

## Запропоноване розбиття (6 файлів)

| Файл | Рядки | Що переносимо |
|------|-------|---------------|
| **`src/tabs/finance.js`** (ядро) | ~600 | Секції 3, 4, 5, 10, 11. Основний `renderFinance`, state, `getFinanceContext`, `processFinanceAction` |
| **`src/tabs/finance-cats.js`** | ~280 | Секції 1, 2. Вся логіка категорій (бібліотека іконок, палітра, CRUD, міграції) |
| **`src/tabs/finance-modals.js`** | ~1100 | Секції 8, 9, 13 (модалка категорії). Всі модалки: транзакція, бюджет, категорія, дата-пікер, калькулятор |
| **`src/tabs/finance-analytics.js`** | ~400 | Секція 13 (частина Аналітика). `openFinAnalytics`, графіки, міні-метрики, benchmark |
| **`src/tabs/finance-insight.js`** | ~130 | Секція 7. `_refreshFinInsight`, промпт, кеш |
| **`src/tabs/finance-chat.js`** | ~150 | Секція 12. `sendFinanceBarMessage`, `addFinanceChatMsg` |

Секція 6 (свайп) — **залишити у finance.js** бо тісно пов'язана з `_finTxsBlock` (DOM класи).

---

## Порядок робіт (фази)

### Фаза 1 — Винесення категорій (найменший ризик)
**Чому перше:** категорії — чиста логіка, мінімум залежностей, 27 експортів зменшиться до ~15 у ядрі.

1. Створити `src/tabs/finance-cats.js` через скіл `/new-file`
2. Перенести: `FIN_CAT_ICONS`, `FIN_CAT_PALETTE`, `FIN_DEFAULT_ICONS`, `FIN_DEFAULT_SUBCATS`, `_makeCatObj`, `_migrateFinCats`, `getFinCats`, `saveFinCats`, `findFinCatById`, `createFinCategory`, `updateFinCategory`, `deleteFinCategory`, `mergeFinCategories`, `addFinSubcategory`, `findFinCatByName`, `pickRandomCatColor`, `finCatIcon`, `FIN_CAT_ICON_NAMES`
3. У `finance.js` — тільки `import` з нового файлу + re-export для backward compat (бо `habits.js` і `inbox.js` імпортують `createFinCategory` з `finance.js`)
4. Тест: додати транзакцію з новою категорією → перевірити що категорія створилась, сітка рендериться

### Фаза 2 — Винесення Аналітики
1. Створити `src/tabs/finance-analytics.js`
2. Перенести: `openFinAnalytics`, `closeFinAnalytics`, `_buildAnalyticsContent`, `_analyticsChart`, `_analyticsMiniMetrics`, `_getBenchmarkConfig`, `_analyticsBenchmark`, state (`_analyticsChartMode`, `_analyticsMiniIdx`, `_analyticsBenchmarkEdit`), обробники (`setAnalyticsChartMode`, `shiftAnalyticsMini`, `toggleAnalyticsBenchmarkEdit`, `setBenchmarkField`, `resetBenchmarkConfig`, `_refreshAnalyticsContent`)
3. Тест: відкрити 📊 → перемикач 3 режимів графіка → стрілки міні-метрик → Редагування benchmark

### Фаза 3 — Винесення інсайту
1. Створити `src/tabs/finance-insight.js`
2. Перенести: `FIN_INSIGHT_TTL`, `_finInsightHash`, `_finDailyInsight`, `_refreshFinInsight`
3. `_finDailyInsight` імпортується у `renderFinance` з нового файлу

### Фаза 4 — Винесення Chat bar
1. Створити `src/tabs/finance-chat.js`
2. Перенести: `_financeTypingEl`, `financeBarHistory`, `financeBarLoading`, `addFinanceChatMsg`, `sendFinanceBarMessage`
3. Тест: чат-бар Фінансів → транзакція через чат → Inbox картка (B-71 regression check)

### Фаза 5 — Винесення модалок
**Найбільший і найризикованіший блок.** Модалки мають багато shared state.

1. Створити `src/tabs/finance-modals.js`
2. Перенести всі 3 модалки з їхнім state і handlers
3. Обережно зі `setupModalSwipeClose` import з `tasks.js`
4. Тест: тап на категорію → модалка → додати транзакцію, потім редагувати; режим ✎ → редагування категорії; бюджет

### Фаза 6 — Cleanup + оновлення документації
1. Видалити закоментований код
2. Оновити `CLAUDE.md` → файлова структура: 6 нових файлів
3. Оновити `docs/ARCHITECTURE.md` → нова діаграма залежностей
4. Перевірити circular dependencies (finance ↔ inbox ↔ habits)

---

## Ризики (що може зламатись)

1. **Circular dependencies:** `finance.js` імпортується з `habits.js`, `inbox.js`, `evening.js`, `projects.js`. При розбитті на 6 файлів — кожен із них може потрапити у цикл з одним з цих. **Мітігація:** спочатку робити Фазу 1-4 (чисте розбиття), Фазу 5 (модалки) — тільки коли впевнений.
2. **Window exports (inline onclick у HTML):** більшість функцій модалок викликаються з `onclick="..."` у HTML string'ах. Всі вони зареєстровані через `Object.assign(window, {...})`. При винесенні у окремий файл — цей `Object.assign` має виконатись ПІСЛЯ імпорту. **Мітігація:** кожен новий файл робить свій `Object.assign(window, {...})` при завантаженні.
3. **Shared state:** модалка транзакції + модалка категорії мають свої приватні `let _finEditId`, `_finCatModalDraft` тощо. При розбитті — ці змінні мають залишитись у тому ж файлі де вони використовуються.
4. **Tight coupling з `renderFinance`:** `_finCatsGrid`, `_finTxsBlock`, `_refreshFinInsight` викликаються напряму з `renderFinance`. При винесенні — імпортувати назад.

---

## Коли НЕ робити

- Якщо є критичний баг у Фінансах (зараз нема — всі 🔴/🟡 закриті у cnTkD)
- Якщо Роман щойно тестує нову фічу і вона ще не стабільна
- Якщо збирається великий деплой з UI змінами — рефакторинг поруч легко ламає

**Оптимальний момент — зараз:** баги закриті, тестування стабільне, є тиждень-два до наступних великих фіч.

---

## Після рефакторингу

Оновити:
- `CLAUDE.md` → "Файлова структура" таблицю (6 нових файлів, опис кожного)
- `START_HERE.md` → дерево файлів
- `docs/ARCHITECTURE.md` → діаграму залежностей Finance-*
- `ROADMAP.md` → відмітити виконану задачу у Blocks

---

## Чек-лист успішного рефакторингу

- [ ] `src/tabs/finance.js` ≤ 700 рядків
- [ ] Жодних circular dependencies (`node build.js` без попереджень)
- [ ] Всі window exports працюють (онклік у HTML string'ах)
- [ ] Smoke-тест: додати транзакцію через + → видалити свайпом → відкрити модалку категорії → зберегти → відкрити Аналітику → перемикнути графік → чат-бар "кава 10" → Inbox картка
- [ ] CACHE_NAME bump
- [ ] Запис у `docs/CHANGES.md`
