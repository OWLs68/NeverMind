// ============================================================
// app-evening-onboarding.js — Слайди, онбординг, допомога, OWL провідник
// Залежності: app-core.js, app-ai-core.js, app-evening-moments.js
// ============================================================

import { currentTab, showToast, switchTab, updateKeyStatus } from '../core/nav.js';
import { getAIContext, getOWLPersonality, safeAgentReply } from '../ai/core.js';
import { addInboxChatMsg } from './inbox.js';
import { getProjects, saveProjects } from './projects.js';

// === SLIDES TOUR ===
const UPDATE_VERSION = 'v065';

const UPDATE_SLIDES = [
  {
    tag: '🥁 Новий барабан',
    emoji: '🥁',
    title: 'Навігація переписана з нуля',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon-lg">👆</div>
    <div class="ob-text">Тап на будь-яку вкладку — одразу переключає</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🔚</div>
    <div class="ob-text">Гумова межа — крайні вкладки не перелітають</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">➕</div>
    <div class="ob-text">Кнопка + — увімкни або вимкни будь-яку вкладку</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#e0e7ff,#6366f1)',
  },
  {
    tag: '🦉 OWL Board',
    emoji: '🦉',
    title: 'OWL завжди поруч',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon-lg">📋</div>
    <div class="ob-text">OWL табло — на кожній вкладці вгорі</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🌀</div>
    <div class="ob-text">Scroll-behind ефект — контент прокручується під табло</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🌙</div>
    <div class="ob-text">Тихі години 0–5 — OWL не турбує вночі</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fef9c3,#f59e0b)',
  },
  {
    tag: '💬 Новий чат',
    emoji: '💬',
    title: '3 стани чату',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon-lg">⬇️</div>
    <div class="ob-text">Закритий → маленький → на весь екран</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">👈</div>
    <div class="ob-text">iOS-like свайпи в Inbox — закрити клавіатуру</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🔁</div>
    <div class="ob-text">Кожна вкладка памʼятає свій чат</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#d1fae5,#16a34a)',
  },
  {
    tag: '🆕 Нові вкладки',
    emoji: '🆕',
    title: 'Вечір · Я · Здоровʼя · Проекти',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon-lg">🌙</div>
    <div class="ob-text">Вечір — підводь підсумок дня і настрій</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🪞</div>
    <div class="ob-text">Я — твій профіль, цінності і памʼять OWL</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">❤️</div>
    <div class="ob-text">Здоровʼя — картки і щоденні шкали</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🚀</div>
    <div class="ob-text">Проекти — OWL будує план після 3 питань</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fce7f3,#db2777)',
  },
  {
    tag: '🔧 25+ фіксів',
    emoji: '🔧',
    title: 'Більше виправлень ніж будь-коли',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon-lg">🔢</div>
    <div class="ob-text">Множинні звички — тап кілька разів на день</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🗂️</div>
    <div class="ob-text">Нотатки: переміщення між папками через OWL</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon-lg">🛡️</div>
    <div class="ob-text">Відповіді OWL захищені від дублювання</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fed7aa,#c2620a)',
    isLast: true,
  },
];

const SLIDES = [
  {
    tag: 'Що таке NeverMind',
    emoji: '🧠',
    title: 'Один потік для всього',
    body: `<p class="ob-desc" style="margin-bottom:12px">Думки зникають. Записи губляться по різних застосунках. Нічого не виконується бо немає системи.</p>
<p class="ob-desc">NeverMind — один рядок куди скидаєш все що в голові. OWL сам розбереться.</p>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Inbox',
    emoji: '📥',
    title: 'Пиши — OWL розбирає',
    body: `<div class="ob-list">
  <div class="ob-example">"купити хліб" → <b>задача</b></div>
  <div class="ob-example">"бігати щоранку" → <b>звичка</b></div>
  <div class="ob-example">"витратив 50 на їжу" → <b>фінанси</b></div>
  <div class="ob-example">"класна ідея про стартап" → <b>нотатка в Ідеях</b></div>
</div>`,
    color: 'linear-gradient(135deg,#f2d978,#f97316)',
  },
  {
    tag: 'Продуктивність',
    emoji: '⚡',
    title: 'Задачі і звички',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon">✅</div>
    <div class="ob-text">Тап на чекбокс — виконати задачу або звичку</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">👈</div>
    <div class="ob-text">Свайп вліво — видалити</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">💬</div>
    <div class="ob-text">Скажи OWL "додай крок до задачі X"</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#fdb87a,#ea580c)',
  },
  {
    tag: 'Вечір і Я',
    emoji: '🌙',
    title: 'Закриття дня і дзеркало',
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon">🌙</div>
    <div class="ob-text">Вечір — задачі, звички, витрати за день + настрій</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">🪞</div>
    <div class="ob-text">Я — тижневі кружечки, настрій, порівняння</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">🤝</div>
    <div class="ob-text">OWL аналізує тиждень і каже що насправді відбувається</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#1e3350,#3a5a80)',
  },
  {
    tag: 'Нові вкладки',
    emoji: '🆕',
    title: "Здоров'я і Проекти",
    body: `<div class="ob-list">
  <div class="ob-item">
    <div class="ob-icon">🫀</div>
    <div class="ob-text">Здоров'я — картки хвороб, трекер самопочуття, препарати</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">🚀</div>
    <div class="ob-text">Проекти — від ідеї до результату з OWL як наставником</div>
  </div>
  <div class="ob-item">
    <div class="ob-icon">➕</div>
    <div class="ob-text">Кнопка + в барабані — увімкни потрібні вкладки</div>
  </div>
</div>`,
    color: 'linear-gradient(135deg,#d4e8d8,#16a34a)',
    isLast: true,
  },
];

let currentSlide = 0;

let _slidesIsUpdate = false;

let _slidesFromOnboarding = false;

function openSlidesTour(fromOnboarding = false) {
  _slidesFromOnboarding = fromOnboarding;
  _slidesIsUpdate = false;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function openUpdateSlides() {
  _slidesFromOnboarding = false;
  _slidesIsUpdate = true;
  currentSlide = 0;
  const el = document.getElementById('slides-tour');
  el.style.display = 'flex';
  renderSlide();
}

function closeSlidesTour(fromOnboarding = false) {
  const el = document.getElementById('slides-tour');
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.3s ease';
  // Зберігаємо що бачили поточне оновлення
  if (_slidesIsUpdate) {
    localStorage.setItem('nm_seen_update', UPDATE_VERSION);
  }
  setTimeout(() => {
    el.style.display = 'none'; el.style.opacity = ''; el.style.transition = '';
    if (fromOnboarding && !localStorage.getItem('nm_survey_done')) {
      startSurvey();
    }
  }, 300);
}

function getCurrentSlides() {
  return _slidesIsUpdate ? UPDATE_SLIDES : SLIDES;
}

function slidesNext() {
  const slides = getCurrentSlides();
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide();
  } else {
    closeSlidesTour(_slidesFromOnboarding);
  }
}

function renderSlide() {
  const slides = getCurrentSlides();
  const slide = slides[currentSlide];
  const total = slides.length;

  // Крапки прогресу
  const dotsEl = document.getElementById('slides-dots');
  dotsEl.innerHTML = Array.from({length: total}, (_, i) => {
    const isActive = i === currentSlide;
    const isDone = i < currentSlide;
    const bg = isActive || isDone ? '#f97316' : 'rgba(30,16,64,0.1)';
    const w = isActive ? '24px' : '7px';
    return `<div style="height:4px;width:${w};border-radius:2px;background:${bg};transition:all 0.3s"></div>`;
  }).join('');

  // Контент — новий дизайн з великим emoji зверху
  const contentEl = document.getElementById('slides-content');
  contentEl.innerHTML = `
    ${slide.emoji ? `<div style="font-size:44px;margin-bottom:10px;line-height:1">${slide.emoji}</div>` : ''}
    <div class="ob-tag">${slide.tag}</div>
    <div class="ob-slide-title">${slide.title}</div>
    ${slide.body}
  `;

  // Кнопка
  const nextBtn = document.getElementById('slides-next-btn');
  nextBtn.textContent = slide.isLast ? 'Почати →' : 'Далі →';
  nextBtn.style.background = slide.color;

  // Пропустити → Закрити на останньому
  const skipBtn = document.getElementById('slides-skip-btn');
  skipBtn.textContent = slide.isLast ? '' : 'Пропустити';
  skipBtn.style.display = slide.isLast ? 'none' : 'block';
}


// === ONBOARDING ===
// === HELP SYSTEM ===
const HELP_CONTENT = {
  inbox: {
    title: 'Inbox',
    subtitle: 'Один потік для всіх думок.',
    color: 'linear-gradient(135deg, #f2d978, #f97316)',
    accent: '#8b6914',
    sections: [
      { title: 'Як писати', items: [
        { icon: 'edit',  title: 'Будь-який текст', desc: 'Пиши як думаєш. Агент сам визначить — це задача, нотатка, звичка чи ідея.' },
        { icon: 'clock', title: 'З часом', desc: '«Зателефонувати завтра о 9» — час автоматично потрапить у заголовок задачі.' },
        { icon: 'list',  title: 'Список одним рядком', desc: '«Ремонт: купити фарбу, найняти майстра» — Агент розбʼє на окремі кроки.' },
      ]},
      { title: 'Жести', items: [
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп (200px) видаляє запис. Можна відновити через «Відновити».' },
        { icon: 'help',  title: 'Агент уточнить', desc: 'Якщо незрозуміло — зʼявляться варіанти відповіді. Просто вибери.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Запитай про свої записи', desc: '«Які задачі відкриті», «що я записував вчора» — Агент знає весь контекст.' },
        { icon: 'idea', title: 'Розвинь ідею', desc: 'Попроси Агента знайти підводні камені або розгорнути думку.' },
      ]},
    ]
  },
  tasks: {
    title: 'Продуктивність',
    subtitle: 'Задачі з кроками і щоденні звички.',
    color: 'linear-gradient(135deg, #fdb87a, #f97316)',
    accent: '#ea580c',
    sections: [
      { title: 'Задачі', items: [
        { icon: 'check',  title: 'Відмічай кроки', desc: 'Тап на чекбокс — відмічає крок. Всі кроки виконані → задача закривається.' },
        { icon: 'list',   title: 'Кроки через Агента', desc: '«Додай кроки до задачі Ремонт: купити фарбу, найняти майстра».' },
        { icon: 'edit',   title: 'Редагувати', desc: 'Тап на назву задачі відкриває редагування.' },
      ]},
      { title: 'Звички', items: [
        { icon: 'habit',    title: 'Щоденний трекер', desc: 'Нова звичка з Inbox одразу зʼявляється тут. Відмічай кожен день — будується стрік.' },
        { icon: 'calendar', title: 'Вибір днів', desc: 'При створенні вкажи конкретні дні тижня — Агент враховує розклад.' },
        { icon: 'swipe',    title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє звичку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Керуй голосом', desc: null,
          cmds: ['виконав задачу: назва', 'додай крок: назва', 'відміни крок', 'відмітити звичку'] },
      ]},
    ]
  },
  notes: {
    title: 'Нотатки',
    subtitle: 'Записи автоматично сортуються по папках.',
    color: 'linear-gradient(135deg, #fed7aa, #f97316)',
    accent: '#c2620a',
    sections: [
      { title: 'Навігація', items: [
        { icon: 'folder', title: 'Папки', desc: 'Агент сам визначає папку при збереженні. Тапни на папку щоб побачити записи всередині.' },
        { icon: 'search', title: 'Пошук', desc: 'Шукає по тексту всіх нотаток одразу, незалежно від папки.' },
      ]},
      { title: 'Робота з нотаткою', items: [
        { icon: 'chat',  title: 'Обговори з Агентом', desc: 'Відкрий нотатку — знизу зʼявиться чат. Агент допоможе розвинути думку.' },
        { icon: 'swipe', title: 'Свайп вліво — видалити', desc: 'Довгий свайп видаляє нотатку. Можна відновити.' },
        { icon: 'menu',  title: 'Меню ···', desc: 'Три крапки на нотатці — перемістити в іншу папку, скопіювати.' },
      ]},
    ]
  },
  me: {
    title: 'Я',
    subtitle: 'Твоя активність і чесний аналіз від Агента.',
    color: 'linear-gradient(135deg, #a7f3d0, #22c55e)',
    accent: '#16a34a',
    sections: [
      { title: 'Що тут є', items: [
        { icon: 'grid',  title: 'Активність тижня', desc: 'Кожна клітинка — один день. Чим темніше — більше записів.' },
        { icon: 'stats', title: 'Статистика', desc: 'Кількість записів, активних задач і нотаток одним поглядом.' },
        { icon: 'habit', title: 'Прогрес звичок', desc: 'Відсоток за 30 днів і кількість днів поспіль по кожній звичці.' },
      ]},
      { title: 'Агент-коуч', items: [
        { icon: 'refresh', title: 'Аналіз', desc: 'Натисни ↻ — Агент скаже де ти провисаєш і що вдається добре.' },
        { icon: 'star',    title: '3 поради', desc: 'Конкретні практичні поради на основі твоїх реальних даних.' },
        { icon: 'chat',    title: 'Запитай сам', desc: 'Чат внизу — питай про свою продуктивність, звички, прогрес.' },
      ]},
    ]
  },
  evening: {
    title: 'Вечір',
    subtitle: 'Рефлексія дня і підсумок від Агента.',
    color: 'linear-gradient(135deg, #818cf8, #4f46e5)',
    accent: '#4f46e5',
    sections: [
      { title: 'Моменти дня', items: [
        { icon: 'plus', title: 'Додай момент', desc: 'Що трапилось, що відчував, що думав — кнопка «+ Додати» або через Агента.' },
        { icon: 'mood', title: 'Настрій', desc: 'Позначай кожен момент — позитивний, нейтральний чи негативний.' },
        { icon: 'ring', title: 'Кільце продуктивності', desc: 'Відсоток позитивних моментів за день. Чесна картина твого дня.' },
      ]},
      { title: 'Агент-підсумок', items: [
        { icon: 'refresh', title: 'Підсумок дня', desc: 'Натисни ↻ — Агент бачить всі записи і моменти, дає пораду на завтра.' },
        { icon: 'chat',    title: 'Поговори', desc: 'Чат внизу — обговори день, поділись думками, отримай підтримку.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'chat', title: 'Питання', desc: null,
          cmds: ['що я зробив сьогодні', 'як пройшов тиждень', 'що покращити завтра'] },
      ]},
    ]
  },
  finance: {
    title: 'Фінанси',
    subtitle: 'Облік витрат і доходів без таблиць.',
    color: 'linear-gradient(135deg, #fcd9bd, #f97316)',
    accent: '#c2410c',
    sections: [
      { title: 'Як додавати', items: [
        { icon: 'chat',   title: 'Через Inbox або чат', desc: '«Витратив 50 на їжу» або «отримав зарплату 3000» — Агент сам збереже.' },
        { icon: 'plus',   title: 'Вручну', desc: 'Кнопка «+ Додати» — вибери тип, суму і категорію.' },
      ]},
      { title: 'Бюджет', items: [
        { icon: 'limit',  title: 'Загальний ліміт', desc: 'Натисни ✎ в блоці «Бюджет по категоріях» щоб задати місячний ліміт.' },
        { icon: 'cat',    title: 'Ліміти по категоріях', desc: 'Агент попередить коли витрати наближаються до ліміту.' },
      ]},
      { title: 'Агент', items: [
        { icon: 'wallet', title: 'Запити', desc: null,
          cmds: ['скільки витратив цього тижня', 'де найбільше трачу', 'встанови бюджет 2000 на місяць', 'видали останню витрату'] },
      ]},
    ]
  },
};

const FIRST_VISIT_TIPS = {
  inbox:   { icon: '💡', title: 'Підказка', text: 'Пиши будь-що — задачу, ідею, звичку. Агент сам розбере. Спробуй: "купити хліб о 18:00"' },
  tasks:   { icon: '⚡', title: 'Підказка', text: 'Пиши список одним записом: "Ремонт: купити фарбу, знайти майстра" — Агент розібʼє на кроки' },
  notes:   { icon: '📁', title: 'Підказка', text: 'Нотатки автоматично сортуються по папках. Тапни на папку щоб побачити записи всередині' },
  me:      { icon: '📊', title: 'Підказка', text: 'Натисни ↻ в блоці "Аналіз агента" — отримаєш чесний огляд своєї продуктивності' },
  evening: { icon: '🌙', title: 'Підказка', text: 'Натисни ↻ в "Агент на вечір" — Агент підсумує твій день на основі всіх записів' },
  finance: { icon: '◈',  title: 'Підказка', text: 'Пиши витрати прямо в Inbox: "витратив 50 на їжу" — Агент сам збереже у Фінанси' },
};

let _helpOpen = false;

const HELP_ICONS = {
  edit:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  clock:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  list:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  swipe:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  help:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chat:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  idea:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="4"/></svg>',
  check:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  habit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M12 8v4l3 3"/></svg>',
  calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  folder:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  search:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  menu:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  grid:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  stats:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  star:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  plus:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  mood:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  ring:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  wallet:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  limit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  cat:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

function openHelp(tab) {
  const data = HELP_CONTENT[tab];
  if (!data) return;

  const panel = document.getElementById('help-drawer-panel');

  // Кольоровий хедер
  const headerEl = document.getElementById('help-drawer-header');
  if (headerEl) {
    headerEl.style.background = data.color;
  }

  document.getElementById('help-drawer-title').textContent = data.title;
  document.getElementById('help-drawer-subtitle').textContent = data.subtitle;

  const contentEl = document.getElementById('help-drawer-content');
  contentEl.innerHTML = data.sections.map(section => `
    <div class="help-section-title">${section.title}</div>
    ${section.items.map(item => `
      <div class="help-item">
        <div class="help-item-icon" style="color:${data.accent}">${HELP_ICONS[item.icon] || ''}</div>
        <div style="flex:1;min-width:0">
          <div class="help-item-title">${item.title}</div>
          ${item.desc ? `<div class="help-item-desc">${item.desc}</div>` : ''}
          ${item.cmds ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.cmds.map(c => `<span class="help-cmd">${c}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `).join('');

  const drawer = document.getElementById('help-drawer');
  drawer.style.display = 'flex';
  requestAnimationFrame(() => {
    document.getElementById('help-drawer-panel').style.transform = 'translateX(0)';
  });
  _helpOpen = true;

  // Свайп вправо — закрити
  if (!panel._helpSwipe) {
    panel._helpSwipe = true;
    let _sx = 0, _sy = 0, _dragging = false;
    panel.addEventListener('touchstart', e => {
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      _dragging = false;
      panel.style.transition = 'none';
    }, { passive: true });
    panel.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - _sx;
      const dy = Math.abs(e.touches[0].clientY - _sy);
      if (!_dragging && dx > 8 && dy < dx) _dragging = true;
      if (!_dragging) return;
      if (dx > 0) panel.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    panel.addEventListener('touchend', e => {
      if (!_dragging) { panel.style.transition = ''; panel.style.transform = 'translateX(0)'; return; }
      const dx = e.changedTouches[0].clientX - _sx;
      panel.style.transition = 'transform 0.24s cubic-bezier(0.32,0.72,0,1)';
      if (dx > 80) {
        panel.style.transform = 'translateX(100%)';
        setTimeout(() => { drawer.style.display = 'none'; panel.style.transition = ''; }, 240);
        _helpOpen = false;
      } else {
        panel.style.transform = 'translateX(0)';
        setTimeout(() => { panel.style.transition = ''; }, 250);
      }
      _dragging = false;
    }, { passive: true });
  }
}

function closeHelp() {
  const panel = document.getElementById('help-drawer-panel');
  if (panel) {
    panel.style.transition = 'transform 0.24s cubic-bezier(0.32,0.72,0,1)';
    panel.style.transform = 'translateX(100%)';
  }
  setTimeout(() => {
    const drawer = document.getElementById('help-drawer');
    if (drawer) drawer.style.display = 'none';
    if (panel) panel.style.transition = '';
  }, 240);
  _helpOpen = false;
}

// Підказка першого відвідування
export function showFirstVisitTip(tab) {
  const key = 'nm_visited_' + tab;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const tip = FIRST_VISIT_TIPS[tab];
  if (!tip) return;

  // Видаляємо попередню підказку якщо є
  const prev = document.getElementById('fv-tip');
  if (prev) prev.remove();

  const tipEl = document.createElement('div');
  tipEl.id = 'fv-tip';
  tipEl.className = 'fv-tip';
  // Позиціонуємо над таббаром
  const tbH = document.getElementById('tab-bar')?.offsetHeight || 83;
  tipEl.style.bottom = (tbH + 12) + 'px';
  tipEl.innerHTML = `
    <div class="fv-tip-icon">${tip.icon}</div>
    <div class="fv-tip-body">
      <div class="fv-tip-title">${tip.title}</div>
      <div class="fv-tip-text">${tip.text}</div>
    </div>
    <div class="fv-tip-close" onclick="this.closest('#fv-tip').remove()">✕</div>
  `;
  document.body.appendChild(tipEl);

  // Автозакриття через 6 секунд
  setTimeout(() => { if (document.getElementById('fv-tip') === tipEl) tipEl.remove(); }, 6000);
}


// === SURVEY (після першого онбордингу) ===
const SURVEY_QUESTIONS = [
  'Чим займаєшся? (наприклад: підприємець, студент, програміст, фрілансер…)',
  'Які твої головні цілі зараз? (коротко, 1-2 речення)',
  'Що хочеш тримати під контролем — задачі, звички, ідеї, або все разом?',
  'Як у тебе зараз з фінансами — ведеш облік чи поки хаос?',
  'Є якийсь проект або велика ціль над якою зараз працюєш?',
  'Розкажи про свій день: о котрій зазвичай прокидаєшся, починаєш активну роботу і лягаєш спати? (наприклад: встаю о 7, працюю з 9 до 18, сплю о 23)',
  'Що найбільше заважає тобі бути продуктивним зараз?',
  'Які звички хочеш сформувати або вже намагаєшся підтримувати?',
  'Як ти зазвичай запамʼятовуєш ідеї — телефон, блокнот, голова?',
  'Що хочеш змінити у своєму житті через 3 місяці?',
];
let surveyAnswers = [];
let surveyStep = 0;
let surveyWaiting = false;

function startSurvey() {
  surveyAnswers = [];
  surveyStep = 0;
  surveyWaiting = false;
  // Переходимо на Inbox
  if (currentTab !== 'inbox') switchTab('inbox');
  // Невелика затримка щоб Inbox відрендерився
  setTimeout(() => {
    addInboxChatMsg('agent', 'Привіт! 👋 Щоб я міг бути кориснішим — розкажи трохи про себе. Це займе хвилину, а я зможу давати конкретніші поради саме для тебе.');
    setTimeout(() => askSurveyQuestion(), 800);
  }, 400);
}

function askSurveyQuestion() {
  if (surveyStep >= SURVEY_QUESTIONS.length) {
    finishSurvey();
    return;
  }
  surveyWaiting = true;
  addInboxChatMsg('agent', SURVEY_QUESTIONS[surveyStep]);
}

// Перехоплюємо відповіді під час опитування
export function handleSurveyAnswer(text) {
  if (!surveyWaiting) return false;
  surveyWaiting = false;
  surveyAnswers.push({ q: SURVEY_QUESTIONS[surveyStep], a: text });
  surveyStep++;
  if (surveyStep < SURVEY_QUESTIONS.length) {
    setTimeout(() => askSurveyQuestion(), 400);
  } else {
    setTimeout(() => finishSurvey(), 400);
  }
  return true; // означає що повідомлення перехоплено
}

async function finishSurvey() {
  addInboxChatMsg('agent', 'Дякую! Зараз підготую персональні поради…');
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    addInboxChatMsg('agent', 'Введи API ключ в налаштуваннях — і я збережу все про тебе в памʼять.');
    localStorage.setItem('nm_survey_done', '1');
    localStorage.setItem('nm_guide_step', SURVEY_QUESTIONS.length.toString());
    return;
  }
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  const name = settings.name || 'користувач';

  // Парсимо розклад з відповіді на питання #6 (індекс 5)
  const scheduleAnswer = (surveyAnswers[5] || {}).a || '';
  const parseScheduleTime = (text, patterns, def) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const h = parseInt(m[1]);
        if (!isNaN(h) && h >= 0 && h <= 23) return `${String(h).padStart(2,'0')}:00`;
      }
    }
    return def;
  };
  const parsedSchedule = {
    wakeUp:    parseScheduleTime(scheduleAnswer, [/встаю\s*о?\s*(\d{1,2})/i, /прокидаюсь\s*о?\s*(\d{1,2})/i, /підйом\s*о?\s*(\d{1,2})/i], '07:00'),
    workStart: parseScheduleTime(scheduleAnswer, [/працюю\s*з\s*(\d{1,2})/i, /починаю\s*о?\s*(\d{1,2})/i, /роботу?\s*з\s*(\d{1,2})/i], '09:00'),
    workEnd:   parseScheduleTime(scheduleAnswer, [/до\s*(\d{1,2})/i, /закінчую\s*о?\s*(\d{1,2})/i], '18:00'),
    bedTime:   parseScheduleTime(scheduleAnswer, [/сплю\s*о?\s*(\d{1,2})/i, /лягаю\s*о?\s*(\d{1,2})/i, /о\s*(\d{1,2})\s*спати/i], '23:00'),
  };
  const updSettings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  updSettings.schedule = parsedSchedule;
  localStorage.setItem('nm_settings', JSON.stringify(updSettings));

  const answersText = surveyAnswers.map((a, i) => `Питання ${i+1}: ${a.q}\nВідповідь: ${a.a}`).join('\n\n');
  const prompt = `Ти — OWL, агент NeverMind. Користувач ${name} тільки що відповів на питання онбордингу:\n\n${answersText}\n\nЗроби дві речі:\n1. Збережи ключові факти про користувача у форматі короткого резюме (4-6 речень) — це піде в памʼять агента.\n2. Дай 2-3 конкретні практичні поради як використовувати NeverMind саме для цієї людини. Порекомендуй конкретні вкладки або функції.\n\nФормат відповіді — ТІЛЬКИ валідний JSON:\n{"memory": "текст для памʼяті", "advice": "персональні поради 2-3 речення"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.7 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      try {
        const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
        if (parsed.memory) {
          localStorage.setItem('nm_memory', parsed.memory);
          localStorage.setItem('nm_memory_ts', Date.now().toString());
        }
        if (parsed.advice) {
          addInboxChatMsg('agent', parsed.advice);
        }
      } catch(e) {
        safeAgentReply(reply, addInboxChatMsg);
      }
    }
  } catch(e) {
    addInboxChatMsg('agent', 'Не вдалось зберегти — але твої відповіді я запамʼятав.');
  }
  localStorage.setItem('nm_survey_done', '1');
  localStorage.setItem('nm_guide_step', SURVEY_QUESTIONS.length.toString());

  // Через 30 секунд — перша рекомендація по застосунку
  setTimeout(() => owlGuideNextTip(), 30000);
}

// === OWL ПРОВІДНИК — органічні питання після онбордингу ===

// Теми для подальшого вивчення (після базових 10 питань)
const OWL_GUIDE_TOPICS = [
  { key: 'health', q: 'Як ти зараз з енергією і здоровʼям — відстежуєш чи пускаєш на самоплив?' },
  { key: 'relations', q: 'Є важливі люди в житті яким хочеш приділяти більше уваги?' },
  { key: 'learning', q: 'Зараз щось активно вивчаєш — книги, курси, нові навички?' },
  { key: 'stress', q: 'Що зараз найбільше тисне або викликає тривогу?' },
  { key: 'money_goal', q: 'Є конкретна фінансова ціль — накопичити, купити, інвестувати?' },
  { key: 'daily_routine', q: 'Як виглядає твій ідеальний день — є якийсь ритм або все хаотично?' },
  { key: 'motivation', q: 'Що тебе найбільше мотивує — результат, визнання, розвиток, або щось інше?' },
  { key: 'obstacles', q: 'Що найчастіше зупиняє коли берешся за щось нове?' },
];

// Підказки про функції застосунку
const OWL_APP_TIPS = [
  { key: 'tip_inbox', msg: 'До речі — в Inbox можна писати всe підряд одним рядком, навіть "купити хліб і зателефонувати мамі". Я розберуся сам.' },
  { key: 'tip_habits', msg: 'Вкладка Продуктивність → Звички — можна відстежувати регулярні дії з підрахунком кількості. Наприклад "8 склянок води".' },
  { key: 'tip_notes', msg: 'У Нотатках папки створюються автоматично — просто пиши в Inbox і я кладу в потрібне місце. Або сам можеш сказати куди.' },
  { key: 'tip_finance', msg: 'Фінанси ведуться через Inbox — просто напиши "витратив 200 на продукти" і я запишу. Без форм і полів.' },
  { key: 'tip_evening', msg: 'Вкладка Вечір — там підсумок дня і настрій одним тапом. Добре відкривати ввечері щоб закрити день.' },
  { key: 'tip_projects', msg: 'Якщо є велика ціль або проект — вкладка Проекти допоможе з планом і темпом. Просто напиши про неї і я допоможу розбити на кроки.' },
  { key: 'tip_owl_mode', msg: 'В налаштуваннях можна змінити характер OWL — Тренер (прямий), Партнер (теплий), або Наставник (мудрий). Який тобі ближче?' },
  { key: 'tip_memory', msg: 'Все що ти розповідаєш — я запамʼятовую. В налаштуваннях є розділ Памʼять де можна подивитись і відредагувати що я знаю про тебе.' },
];

function owlGuideNextTip() {
  // Не питаємо якщо опитування ще йде
  if (surveyWaiting) return;
  // Не питаємо вночі
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 8) return;
  // Не питаємо якщо вкладка не Inbox
  if (typeof currentTab !== 'undefined' && currentTab !== 'inbox') return;

  // Продовження інтерв'ю по проекту
  const projectStep = parseInt(localStorage.getItem('nm_project_interview_step') || '0');
  const projectName = localStorage.getItem('nm_project_interview_name') || '';
  if (projectStep > 0 && projectName) {
    const projectQuestions = [
      `Скільки годин на тиждень реально можеш вкладати в "${projectName}"?`,
      `Що найбільше лякає або турбує тебе в цьому проекті?`,
      `Чому саме "${projectName}" — що тебе мотивує?`,
    ];
    if (projectStep <= projectQuestions.length) {
      addInboxChatMsg('agent', projectQuestions[projectStep - 1]);
      if (projectStep < projectQuestions.length) {
        localStorage.setItem('nm_project_interview_step', (projectStep + 1).toString());
      } else {
        // Після всіх питань — генеруємо перші кроки
        localStorage.removeItem('nm_project_interview_step');
        localStorage.removeItem('nm_project_interview_name');
        setTimeout(() => generateProjectFirstSteps(projectName), 1500);
      }
      return;
    }
  }

  const shownTips = JSON.parse(localStorage.getItem('nm_guide_shown_tips') || '[]');
  const shownTopics = JSON.parse(localStorage.getItem('nm_guide_shown_topics') || '[]');

  // Спочатку показуємо підказки про функції (кожну один раз)
  const nextTip = OWL_APP_TIPS.find(t => !shownTips.includes(t.key));
  if (nextTip) {
    addInboxChatMsg('agent', nextTip.msg);
    shownTips.push(nextTip.key);
    localStorage.setItem('nm_guide_shown_tips', JSON.stringify(shownTips));
    return;
  }

  // Потім питаємо по темах (кожну один раз)
  const nextTopic = OWL_GUIDE_TOPICS.find(t => !shownTopics.includes(t.key));
  if (nextTopic) {
    addInboxChatMsg('agent', nextTopic.q);
    shownTopics.push(nextTopic.key);
    localStorage.setItem('nm_guide_shown_topics', JSON.stringify(shownTopics));
    localStorage.setItem('nm_guide_waiting_topic', nextTopic.key);
  }
}

// Виклик після кожної відповіді агента в Inbox — вирішує чи питати зараз
export function maybeAskGuideQuestion() {
  // Тільки якщо онбординг завершено і є ключ
  if (!localStorage.getItem('nm_survey_done')) return;
  if (!localStorage.getItem('nm_gemini_key')) return;
  if (surveyWaiting) return;

  // Органічно — не кожного разу, а з вірогідністю ~25% і не частіше ніж раз на 3 хв
  const lastGuideTs = parseInt(localStorage.getItem('nm_guide_last_ts') || '0');
  const elapsed = Date.now() - lastGuideTs;
  if (elapsed < 3 * 60 * 1000) return; // не частіше 3 хвилин
  if (Math.random() > 0.25) return; // 25% шанс

  localStorage.setItem('nm_guide_last_ts', Date.now().toString());
  setTimeout(() => owlGuideNextTip(), 1200); // невелика пауза після відповіді агента
}

async function generateProjectFirstSteps(projectName) {
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;
  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} На основі розмови про проект "${projectName}" — запропонуй перші 3 конкретні кроки для старту. Кожен крок — одна дія, 4-8 слів, реальна і досяжна на цьому тижні.
Відповідай ТІЛЬКИ JSON: {"steps":["крок 1","крок 2","крок 3"],"summary":"1 речення — що це за проект і з чого починати"}`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Проект: ${projectName}\n\n${aiContext}` }
        ],
        max_tokens: 200,
        temperature: 0.6
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return;
    const parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
    if (parsed.steps && parsed.steps.length > 0) {
      // Зберігаємо кроки в проект
      try {
        const projects = getProjects();
        const p = projects.find(pr => pr.name === projectName);
        if (p && p.steps.length === 0) {
          p.steps = parsed.steps.map(s => ({ id: Date.now() + Math.random(), text: s, done: false }));
          saveProjects(projects);
        }
      } catch(e) {}
      const stepsText = parsed.steps.map((s, i) => `${i+1}. ${s}`).join('\n');
      addInboxChatMsg('agent', `${parsed.summary || 'Перші кроки для старту:'}\n\n${stepsText}\n\nКроки збережені у воркспейсі проекту.`);
    }
  } catch(e) {}
}

// Зберігає відповідь юзера в памʼять якщо OWL чекав на відповідь по темі
export async function saveGuideTopicAnswer(userText) {
  const waitingTopic = localStorage.getItem('nm_guide_waiting_topic');
  if (!waitingTopic) return;
  localStorage.removeItem('nm_guide_waiting_topic');

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) return;

  const currentMemory = localStorage.getItem('nm_memory') || '';
  const topicData = OWL_GUIDE_TOPICS.find(t => t.key === waitingTopic);
  if (!topicData) return;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Існуюча памʼять про користувача:\n${currentMemory}\n\nНова відповідь на питання "${topicData.q}":\n${userText}\n\nДопов нову інформацію до памʼяті. Повернь ТІЛЬКИ оновлений текст памʼяті (без JSON, без коментарів), максимум 8 речень.` }],
        max_tokens: 300,
        temperature: 0.5
      })
    });
    const data = await res.json();
    const updated = data.choices?.[0]?.message?.content?.trim();
    if (updated) {
      localStorage.setItem('nm_memory', updated);
      localStorage.setItem('nm_memory_ts', Date.now().toString());
    }
  } catch(e) {}
}


export function checkOnboarding() {
  const done = localStorage.getItem('nm_onboarding_done');
  if (!done) {
    // Новий користувач — показуємо онбординг
    document.getElementById('onboarding').style.display = 'block';
    return true;
  }
  // Існуючий користувач — перевіряємо чи бачив оновлення
  const seenUpdate = localStorage.getItem('nm_seen_update');
  if (seenUpdate !== UPDATE_VERSION) {
    setTimeout(() => openUpdateSlides(), 500);
    return false;
  }
  return false;
}

function obNext(step) {
  if (step === 1) {
    const name = document.getElementById('ob-name').value.trim();
    const age = document.getElementById('ob-age').value.trim();
    if (!name) { showToast('Введи імʼя'); return; }
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    settings.name = name;
    if (age) settings.age = age;
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-1').style.display = 'none';
    document.getElementById('ob-step-2').style.display = 'block';
  } else if (step === 2) {
    const key = document.getElementById('ob-key').value.trim();
    if (key) localStorage.setItem('nm_gemini_key', key);
    document.getElementById('ob-step-2').style.display = 'none';
    document.getElementById('ob-step-owl').style.display = 'block';
    // Дефолтно вибрати "partner"
    selectOwlMode('partner');
  } else if (step === 'owl') {
    const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
    if (!settings.owl_mode) settings.owl_mode = 'partner';
    localStorage.setItem('nm_settings', JSON.stringify(settings));
    document.getElementById('ob-step-owl').style.display = 'none';
    document.getElementById('ob-step-consent').style.display = 'block';
  }
}

function obSkipKey() {
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-owl').style.display = 'block';
  selectOwlMode('partner');
}

function selectOwlMode(mode) {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  settings.owl_mode = mode;
  localStorage.setItem('nm_settings', JSON.stringify(settings));
  ['coach','partner','mentor'].forEach(m => {
    const card = document.getElementById('owl-card-' + m);
    if (!card) return;
    card.style.border = m === mode ? '2px solid #7c3aed' : '2px solid rgba(124,58,237,0.15)';
    card.style.background = m === mode ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.8)';
  });
}

function obShowWelcome() {
  const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
  document.getElementById('ob-welcome-text').textContent = `Привіт, ${settings.name || 'друже'}! 👋`;
  document.getElementById('ob-step-2').style.display = 'none';
  document.getElementById('ob-step-3').style.display = 'block';
}

function obFinish() {
  localStorage.setItem('nm_onboarding_done', '1');
  const ob = document.getElementById('onboarding');
  ob.style.opacity = '0';
  ob.style.transition = 'opacity 0.4s ease';
  setTimeout(() => {
    ob.style.display = 'none';
    // Показуємо тур після онбордингу
    openSlidesTour(true);
  }, 400);
  updateKeyStatus(!!localStorage.getItem('nm_gemini_key'));
}


// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openHelp, closeHelp, openSlidesTour, closeSlidesTour, slidesNext,
  obNext, obSkipKey, obFinish, selectOwlMode, openUpdateSlides,
});
