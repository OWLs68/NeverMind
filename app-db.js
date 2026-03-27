// ============================================================
// app-db.js — Централізований доступ до localStorage
// Підключається першим серед JS-модулів
// ============================================================

const db = {

  // ===== Базові методи =====

  get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return defaultValue;
      return JSON.parse(val);
    } catch { return defaultValue; }
  },

  save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  },

  // ===== Задачі =====

  getTasks()     { return db.get('nm_tasks', []); },
  saveTasks(arr) { db.save('nm_tasks', arr); },

  // ===== Нотатки =====

  getNotes()     { return db.get('nm_notes', []); },
  saveNotes(arr) { db.save('nm_notes', arr); },

  getFoldersMeta()     { try { return db.get('nm_folders_meta', {}); } catch { return {}; } },
  saveFoldersMeta(obj) { try { db.save('nm_folders_meta', obj); } catch(e) {} },

  // ===== Inbox =====

  getInbox()     { return db.get('nm_inbox', []); },
  saveInbox(arr) { db.save('nm_inbox', arr); },

  // ===== Звички =====

  getHabits()       { return db.get('nm_habits2', []); },
  saveHabits(arr)   { db.save('nm_habits2', arr); },
  getHabitLog()     { return db.get('nm_habit_log2', {}); },
  saveHabitLog(obj) { db.save('nm_habit_log2', obj); },
  getQuitLog()      { return db.get('nm_quit_log', {}); },
  saveQuitLog(obj)  { db.save('nm_quit_log', obj); },

  // ===== Фінанси =====

  getFinance()       { return db.get('nm_finance', []); },
  saveFinance(arr)   { db.save('nm_finance', arr); },
  getFinBudget()     { return db.get('nm_finance_budget', { total: 0, categories: {} }); },
  saveFinBudget(obj) { db.save('nm_finance_budget', obj); },
  getFinCats() {
    const saved = db.get('nm_finance_cats', null);
    if (saved) return saved;
    return {
      expense: ['Їжа', 'Транспорт', 'Підписки', 'Здоровʼя', 'Житло', 'Покупки', 'Інше'],
      income:  ['Зарплата', 'Надходження', 'Повернення', 'Інше'],
    };
  },
  saveFinCats(obj) { db.save('nm_finance_cats', obj); },

  // ===== Здоровʼя =====

  getHealthCards()      { return db.get('nm_health_cards', []); },
  saveHealthCards(arr)  { db.save('nm_health_cards', arr); },
  getHealthLog()        { return db.get('nm_health_log', {}); },
  saveHealthLog(obj)    { db.save('nm_health_log', obj); },

  // ===== Проекти =====

  getProjects()      { return db.get('nm_projects', []); },
  saveProjects(arr)  { db.save('nm_projects', arr); },

  // ===== Моменти та Вечір =====

  getMoments()      { return db.get('nm_moments', []); },
  saveMoments(arr)  { db.save('nm_moments', arr); },

  getEveningSummary()      { return db.get('nm_evening_summary', null); },
  saveEveningSummary(obj)  { db.save('nm_evening_summary', obj); },

  getEveningMood() {
    const today = new Date().toDateString();
    try {
      const saved = db.get('nm_evening_mood', null);
      if (saved && saved.date === today) return saved.mood;
    } catch(e) {}
    return null;
  },
  saveEveningMood(obj) { db.save('nm_evening_mood', obj); },

  // ===== Налаштування =====

  getSettings()      { return db.get('nm_settings', {}); },
  saveSettings(obj)  { db.save('nm_settings', obj); },

  // ===== API ключ =====

  getApiKey()     { return localStorage.getItem('nm_gemini_key') || ''; },
  saveApiKey(key) {
    if (key) localStorage.setItem('nm_gemini_key', key);
    else localStorage.removeItem('nm_gemini_key');
  },

  // ===== Памʼять =====

  getMemory()      { return localStorage.getItem('nm_memory') || ''; },
  saveMemory(text) { localStorage.setItem('nm_memory', text); },
  getMemoryTs()    { return localStorage.getItem('nm_memory_ts'); },
  saveMemoryTs(ts) { localStorage.setItem('nm_memory_ts', String(ts)); },

  // ===== Активні вкладки =====

  getActiveTabs() {
    try {
      const saved = db.get('nm_active_tabs', null);
      if (Array.isArray(saved) && saved.length >= 1) return saved;
    } catch(e) {}
    return ['inbox', 'notes'];
  },
  saveActiveTabs(arr) { db.save('nm_active_tabs', arr); },

  // ===== Кошик =====

  getTrash()      { try { return db.get('nm_trash', []); } catch { return []; } },
  saveTrash(arr)  { db.save('nm_trash', arr); },

  // ===== Лог помилок =====

  getErrorLog()       { try { return db.get('nm_error_log', []); } catch { return []; } },
  saveErrorLog(arr)   { try { db.save('nm_error_log', arr); } catch(e) {} },

  // ===== OWL Board (inbox) =====

  getOwlBoardMessages()      { try { return db.get('nm_owl_board', []); } catch { return []; } },
  saveOwlBoardMessages(arr)  { db.save('nm_owl_board', arr.slice(-3)); },

  getOwlBoardSaid() {
    try {
      const s = db.get('nm_owl_board_said', {});
      if (s.date !== new Date().toDateString()) return { date: new Date().toDateString(), topics: [] };
      return s;
    } catch { return { date: new Date().toDateString(), topics: [] }; }
  },
  saveOwlBoardSaid(obj) { db.save('nm_owl_board_said', obj); },

  getOwlBoardTs()      { return parseInt(localStorage.getItem('nm_owl_board_ts') || '0'); },
  saveOwlBoardTs(ts)   { localStorage.setItem('nm_owl_board_ts', String(ts)); },

  // ===== OWL Tab Boards =====

  getOwlTabBoardKey(tab) { return 'nm_owl_tab_' + tab; },
  getOwlTabTsKey(tab)    { return 'nm_owl_tab_ts_' + tab; },
  getOwlTabSaidKey(tab)  { return 'nm_owl_tab_said_' + tab; },

  getTabBoardMsgs(tab) {
    try {
      const raw = db.get(db.getOwlTabBoardKey(tab), null);
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      return [raw]; // backward compat: старий формат → масив
    } catch { return []; }
  },
  saveTabBoardMsg(tab, newMsg) {
    const msgs = db.getTabBoardMsgs(tab);
    msgs.unshift(newMsg);
    if (msgs.length > 3) msgs.length = 3;
    try { db.save(db.getOwlTabBoardKey(tab), msgs); } catch(e) {}
  },
  getTabBoardSaid(tab) {
    const today = new Date().toDateString();
    try {
      const raw = db.get(db.getOwlTabSaidKey(tab), {});
      if (raw.date !== today) return {};
      return raw.said || {};
    } catch { return {}; }
  },
  saveTabBoardSaid(tab, said) {
    const today = new Date().toDateString();
    try { db.save(db.getOwlTabSaidKey(tab), { date: today, said }); } catch(e) {}
  },
  getOwlTabTs(tab)      { return parseInt(localStorage.getItem(db.getOwlTabTsKey(tab)) || '0'); },
  saveOwlTabTs(tab, ts) { localStorage.setItem(db.getOwlTabTsKey(tab), String(ts)); },

  // ===== Chat messages =====

  saveChatMsg(tab, role, text) {
    if (role === 'typing') return;
    const keys = { inbox: 'nm_chat_inbox', tasks: 'nm_chat_tasks', notes: 'nm_chat_notes', me: 'nm_chat_me', evening: 'nm_chat_evening', finance: 'nm_chat_finance' };
    const key = keys[tab];
    if (!key) return;
    try {
      const msgs = db.get(key, []);
      msgs.push({ role, text, ts: Date.now() });
      if (msgs.length > 30) msgs.splice(0, msgs.length - 30);
      db.save(key, msgs);
    } catch(e) {}
  },
  loadChatMsgs(tab) {
    const keys = { inbox: 'nm_chat_inbox', tasks: 'nm_chat_tasks', notes: 'nm_chat_notes', me: 'nm_chat_me', evening: 'nm_chat_evening', finance: 'nm_chat_finance' };
    const key = keys[tab];
    if (!key) return [];
    try { return db.get(key, []); } catch { return []; }
  },

  // ===== Task chat =====

  getTaskChat(id)       { return db.get('nm_task_chat_' + id, null); },
  saveTaskChat(id, obj) { db.save('nm_task_chat_' + id, obj); },

  // ===== Onboarding / Guide =====

  getOnboardingDone()      { return localStorage.getItem('nm_onboarding_done'); },
  setOnboardingDone()      { localStorage.setItem('nm_onboarding_done', '1'); },
  getSurveyDone()          { return localStorage.getItem('nm_survey_done'); },
  setSurveyDone()          { localStorage.setItem('nm_survey_done', '1'); },
  getSeenUpdate()          { return localStorage.getItem('nm_seen_update'); },
  setSeenUpdate(v)         { localStorage.setItem('nm_seen_update', v); },
  getGuideStep()           { return localStorage.getItem('nm_guide_step'); },
  setGuideStep(v)          { localStorage.setItem('nm_guide_step', v); },
  getGuideShownTips()      { return db.get('nm_guide_shown_tips', []); },
  setGuideShownTips(arr)   { db.save('nm_guide_shown_tips', arr); },
  getGuideShownTopics()    { return db.get('nm_guide_shown_topics', []); },
  setGuideShownTopics(arr) { db.save('nm_guide_shown_topics', arr); },
  getGuideWaitingTopic()   { return localStorage.getItem('nm_guide_waiting_topic'); },
  setGuideWaitingTopic(v)  { localStorage.setItem('nm_guide_waiting_topic', v); },
  clearGuideWaitingTopic() { localStorage.removeItem('nm_guide_waiting_topic'); },
  getGuideLastTs()         { return parseInt(localStorage.getItem('nm_guide_last_ts') || '0'); },
  setGuideLastTs(ts)       { localStorage.setItem('nm_guide_last_ts', String(ts)); },
  getProjectInterviewStep()    { return parseInt(localStorage.getItem('nm_project_interview_step') || '0'); },
  setProjectInterviewStep(v)   { localStorage.setItem('nm_project_interview_step', String(v)); },
  clearProjectInterviewStep()  { localStorage.removeItem('nm_project_interview_step'); },
  getProjectInterviewName()    { return localStorage.getItem('nm_project_interview_name') || ''; },
  setProjectInterviewName(v)   { localStorage.setItem('nm_project_interview_name', v); },
  clearProjectInterviewName()  { localStorage.removeItem('nm_project_interview_name'); },

  // ===== Інші =====

  getNotesFoldersTs()    { return localStorage.getItem('nm_notes_folders_ts'); },
  setNotesFoldersTs(ts)  { localStorage.setItem('nm_notes_folders_ts', String(ts)); },
  getFinCoachCache(key)  { return localStorage.getItem(key); },
  setFinCoachCache(key, data) { localStorage.setItem(key, data); },
  getVisited(key)        { return localStorage.getItem(key); },
  setVisited(key)        { localStorage.setItem(key, '1'); },
};

// ============================================================
// Глобальні враппери — зворотня сумісність для модулів
// що викликають функції без префіксу db.
// ============================================================
function getTasks()              { return db.getTasks(); }
function saveTasks(arr)          { db.saveTasks(arr); }
function getInbox()              { return db.getInbox(); }
function saveInbox(arr)          { db.saveInbox(arr); }
function getNotes()              { return db.getNotes(); }
function saveNotes(arr)          { db.saveNotes(arr); }
function getHabits()             { return db.getHabits(); }
function saveHabits(arr)         { db.saveHabits(arr); }
function getHabitLog()           { return db.getHabitLog(); }
function saveHabitLog(obj)       { db.saveHabitLog(obj); }
function getQuitLog()            { return db.getQuitLog(); }
function saveQuitLog(obj)        { db.saveQuitLog(obj); }
function getFinance()            { return db.getFinance(); }
function saveFinance(arr)        { db.saveFinance(arr); }
function getFinBudget()          { return db.getFinBudget(); }
function saveFinBudget(obj)      { db.saveFinBudget(obj); }
function getFinCats()            { return db.getFinCats(); }
function saveFinCats(obj)        { db.saveFinCats(obj); }
function getHealthCards()        { return db.getHealthCards(); }
function saveHealthCards(arr)    { db.saveHealthCards(arr); }
function getHealthLog()          { return db.getHealthLog(); }
function saveHealthLog(obj)      { db.saveHealthLog(obj); }
function getProjects()           { return db.getProjects(); }
function saveProjects(arr)       { db.saveProjects(arr); }
function getMoments()            { return db.getMoments(); }
function saveMoments(arr)        { db.saveMoments(arr); }
function getEveningSummary()     { return db.getEveningSummary(); }
function saveEveningSummary(obj) { db.saveEveningSummary(obj); }
function getEveningMood()        { return db.getEveningMood(); }
function saveEveningMood(obj)    { db.saveEveningMood(obj); }
function getTrash()              { return db.getTrash(); }
function saveTrash(arr)          { db.saveTrash(arr); }
function getErrorLog()           { return db.getErrorLog(); }
function saveErrorLog(arr)       { db.saveErrorLog(arr); }
