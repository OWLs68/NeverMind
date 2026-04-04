import { updateChatWindowHeight } from '../core/utils.js';
import { _getTabChatAHeight, _getTabChatBHeight, _tabChatState } from '../owl/inbox-board.js';
import { getTabbarHeight } from '../tabs/inbox.js';

export function setupKeyboardAvoiding() {
  if (!window.visualViewport) return;

  const update = () => {
    const vv = window.visualViewport;
    // Правильний розрахунок для iOS: враховуємо offsetTop (скільки зверху зрізано)
    // Не включаємо vv.offsetTop — він збільшується при скролі сторінки
    // і тоді keyboardHeight хибно стає <250, таббар не ховається
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
    const aiBar = document.getElementById('inbox-ai-bar');
    const tabBar = document.getElementById('tab-bar');
    const tbH = tabBar ? tabBar.offsetHeight : 83;
    const newBars = ['tasks-ai-bar','notes-ai-bar','me-ai-bar','evening-ai-bar','finance-ai-bar','health-ai-bar','projects-ai-bar'].map(id => document.getElementById(id));

    if (keyboardHeight > 250) { // реальна клавіатура > 250px; менше — це просто Safari ховає свій тулбар під час свайпу
      // Клавіатура відкрита — ховаємо таббар вниз, піднімаємо бар вгору
      if (aiBar) { aiBar.style.bottom = (keyboardHeight + 8) + 'px'; aiBar.style.left = '12px'; aiBar.style.right = '12px'; }
      // Обмежуємо висоту inbox чату щоб не виходив за видиму зону
      // Логіка: chatH = vv.height - barBottom - inputH - safeAreaTop
      const inboxCw = document.getElementById('inbox-chat-window');
      if (inboxCw && inboxCw.classList.contains('open')) {
        // Клавіатура відкрита — стискаємо до A-висоти
        if (typeof _tabChatState !== 'undefined' && _tabChatState['inbox'] === 'b') {
          _tabChatState['inbox'] = 'a';
        }
        const chatH = typeof _getTabChatAHeight === 'function'
          ? _getTabChatAHeight('inbox')
          : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
        inboxCw.style.height = chatH + 'px';
        inboxCw.style.maxHeight = chatH + 'px';
        const inboxMsgs = document.getElementById('inbox-chat-messages');
        if (inboxMsgs) {
          inboxMsgs.style.maxHeight = Math.max(30, chatH - 20) + 'px';
          setTimeout(() => { inboxMsgs.scrollTop = inboxMsgs.scrollHeight; }, 50);
        }
      }
      // Ховаємо таббар — translateY достатньо великий щоб він пішов за екран
      if (tabBar) { tabBar.style.transform = `translateY(${tbH + keyboardHeight}px)`; tabBar.style.opacity = '0'; tabBar.style.pointerEvents = 'none'; }
      newBars.forEach(b => {
        if (!b || b.style.display === 'none') return;
        b.style.bottom = (keyboardHeight + 8) + 'px';
        // Обмежуємо висоту чат-вікна щоб handle лишався видимим
        // chatH = vv.height - barBottom - inputH - safeAreaTop
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin && chatWin.classList.contains('open')) {
          const tab = b.id.replace('-ai-bar', '');
          const state = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})[tab];
          if (state === 'b') {
            // Клавіатура з'явилась поки стан B → авто-колапс до A
            if (typeof _tabChatState !== 'undefined') _tabChatState[tab] = 'a';
            const aH = typeof _getTabChatAHeight === 'function'
              ? _getTabChatAHeight(tab)
              : Math.max(150, vv.height - (keyboardHeight + 8) - 64 - 60);
            chatWin.style.transition = 'height 0.3s cubic-bezier(0.32,0.72,0,1)';
            chatWin.style.height = aH + 'px';
            chatWin.style.maxHeight = aH + 'px';
            setTimeout(() => chatWin.style.transition = '', 300);
          } else {
            const chatH = typeof _getTabChatAHeight === 'function'
              ? _getTabChatAHeight(tab)
              : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
            chatWin.style.height = chatH + 'px';
            chatWin.style.maxHeight = chatH + 'px';
          }
        }
      });
    } else {
      // Клавіатура закрита — повертаємо все на місце
      if (aiBar) { const h = getTabbarHeight(); aiBar.style.bottom = (h + 4) + 'px'; aiBar.style.left = '4px'; aiBar.style.right = '4px'; }
      // Відновлюємо висоту inbox чату після закриття клавіатури
      const inboxCw = document.getElementById('inbox-chat-window');
      if (inboxCw && inboxCw.classList.contains('open')) {
        try {
          const inboxState = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})['inbox'];
          const calcH = inboxState === 'b' && typeof _getTabChatBHeight === 'function'
            ? _getTabChatBHeight('inbox')
            : (typeof _getTabChatAHeight === 'function' ? _getTabChatAHeight('inbox') : null);
          if (calcH) { inboxCw.style.height = calcH + 'px'; inboxCw.style.maxHeight = calcH + 'px'; }
          else { inboxCw.style.height = ''; inboxCw.style.maxHeight = ''; }
        } catch(e) { inboxCw.style.height = ''; inboxCw.style.maxHeight = ''; }
        const inboxMsgs = document.getElementById('inbox-chat-messages');
        if (inboxMsgs) inboxMsgs.style.maxHeight = '';
      }
      if (tabBar) { tabBar.style.transform = 'translateY(0)'; tabBar.style.opacity = ''; tabBar.style.pointerEvents = ''; }
      newBars.forEach(b => {
        if (!b) return;
        b.style.bottom = (tbH + 4) + 'px';
        const chatWin = b.querySelector('.ai-bar-chat-window');
        if (chatWin && chatWin.classList.contains('open')) {
          const tab = b.id.replace('-ai-bar', '');
          const state = (typeof _tabChatState !== 'undefined' ? _tabChatState : {})[tab];
          if (state === 'b') {
            // Стан B: перераховуємо до повної висоти без клавіатури
            try {
              const bH = typeof _getTabChatBHeight === 'function'
                ? _getTabChatBHeight(tab)
                : null;
              if (bH) {
                chatWin.style.height = bH + 'px';
                chatWin.style.maxHeight = bH + 'px';
              } else { updateChatWindowHeight(tab); }
            } catch(e) {}
          } else if (state === 'a') {
            // Стан A: compact висота без клавіатури (обмежена)
            try {
              const aH = typeof _getTabChatAHeight === 'function'
                ? _getTabChatAHeight(tab)
                : null;
              if (aH) {
                chatWin.style.height = aH + 'px';
                chatWin.style.maxHeight = aH + 'px';
              } else { updateChatWindowHeight(tab); }
            } catch(e) {}
          }
        } else if (chatWin) {
          chatWin.style.height = '';
          chatWin.style.maxHeight = '';
        }
      });
    }
  };

  // iOS іноді надсилає scroll замість resize — слухаємо обидва
  window.visualViewport.addEventListener('resize', update);
  window.visualViewport.addEventListener('scroll', update);

  // Фікс після повернення з фону / розблокування — viewport нестабільний ~600ms
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // Очищуємо stuck-стани від незавершених gesture (touchcancel міг не спрацювати)
    document.querySelectorAll('.ai-bar-chat-window').forEach(cw => {
      // Скидаємо лише transform/opacity, НЕ height (може бути expanded-стан)
      if (cw.style.transform && cw.style.transform !== 'translateY(0)' && cw.style.transform !== '') {
        cw.style.transition = '';
        cw.style.transform = '';
        cw.style.opacity = '';
      }
    });
    // iOS viewport стабілізується поступово — запускаємо update кілька разів
    setTimeout(update, 80);
    setTimeout(update, 350);
    setTimeout(update, 750);
  });

  // Фікс повторного фокусу: iOS не генерує новий resize якщо viewport вже встановлений
  // Викликаємо update() вручну при кожному фокусі на поле вводу
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 120);
      setTimeout(update, 400); // другий раз — iOS іноді повільніше показує клавіатуру
    }
  }, { passive: true });

  // При закритті клавіатури через кнопку Готово — iOS не завжди надсилає resize
  document.addEventListener('focusout', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      setTimeout(update, 150);
    }
  }, { passive: true });
}

