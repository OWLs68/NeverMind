// === tool-filter.js — Dynamic Tool Loading (V3 Фаза 1.5, винесено з core.js v3pexs) ===
//
// Regex-класифікатор: з повного набору (~60 tools) лишає лише релевантні
// категорії під текст юзера → економія ~30-40% токенів на запит + менше плутанини
// для моделі. Базові tools завжди включені. Слабкий матч → повний fallback.
//
// ⚠️ Винесено у src/data/ (як intent-router/dispatcher-guards/habit-classifier)
// щоб бути ЧИСТИМ і node-тестованим (`scripts/check-tool-filter.js`). core.js
// не запускається у node (браузерні імпорти) → класифікатор там був непокритий
// тестом → і саме там тихо помер баг \b-кирилиця (фільтр не матчив укр-текст,
// мовчки слав повний набір щоразу). Тепер контракт-тест стереже від рецидиву.
//
// Межа CYR_BL/CYR_BR — єдине джерело правди з intent-router.js (НЕ /\b/: у JS
// \b рахує межу лише по латиниці → /\b(кирилиця)/ ніколи не матчить укр-слово).

import { BL as CYR_BL, BR as CYR_BR } from './intent-router.js';

// Базові tools — завжди у наборі (модель може потребувати для будь-якого запиту).
export const BASE_TOOL_NAMES = new Set([
  'save_memory_fact', 'save_task', 'save_note', 'save_finance', 'create_event', 'clarify',
  'switch_tab', 'request_quiet'
]);

export const TOOL_CATEGORIES = {
  finance: {
    rx: new RegExp(CYR_BL + '(гр(н|івн)|€|\\$|usd|usdt|eur|витрат|дохо|оплат|плат[іиї]|ціна|сума|бюджет|категор[іи]|підкатегор|зарплат|грош|каса|платіж)', 'i'),
    tools: ['save_finance', 'update_transaction', 'delete_transaction', 'set_finance_budget', 'add_finance_category', 'rename_finance_category', 'delete_finance_category', 'add_finance_subcategory', 'rename_finance_subcategory', 'delete_finance_subcategory', 'set_finance_period', 'open_finance_analytics']
  },
  habit: {
    rx: new RegExp(CYR_BL + '(звичк|щодня|повторюй|кожен ?(день|ранок|вечір)|трекер|стрік|streak)', 'i'),
    tools: ['save_habit', 'edit_habit', 'delete_habit', 'complete_habit']
  },
  task: {
    rx: new RegExp(CYR_BL + '(задач|треба зробити|нагада[йт]|напомни|зроби|куп(и|ити)' + CYR_BR + '|відправ|зателефонуй|написати|подати|оплатити|поприбирай|поміняй)', 'i'),
    tools: ['save_task', 'edit_task', 'delete_task', 'complete_task', 'reopen_task', 'add_step', 'set_reminder']
  },
  list: {
    rx: new RegExp(CYR_BL + '(список|переліку?|перелік|чеклист|чекліст|куп(и|ити)' + CYR_BR + ')', 'i'),
    tools: ['save_list', 'delete_list']
  },
  event: {
    rx: new RegExp(CYR_BL + '(подія|подію|зустріч|прийом|приїзд|концерт|рейс|тренуван|відміни|відмін|перенес|завтра|післязавтра|сьогодні о|у (понеділ|вівтор|серед|четвер|пятниц|субот|неділ))', 'i'),
    tools: ['create_event', 'edit_event', 'delete_event', 'open_calendar']
  },
  // health category REMOVED (EU AI Act compliance JMQuT 17.05.2026) — AI більше не вгадує health-tools за регексом симптомів.
  note: {
    rx: new RegExp(CYR_BL + '(нотатк|запиши думк|щоден|рефлекс|папк[уи])', 'i'),
    tools: ['save_note', 'edit_note', 'move_note', 'delete_folder']
  },
  project: {
    rx: new RegExp(CYR_BL + '(проект|ремонт|запуск|розробк|організац|крок проект|етап|віх|milestone|метрик|ризик)', 'i'),
    tools: ['create_project', 'complete_project_step', 'add_project_step', 'update_project_progress', 'add_project_decision', 'add_project_metric', 'add_project_resource', 'update_project_tempo', 'update_project_risks']
  },
  moment: {
    rx: new RegExp(CYR_BL + '(момент|щойно|поїхав|зустрів(ся|ла)|побачив|був на)', 'i'),
    tools: ['save_moment']
  },
  routine: {
    rx: new RegExp(CYR_BL + '(розклад|розпорядок|прокидаюсь|лягаю|режим дня)', 'i'),
    tools: ['save_routine']
  },
  trash: {
    rx: new RegExp(CYR_BL + '(відновити|повернути назад|з кошика|undo|поверни)', 'i'),
    tools: ['restore_deleted']
  },
  memory: {
    rx: new RegExp(CYR_BL + '(запамʼятай|що ти про мене|памʼять|memory)', 'i'),
    tools: ['save_memory_fact', 'open_memory']
  },
  ui: {
    rx: new RegExp(CYR_BL + '(відкрий|покажи|перейди|переключи|режим тиші|дай спокій|не доставай|тренер|партнер|ментор)', 'i'),
    tools: ['switch_tab', 'open_settings', 'set_owl_mode', 'request_quiet']
  }
};

export function selectRelevantTools(userText, fullTools) {
  if (!userText || typeof userText !== 'string' || !Array.isArray(fullTools)) return fullTools;
  const text = userText.toLowerCase();
  const matched = new Set();
  let hits = 0;
  for (const cat of Object.values(TOOL_CATEGORIES)) {
    if (cat.rx.test(text)) {
      hits++;
      cat.tools.forEach(n => matched.add(n));
    }
  }
  // Якщо нема матчу або матчів забагато (>4 категорій — амбівалентний запит) — повний набір.
  if (hits === 0 || hits > 4) return fullTools;
  // Завжди додаємо базові tools.
  BASE_TOOL_NAMES.forEach(n => matched.add(n));
  const filtered = fullTools.filter(t => matched.has(t.function?.name));
  // Sanity check — мінімум 5 tools має лишитись.
  return filtered.length >= 5 ? filtered : fullTools;
}
