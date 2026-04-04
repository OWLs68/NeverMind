// Chip (кнопка табло) → відкрити чат-бар і відправити текст як повідомлення
function owlChipToChat(tab, text) {
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
    if (barTab === 'inbox') { if (typeof sendToAI === 'function') sendToAI(); }
    else if (barTab === 'tasks') { if (typeof sendTasksBarMessage === 'function') sendTasksBarMessage(); }
    else if (barTab === 'notes') { if (typeof sendNotesBarMessage === 'function') sendNotesBarMessage(); }
    else if (barTab === 'finance') { if (typeof sendFinanceBarMessage === 'function') sendFinanceBarMessage(); }
    else if (barTab === 'health') { if (typeof sendHealthBarMessage === 'function') sendHealthBarMessage(); }
    else if (barTab === 'projects') { if (typeof sendProjectsBarMessage === 'function') sendProjectsBarMessage(); }
    else if (barTab === 'me') { if (typeof sendMeChatMessage === 'function') sendMeChatMessage(); }
    else if (barTab === 'evening') { if (typeof sendEveningBarMessage === 'function') sendEveningBarMessage(); }
  }, 100);
}

// === WINDOW GLOBALS (перехідний період) ===
Object.assign(window, { owlChipToChat });
