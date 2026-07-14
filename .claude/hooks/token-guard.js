#!/usr/bin/env node
// .claude/hooks/token-guard.js — per-task токен-запобіжник (Роман 14.07.2026).
//
// Окремий механізм від бюджет-гейту /fullaudit: той рахує КУМУЛЯТИВНО по всіх
// агентах у Workflow. Цей ловить ОДИН Agent/Task-виклик що розрісся понад поріг
// за раз (агент що вийшов з-під контролю), не серію дрібних.
//
// Робота (реєструється на ДВІ події у settings.json):
//   PostToolUse на Agent/Task → читає tool_response.usage.input_tokens+output_tokens;
//     якщо сума > THRESHOLD → пише прапорець-файл на сесію (.token-guard-tripped).
//   PreToolUse на будь-що → якщо прапорець є → deny (exit 2), уся подальша робота
//     зупинена, поки Роман не прибере файл. Виняток: Bash-команда що ВИДАЛЯЄ сам
//     прапорець пропускається (щоб «прибери токен-запобіжник» / rm працювали).
//
// Fail-open: будь-яка помилка самого хука → exit 0 (НЕ ламає сесію). Єдиний
// свідомий блок — exit 2 при наявному прапорці.

const fs = require('fs');
const path = require('path');

const THRESHOLD = 350000;
const FLAG = path.join(__dirname, '.token-guard-tripped');

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(input || '{}');
    const event = d.hook_event_name || '';

    // === PreToolUse: перед кожним інструментом — перевірка прапорця ===
    if (event === 'PreToolUse') {
      if (!fs.existsSync(FLAG)) process.exit(0);
      // Виняток: дозволити команду що прибирає САМ прапорець (розблокування Романом).
      const cmd = (d.tool_input && d.tool_input.command) || '';
      if (d.tool_name === 'Bash' && cmd.includes('.token-guard-tripped')) process.exit(0);
      let info = '';
      try { info = fs.readFileSync(FLAG, 'utf8'); } catch (e) {}
      console.error('\n=== 🛑 ТОКЕН-ЗАПОБІЖНИК СПРАЦЮВАВ ===\n');
      console.error(info || ('Один агент-виклик перевищив ' + THRESHOLD + ' токенів.'));
      console.error('\nУся подальша робота ЗУПИНЕНА до підтвердження Романа.');
      console.error('Продовжити: прибрати файл  ' + FLAG);
      console.error('  (у терміналі `rm` цього файлу, або скажи Клоду «прибери токен-запобіжник»).');
      console.error('\n=== Стоп до підтвердження. ===\n');
      process.exit(2);
    }

    // === PostToolUse на Agent/Task: замір витрати одного виклику ===
    if (event === 'PostToolUse') {
      const tool = d.tool_name || '';
      if (tool !== 'Task' && tool !== 'Agent') process.exit(0);
      const u = (d.tool_response && d.tool_response.usage) || {};
      const total = (u.input_tokens || 0) + (u.output_tokens || 0);
      if (total > THRESHOLD) {
        const msg = '🛑 Токен-запобіжник: агент-виклик (' + tool + ') спалив ' + total +
          ' токенів за раз (поріг ' + THRESHOLD + '). Подальша робота сесії зупинена.';
        try { fs.writeFileSync(FLAG, msg + '\n'); } catch (e) {}
      }
      process.exit(0);
    }

    process.exit(0);
  } catch (e) {
    process.exit(0); // fail-open — хук ніколи не ламає сесію
  }
});
