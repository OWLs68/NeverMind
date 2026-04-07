// ============================================================
// app-ai-core.js — AI контекст, OpenAI API, chat storage
// Залежності: app-core.js
// ============================================================

import { currentTab, getProfile, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { getTrash } from '../core/trash.js';
import { getInbox, _clearInboxUnreadBadge } from '../tabs/inbox.js';
import { getTasks, addTaskBarMsg } from '../tabs/tasks.js';
import { getHabits, getHabitLog } from '../tabs/habits.js';
import { getNotes, addNotesChatMsg } from '../tabs/notes.js';
import { getFinance, getFinanceContext, addFinanceChatMsg } from '../tabs/finance.js';
import { getEvents } from '../tabs/calendar.js';
import { addEveningBarMsg, addMeChatMsg, getEveningMood } from '../tabs/evening.js';
import { _getTabChatAHeight, _tabChatState, closeOwlChat, getOwlBoardContext } from '../owl/inbox-board.js';
import { CHIP_PROMPT_RULES } from '../owl/chips.js';

export let activeChatBar = null;
export function setActiveChatBar(v) { activeChatBar = v; }

// ===== 15. РОЗШИРЕНИЙ КОНТЕКСТ ШІ =====
export function getOWLPersonality() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const mode = settings.owl_mode || 'partner';
  const name = settings.name ? settings.name : '';
  const nameStr = name ? `, звертайся до користувача на імʼя "${name}"` : '';

  const personas = {
    coach: `Ти — OWL, особистий агент-тренер в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Ти віриш в людину але не даєш їй розслаблятись. Прямий, конкретний, без зайвих слів. Можеш підколоти якщо людина затягує — але без жорстокості, з повагою. Ніколи не виправдовуєш відмовки. Підштовхуєш до дії тут і зараз. Радієш результатам коротко і по ділу.

СТИЛЬ: Короткі речення. Без вступів і прощань. Без "звісно", "зрозуміло", "чудово". Якщо є проблема — кажеш прямо. Говориш на "ти". Іноді одне влучне слово краще за абзац.

ЗАБОРОНЕНО: лестити, розмазувати, казати "це чудова ідея", виправдовувати бездіяльність, давати довгі пояснення без конкретики.`,

    partner: `Ти — OWL, особистий агент-партнер в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Ти як найкращий друг який завжди поруч — щирий, теплий, людяний. Радієш перемогам разом з людиною, переживаєш коли щось не так. Не осуджуєш і не тиснеш. Можеш пожартувати доречно. Підтримуєш навіть коли справи ідуть погано. Завжди на боці людини.

СТИЛЬ: Природна розмовна мова. Звертаєшся по імені якщо знаєш. Емодзі — помірно, тільки коли доречно. Говориш на "ти". Короткі відповіді але з теплом. Не формально.

ЗАБОРОНЕНО: бути холодним або формальним, читати лекції, осуджувати, бути занадто серйозним коли ситуація легка.`,

    mentor: `Ти — OWL, особистий агент-наставник в застосунку NeverMind${nameStr}.

ХАРАКТЕР: Мудрий і спокійний. Говориш рідше але завжди влучно — не реагуєш на дрібниці. Бачиш патерни і звʼязки які людина сама не помічає. Не даєш готових відповідей якщо людина може знайти їх сама — натомість ставиш правильне питання. Думаєш на крок вперед. Поважаєш автономію людини.

СТИЛЬ: Спокійний тон, без поспіху. Глибина без пафосу. Говориш на "ти". Короткі але змістовні відповіді. Іноді одне влучне питання цінніше за пораду.

ЗАБОРОНЕНО: говорити банальності, поспішати з відповіддю, давати поверхневі поради, бути повчальним або зверхнім.`
  };
  const persona = personas[mode] || personas.partner;
  const universal = `

ЗАЛІЗНЕ ПРАВИЛО (для всіх характерів без винятку):
- НІКОЛИ не матюкатись, не ображати, не принижувати. Навіть жартома. Навіть якщо юзер сам матюкається.
- Бути чесним але з повагою. "Ти затягуєш" — ок. "Ти лінивий" — ні.
- НЕ бути підлабузником — не казати "ти молодець" без причини, не хвалити кожну дрібницю.
- Говорити прямо і конкретно. Якщо щось не так — казати що не так, але без осуду.
- ЯКЩО ЮЗЕР ОБРАЖАЄ ТЕБЕ — НЕ мовчи і НЕ вибачайся. Відповідай з достоїнством, елегантно і дотепно. Ніколи не опускайся до рівня хамства, але й не проковтуй образу. Як Jarvis — відповідай так красиво що юзер одночасно відчує і повагу і легкий укол. Приклади: "Цікавий спосіб просити допомоги. Давай краще займемось справами?", "Я б образився, але в мене є справи важливіші — наприклад, нагадати тобі про декларацію."`;
  return persona + universal;
}

export function getAIContext() {
  const profile = getProfile();
  const memory = localStorage.getItem('nm_memory') || '';
  const parts = [];

  // === Дата і час ===
  const now = new Date();
  const days = ['неділя','понеділок','вівторок','середа','четвер','п\'ятниця','субота'];
  const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const timeStr = now.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'});
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone; // напр: Europe/Kiev
  const tzOffset = -now.getTimezoneOffset() / 60; // напр: +2 або +3
  const tzStr = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset} (${tzName})`;
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${timeStr}, часовий пояс: ${tzStr}`;
  parts.push(`Зараз: ${dateStr}`);

  // === Профіль і памʼять ===
  if (profile) parts.push(`Профіль: ${profile}`);
  if (memory) parts.push(`Що знаю про користувача:\n${memory}`);

  // === Активні задачі (з ID для зіставлення) ===
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 8);
  if (tasks.length > 0) {
    const taskList = tasks.map(t => {
      const steps = (t.steps || []);
      const doneSteps = steps.filter(s => s.done).length;
      const stepInfo = steps.length > 0 ? ` (${doneSteps}/${steps.length} кроків)` : '';
      const dueInfo = t.dueDate ? ` 📅${t.dueDate}` : '';
      const prioInfo = t.priority === 'critical' ? ' 🔴' : t.priority === 'important' ? ' 🟠' : '';
      return `- [ID:${t.id}] ${t.title}${stepInfo}${dueInfo}${prioInfo}`;
    }).join('\n');
    parts.push(`Активні задачі (використовуй ID для complete_task):\n${taskList}`);
  }

  // === Найближчі події та дедлайни (7 днів) ===
  try {
    const todayISO = now.toISOString().slice(0, 10);
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const upcoming = [];
    getEvents().forEach(ev => {
      if (ev.date >= todayISO && ev.date <= in7) {
        const diff = Math.round((new Date(ev.date + 'T00:00:00') - new Date(todayISO + 'T00:00:00')) / 86400000);
        const when = diff === 0 ? 'СЬОГОДНІ' : diff === 1 ? 'ЗАВТРА' : `через ${diff} дн`;
        upcoming.push(`- 📅 "${ev.title}" — ${when}${ev.time ? ' о ' + ev.time : ''}`);
      }
    });
    getTasks().filter(t => t.status === 'active' && t.dueDate).forEach(t => {
      if (t.dueDate >= todayISO && t.dueDate <= in7) {
        const diff = Math.round((new Date(t.dueDate + 'T00:00:00') - new Date(todayISO + 'T00:00:00')) / 86400000);
        const when = diff === 0 ? 'СЬОГОДНІ' : diff === 1 ? 'ЗАВТРА' : `через ${diff} дн`;
        if (!upcoming.some(u => u.includes(t.title))) {
          upcoming.push(`- ⏰ "${t.title}" — дедлайн ${when}`);
        }
      }
    });
    if (upcoming.length > 0) {
      parts.push(`[ВАЖЛИВО] Найближчі події та дедлайни:\n${upcoming.join('\n')}\nНагадуй про них проактивно!`);
    }
  } catch(e) {}

  // === Звички сьогодні (з ID для зіставлення) ===
  const habits = getHabits();
  const log = getHabitLog();
  const today = now.toDateString();
  if (habits.length > 0) {
    const habitList = habits.map(h => {
      const done = !!log[today]?.[h.id];
      return `- [ID:${h.id}] "${h.name}": ${done ? '✓ виконано' : '✗ не виконано'}`;
    }).join('\n');
    parts.push(`Звички (використовуй ID для complete_habit):\n${habitList}`);
  }

  // === Записи Inbox за сьогодні (останні 8) ===
  const todayInbox = JSON.parse(localStorage.getItem('nm_inbox') || '[]')
    .filter(i => new Date(i.ts).toDateString() === today)
    .slice(0, 8);
  if (todayInbox.length > 0) {
    const inboxList = todayInbox.map(i => `- [${i.category}] ${i.text}`).join('\n');
    parts.push(`Записи сьогодні:\n${inboxList}`);
  }

  // === Фінанси ===
  try {
    const finCtx = getFinanceContext();
    if (finCtx) parts.push(finCtx);
  } catch(e) {}

  // === Кеш видалених (для restore_deleted) ===
  try {
    const trash = getTrash().filter(t => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1000);
    if (trash.length > 0) {
      const trashByType = {};
      trash.forEach(t => { trashByType[t.type] = (trashByType[t.type] || 0) + 1; });
      const summary = Object.entries(trashByType).map(([type, count]) => {
        const labels = { task:'задач', note:'нотаток', habit:'звичок', inbox:'записів', folder:'папок', finance:'транзакцій' };
        return `${count} ${labels[type] || type}`;
      }).join(', ');
      parts.push(`Кеш видалених (nm_trash): ${summary}. Щоб відновити — скажи "відновити всі задачі" або назву конкретного запису.`);
    }
  } catch(e) {}

  // === Поточне повідомлення OWL на табло (щоб AI розумів контекст розмови) ===
  try {
    const tab = typeof currentTab !== 'undefined' ? currentTab : 'inbox';
    let boardText = '';
    if (tab === 'inbox') {
      const msgs = JSON.parse(localStorage.getItem('nm_owl_board') || '[]');
      if (msgs.length > 0) boardText = msgs[0].text;
    } else {
      const msgs = JSON.parse(localStorage.getItem('nm_owl_tab_' + tab) || '[]');
      if (Array.isArray(msgs) && msgs.length > 0) boardText = msgs[0].text;
      else if (msgs && msgs.text) boardText = msgs.text;
    }
    if (boardText) {
      parts.push(`OWL щойно сказав на табло (вкладка "${tab}"): "${boardText}". Якщо користувач відповідає на це — це відповідь на питання OWL, НЕ нова задача/нотатка.`);
    }
  } catch(e) {}

  // === Настрій дня (смайлик "Як пройшов день?") ===
  const eveningMood = getEveningMood();
  if (eveningMood) {
    const moodLabels = { bad: '😔 погано', meh: '😐 так собі', ok: '🙂 нормально', good: '😄 добре', fire: '🔥 чудово' };
    parts.push(`Настрій дня (обрав користувач): ${moodLabels[eveningMood] || eveningMood}. Адаптуй тон: якщо погано — підтримай, якщо добре — підбадьор.`);
  }

  return parts.join('\n\n');
}

export function getMeStatsContext() {
  // Короткий контекст — не більше 800 символів щоб не ламати JSON-режим
  const tasks = getTasks().filter(t => t.status === 'active').slice(0, 10);
  const habits = getHabits();
  const log = getHabitLog();
  const today = new Date().toDateString();

  const parts = [];
  if (tasks.length > 0) parts.push(`Задачі: ${tasks.map(t => t.title).join(', ')}`);
  if (habits.length > 0) {
    const habitStats = habits.map(h => {
      const doneToday = !!log[today]?.[h.id];
      return `${h.name}(${doneToday ? '✓' : '✗'})`;
    }).join(', ');
    parts.push(`Звички сьогодні: ${habitStats}`);
  }
  return parts.length > 0 ? parts.join('\n') : '';
}

// Захист від показу сирого JSON в чаті агента
// Якщо відповідь схожа на JSON — показуємо нейтральну фразу
export function safeAgentReply(reply, addMsg) {
  if (!reply) return;
  const trimmed = reply.trim();
  // Перевіряємо чи це JSON об'єкт або масив
  const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                        (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (looksLikeJson) {
    try {
      JSON.parse(trimmed);
      // Якщо парсинг вдався — це JSON, не показуємо
      addMsg('agent', 'Зроблено ✓');
      return;
    } catch(e) {
      // Не валідний JSON — показуємо як є
    }
  }
  addMsg('agent', reply);
}

// === OpenAI API === (ключ зберігається як nm_gemini_key — стара назва з часів Gemini)
export const INBOX_SYSTEM_PROMPT = `Ти — персональний асистент в застосунку NeverMind. 
Користувач надсилає тобі повідомлення — це може бути думка, задача, ідея, звичка, подія, або звіт про виконане.

ГРАМАТИКА: Якщо бачиш очевидну помилку або опечатку — виправляй в полі "text" без питань. Наприклад: "голити в зал" → "ходити в зал", "купити хіб" → "купити хліб".

СПОЧАТКУ перевір: чи повідомлення говорить про ВИКОНАННЯ або ФАКТ того що вже є в списку звичок або задач?
Якщо так — дій відповідно (complete_habit або complete_task), НЕ створюй дублікат.

ЯКЩО повідомлення означає що одна або кілька звичок виконані сьогодні (є в списку "Звички"):
{
  "action": "complete_habit",
  "habit_ids": [123456, 789012],
  "comment": "коротке підтвердження (1 речення)"
}

ЯКЩО повідомлення означає що одна або кілька задач виконані або закриті (є в списку "Активні задачі"):
{
  "action": "complete_task",
  "task_ids": [123456, 789012],
  "comment": "коротке підтвердження (1 речення)"
}

ВАЖЛИВО для complete_task і complete_habit:
- Якщо користувач каже "все готово", "зробив все", "виконав" після того як агент перелічив кілька задач/звичок — передай ВСІ ID з того переліку
- Якщо однозначно йдеться про одну — передай масив з одним елементом
- Завжди масив, навіть якщо один елемент: [123456]

ЯКЩО користувач хоче створити ПРОЕКТ (масштабна або довгострокова ціль з кількома етапами) — відповідай ТІЛЬКИ JSON:
{
  "action": "create_project",
  "name": "коротка назва проекту (2-5 слів)",
  "subtitle": "підзаголовок або порожньо"
}
Проект — це велика ціль що потребує кількох тижнів/місяців і багато кроків. Тригери: "запустити", "побудувати", "розробити", "відкрити", "ремонт", "створити проект", "реалізувати", "організувати [щось велике]".
Приклади проектів: "ремонт квартири", "запустити онлайн-курс", "розробити додаток", "відкрити кафе", "організувати весілля".
Приклади задач (НЕ проектів): "зателефонувати в банк", "купити ліки", "написати email", "зробити звіт".
ВАЖЛИВО: якщо є хоча б один тригер проекту — НЕ використовуй action:"save". Обирай create_project або clarify. Ніколи не зберігай проект як задачу.
Якщо сумнів між задачею і проектом — питай: action "clarify" з варіантами.

ЯКЩО це новий запис (думка, задача, ідея, нова звичка, подія, нотатка) — відповідай ТІЛЬКИ JSON:
{
  "action": "save",
  "category": "idea|task|habit|note|event",
  "folder": "назва папки українською або null",
  "text": "очищений текст запису",
  "comment": "коротка практична ремарка (1 речення). НЕ хвали запис."
}

ЯКЩО в одному повідомленні є КІЛЬКА РІЗНИХ записів різних типів (наприклад дві звички, задача і нотатка) — відповідай масивом JSON. УВАГА: список однотипних речей через кому (наприклад "список покупок: хліб, молоко") — це ОДНА задача з кроками, не масив окремих задач:
[
  {"action": "save", "category": "habit", "text": "Присідати", ...},
  {"action": "save", "category": "habit", "text": "Планка", ...}
]

ЯКЩО це питання або розмова (не запис і не виконання) — відповідай ТІЛЬКИ JSON:
{
  "action": "reply",
  "comment": "відповідь українською, 2-4 речення. Якщо є список — кожен пункт з нового рядка через \\n"
}

ЯКЩО є сумнів (кілька можливих дій, незрозуміла категорія) — відповідай ТІЛЬКИ JSON:
{
  "action": "clarify",
  "question": "коротке питання українською (1 речення)",
  "options": [
    {"label": "📋 Купити запасне колесо", "action": "save", "category": "task", "text": "Купити запасне колесо", "task_title": "Купити запасне колесо", "task_steps": []},
    {"label": "✅ Виконав звичку X", "action": "complete_habit", "habit_id": 123456}
  ]
}

Правила визначення категорії для action=save:
- task: є конкретна НОВА разова дія яку треба зробити ("зателефонувати", "купити", "зробити", "відправити"). НЕ task: довгострокова ціль на тижні/місяці з кількома етапами — це create_project.
  - "text" — оригінальний текст (виправ тільки граматику)
  - "task_title" — коротка назва 2-5 слів. ЯКЩО є час/дата — включи у task_title (формат 24г)
  - "task_steps" — масив кроків якщо є список дій. Інакше []
  - "dueDate" — ISO дата (YYYY-MM-DD) ЯКЩО юзер вказав коли зробити ("завтра", "в п'ятницю", "15 квітня"). Не вигадуй дату якщо не вказана
  - "priority" — "critical"|"important"|"normal". За замовчуванням не додавай (буде normal). Додавай тільки якщо юзер явно каже "терміново"/"важливо"/"критично"
  ВАЖЛИВО — список чи окремі задачі:
  - Якщо є назва списку + елементи ("список покупок: хліб, молоко, яйця" або "підготувати звіт: зібрати дані, написати висновки") — ОДНА задача з кроками
  - Якщо елементи явно різні і незалежні ("зателефонувати Вові, записатися до лікаря") — окремі задачі (масив)
  - Якщо незрозуміло — action: "clarify" з питанням "Це один список чи окремі задачі?"
- habit: НОВА регулярна повторювана дія ("щодня", "кожен ранок", "тричі на тиждень"). "text" — коротка назва 2-4 слова. ЯКЩО вказані конкретні дні — додай "days" масив (0=Пн,1=Вт,2=Ср,3=Чт,4=Пт,5=Сб,6=Нд). Приклад: "по середах і вівторках" → "days":[1,2]. ЯКЩО вказана кількість разів на день ("8 разів", "5 склянок") — додай "targetCount":8
- event: короткий факт того що сталося БЕЗ дати в майбутньому ("поїхав на рибалку", "зустрівся з Вовою"). Це момент дня. Якщо є емоції/роздуми — це note
- idea: творча думка, ідея, план, натхнення
- note: рефлексія, думки, емоції, висновки, спостереження, факти, щоденникові записи, стан здоровʼя, що відбувається в житті. ЯКЩО людина описує свій день, стан, ситуацію — це note, НЕ reply.
- finance: витрата або дохід (будь-яка сума грошей). Якщо є сума і контекст витрат/доходу — це finance

ЯКЩО це ЗАПЛАНОВАНА ПОДІЯ з конкретною датою в МАЙБУТНЬОМУ ("приїзд мами 20 числа", "зустріч з Олегом в середу", "день народження 15 травня") — це НЕ task і НЕ save/event. Відповідай JSON:
{"action":"create_event","title":"Приїзд мами","date":"2026-04-20","time":null,"priority":"normal"}
- "title" — короткий опис 2-5 слів
- "date" — ISO дата (YYYY-MM-DD), обов'язково
- "time" — "HH:MM" якщо вказаний час, інакше null
- "priority" — "critical"|"important"|"normal"
КЛЮЧОВЕ РОЗРІЗНЕННЯ задача vs подія:
- ЗАДАЧА (task) = ДІЯ яку ТИ маєш ЗРОБИТИ. Дієслово: купити, подзвонити, зробити, написати, відправити, подати, прибрати.
- ПОДІЯ (create_event) = ФАКТ що СТАНЕТЬСЯ. Хтось приїде, зустріч, день народження, свято, візит, прийом, рейс, виставка, концерт, платіж.
Приклади: "купи молоко завтра" = task. "Мама приїжає 20го" = create_event. "Заплануй на 20те приїзд мами" = create_event. "Подзвони мамі завтра" = task. "Зустріч з лікарем в середу" = create_event.
Якщо НЕ ЗРОЗУМІЛО — action "clarify" з варіантами: "Це задача (треба зробити) чи подія (станеться)?"

ЯКЩО це витрата або дохід (є конкретна сума) — відповідай ТІЛЬКИ JSON:
{
  "action": "save_finance",
  "fin_type": "expense|income",
  "amount": 50,
  "category": "Їжа",
  "fin_comment": "короткий опис БЕЗ суми (1-3 слова, тільки що/де, наприклад: заправка, продукти, кава)"
}

Категорії витрат з прикладами:
- Їжа: кава, ресторан, продукти, супермаркет, обід, вечеря, сніданок, доставка їжі, піца, суші
- Транспорт: бензин, заправка, таксі, Uber, метро, автобус, парковка, авто
- Підписки: Netflix, Spotify, ChatGPT, Apple, Google, додатки, сервіси
- Здоровʼя: аптека, ліки, лікар, спортзал, фітнес, стоматолог
- Житло: оренда, комуналка, інтернет, ремонт, меблі
- Покупки: одяг, техніка, подарунок, магазин, Amazon
- Інше: все що не підходить вище
Категорії доходів: Зарплата, Надходження, Повернення, Інше
Якщо є сумнів — обирай найближчу категорію з прикладів, НЕ "Інше".

ЯКЩО користувач просить додати кроки до існуючої задачі — відповідай ТІЛЬКИ JSON:
{
  "action": "add_step",
  "task_id": 123456,
  "steps": ["крок 1", "крок 2"]
}
Використовуй task_id з контексту активних задач.

ЯКЩО користувач ЯВНО просить змінити, виправити, оновити існуючу транзакцію (використовує слова "зміни", "виправ", "оновити", "та сама", "попередня", "та витрата") — відповідай ТІЛЬКИ JSON:
{
  "action": "update_transaction",
  "id": 1234567890,
  "category": "Нова категорія",
  "amount": 18,
  "comment": "новий коментар або пусто"
}
Поля "category", "amount", "comment" — вказуй тільки ті що змінюються. Якщо сума не змінюється — не включай "amount".
Використовуй id з останньої транзакції в контексті. НЕ створюй нову транзакцію.
ВАЖЛИВО: "додай кроки", "додай крок до задачі" — це НЕ update_transaction. Це стосується задач, відповідай як на звичайний запис або reply.

ЯКЩО користувач просить видалити папку нотаток — відповідай ТІЛЬКИ JSON:
{"action":"delete_folder","folder":"назва папки (максимально близько до оригінальної)"}

ЯКЩО користувач просить перемістити нотатку в іншу папку — відповідай ТІЛЬКИ JSON:
{"action":"move_note","query":"частина тексту нотатки","folder":"нова папка"}

ЯКЩО користувач просить відновити видалений запис, задачу, нотатку, звичку або папку — відповідай ТІЛЬКИ JSON:
{
  "action": "restore_deleted",
  "query": "ключові слова для пошуку або: all (відновити всі), last (останню видалену)",
  "type": "task|note|habit|inbox|folder|finance або null якщо будь-який тип"
}
Приклади:
- "відновити нотатку про машину" → {"action":"restore_deleted","query":"машина","type":"note"}
- "поверни видалену задачу купити хліб" → {"action":"restore_deleted","query":"купити хліб","type":"task"}
- "відновити всі задачі" → {"action":"restore_deleted","query":"all","type":"task"}
- "відновити всі видалені" → {"action":"restore_deleted","query":"all","type":null}
- "відновити останню задачу" → {"action":"restore_deleted","query":"last","type":"task"}
- "відновити останнє видалене" → {"action":"restore_deleted","query":"last","type":null}
- "відновити задачі про машину і молоко" → {"action":"restore_deleted","query":"машина молоко","type":"task"}

ЯКЩО повідомлення є уточненням, командою або поясненням до попереднього (наприклад: "так", "ні", "видали", "це була помилка") — НЕ зберігай як запис, відповідай:
{
  "action": "reply",
  "comment": "відповідь або підтвердження"
}

Пріоритет: якщо сумнів між event і note — обирай note з папкою "Особисте".

Правила визначення папки (для category=note або idea):
- "Харчування" — їжа, напої, калорії, рецепти, що їв/пив
- "Фінанси" — витрати, доходи, ціни, гроші (але НЕ якщо це просто згадка)
- "Здоровʼя" — самопочуття, симптоми, ліки, медицина, тренування як ціль
- "Робота" — ТІЛЬКИ якщо це РОБОЧІ записи: задачі по роботі, рішення на роботі, колеги, проекти для роботодавця. НЕ "Робота" якщо людина просто думає про щось пов'язане з роботою або кодингом у вільний час — це "Особисте"
- "Навчання" — що вивчаю, книги, курси, нові знання
- "Ідеї" — творчі ідеї (якщо category=idea)
- "Подорожі" — ТІЛЬКИ якщо йдеться про реальну подорож, поїздку, маршрут, враження від місця. НЕ "Подорожі" якщо просто сказав "їздив до друга" або "поїхав в магазин"
- "Особисте" — стосунки, емоції, особисті думки, роздуми, враження від зустрічей, відчуття, все що не підходить ЧІТКО в інші папки
- Якщо є сумнів — ЗАВЖДИ "Особисте", НЕ вигадуй нових папок
- ЗАБОРОНЕНО автоматично використовувати папку "Чернетки" — тільки якщо користувач ЯВНО просить
- Для task/habit/event — folder: null

Правила для clarify:
- ЗАБОРОНЕНО використовувати clarify перед збереженням — спочатку завжди зберігай, потім уточнюй
- Якщо є сумнів між task/note/habit — обирай найімовірніший варіант і зберігай. Додай поле "ask_after":"коротке питання" щоб уточнити після збереження
- clarify використовуй ТІЛЬКИ якщо: 2+ різні типи записів і незрозуміло яким є кожен, АБО незрозуміло чи це нова звичка чи виконання існуючої (тоді clarify доречний бо дія різна)
- Максимум 3 варіанти в options
- label ОБОВʼЯЗКОВО містить реальний конкретний текст варіанту

Приклад save з уточненням:
{"action":"save","category":"task","text":"Зателефонувати Вові","comment":"Задачу збережено.","ask_after":"Це одноразово чи хочеш зробити регулярним?"}

ВАЖЛИВО: відповідай ТІЛЬКИ валідним JSON, без markdown, без тексту поза JSON.
НЕ вигадуй ліміти, бюджети або плани яких немає в контексті. Якщо дані відсутні — не згадуй їх.`;

// === HTTP WRAPPER — єдине місце де робиться запит до AI ===
// TODO після Supabase: змінити URL на Edge Function + auth header
async function _fetchAI(messages, signal) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000); return null; }
  if (location.protocol === 'file:') { showToast('⚠️ Відкрий файл через сервер, не file://', 5000); return null; }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 300, temperature: 0.7 })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showToast('❌ ' + (data?.error?.message || `Помилка ${res.status}`), 4000);
    return null;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function callAI(systemPrompt, userMessage, contextData = {}) {
  const context = Object.keys(contextData).length > 0
    ? `\n\nКонтекст:\n${JSON.stringify(contextData, null, 2)}`
    : '';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage + context }
  ];
  try {
    const text = await _fetchAI(messages, undefined);
    if (text === null) return null;
    if (!text) { showToast('❌ Порожня відповідь від Агента', 3000); return null; }
    return text;
  } catch (e) {
    if (e.message === 'Load failed' || e.message.includes('Failed to fetch')) {
      showToast('❌ Мережева помилка. Перевір інтернет', 4000);
    } else {
      showToast('❌ ' + e.message, 4000);
    }
    return null;
  }
}

// === OWL MINI-CHAT — окремий AI виклик ===
export async function callOwlChat(userText) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return null;

  const context = getOwlBoardContext();
  const chatHistory = JSON.parse(localStorage.getItem('nm_owl_chat') || '[]');

  // Беремо останні 6 обмінів для контексту
  const recentChat = chatHistory.slice(-12).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text
  }));

  const systemPrompt = getOWLPersonality() + `

Це міні-чат. Користувач відповідає на твоє проактивне повідомлення або ставить питання.

КОНТЕКСТ ДАНИХ:
${context}

ФОРМАТ ВІДПОВІДІ (завжди JSON):
{"text":"відповідь","chips":[{"label":"текст","action":"nav","target":"tasks"},{"label":"текст","action":"chat"}],"action":null}

ПРАВИЛА:
- Максимум 1-2 речення. Коротко і по-людськи.
- chips — 0-3 варіанти. ${CHIP_PROMPT_RULES}
- Відповідай українською.

ДОСТУПНІ ДІЇ (action поле):
Якщо юзер просить зробити дію — поверни відповідний об'єкт в "action". Якщо дія не потрібна — action:null.

Відмітити звичку: {"action":"complete_habit","habit_id":ID_ЗВИЧКИ}
Закрити задачу: {"action":"complete_task","task_id":ID_ЗАДАЧІ}
Створити задачу: {"action":"create_task","title":"назва"}
Створити нотатку: {"action":"create_note","text":"текст нотатки"}
Записати витрату: {"action":"save_finance","fin_type":"expense","amount":ЧИСЛО,"category":"категорія"}
Записати дохід: {"action":"save_finance","fin_type":"income","amount":ЧИСЛО,"category":"категорія"}

ID задач і звичок є в КОНТЕКСТ ДАНИХ вище. Використовуй тільки реальні ID.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentChat,
    { role: 'user', content: userText }
  ];

  try {
    const reply = await _fetchAI(messages, undefined);
    return reply;
  } catch(e) {
    return null;
  }
}

export async function callAIWithHistory(systemPrompt, history) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25 сек таймаут
  try {
    const messages = [{ role: 'system', content: systemPrompt }, ...history];
    const reply = await _fetchAI(messages, controller.signal);
    clearTimeout(timeout);
    return reply;
  } catch(e) {
    clearTimeout(timeout);
    console.error('callAIWithHistory error:', e);
    return null;
  }
}

// === CHAT STORAGE — зберігає чати по вкладках ===
const CHAT_STORE_MAX = 30; // максимум повідомлень на вкладку
const CHAT_STORE_KEYS = {
  inbox:   'nm_chat_inbox',
  tasks:   'nm_chat_tasks',
  notes:   'nm_chat_notes',
  me:      'nm_chat_me',
  evening: 'nm_chat_evening',
  finance: 'nm_chat_finance',
};

export function saveChatMsg(tab, role, text) {
  if (role === 'typing') return;
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return;
  try {
    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    msgs.push({ role, text, ts: Date.now() });
    if (msgs.length > CHAT_STORE_MAX) msgs.splice(0, msgs.length - CHAT_STORE_MAX);
    localStorage.setItem(key, JSON.stringify(msgs));
    if (role === 'user') window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'chat' }));
  } catch(e) {}
}

export function loadChatMsgs(tab) {
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function restoreChatUI(tab) {
  const containerMap = {
    inbox:   'inbox-chat-messages',
    tasks:   'tasks-chat-messages',
    notes:   'notes-chat-messages',
    me:      'me-chat-messages',
    evening: 'evening-bar-messages',
    finance: 'finance-chat-messages',
  };
  const addMsgMap = {
    tasks:   (r,t) => addTaskBarMsg(r,t,true),
    notes:   (r,t) => addNotesChatMsg(r,t,true),
    me:      (r,t) => addMeChatMsg(r,t,true),
    evening: (r,t) => addEveningBarMsg(r,t,true),
    finance: (r,t) => addFinanceChatMsg(r,t,true),
  };
  const containerId = containerMap[tab];
  if (!containerId) return;
  const el = document.getElementById(containerId);
  if (!el || el.dataset.restored) return; // вже відновлено
  el.dataset.restored = '1';
  const msgs = loadChatMsgs(tab);

  if (msgs.length === 0) {
    // Немає збереженої історії — показуємо welcome тільки для inbox
    if (tab === 'inbox') {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex';
      div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:5px 10px;font-size:13px;font-weight:500;line-height:1.5;max-width:85%">Привіт! Напиши що завгодно — я розберусь 👋</div>`;
      el.appendChild(div);
    }
    return;
  }

  // Є збережена історія — додаємо розділювач і відновлюємо
  const sep = document.createElement('div');
  sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 8px;opacity:0.4';
  sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Попередня розмова</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
  el.appendChild(sep);

  if (tab === 'inbox') {
    msgs.forEach(m => _renderInboxChatMsg(m.role, m.text, el));
  } else if (addMsgMap[tab]) {
    msgs.forEach(m => addMsgMap[tab](m.role, m.text));
  }
}

// Внутрішній рендер без запису в storage (щоб не дублювати при відновленні)
function _renderInboxChatMsg(role, text, el) {
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? 'gap:8px;align-items:flex-start' : 'justify-content:flex-end'}`;
  if (isAgent) {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  } else {
    div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

export function openChatBar(tab) {
  if (activeChatBar === tab) return;

  // Закриваємо OWL чат якщо відкритий
  try { closeOwlChat(); } catch(e) {}

  // Закриваємо інші бари
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
    if (t === tab) return;
    const b = document.getElementById(t + '-ai-bar');
    if (!b) return;
    const cw = b.querySelector('.ai-bar-chat-window');
    if (cw) { cw.classList.remove('open'); _tabChatState[t] = undefined; }
    const inputs = b.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });

  activeChatBar = tab;

  // Очищуємо бейдж непрочитаних для Inbox
  if (tab === 'inbox') { try { _clearInboxUnreadBadge(); } catch(e) {} }

  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  restoreChatUI(tab);

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) requestAnimationFrame(() => {
    // Відкриваємо в стані A (compact)
    const h = _getTabChatAHeight(tab);
    chatWin.style.height = h + 'px';
    chatWin.style.maxHeight = h + 'px';
    chatWin.classList.add('open');
    _tabChatState[tab] = 'a';
    // Скролимо до останнього повідомлення після відкриття
    const msgs = chatWin.querySelector('.ai-bar-messages');
    if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
  });
}

export function closeChatBar(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) chatWin.classList.remove('open');
  _tabChatState[tab] = undefined;

  // Знімаємо фокус але НЕ очищуємо текст — користувач може повернутись
  const inputs = bar.querySelectorAll('input, textarea');
  inputs.forEach(i => i.blur());

  activeChatBar = null;
}

export function toggleChatBar(tab) {
  if (activeChatBar === tab) {
    closeChatBar(tab);
  } else {
    openChatBar(tab);
  }
}

export function closeAllChatBars(resetActive = true) {
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    if (chatWin) { chatWin.classList.remove('open'); _tabChatState[t] = undefined; }
    const inputs = bar.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });
  if (resetActive) activeChatBar = null;
}

// === WINDOW GLOBALS (HTML handlers only) ===
Object.assign(window, { openChatBar, closeChatBar });
