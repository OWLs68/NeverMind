#!/usr/bin/env node
// .claude/hooks/byyou-push-lock.js
//
// PreToolUse hook (Bash) — ЗАМОК НА PUSH у режимі /byyou.
//
// Контекст: кожен push у гілку claude/** деплоїться у ЖИВИЙ застосунок одразу
// (auto-merge.yml → GitHub Pages). У напівавтономному режимі /byyou Claude
// робить багато локальних комітів сам — і найбільший ризик (підтвердили
// Council + Gemini + GPT раунд 2) це ВИПАДКОВИЙ прод-деплой: Claude розігнався
// і пушнув «між кроками».
//
// Рішення (детерміноване, не дисципліна): поки активний потік /byyou —
// `git push` ЗАБЛОКОВАНО, доки Роман не скаже релізне слово «деплой» у
// своєму повідомленні. Хук читає USER-повідомлення з транскрипту (це слова
// Романа — Claude їх підробити не може), а не файл-токен який Claude міг би
// створити сам.
//
// Логіка активації:
//   • тільки на `git push`
//   • тільки якщо _ai-tools/BYYOU_PLAN.md існує і має статус active
//   • дивимось ОСТАННІ 2 user-повідомлення на слово «деплой» (свіже рішення,
//     не стале згадування з обговорення)
//   • є «деплой» → пропускаємо; немає → блокуємо (exit 2)
//
// Поза режимом /byyou (немає активного плану) хук дрімає — звичайні push
// працюють як завжди.
//
// Створено: 20.06.2026 (сесія gfrvu5) разом зі скілом /byyou.

const fs = require('fs');
const path = require('path');

const PLAN_PATH = path.join(__dirname, '..', '..', '_ai-tools', 'BYYOU_PLAN.md');
const RELEASE_WORD = /\bдеплой\b/i;       // релізне слово (обрав Роман)
const N_RECENT_USER_MESSAGES = 2;          // тільки свіже рішення Романа

// Чи активний потік /byyou? Файл існує + статус active (не idle/done/archived).
function isByyouActive() {
  try {
    if (!fs.existsSync(PLAN_PATH)) return false;
    const content = fs.readFileSync(PLAN_PATH, 'utf8');
    // Маркер статусу у шаблоні: «**Статус:** active» (або 🟢 active).
    return /\*\*Статус:\*\*\s*(🟢\s*)?active\b/i.test(content);
  } catch {
    return false;
  }
}

// Останні N user-повідомлень з транскрипту (це слова Романа).
function readRecentUserTexts(transcriptPath, n) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const texts = [];
  for (let i = lines.length - 1; i >= 0 && texts.length < n; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== 'user' || !entry.message) continue;
      const c = entry.message.content;
      if (Array.isArray(c)) {
        const t = c.filter(b => b.type === 'text' && b.text).map(b => b.text).join('\n');
        if (t) texts.push(t);
      } else if (typeof c === 'string' && c.length > 0) {
        texts.push(c);
      }
    } catch {}
  }
  return texts.join('\n');
}

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    // Активуємось лише на git push
    if (!/\bgit\s+push\b/.test(command)) process.exit(0);

    // Поза режимом /byyou — не заважаємо
    if (!isByyouActive()) process.exit(0);

    const userText = readRecentUserTexts(data.transcript_path, N_RECENT_USER_MESSAGES);
    if (RELEASE_WORD.test(userText)) process.exit(0); // Роман дозволив реліз

    console.error('\n=== 🔒 BYYOU PUSH-ЗАМОК (.claude/hooks/byyou-push-lock.js) ===\n');
    console.error(
      'Активний потік /byyou (BYYOU_PLAN.md = active). Push = живий деплой у застосунок Романа.\n' +
      'Між брамами push ЗАБЛОКОВАНО — це захист від випадкового прод-деплою.\n\n' +
      'Щоб задеплоїти: покажи Роману реліз-нотатки (ЩО ЗМІНИЛОСЬ / ЩО МОЖЕ ЗЛАМАТИСЬ / ' +
      'ЩО ПЕРЕВІРИТИ НА IPHONE) і чекай поки він скаже «деплой». Тоді повтори push.\n'
    );
    process.exit(2);
  } catch {
    // Не блокуємо push при власній помилці хука
    process.exit(0);
  }
});
