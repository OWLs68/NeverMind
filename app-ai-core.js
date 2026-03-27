// ============================================================
// app-ai-core.js — AI контекст, OpenAI API, chat storage
// Залежності: app-core.js
// ============================================================

// ===== 15. РОЗШИРЕНИЙ КОНТЕКСТ ШІ =====
function getOWLPersonality() {
  const settings = db.getSettings();
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
  const memory = db.getMemory();
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
  const todayInbox = db.getInbox()
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

// Захист від показу сирого JSON в чаті агента
// Якщо відповідь схожа на JSON — показуємо нейтральну фразу
function safeAgentReply(reply, addMsg) {
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
- habit: НОВА регулярна повторювана дія ("щодня", "кожен ранок", "тричі на тиждень"). "text" — коротка назва 2-4 слова. ЯКЩО вказані конкретні дні — додай "days" масив (0=Пн,1=Вт,2=Ср,3=Чт,4=Пт,5=Сб,6=Нд). Приклад: "по середах і вівторках" → "days":[1,2]. ЯКЩО вказана кількість разів на день ("8 разів", "5 склянок") — додай "targetCount":8
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

ЯКЩО користувач ЯВНО хоче створити ПРОЕКТ (масштабна довгострокова ціль: "запустити", "побудувати", "розробити", "відкрити", "створити проект") — відповідай ТІЛЬКИ JSON:
{
  "action": "create_project",
  "name": "коротка назва проекту (2-5 слів)",
  "subtitle": "підзаголовок або порожньо"
}
НЕ плутай з простою задачею. Проект — це щось масштабне з кількома етапами. Якщо сумнів — save category task.

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

async function callAI(systemPrompt, userMessage, contextData = {}) {
  const key = db.getApiKey();
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
  const key = db.getApiKey();
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

// === CHAT STORAGE — делегується до db ===
function saveChatMsg(tab, role, text) { db.saveChatMsg(tab, role, text); }
function loadChatMsgs(tab) { return db.loadChatMsgs(tab); }

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

  // Закриваємо інші бари
  ['tasks','me','evening','finance','health','projects'].forEach(t => {
    if (t === tab) return;
    const b = document.getElementById(t + '-ai-bar');
    if (!b) return;
    const cw = b.querySelector('.ai-bar-chat-window');
    if (cw) cw.classList.remove('open');
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
    const h = tab !== 'inbox' ? _getTabChatAHeight(tab) : null;
    if (h !== null) {
      chatWin.style.height = h + 'px';
      chatWin.style.maxHeight = h + 'px';
    } else {
      try { updateChatWindowHeight(tab); } catch(e) {}
    }
    chatWin.classList.add('open');
    if (tab !== 'inbox') _tabChatState[tab] = 'a';
  });
}

function closeChatBar(tab) {
  const bar = document.getElementById(tab + '-ai-bar');
  if (!bar) return;

  // Inbox: вікно чату завжди відкрите — тільки ховаємо клавіатуру і скидаємо розгорнутість
  if (tab === 'inbox') {
    if (inboxChatExpanded) {
      inboxChatExpanded = false;
      const cw = document.getElementById('inbox-chat-window');
      if (cw) { cw.style.height = ''; cw.style.maxHeight = ''; }
      const msgs = document.getElementById('inbox-chat-messages');
      if (msgs) msgs.style.maxHeight = '';
    }
    bar.querySelectorAll('input, textarea').forEach(i => i.blur());
    activeChatBar = null;
    return;
  }

  const chatWin = bar.querySelector('.ai-bar-chat-window');
  if (chatWin) chatWin.classList.remove('open');
  _tabChatState[tab] = undefined;

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
  ['inbox','tasks','notes','me','evening','finance','health','projects'].forEach(t => {
    const bar = document.getElementById(t + '-ai-bar');
    if (!bar) return;
    const chatWin = bar.querySelector('.ai-bar-chat-window');
    // Inbox: не закриваємо вікно чату (воно завжди відкрите)
    if (chatWin && t !== 'inbox') { chatWin.classList.remove('open'); _tabChatState[t] = undefined; }
    const inputs = bar.querySelectorAll('input, textarea');
    inputs.forEach(i => i.blur());
  });
  if (resetActive) activeChatBar = null;
}

// Стан розгорнутості inbox чату (свайп вгору)
let inboxChatExpanded = false;
let inboxCompactH = 0; // зафіксована compact-висота при touchstart

// Повна висота inbox чат-вікна = від safe area до поля вводу
function getInboxExpandHeight() {
  const bar = document.getElementById('inbox-ai-bar');
  if (!bar) return 200;
  const inputBox = bar.querySelector('.ai-bar-input-box');
  const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 80;
  return Math.max(100, inputTop - 80 - 8); // 80 = header + safe area
}

