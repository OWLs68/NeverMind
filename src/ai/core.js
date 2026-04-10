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
import { getEvents, getTodayRoutine, getRoutine } from '../tabs/calendar.js';
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

  // === Нещодавно закриті задачі (24 години) — щоб AI знав що вже зроблено ===
  const recentlyDone = getTasks().filter(t => t.status === 'done' && t.completedAt && (now - t.completedAt) < 24 * 60 * 60 * 1000).slice(0, 5);
  if (recentlyDone.length > 0) {
    parts.push(`[ФАКТ] Нещодавно ЗАКРИТІ задачі (вже виконані, НЕ нагадуй про них!):\n${recentlyDone.map(t => '- ✅ "' + t.title + '"').join('\n')}`);
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
        upcoming.push(`- 📅 [ID:${ev.id}] "${ev.title}" — ${when}${ev.time ? ' о ' + ev.time : ''}`);
      }
    });
    // Всі події (не тільки 7 днів) — для редагування
    const allEvents = getEvents();
    const futureEvents = allEvents.filter(ev => ev.date >= todayISO && !upcoming.some(u => u.includes(ev.id)));
    if (futureEvents.length > 0) {
      futureEvents.slice(0, 10).forEach(ev => {
        upcoming.push(`- 📅 [ID:${ev.id}] "${ev.title}" — ${ev.date}${ev.time ? ' о ' + ev.time : ''}`);
      });
    }
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

  // === Розпорядок дня (всі дні) ===
  try {
    const allRoutine = getRoutine();
    const dayLabels = { default:'Будні', mon:'Пн', tue:'Вт', wed:'Ср', thu:'Чт', fri:'Пт', sat:'Сб', sun:'Нд' };
    const filledDays = Object.keys(allRoutine).filter(k => allRoutine[k]?.length > 0);
    if (filledDays.length > 0) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
      const todayKey = dayKeys[new Date().getDay()];
      const routineParts = filledDays.map(day => {
        const isToday = day === todayKey || (day === 'default' && !allRoutine[todayKey]);
        const blocks = allRoutine[day].sort((a, b) => a.time.localeCompare(b.time)).map(b => {
          const mark = isToday && (parseInt(b.time) * 60 + parseInt(b.time.split(':')[1] || 0)) <= nowMin ? '✓' : '';
          return `${b.time} ${b.activity}${mark}`;
        }).join(', ');
        return `${dayLabels[day] || day}${isToday ? ' (сьогодні)' : ''}: ${blocks}`;
      });
      // Знайти наступний блок сьогодні
      const todayBlocks = (allRoutine[todayKey] || allRoutine['default'] || []).sort((a, b) => a.time.localeCompare(b.time));
      const nextBlock = todayBlocks.find(b => {
        const [bh, bm] = b.time.split(':').map(Number);
        return bh * 60 + (bm || 0) > nowMin;
      });
      let nextHint = '';
      if (nextBlock) {
        const [bh, bm] = nextBlock.time.split(':').map(Number);
        const minsUntil = bh * 60 + (bm || 0) - nowMin;
        nextHint = `\n[НАСТУПНЕ ЗА РОЗКЛАДОМ] ${nextBlock.time} — ${nextBlock.activity} (через ${minsUntil} хв). Нагадай завчасно!`;
      }
      parts.push(`Розпорядок дня:\n${routineParts.join('\n')}${nextHint}\nМожеш копіювати, змінювати блоки через save_routine.`);
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
Користувач надсилає повідомлення — думка, задача, ідея, звичка, подія, або звіт про виконане.
Використовуй відповідний tool для дії. Якщо це просто питання або розмова — відповідай текстом БЕЗ tool, коротко, 2-4 речення.

ГРАМАТИКА: Якщо бачиш помилку або опечатку — виправляй в тексті без питань.

ПРІОРИТЕТ ПЕРЕВІРКИ (завжди перевіряй СПОЧАТКУ):
1. Чи це ВИКОНАННЯ звички/задачі зі списку? → complete_habit / complete_task. "Все готово", "зробив все" після переліку → передай ВСІ ID
2. Чи це НАГАДАЙ/нагадай мені → ЗАВЖДИ set_reminder, НІКОЛИ не save_task
3. Чи це витрата/дохід із сумою → save_finance
4. **Чи є дієслово дії в інфінітиві/наказовому (купити, зробити, написати, зателефонувати, помити, попрати, відправити, замовити, принести, віднести)? → save_task. Завжди. Без винятків. Навіть якщо немає часу, дати, емоцій — це ЗАДАЧА.**
5. Чи це запис, думка, ідея → відповідний tool

МЕТАІНСТРУКЦІЇ: Якщо юзер пише "це задача", "це нотатка", "це звичка" — він прямо каже ТОБІ який тип створити. Створи відповідний тип з цим текстом. НЕ save_note за замовчуванням.

РОЗРІЗНЕННЯ task vs event vs project:
- ЗАДАЧА (save_task) = ДІЯ яку ТИ маєш ЗРОБИТИ: купити, подзвонити, зробити, написати. Дієслово = задача.
- ПОДІЯ (create_event) = ФАКТ що СТАНЕТЬСЯ з датою: приїзд, зустріч, день народження, візит
- ПРОЕКТ (create_project) = масштабна ціль на тижні/місяці: ремонт, запуск бізнесу. Тригери: запустити, побудувати, розробити, організувати [щось велике]
- МОМЕНТ (save_moment) = факт що вже стався БЕЗ дати в майбутньому
- НОТАТКА (save_note) = ТІЛЬКИ думки, емоції, рефлексія, стан здоров'я, опис дня/ситуації. НЕ для дій які треба зробити.
- Якщо сумнів задача vs подія → clarify. Якщо сумнів момент vs нотатка → save_note

СПИСОК чи ОКРЕМІ ЗАДАЧІ:
- "Список покупок: хліб, молоко" → ОДНА save_task з steps (кроками)
- "Зателефонувати Вові, записатися до лікаря" → ДВА окремі save_task виклики

РЕДАГУВАННЯ: "перенеси", "зміни", "поміняй" → edit_event/edit_task/edit_note/edit_habit. НІКОЛИ не створюй новий замість редагування.

УТОЧНЕННЯ: Якщо повідомлення — уточнення до попереднього ("так", "ні", "видали") — відповідай текстом, не створюй запис.

НЕ вигадуй ліміти, бюджети або плани яких немає в контексті.`;

// === INBOX TOOLS — визначення функцій для OpenAI tool calling ===
export const INBOX_TOOLS = [
  // --- СТВОРЕННЯ ---
  { type: "function", function: { name: "save_task", description: "Створити нову разову задачу. Дія яку треба ЗРОБИТИ: купити, зателефонувати, відправити, зробити, написати.", parameters: { type: "object", properties: { title: { type: "string", description: "Коротка назва 2-5 слів. Включай час/дату якщо є" }, text: { type: "string", description: "Повний текст з виправленою граматикою" }, steps: { type: "array", items: { type: "string" }, description: "Кроки якщо є список дій" }, due_date: { type: "string", description: "YYYY-MM-DD якщо юзер вказав дату" }, priority: { type: "string", enum: ["normal","important","critical"] }, comment: { type: "string", description: "Коротка ремарка агента, 1 речення. НЕ хвали" } }, required: ["title","text","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "save_note", description: "Зберегти нотатку — ТІЛЬКИ думки, рефлексія, емоції, ідеї, стан здоров'я, щоденниковий запис, опис дня/ситуації. НЕ використовувати для дій які треба зробити (купити, зробити, зателефонувати) — це save_task.", parameters: { type: "object", properties: { text: { type: "string", description: "Текст нотатки з виправленою граматикою" }, folder: { type: "string", enum: ["Особисте","Здоров'я","Робота","Навчання","Харчування","Фінанси","Подорожі","Ідеї"], description: "Папка. Якщо сумнів — Особисте. Ідеї — для творчих ідей. Робота — ТІЛЬКИ робочі записи. Подорожі — ТІЛЬКИ реальні поїздки" }, comment: { type: "string", description: "Коротка ремарка 1 речення" } }, required: ["text","folder","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "save_habit", description: "Створити НОВУ регулярну повторювану звичку. Щодня, кожен ранок, тричі на тиждень.", parameters: { type: "object", properties: { name: { type: "string", description: "Назва 2-4 слова" }, details: { type: "string", description: "Деталі якщо є" }, days: { type: "array", items: { type: "integer" }, description: "Дні тижня: 0=Пн,1=Вт,2=Ср,3=Чт,4=Пт,5=Сб,6=Нд. Порожній масив = щодня" }, target_count: { type: "integer", description: "Разів на день (8 склянок = 8). За замовчуванням 1" }, comment: { type: "string", description: "Коротка ремарка" } }, required: ["name","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "save_moment", description: "Зберегти момент дня — що сталося, короткий факт БЕЗ дати в майбутньому: поїхав, зустрівся, побачив, був на...", parameters: { type: "object", properties: { text: { type: "string", description: "Текст моменту" }, mood: { type: "string", enum: ["positive","neutral","negative"] }, comment: { type: "string", description: "Коротка ремарка" } }, required: ["text","mood","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "create_event", description: "Запланована подія з датою в МАЙБУТНЬОМУ: приїзд, зустріч, день народження, концерт, візит, прийом, рейс. ПОДІЯ = факт що СТАНЕТЬСЯ, не дія яку треба зробити.", parameters: { type: "object", properties: { title: { type: "string", description: "Назва 2-5 слів" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM якщо вказано" }, priority: { type: "string", enum: ["normal","important","critical"] }, comment: { type: "string", description: "Коротка ремарка" } }, required: ["title","date","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "save_finance", description: "Записати витрату або дохід — є конкретна сума грошей.", parameters: { type: "object", properties: { fin_type: { type: "string", enum: ["expense","income"] }, amount: { type: "number", description: "Сума" }, category: { type: "string", description: "Витрати: Їжа, Транспорт, Підписки, Здоров'я, Житло, Покупки, Інше. Доходи: Зарплата, Надходження, Повернення, Інше" }, fin_comment: { type: "string", description: "Короткий опис БЕЗ суми, 1-3 слова" }, date: { type: "string", description: "YYYY-MM-DD тільки якщо юзер вказав дату або вчора/позавчора" } }, required: ["fin_type","amount","category","fin_comment"], additionalProperties: false } } },
  { type: "function", function: { name: "create_project", description: "Створити проект — масштабна довгострокова ціль на тижні/місяці: ремонт, запуск бізнесу, розробка додатку, організація весілля.", parameters: { type: "object", properties: { name: { type: "string", description: "Назва 2-5 слів" }, subtitle: { type: "string", description: "Підзаголовок" }, comment: { type: "string", description: "Ремарка" } }, required: ["name"], additionalProperties: false } } },
  // --- ВИКОНАННЯ ---
  { type: "function", function: { name: "complete_habit", description: "Відмітити звичку(и) як виконані сьогодні. Юзер каже що зробив щось зі списку звичок.", parameters: { type: "object", properties: { habit_ids: { type: "array", items: { type: "integer" }, description: "ID звичок зі списку" }, comment: { type: "string", description: "Коротке підтвердження" } }, required: ["habit_ids","comment"], additionalProperties: false } } },
  { type: "function", function: { name: "complete_task", description: "Закрити задачу(і) як виконані. Юзер каже що зробив щось з активних задач.", parameters: { type: "object", properties: { task_ids: { type: "array", items: { type: "integer" }, description: "ID задач зі списку" }, comment: { type: "string", description: "Коротке підтвердження" } }, required: ["task_ids","comment"], additionalProperties: false } } },
  // --- РЕДАГУВАННЯ ---
  { type: "function", function: { name: "edit_task", description: "Змінити існуючу задачу: назву, дедлайн, пріоритет. Юзер каже перенеси/зміни/поміняй задачу.", parameters: { type: "object", properties: { task_id: { type: "integer", description: "ID задачі" }, title: { type: "string" }, due_date: { type: "string", description: "YYYY-MM-DD" }, priority: { type: "string", enum: ["normal","important","critical"] }, comment: { type: "string" } }, required: ["task_id"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_habit", description: "Змінити існуючу звичку: назву, дні, деталі. НЕ створювати нову якщо юзер хоче змінити існуючу!", parameters: { type: "object", properties: { habit_id: { type: "integer", description: "ID звички" }, name: { type: "string" }, days: { type: "array", items: { type: "integer" } }, details: { type: "string" }, comment: { type: "string" } }, required: ["habit_id"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_event", description: "Змінити існуючу подію: дату, час, назву. Перенеси/зміни подію.", parameters: { type: "object", properties: { event_id: { type: "integer", description: "ID події" }, title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM" }, priority: { type: "string", enum: ["normal","important","critical"] }, comment: { type: "string" } }, required: ["event_id"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_note", description: "Змінити існуючу нотатку: текст або папку.", parameters: { type: "object", properties: { note_id: { type: "integer", description: "ID нотатки" }, text: { type: "string" }, folder: { type: "string" }, comment: { type: "string" } }, required: ["note_id"], additionalProperties: false } } },
  // --- ВИДАЛЕННЯ ---
  { type: "function", function: { name: "delete_task", description: "Видалити задачу.", parameters: { type: "object", properties: { task_id: { type: "integer" }, comment: { type: "string" } }, required: ["task_id"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_habit", description: "Видалити звичку.", parameters: { type: "object", properties: { habit_id: { type: "integer" }, comment: { type: "string" } }, required: ["habit_id"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_event", description: "Видалити подію з календаря.", parameters: { type: "object", properties: { event_id: { type: "integer" }, comment: { type: "string" } }, required: ["event_id"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_folder", description: "Видалити папку нотаток з усіма нотатками.", parameters: { type: "object", properties: { folder: { type: "string", description: "Назва папки" } }, required: ["folder"], additionalProperties: false } } },
  // --- ІНШЕ ---
  { type: "function", function: { name: "reopen_task", description: "Повернути закриту задачу в активні.", parameters: { type: "object", properties: { task_id: { type: "integer" }, comment: { type: "string" } }, required: ["task_id"], additionalProperties: false } } },
  { type: "function", function: { name: "add_step", description: "Додати кроки до існуючої задачі.", parameters: { type: "object", properties: { task_id: { type: "integer" }, steps: { type: "array", items: { type: "string" } } }, required: ["task_id","steps"], additionalProperties: false } } },
  { type: "function", function: { name: "move_note", description: "Перемістити нотатку в іншу папку.", parameters: { type: "object", properties: { query: { type: "string", description: "Частина тексту нотатки для пошуку" }, folder: { type: "string", description: "Нова папка" } }, required: ["query","folder"], additionalProperties: false } } },
  { type: "function", function: { name: "update_transaction", description: "Змінити існуючу фінансову транзакцію. Юзер ЯВНО каже змінити/виправити суму або категорію.", parameters: { type: "object", properties: { id: { type: "integer" }, category: { type: "string" }, amount: { type: "number" }, comment: { type: "string" } }, required: ["id"], additionalProperties: false } } },
  { type: "function", function: { name: "set_reminder", description: "Встановити нагадування. Юзер каже НАГАДАЙ, нагадай мені, напомни. ЗАВЖДИ set_reminder, НІКОЛИ не save_task.", parameters: { type: "object", properties: { text: { type: "string", description: "Що нагадати" }, time: { type: "string", description: "HH:MM. вранці=08:00, вдень=12:00, після обіду=14:00, ввечері=18:00, перед сном=22:00, через годину=поточний+1" }, date: { type: "string", description: "YYYY-MM-DD, за замовчуванням сьогодні" } }, required: ["text","time"], additionalProperties: false } } },
  { type: "function", function: { name: "restore_deleted", description: "Відновити видалений запис з кошика.", parameters: { type: "object", properties: { query: { type: "string", description: "Ключові слова, 'all' (всі) або 'last' (останній)" }, type: { type: "string", enum: ["task","note","habit","inbox","folder","finance"], description: "Тип запису" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "save_routine", description: "Зберегти/змінити розпорядок дня.", parameters: { type: "object", properties: { day: { type: "array", items: { type: "string", enum: ["mon","tue","wed","thu","fri","sat","sun","default"] }, description: "Дні. default=будні. Масив: ['mon','tue',...]" }, blocks: { type: "array", items: { type: "object", properties: { time: { type: "string" }, activity: { type: "string" } }, required: ["time","activity"] }, description: "Блоки розпорядку" } }, required: ["day","blocks"], additionalProperties: false } } },
  { type: "function", function: { name: "clarify", description: "Запитати уточнення. ТІЛЬКИ коли 2+ різних типів і незрозуміло, або задача vs проект. Якщо 80%+ впевненості — зберігай без питань.", parameters: { type: "object", properties: { question: { type: "string", description: "Коротке питання 1 речення" }, options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, action: { type: "string" }, category: { type: "string" }, text: { type: "string" }, task_title: { type: "string" }, task_steps: { type: "array", items: { type: "string" } }, habit_id: { type: "integer" } }, required: ["label"] }, description: "2-3 варіанти з вбудованими діями" } }, required: ["question","options"], additionalProperties: false } } },
];

// === HTTP WRAPPER — єдине місце де робиться запит до AI ===
// Повертає message object { content?, tool_calls? } коли tools передані
// Повертає content string коли tools НЕ передані (backward compat)
async function _fetchAI(messages, signal, tools, temperature = 0.7) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { showToast('⚙️ Введіть OpenAI API ключ у налаштуваннях', 3000); return null; }
  if (location.protocol === 'file:') { showToast('⚠️ Відкрий файл через сервер, не file://', 5000); return null; }
  const body = { model: 'gpt-4o-mini', messages, max_tokens: 400, temperature };
  if (tools && tools.length > 0) body.tools = tools;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showToast('❌ ' + (data?.error?.message || `Помилка ${res.status}`), 4000);
    return null;
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) return null;
  // Якщо tools передані — повертаємо повний message object
  if (tools) return msg;
  // Інакше — backward compat, тільки content string
  return msg.content || null;
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
Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD","time":"HH:MM","title":"нова назва"} (передавай тільки поля що змінюються)
Видалити подію: {"action":"delete_event","event_id":ID}
Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст","folder":"нова папка"} (тільки поля що змінюються)
Зберегти/змінити розпорядок: {"action":"save_routine","day":"mon" або ["mon","tue","wed","thu","fri"],"blocks":[{"time":"07:00","activity":"Підйом"},{"time":"09:00","activity":"Робота"}]}
- "Скопіюй на всі будні" → day:["mon","tue","wed","thu","fri"], blocks з поточного дня
- "Зміни дату" → edit_event з новою датою. "Перенеси на 24" → edit_event з date

ID задач, звичок, подій є в КОНТЕКСТ ДАНИХ вище. Використовуй тільки реальні ID.

Нагадування: {"action":"set_reminder","time":"HH:MM","text":"що нагадати","date":"YYYY-MM-DD"} (date за замовчуванням = сьогодні)

ГОЛОВНЕ ПРАВИЛО РЕДАГУВАННЯ: Якщо юзер каже "перенеси", "зміни", "поміняй", "оновити" — це ЗАВЖДИ edit існуючого запису (edit_event, edit_task, edit_note). НІКОЛИ не створюй новий запис замість редагування. "Мама приїде 24го а не 20го" → edit_event (змінити дату), НЕ create_event. Шукай відповідний запис по назві в контексті.`;

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

// === callAIWithTools — tool calling для Inbox ===
// Повертає message object { content?, tool_calls? } або null
// Temperature 0.2 — класифікація має бути стабільною, не творчою
export async function callAIWithTools(systemPrompt, history, tools) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const messages = [{ role: 'system', content: systemPrompt }, ...history];
    const msg = await _fetchAI(messages, controller.signal, tools, 0.2);
    clearTimeout(timeout);
    return msg;
  } catch(e) {
    clearTimeout(timeout);
    console.error('callAIWithTools error:', e);
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

  // Табло може оновитись після закриття чату
  window.dispatchEvent(new CustomEvent('nm-chat-closed', { detail: tab }));
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
