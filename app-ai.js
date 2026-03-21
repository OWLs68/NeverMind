// ============================================================
// app-ai.js — ШІ — OWL personality, AI context, callAI, chat storage, OWL board
// Функції: getOWLPersonality, getAIContext, callAI, callAIWithHistory, saveChatMsg, restoreChatUI, openChatBar, generateOwlBoardMessage, tryOwlBoardUpdate
// Залежності: app-core.js
// ============================================================

// ===== 15. РОЗШИРЕНИЙ КОНТЕКСТ ШІ =====
function getOWLPersonality() {
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
  return personas[mode] || personas.partner;
}

function getAIContext() {
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
      return `- [ID:${t.id}] ${t.title}${stepInfo}`;
    }).join('\n');
    parts.push(`Активні задачі (використовуй ID для complete_task):\n${taskList}`);
  }

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

  return parts.join('\n\n');
}

function getMeStatsContext() {
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


// === OpenAI API === (ключ зберігається як nm_gemini_key — стара назва з часів Gemini)
const INBOX_SYSTEM_PROMPT = `Ти — персональний асистент в застосунку NeverMind. 
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
- task: є конкретна НОВА дія яку треба зробити ("зателефонувати", "купити", "зробити", "відправити")
  - "text" — оригінальний текст (виправ тільки граматику)
  - "task_title" — коротка назва 2-5 слів. ЯКЩО є час/дата — включи у task_title (формат 24г)
  - "task_steps" — масив кроків якщо є список дій. Інакше []
  ВАЖЛИВО — список чи окремі задачі:
  - Якщо є назва списку + елементи ("список покупок: хліб, молоко" або "ремонт: купити фарбу, найняти майстра") — ОДНА задача з кроками
  - Якщо елементи явно різні і незалежні ("зателефонувати Вові, записатися до лікаря") — окремі задачі (масив)
  - Якщо незрозуміло — action: "clarify" з питанням "Це один список чи окремі задачі?"
- habit: НОВА регулярна повторювана дія ("щодня", "кожен ранок", "тричі на тиждень"). "text" — коротка назва 2-4 слова
- event: короткий факт події без емоцій ("поїхав на рибалку", "зустрівся з Вовою"). Якщо є емоції/роздуми — це note
- idea: творча думка, ідея, план, натхнення
- note: рефлексія, думки, емоції, висновки, спостереження, факти, щоденникові записи, стан здоровʼя, що відбувається в житті. ЯКЩО людина описує свій день, стан, ситуацію — це note, НЕ reply.
- finance: витрата або дохід (будь-яка сума грошей). Якщо є сума і контекст витрат/доходу — це finance

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
- Трава: джоінт, канабіс, трава, диспансер
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
- "Харчування" — їжа, напої, калорії, рецепти
- "Фінанси" — витрати, доходи, ціни, гроші
- "Здоровʼя" — самопочуття, симптоми, ліки, спорт, тренування
- "Робота" — робочі думки, проекти, колеги
- "Навчання" — що вивчаю, книги, курси, інсайти
- "Ідеї" — творчі ідеї (якщо category=idea)
- "Особисте" — стосунки, емоції, особисті думки, все що не підходить в інші папки
- "Подорожі" — місця, маршрути, враження
- Якщо не підходить жодна — використовуй "Особисте", НЕ вигадуй нових папок
- ЗАБОРОНЕНО автоматично використовувати папку "Чернетки" — тільки якщо користувач ЯВНО просить зберегти в чернетки
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

async function callAI(systemPrompt, userMessage, contextData = {}) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000);
    return null;
  }
  if (location.protocol === 'file:') {
    showToast('⚠️ Відкрий файл через сервер, не file://', 5000);
    return null;
  }
  const context = Object.keys(contextData).length > 0
    ? `\n\nКонтекст:\n${JSON.stringify(contextData, null, 2)}`
    : '';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage + context }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('❌ ' + (data?.error?.message || `Помилка ${res.status}`), 4000);
      return null;
    }
    const text = data.choices?.[0]?.message?.content;
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



async function callAIWithHistory(systemPrompt, history) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000); return null; }
  if (location.protocol === 'file:') { showToast('⚠️ Відкрий файл через сервер, не file://', 5000); return null; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25 сек таймаут
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: 300,
        temperature: 0.7
      })
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI error:', res.status, errText);
      return null;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || null;
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

function saveChatMsg(tab, role, text) {
  if (role === 'typing') return;
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return;
  try {
    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    msgs.push({ role, text, ts: Date.now() });
    if (msgs.length > CHAT_STORE_MAX) msgs.splice(0, msgs.length - CHAT_STORE_MAX);
    localStorage.setItem(key, JSON.stringify(msgs));
  } catch(e) {}
}

function loadChatMsgs(tab) {
  const key = CHAT_STORE_KEYS[tab];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function restoreChatUI(tab) {
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
  if (!el || el.children.length > 0) return; // вже є повідомлення
  const msgs = loadChatMsgs(tab);
  if (msgs.length === 0) return;
  // Додаємо розділювач "Попередня розмова"
  const sep = document.createElement('div');
  sep.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0 8px;opacity:0.4';
  sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">Попередня розмова</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
  el.appendChild(sep);
  // Рендеримо збережені повідомлення без повторного запису в storage
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

function openChatBar(tab) {
  if (activeChatBar === tab) return;

  // Закриваємо інші бари БЕЗ blur — щоб не скинути фокус з поточного поля
  ['tasks','me','evening','finance'].forEach(t => {
    if (t === tab) return;
    const b = document.getElementById(t + '-ai-bar');
    if (!b) return;
    const cw = b.querySelector('.ai-bar-chat-window');
    if (cw) cw.classList.remove('open');
    const inputs = b.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });

  activeChatBar = tab;

  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  // Відновлюємо попередній чат якщо вікно порожнє
  restoreChatUI(tab);

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) requestAnimationFrame(() => { chatWin.classList.add('open'); });
}

function closeChatBar(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) chatWin.classList.remove('open');

  // Знімаємо фокус але НЕ очищуємо текст — користувач може повернутись
  const inputs = bar.querySelectorAll('input, textarea');
  inputs.forEach(i => i.blur());

  activeChatBar = null;
}

function toggleChatBar(tab) {
  if (activeChatBar === tab) {
    closeChatBar(tab);
  } else {
    openChatBar(tab);
  }
}

function closeAllChatBars(resetActive = true) {
  ['inbox','tasks','notes','me','evening','finance'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    if (chatWin) chatWin.classList.remove('open');
    const inputs = bar.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });
  if (resetActive) activeChatBar = null;
}

// Свайп вниз по чат-вікну щоб закрити
function setupChatBarSwipe() {
  ['inbox','tasks','notes','me','evening','finance'].forEach(tab => {
    const bar = document.getElementById(tab + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    const messages = bar.querySelector('.ai-bar-messages');
    if (!chatWin) return;

    // --- Gesture-driven свайп по чат-вікну ---
    let winStartY = 0, winStartX = 0, winStartVpTop = 0, isDragging = false, startTime = 0;

    chatWin.addEventListener('touchstart', e => {
      if (messages && messages.contains(e.target)) return;
      winStartY = e.touches[0].clientY;
      winStartX = e.touches[0].clientX;
      // Запамʼятовуємо позицію viewport — компенсуємо iOS scroll при клавіатурі
      winStartVpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      startTime = Date.now();
      isDragging = false;
      chatWin.style.transition = 'none';
      chatWin.style.opacity = '1';
    }, { passive: true });

    chatWin.addEventListener('touchmove', e => {
      if (messages && messages.contains(e.target)) return;
      // Враховуємо зміщення viewport (коли клавіатура відкрита iOS скролить viewport)
      const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
      const vpDelta = vpTop - winStartVpTop;
      const dy = (e.touches[0].clientY - winStartY) + vpDelta;
      if (isDragging) {
        if (dy <= 0) { chatWin.style.transform = 'translateY(0)'; return; }
        chatWin.style.transform = `translateY(${dy}px)`;
        chatWin.style.opacity = Math.max(0, 1 - dy / 300).toFixed(2);
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - winStartX);
      if (dy <= 0) return;
      if (dx > dy * 1.5) return;
      isDragging = true;
      chatWin.style.transform = `translateY(${dy}px)`;
      chatWin.style.opacity = Math.max(0, 1 - dy / 300).toFixed(2);
    }, { passive: true });

    chatWin.addEventListener('touchend', e => {
      if (!isDragging) {
        // Це був тап — повертаємо в початковий стан
        chatWin.style.transition = '';
        chatWin.style.transform = '';
        chatWin.style.opacity = '';
        return;
      }
      const dy = e.changedTouches[0].clientY - winStartY;
      const elapsed = Date.now() - startTime;
      const velocity = dy / elapsed; // px/ms
      // Вмикаємо transition назад
      chatWin.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease';
      // Закриваємо якщо: пройшли > 80px АБО швидкість > 0.5px/ms
      if (dy > 80 || velocity > 0.5) {
        chatWin.style.transform = 'translateY(110%)';
        chatWin.style.opacity = '0';
        setTimeout(() => {
          closeChatBar(tab);
          chatWin.style.transition = '';
          chatWin.style.transform = '';
          chatWin.style.opacity = '';
        }, 280);
      } else {
        // Повертаємо назад (пружина)
        chatWin.style.transform = 'translateY(0)';
        chatWin.style.opacity = '1';
        setTimeout(() => {
          chatWin.style.transition = '';
          chatWin.style.transform = '';
          chatWin.style.opacity = '';
        }, 280);
      }
      isDragging = false;
    }, { passive: true });

    // --- Блок: бар не рухається при скролі сторінки ---
    // Блокуємо тільки коли вікно чату ВІДКРИТЕ
    bar.addEventListener('touchmove', e => {
      // Якщо вікно закрите — пропускаємо все наскрізь
      if (!chatWin.classList.contains('open')) return;
      // Вікно відкрите — дозволяємо скрол повідомлень і поля
      if (messages && messages.contains(e.target)) return;
      const textarea = bar.querySelector('textarea');
      if (textarea && textarea.contains(e.target)) return;
      e.preventDefault();
    }, { passive: false });
  });

  // --- Тап поза вікном → закрити (але НЕ свайп) ---
  let docTouchStartY = 0, docTouchStartX = 0;
  document.addEventListener('touchstart', e => {
    docTouchStartY = e.touches[0].clientY;
    docTouchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!activeChatBar) return;
    const bar = document.getElementById(activeChatBar + '-ai-bar');
    if (!bar) return;
    // Якщо дотик всередині бару — нічого (поле, вікно, кнопки)
    if (bar.contains(e.target)) return;
    // Якщо дотик по таббару — нічого
    const tabBar = document.getElementById('tab-bar');
    if (tabBar && tabBar.contains(e.target)) return;
    // Вимірюємо відстань — якщо це свайп (> 10px) → НЕ закриваємо
    const dy = Math.abs(e.changedTouches[0].clientY - docTouchStartY);
    const dx = Math.abs(e.changedTouches[0].clientX - docTouchStartX);
    if (dy > 10 || dx > 10) return; // це скрол карток — не заважаємо
    // Це тап → закриваємо чат (текст у полі НЕ очищуємо)
    closeChatBar(activeChatBar);
  }, { passive: true });
}


// === OWL BOARD ===
const OWL_BOARD_KEY = 'nm_owl_board';       // масив до 3 повідомлень
const OWL_BOARD_SEEN_KEY = 'nm_owl_board_seen'; // які ID вже показано
const OWL_BOARD_TS_KEY = 'nm_owl_board_ts'; // timestamp останньої генерації
const OWL_BOARD_INTERVAL = 3 * 60 * 1000;  // 3 хвилини

let _owlBoardSlide = 0;
let _owlBoardMessages = [];
let _owlBoardGenerating = false;
let _owlBoardTimer = null;

function getOwlBoardMessages() {
  try { return JSON.parse(localStorage.getItem(OWL_BOARD_KEY) || '[]'); } catch { return []; }
}
function saveOwlBoardMessages(arr) {
  localStorage.setItem(OWL_BOARD_KEY, JSON.stringify(arr.slice(-3)));
}

// === OWL BOARD — повний розумний цикл ===

// Ключ для антиповтору — що вже сказали сьогодні
const OWL_BOARD_SAID_KEY = 'nm_owl_board_said'; // {date, topics:[]}

function getOwlBoardSaid() {
  try {
    const s = JSON.parse(localStorage.getItem(OWL_BOARD_SAID_KEY) || '{}');
    if (s.date !== new Date().toDateString()) return { date: new Date().toDateString(), topics: [] };
    return s;
  } catch { return { date: new Date().toDateString(), topics: [] }; }
}
function markOwlBoardSaid(topic) {
  const s = getOwlBoardSaid();
  if (!s.topics.includes(topic)) s.topics.push(topic);
  localStorage.setItem(OWL_BOARD_SAID_KEY, JSON.stringify(s));
}
function owlAlreadySaid(topic) {
  return getOwlBoardSaid().topics.includes(topic);
}

// Перевірка чи є щось важливе — БЕЗ API
function checkOwlBoardTrigger() {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return false;

  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();

  // Тихий режим 23:00–7:00
  if (hour >= 23 || hour < 7) return false;

  // Ранковий огляд 7:00–9:00 — раз за ранок
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) return true;

  // Обід 13:00 — статус дня, раз
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) return true;

  // Вечірній підсумок 20:00 — раз
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) return true;
  }

  // Понеділок вранці — огляд тижня
  if (now.getDay() === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) return true;

  // Пʼятниця ввечері — підсумок тижня
  if (now.getDay() === 5 && hour >= 17 && !owlAlreadySaid('week_end')) return true;

  // Дедлайн через ~годину — не повторювати для тієї ж задачі
  const tasks = getTasks().filter(t => t.status !== 'done');
  for (const t of tasks) {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
      if (diff > 0 && diff <= 65 && !owlAlreadySaid('deadline_' + t.id)) return true;
    }
  }

  // Задача 3+ дні не закривається
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = tasks.filter(t => t.createdAt && t.createdAt < now3d && !owlAlreadySaid('stuck_' + t.id));
  if (stuck.length > 0) return true;

  // Звички не виконані після 10:00
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const pending = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (pending.length > 0 && !owlAlreadySaid('habits_' + todayStr)) return true;
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const atRisk = habits.filter(h => h.days.includes(now.getDay()) && !todayLog[h.id]);
    if (atRisk.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) return true;
  }

  // Всі звички виконані — привітати раз
  if (hour >= 10) {
    const habits = getHabits();
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const todayH = habits.filter(h => h.days.includes(now.getDay()));
    if (todayH.length > 0 && todayH.every(h => todayLog[h.id]) && !owlAlreadySaid('all_habits_done_' + todayStr)) return true;
  }

  // Бюджет 80%+ витрачено
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const exp = getFinance().filter(t => t.ts >= from && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
      const pct = exp / budget.total;
      if (pct >= 0.8 && !owlAlreadySaid('budget_80_' + new Date().toISOString().slice(0,7))) return true;
    }
  } catch(e) {}

  // Порожній день — немає нічого критичного, але треба щось показати
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) return true;

  return false;
}

// Будуємо контекст для табло з пріоритетами
function getOwlBoardContext() {
  const now = new Date();
  const todayStr = now.toDateString();
  const hour = now.getHours();
  const min = now.getMinutes();
  const weekDay = now.getDay(); // 0=нд, 1=пн...5=пт
  const critical = [];
  const important = [];
  const normal = [];

  const timeOfDay = hour < 12 ? 'ранок' : hour < 18 ? 'день' : 'вечір';
  normal.push(`Зараз ${timeOfDay}, ${now.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'})}.`);

  // Задачі
  const tasks = getTasks();
  const activeTasks = tasks.filter(t => t.status !== 'done');

  // Дедлайн через ~годину
  const urgent = activeTasks.filter(t => {
    const m = t.title.match(/(\d{1,2}):(\d{2})/);
    if (!m) return false;
    const diff = (parseInt(m[1])*60+parseInt(m[2])) - (hour*60+min);
    return diff > 0 && diff <= 65;
  });
  urgent.forEach(t => {
    if (!owlAlreadySaid('deadline_' + t.id)) {
      critical.push(`[КРИТИЧНО] Дедлайн через ~годину: "${t.title}".`);
      markOwlBoardSaid('deadline_' + t.id);
    }
  });

  // Задача завʼязла 3+ дні
  const now3d = Date.now() - 3*24*60*60*1000;
  const stuck = activeTasks.filter(t => t.createdAt && t.createdAt < now3d);
  stuck.forEach(t => {
    if (!owlAlreadySaid('stuck_' + t.id)) {
      important.push(`[ВАЖЛИВО] Задача "${t.title}" відкрита вже 3+ дні.`);
      markOwlBoardSaid('stuck_' + t.id);
    }
  });

  if (activeTasks.length > 0) {
    normal.push(`Відкритих задач: ${activeTasks.length}. ${activeTasks.slice(0,3).map(t=>t.title).join(', ')}${activeTasks.length>3?' і ще...':''}.`);
  } else {
    normal.push('Всі задачі виконано.');
  }

  // Звички
  const habits = getHabits();
  const log = getHabitLog();
  const todayLog = log[todayStr] || {};
  const todayHabits = habits.filter(h => h.days.includes(now.getDay()));
  const doneHabits = todayHabits.filter(h => todayLog[h.id]);
  const pendingHabits = todayHabits.filter(h => !todayLog[h.id]);

  // Всі звички виконані — привітати
  if (todayHabits.length > 0 && pendingHabits.length === 0 && !owlAlreadySaid('all_habits_done_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Всі ${todayHabits.length} звичок виконано сьогодні!`);
    markOwlBoardSaid('all_habits_done_' + todayStr);
  }

  // Стрік під загрозою після 20:00
  if (hour >= 20 && pendingHabits.length > 0 && !owlAlreadySaid('streak_risk_' + todayStr)) {
    const atRisk = pendingHabits.filter(h => {
      const allDays = Object.values(log);
      return allDays.filter(d => d[h.id]).length >= 3;
    });
    if (atRisk.length > 0) {
      critical.push(`[КРИТИЧНО] Стрік під загрозою: ${atRisk.map(h=>h.name).join(', ')}.`);
      markOwlBoardSaid('streak_risk_' + todayStr);
    }
  }

  // Звички не виконані після 10:00
  if (hour >= 10 && pendingHabits.length > 0 && !owlAlreadySaid('habits_' + todayStr)) {
    important.push(`[ВАЖЛИВО] Не виконано звичок: ${pendingHabits.map(h=>h.name).join(', ')}.`);
    markOwlBoardSaid('habits_' + todayStr);
  }

  if (todayHabits.length > 0) {
    normal.push(`Звички сьогодні: ${doneHabits.length}/${todayHabits.length}.`);
  }

  // Фінанси
  try {
    const budget = getFinBudget();
    if (budget.total > 0) {
      const from = getFinPeriodRange('month');
      const txs = getFinance().filter(t => t.ts >= from && t.type === 'expense');
      const exp = txs.reduce((s,t) => s+t.amount, 0);
      const pct = Math.round(exp/budget.total*100);
      const monthKey = new Date().toISOString().slice(0,7);
      if (exp > budget.total) {
        important.push(`[ВАЖЛИВО] Бюджет перевищено! Витрачено ${formatMoney(exp)} з ${formatMoney(budget.total)} (${pct}%).`);
      } else if (pct >= 80 && !owlAlreadySaid('budget_80_' + monthKey)) {
        important.push(`[ВАЖЛИВО] Витрачено ${pct}% місячного бюджету.`);
        markOwlBoardSaid('budget_80_' + monthKey);
      } else {
        normal.push(`Бюджет місяця: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
      }

      // Незвична витрата — більше ніж вдвічі від середньої по категорії
      if (txs.length >= 3) {
        const bycat = {};
        txs.forEach(t => { if (!bycat[t.category]) bycat[t.category] = []; bycat[t.category].push(t.amount); });
        const lastTx = txs[0];
        if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
          const avg = bycat[lastTx.category].reduce((a,b)=>a+b,0) / bycat[lastTx.category].length;
          if (lastTx.amount > avg * 2.5 && !owlAlreadySaid('unusual_tx_' + lastTx.id)) {
            important.push(`[ВАЖЛИВО] Незвична витрата: ${formatMoney(lastTx.amount)} на "${lastTx.category}" — вище звичного вдвічі.`);
            markOwlBoardSaid('unusual_tx_' + lastTx.id);
          }
        }
      }
    }
  } catch(e) {}

  // Ранковий огляд
  if (hour >= 7 && hour <= 9 && !owlAlreadySaid('morning_brief')) {
    normal.push(`[РАНОК] Початок дня. Налаштуй пріоритети.`);
    markOwlBoardSaid('morning_brief');
  }

  // Середина дня
  if (hour === 13 && min < 30 && !owlAlreadySaid('midday_check')) {
    normal.push(`[ОБІД] Середина дня — як справи?`);
    markOwlBoardSaid('midday_check');
  }

  // Вечір без підсумку
  if (hour >= 20 && !owlAlreadySaid('evening_prompt')) {
    const s = JSON.parse(localStorage.getItem('nm_evening_summary') || 'null');
    if (!s || new Date(s.date).toDateString() !== todayStr) {
      important.push('[ВАЖЛИВО] Вечір — підсумок дня ще не записано.');
      markOwlBoardSaid('evening_prompt');
    }
  }

  // Понеділок — огляд тижня
  if (weekDay === 1 && hour >= 8 && hour <= 10 && !owlAlreadySaid('week_start')) {
    normal.push('[ТИЖДЕНЬ] Новий тиждень. Огляд планів і відкритих задач.');
    markOwlBoardSaid('week_start');
  }

  // Пʼятниця — підсумок тижня
  if (weekDay === 5 && hour >= 17 && !owlAlreadySaid('week_end')) {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && Date.now() - t.updatedAt < 7*24*60*60*1000);
    normal.push(`[ТИЖДЕНЬ] Кінець тижня. Закрито задач за тиждень: ${doneTasks.length}.`);
    markOwlBoardSaid('week_end');
  }

  // Порожній день — немає нічого критичного або важливого
  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const sinceLastH = (Date.now() - lastTs) / (60*60*1000);
  if (critical.length === 0 && important.length === 0 && sinceLastH > 4 && !owlAlreadySaid('quiet_day_' + todayStr)) {
    normal.push('[СПОКІЙНИЙ ДЕНЬ] Немає нічого термінового. OWL може сказати щось мотивуюче або поставити коротке питання.');
    markOwlBoardSaid('quiet_day_' + todayStr);
  }

  return [...critical, ...important, ...normal].join(' ');
}

async function generateOwlBoardMessage() {
  if (_owlBoardGenerating) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  _owlBoardGenerating = true;

  const context = getOwlBoardContext();
  const existing = getOwlBoardMessages();

  // Список того що вже казали — щоб не повторювати
  const recentTexts = existing.map(m => m.text).join(' | ');

  const systemPrompt = getOWLPersonality() + `

Ти пишеш КОРОТКЕ проактивне повідомлення для табло в Inbox. Це НЕ відповідь на запит — це твоя ініціатива.

ПРІОРИТЕТ ПОВІДОМЛЕНЬ:
1. Якщо є [КРИТИЧНО] — пиши ТІЛЬКИ про це. Нічого іншого.
2. Якщо є [ВАЖЛИВО] і немає [КРИТИЧНО] — пиши про перше [ВАЖЛИВО].
3. Якщо є [СПОКІЙНИЙ ДЕНЬ] — скажи щось коротке в своєму характері: мотивацію, коротке питання про день, або просте спостереження. БЕЗ згадки задач і звичок якщо їх немає.
4. Інакше — обери найцікавіше зі звичайних даних.

ПРАВИЛА:
- Максимум 2 речення. Коротко і конкретно.
- Використовуй ТІЛЬКИ факти з контексту нижче. НЕ вигадуй ліміти, суми, плани або звички яких немає в даних.
- НЕ повторюй те що вже казав: "${recentTexts || 'нічого'}"
- Відповідай ТІЛЬКИ JSON: {"text":"повідомлення","priority":"critical|important|normal","chips":["чіп1","чіп2"]}
- chips — 2-3 конкретні факти або дії. Максимум 3 слова кожен. Якщо спокійний день — chips можуть бути порожнім масивом [].
- Відповідай українською.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Дані: ${context}` }
        ],
        max_tokens: 150,
        temperature: 0.8
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { _owlBoardGenerating = false; return; }

    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (!parsed.text) { _owlBoardGenerating = false; return; }

    // Додаємо нове повідомлення, зберігаємо 3 останніх
    const msgs = getOwlBoardMessages();
    msgs.unshift({ id: Date.now(), text: parsed.text, priority: parsed.priority || 'normal', chips: parsed.chips || [] });
    saveOwlBoardMessages(msgs.slice(0, 3));
    localStorage.setItem(OWL_BOARD_TS_KEY, Date.now().toString());

    renderOwlBoard();
  } catch(e) {}
  _owlBoardGenerating = false;
}

function renderOwlBoard() {
  const messages = getOwlBoardMessages();
  const board = document.getElementById('owl-board');
  if (!board) return;

  if (messages.length === 0) {
    board.style.display = 'none';
    return;
  }

  board.style.display = 'block';
  _owlBoardMessages = messages;
  if (_owlBoardSlide >= messages.length) _owlBoardSlide = 0;

  // Рендер слайдів
  const track = document.getElementById('owl-board-track');
  if (track) {
    track.innerHTML = messages.map((m, i) => {
      const priorityDot = m.priority === 'critical'
        ? '<div style="width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:5px;box-shadow:0 0 6px rgba(239,68,68,0.7)"></div>'
        : m.priority === 'important'
        ? '<div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:5px"></div>'
        : '';
      return `
        <div style="min-width:100%;box-sizing:border-box">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:7px">
            ${priorityDot}
            <div style="font-size:13px;font-weight:600;color:white;line-height:1.5;flex:1">${escapeHtml(m.text)}</div>
          </div>
          ${m.chips && m.chips.length > 0 ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${m.chips.map(c=>`<div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.15)">${escapeHtml(c)}</div>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    track.style.transform = `translateX(-${_owlBoardSlide * 100}%)`;
  }

  // Крапки
  const dots = document.getElementById('owl-board-dots');
  if (dots && messages.length > 1) {
    dots.style.display = 'flex';
    dots.innerHTML = messages.map((_, i) => {
      const active = i === _owlBoardSlide;
      return `<div onclick="owlBoardGoTo(${i})" style="height:4px;width:${active?'12px':'4px'};border-radius:2px;background:${active?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.2)'};transition:all 0.3s;cursor:pointer"></div>`;
    }).join('');
  } else if (dots) {
    dots.style.display = 'none';
  }

  // Свайп на слайдері
  setupOwlBoardSwipe();
}

function owlBoardGoTo(idx) {
  _owlBoardSlide = idx;
  const track = document.getElementById('owl-board-track');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  renderOwlBoard();
}

function dismissOwlBoard() {
  const board = document.getElementById('owl-board');
  if (board) board.style.display = 'none';
}

let _owlSwipeStartX = 0;
function setupOwlBoardSwipe() {
  const slider = document.getElementById('owl-board-slider');
  if (!slider || slider._owlSwipe) return;
  slider._owlSwipe = true;

  let _owlStartX = 0, _owlStartY = 0, _owlLocked = false;

  slider.addEventListener('touchstart', e => {
    _owlStartX = e.touches[0].clientX;
    _owlStartY = e.touches[0].clientY;
    _owlLocked = false;
  }, { passive: true });

  slider.addEventListener('touchmove', e => {
    const dx = Math.abs(e.touches[0].clientX - _owlStartX);
    const dy = Math.abs(e.touches[0].clientY - _owlStartY);
    if (!_owlLocked && dx > dy && dx > 8) {
      _owlLocked = true;
    }
    if (_owlLocked) {
      e.stopPropagation();
      // Показуємо рух треку під пальцем
      const msgs = getOwlBoardMessages();
      if (msgs.length <= 1) return;
      const rawDx = e.touches[0].clientX - _owlStartX;
      const track = document.getElementById('owl-board-track');
      if (track) {
        const base = -_owlBoardSlide * 100;
        const pct = (rawDx / slider.offsetWidth) * 100;
        // Опір на краях
        let offset = pct;
        if ((_owlBoardSlide === 0 && rawDx > 0) || (_owlBoardSlide === msgs.length - 1 && rawDx < 0)) {
          offset = pct * 0.25;
        }
        track.style.transition = 'none';
        track.style.transform = `translateX(${base + offset}%)`;
      }
    }
  }, { passive: false });

  slider.addEventListener('touchend', e => {
    if (!_owlLocked) return;
    e.stopPropagation();
    const dx = e.changedTouches[0].clientX - _owlStartX;
    const track = document.getElementById('owl-board-track');
    if (track) track.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
    const msgs = getOwlBoardMessages();
    if (dx < -40 && _owlBoardSlide < msgs.length - 1) owlBoardGoTo(_owlBoardSlide + 1);
    else if (dx > 40 && _owlBoardSlide > 0) owlBoardGoTo(_owlBoardSlide - 1);
    else owlBoardGoTo(_owlBoardSlide); // snap back
    _owlLocked = false;
  }, { passive: false });
}

// Запуск циклу перевірки
function startOwlBoardCycle() {
  // Одразу при відкритті
  tryOwlBoardUpdate();
  // Потім кожні 3 хвилини
  if (_owlBoardTimer) clearInterval(_owlBoardTimer);
  _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
}

function tryOwlBoardUpdate() {
  // Тихий режим 23:00–7:00
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 7) return;

  // Показуємо що є зараз
  const msgs = getOwlBoardMessages();
  if (msgs.length > 0) renderOwlBoard();

  const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || '0');
  const elapsed = Date.now() - lastTs;
  const isFirstTime = msgs.length === 0 && lastTs === 0;
  const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== new Date().toDateString();

  // Вранці (7-9) — перевіряємо частіше (кожні 2 хв)
  const interval = (hour >= 7 && hour <= 9) ? 2 * 60 * 1000 : OWL_BOARD_INTERVAL;

  const shouldGenerate = isFirstTime || isNewDay || (elapsed > interval && checkOwlBoardTrigger());
  if (shouldGenerate) generateOwlBoardMessage();
}

