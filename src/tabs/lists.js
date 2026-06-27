// ============================================================
// lists.js — Списки-чеклісти в Inbox (окрема сутність nm_lists, v3pexs)
//
// Список ≠ задача: жива легка сутність-чекліст що рендериться карткою прямо
// у стрічці Inbox, нуль слідів у nm_tasks. Створюється детермінованим маршрутом
// (list-detector.js) + AI tool save_list, ловиться guard'ом dropTaskOnList.
//
// Сховище: nm_lists (у реєстрі NM_KEYS.data → clearAllData/Supabase-backup).
// Форма елемента: makeList({title, items}) у entity-factories.js (конверт stampEntity).
// item = {id, text, done}. Рендер чеклісту — спільний renderChecklist (ui/checklist.js).
// ============================================================

// Сховище — дзеркало getTasks/saveTasks. Payload nm-data-changed — РЯДОК 'lists'
// (Ворота 2 структурний payload ще не зроблено, слухачі читають рядок).
export function getLists() {
  try { return JSON.parse(localStorage.getItem('nm_lists') || '[]'); } catch { return []; }
}
export function saveLists(arr) {
  localStorage.setItem('nm_lists', JSON.stringify(arr));
  window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'lists' }));
}
