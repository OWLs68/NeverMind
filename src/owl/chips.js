import { switchTab, showToast } from '../core/nav.js';
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
  const lower = text.toLowerCase();

  // Чіпи-навігація: переводять на потрібну вкладку замість відправки в AI
  const navMap = [
    { patterns: ['задач', 'закрити задач', 'завершити задач'], tab: 'tasks' },
    { patterns: ['звичк', 'виконати звичк', 'відмітити звичк'], tab: 'tasks' },
    { patterns: ['підсумк', 'підсумок дня', 'записати підсумк'], tab: 'evening' },
    { patterns: ['нотатк', 'записати нотатк'], tab: 'notes' },
    { patterns: ['фінанс', 'витрат', 'бюджет'], tab: 'finance' },
    { patterns: ['здоров', 'самопочутт'], tab: 'health' },
    { patterns: ['проект'], tab: 'projects' },
  ];

  for (const nav of navMap) {
    if (nav.patterns.some(p => lower.includes(p))) {
      switchTab(nav.tab);
      showToast('Переходжу до вкладки');
      return;
    }
  }

  // Решта чіпів — відправляємо як повідомлення в чат-бар
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
