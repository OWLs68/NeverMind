// ============================================================
// unread-badge.js — Універсальна червона крапка з лічильником
// непрочитаних повідомлень для будь-якого чат-бару
// ============================================================
// Винесено з inbox.js у сесії QV1n2 (19.04.2026) в рамках Фази 0
// рефакторингу Вечора 2.0.
//
// Використання:
//   import { showUnreadBadge, clearUnreadBadge } from '../ui/unread-badge.js';
//
//   showUnreadBadge('inbox', 'ai-send-btn');         // коли агент пише а чат закритий
//   clearUnreadBadge('inbox');                        // коли юзер відкрив чат
//
// Лічильник тримається у пам'яті (Map), при перезавантаженні скидається.
// Це ок бо червона крапка — миттєвий сигнал "нове з'явилось", а не long-term стан.
// ============================================================

// tab → кількість непрочитаних
const _unreadCounts = new Map();

// tab → id кнопки Надіслати (до якої причеплена крапка)
const _badgeAnchors = new Map();

/**
 * Показати/оновити червону крапку з лічильником на кнопці.
 * Викликається коли агент поклав повідомлення у закритий чат.
 *
 * @param {string} tab — ідентифікатор вкладки (inbox/evening/tasks/habits/notes/finance/health/projects/me)
 * @param {string} sendBtnId — id HTML-елемента кнопки Надіслати у цьому чат-барі
 */
export function showUnreadBadge(tab, sendBtnId) {
  const current = _unreadCounts.get(tab) || 0;
  const next = current + 1;
  _unreadCounts.set(tab, next);
  _badgeAnchors.set(tab, sendBtnId);

  const badgeId = `${tab}-chat-badge`;
  let badge = document.getElementById(badgeId);
  if (!badge) {
    const sendBtn = document.getElementById(sendBtnId);
    if (!sendBtn) return; // ще не відрендерено — нічого страшного
    badge = document.createElement('div');
    badge.id = badgeId;
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:white;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10';
    sendBtn.style.position = 'relative';
    sendBtn.appendChild(badge);
  }
  badge.textContent = next > 9 ? '9+' : next;
}

/**
 * Прибрати червону крапку (коли юзер відкрив чат і побачив повідомлення).
 *
 * @param {string} tab — ідентифікатор вкладки
 */
export function clearUnreadBadge(tab) {
  _unreadCounts.set(tab, 0);
  const badge = document.getElementById(`${tab}-chat-badge`);
  if (badge) badge.remove();
}

/**
 * Отримати поточну кількість непрочитаних для вкладки (наприклад для logger/debug).
 */
export function getUnreadCount(tab) {
  return _unreadCounts.get(tab) || 0;
}
