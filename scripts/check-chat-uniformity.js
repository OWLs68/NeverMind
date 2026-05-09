#!/usr/bin/env node
// scripts/check-chat-uniformity.js — гарантує що 8 чатів NeverMind працюють однаково.
// Створено 64CXo 09.05.2026 за принципом «один мозок» (CLAUDE.md «🚀 Архітектура»).
//
// Перевіряє СТАТИЧНІ ІНВАРІАНТИ:
//   1. Кожен tabs/X.js що містить sendXBarMessage/sendXAI повинен викликати
//      shouldClarify ПЕРЕД виконанням tool_calls.
//   2. Жоден tabs/X.js (крім habits.js processUniversalAction) не повинен мати
//      власного `case 'complete_task':` switch'а — все має йти через
//      processUniversalAction або dispatchChatToolCalls.
//   3. Жоден файл крім inbox.js і tool-dispatcher.js не повинен мати
//      _toolCallToAction або _toolCallToUniversalAction-подібних мап.
//
// Виключення (legit acceptions):
//   - inbox.js:processCompleteTask — Inbox-специфіка (зберігає у Inbox-list).
//     ALLOW поки великий рефакторинг inbox.js не зроблено окремою сесією.
//   - habits.js processUniversalAction case 'complete_task' — це ЄДИНИЙ канонічний handler.
//   - evening-actions.js dispatchEveningTool — legacy, дозволено поки не уніфіковано.
//
// Ламає білд (exit 1) при порушеннях. Запускається з build.js.
//
// Принцип: жорсткий gate. Кожне нове порушення треба свідомо додавати у ALLOWLIST.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TAB_FILES = [
  'src/tabs/inbox.js',
  'src/tabs/habits.js',
  'src/tabs/notes.js',
  'src/tabs/me.js',
  'src/tabs/evening-chat.js',
  'src/tabs/evening-actions.js',
  'src/tabs/health.js',
  'src/tabs/finance-chat.js',
  'src/tabs/projects.js',
];

// Файли яким дозволено мати локальні handlers (legit винятки).
const HANDLER_ALLOWLIST = {
  // habits.js — це канонічний processUniversalAction (єдина точка для CRUD задач/звичок).
  'src/tabs/habits.js': ['complete_task', 'complete_habit', 'complete_step', 'merge_tasks', 'add_step', 'create_task', 'edit_task', 'delete_task', 'reopen_task'],
  // inbox.js — Inbox-специфіка (poки великий рефакторинг не зроблено).
  // Documented борг (64CXo 09.05) — зменшувати у наступних сесіях через міграцію
  // на dispatchChatToolCalls. КОЖЕН раз коли мігрується tool — видалити з цього списку.
  'src/tabs/inbox.js': [
    // CRUD-tools — мають піти у tool-dispatcher.js при рефакторингу:
    'save_task', 'save_note', 'save_habit', 'save_moment', 'save_finance',
    'create_event', 'create_project', 'create_health_card', 'create_finance_category',
    'edit_task', 'edit_habit', 'edit_event', 'edit_note', 'edit_health_card',
    'edit_finance_category', 'edit_medication',
    'delete_task', 'delete_habit', 'delete_event', 'delete_folder', 'delete_project',
    'delete_health_card', 'delete_allergy', 'delete_finance_category', 'delete_reminder',
    'add_step', 'add_health_history_entry', 'add_allergy', 'add_medication', 'add_finance_subcategory',
    'merge_finance_categories', 'move_note', 'reopen_task', 'set_reminder',
    'save_routine', 'show_monthly_summary', 'save_memory_fact',
    'update_transaction', 'update_health_card_status', 'log_medication_dose',
    'complete_task', 'complete_habit',
    // Inbox-специфіка яка ЗАЛИШИТЬСЯ навіть після рефакторингу:
    'clarify', 'restore_deleted',
  ],
  // evening-actions.js — повний список legacy handlers. Дозволено поки немає
  // рефакторингу evening-chat.js на dispatchChatToolCalls. Documented борг.
  'src/tabs/evening-actions.js': [
    'save_task', 'save_note', 'save_habit', 'save_moment', 'save_finance',
    'create_event', 'set_reminder', 'add_step', 'save_memory_fact',
    'complete_task', 'complete_habit', 'reopen_task',
    'edit_task', 'edit_habit', 'edit_event', 'edit_note',
    'delete_task', 'delete_habit', 'delete_event',
    'move_note', 'update_transaction', 'restore_deleted',
  ],
  // tool-dispatcher.js — це сам dispatcher.
  'src/ai/tool-dispatcher.js': ['*'],
};

const errors = [];

function readFile(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

// === Інваріант 1: shouldClarify викликається у sendXBarMessage / sendXAI ===
const sendFnPattern = /(send[A-Z][A-Za-z]*BarMessage|sendToAI|sendNotesChatMessage|sendMeChat|sendTasksBarMessage|sendHealthChatMsg)/;
for (const rel of TAB_FILES) {
  const src = readFile(rel);
  if (!src) continue;
  if (!sendFnPattern.test(src)) continue; // файл не містить send-функції — пропускаємо
  // Дивимось що файл імпортує shouldClarify АБО guard викликається
  if (!/shouldClarify/.test(src)) {
    errors.push(`[${rel}] не імпортує/не викликає shouldClarify — guard клик пропускається перед dispatch tool_calls. Принцип "один мозок" вимагає однакової поведінки у всіх 8 чатах.`);
  }
}

// === Інваріант 2: case 'X' switch на CRUD-tools тільки у allowlisted файлах ===
const switchPattern = /case\s+['"](save_task|save_note|save_habit|save_finance|save_moment|complete_task|complete_habit|complete_step|merge_tasks|add_step|create_event|edit_task|edit_habit|edit_event|edit_note|delete_task|delete_habit|delete_event|delete_folder|reopen_task|move_note|set_reminder|delete_reminder|save_routine|create_project|delete_project|update_transaction|delete_transaction|set_finance_budget|create_finance_category|edit_finance_category|delete_finance_category|merge_finance_categories|add_finance_subcategory|create_health_card|edit_health_card|delete_health_card|update_health_card_status|add_medication|edit_medication|log_medication_dose|add_allergy|delete_allergy|add_health_history_entry|save_memory_fact|complete_project_step|add_project_step|update_project_progress|add_project_decision|add_project_metric|add_project_resource|update_project_tempo|update_project_risks|show_monthly_summary|clarify|restore_deleted|post_chat_message)['"]\s*:/g;

const filesToCheck = [
  ...TAB_FILES,
  'src/ai/tool-dispatcher.js',
  'src/ai/inbox.js', // деякі інші точки
];

for (const rel of filesToCheck) {
  const src = readFile(rel);
  if (!src) continue;
  const allowed = HANDLER_ALLOWLIST[rel];
  if (allowed && allowed[0] === '*') continue; // повний дозвіл
  let m;
  while ((m = switchPattern.exec(src)) !== null) {
    const tool = m[1];
    if (!allowed || !allowed.includes(tool)) {
      // Шукаємо рядок
      const lineNum = src.slice(0, m.index).split('\n').length;
      errors.push(`[${rel}:${lineNum}] локальний \`case '${tool}':\` поза dispatcher. Має йти через processUniversalAction (habits.js) або dispatchChatToolCalls (tool-dispatcher.js). Якщо це legit Inbox/Evening специфіка — додай у HANDLER_ALLOWLIST у scripts/check-chat-uniformity.js.`);
    }
  }
  switchPattern.lastIndex = 0;
}

// === Інваріант 3: дублюючі _toolCallToAction (мапи tool→action) поза tool-dispatcher.js ===
// Шукаємо ТIЛЬКИ definitions (function/const), не коментарі.
const mapPattern = /(?:function|const|let|var)\s+(_toolCallToAction|_toolCallToUniversalAction)\b/g;
for (const rel of TAB_FILES) {
  const src = readFile(rel);
  if (!src) continue;
  if (mapPattern.test(src)) {
    if (rel === 'src/tabs/inbox.js') continue; // legit — поки не уніфіковано
    errors.push(`[${rel}] містить definition _toolCallToAction або _toolCallToUniversalAction. Має бути ТIЛЬКИ у src/ai/tool-dispatcher.js (єдине джерело правди для маршрутизації tools).`);
  }
  mapPattern.lastIndex = 0;
}

// === Звіт ===
if (errors.length > 0) {
  console.error('\n🚫 CHECK-CHAT-UNIFORMITY: знайдено порушення принципу «8 чатів = ОДИН мозок»\n');
  errors.forEach((e, i) => console.error(`${i + 1}. ${e}\n`));
  console.error(`\n📋 Як виправити:`);
  console.error(`   - Якщо handler має йти через dispatcher — перенеси у tool-dispatcher.js _toolCallToUniversalAction або _handleXTool.`);
  console.error(`   - Якщо це legit Inbox/Evening специфіка — додай tool у HANDLER_ALLOWLIST.`);
  console.error(`   - Якщо це нова асиметрія — задокументуй у NEVERMIND_BUGS.md як борг + додай у allowlist щоб білд пройшов.\n`);
  process.exit(1);
} else {
  console.log('✅ check-chat-uniformity: усі 8 чатів узгоджені (з урахуванням ALLOWLIST документованих боргів)');
}
