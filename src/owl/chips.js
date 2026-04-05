import { openChatBar } from '../ai/core.js';
import { sendToAI } from '../tabs/inbox.js';
import { sendTasksBarMessage } from '../tabs/habits.js';
import { sendNotesBarMessage } from '../tabs/notes.js';
import { sendFinanceBarMessage } from '../tabs/finance.js';
import { sendEveningBarMessage, sendMeChatMessage } from '../tabs/evening.js';
import { sendHealthBarMessage } from '../tabs/health.js';
import { sendProjectsBarMessage } from '../tabs/projects.js';

// Chip (кнопка табло) → відкрити чат-бар і відправити текст як повідомлення
export function owlChipToChat(tab, text) {
  const barTab = tab === 'inbox' ? 'inbox' : (tab || 'inbox');
  openChatBar(barTab);
  const inputId = barTab === 'inbox' ? 'inbox-input' : barTab + '-chat-input';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }
  setTimeout(() => {
    if (barTab === 'inbox') { sendToAI(); }
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
