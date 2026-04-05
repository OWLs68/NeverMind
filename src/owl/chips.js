import { switchTab, showToast } from '../core/nav.js';
import { openChatBar } from '../ai/core.js';
import { sendToAI } from '../tabs/inbox.js';
import { sendTasksBarMessage } from '../tabs/habits.js';
import { sendNotesBarMessage } from '../tabs/notes.js';
import { sendFinanceBarMessage } from '../tabs/finance.js';
import { sendEveningBarMessage, sendMeChatMessage } from '../tabs/evening.js';
import { sendHealthBarMessage } from '../tabs/health.js';
import { sendProjectsBarMessage } from '../tabs/projects.js';

const VALID_NAV_TARGETS = ['tasks','notes','habits','finance','health','projects','evening','me','inbox'];

// Chip (кнопка табло) → або перекинути на вкладку (action=nav), або відправити в чат (action=chat)
// action/target приходять з об'єкта чіпа (новий формат). Старі string-чіпи = chat.
export function owlChipToChat(tab, text, action, target) {
  if (action === 'nav' && VALID_NAV_TARGETS.includes(target)) {
    switchTab(target);
    showToast('Переходжу до вкладки');
    return;
  }
  const barTab = tab === 'inbox' ? 'inbox' : (tab || 'inbox');
  openChatBar(barTab);
  const inputId = barTab === 'inbox' ? 'inbox-input' : barTab + '-chat-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }
  setTimeout(() => {
    if (barTab === 'inbox') { sendToAI(true); } // fromChip=true — не створювати нові записи в Inbox
    else if (barTab === 'tasks') { sendTasksBarMessage(); }
    else if (barTab === 'notes') { sendNotesBarMessage(); }
    else if (barTab === 'finance') { sendFinanceBarMessage(); }
    else if (barTab === 'health') { sendHealthBarMessage(); }
    else if (barTab === 'projects') { sendProjectsBarMessage(); }
    else if (barTab === 'me') { sendMeChatMessage(); }
    else if (barTab === 'evening') { sendEveningBarMessage(); }
  }, 100);
}

// === WINDOW GLOBALS (HTML handlers only) ===
window.owlChipToChat = owlChipToChat;
