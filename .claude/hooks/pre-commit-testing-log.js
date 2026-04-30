#!/usr/bin/env node
// .claude/hooks/pre-commit-testing-log.js
//
// PreToolUse hook на Bash: блокує `git commit` з `feat:` що чіпає src/ |
// index.html | style.css, якщо TESTING_LOG.md НЕ серед staged файлів того
// самого коміту.
//
// Закон, не нагадування. Раніше `lesson-reminder.sh` тільки кричав —
// Claude забував і пушив фічу без запису. xHQfi 30.04: 4 feat: коміти у
// src/ → 1 рядок у TESTING_LOG (доданий вручну, не через хук). Тест-борг
// росте швидше ніж клацання → 12 сесій без iPhone-перевірки.
//
// Bypass: фраза `testing-log: ok` у останніх 5 повідомленнях асистента
// (для інфраструктурних feat: типу нового хука без UI-впливу).
//
// Створено: 30.04.2026 d6Fgh за прямим запитом Романа («Ти ігноруєш правила»).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const N_RECENT_MESSAGES = 5;
const BYPASS_PHRASE = /testing[\s-]?log:\s*ok/i;
const CODE_FILE_REGEX = /^(src\/.+\.(js|css|html)|index\.html|style\.css)$/;

function readRecentAssistantTexts(transcriptPath, n) {
  if (!fs.existsSync(transcriptPath)) return '';
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const texts = [];
  for (let i = lines.length - 1; i >= 0 && texts.length < n; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== 'assistant' || !entry.message) continue;
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

function extractCommitMessage(command) {
  // -m "повідомлення" або -m 'повідомлення' або heredoc
  const mDouble = command.match(/-m\s+"([^"]+)"/);
  if (mDouble) return mDouble[1];
  const mSingle = command.match(/-m\s+'([^']+)'/);
  if (mSingle) return mSingle[1];
  // heredoc: cat <<'EOF'\n...\nEOF
  const heredoc = command.match(/<<'?(\w+)'?\s*\n([\s\S]+?)\n\1/);
  if (heredoc) return heredoc[2];
  return '';
}

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

    const msg = extractCommitMessage(command);
    if (!/^feat[(:]/m.test(msg)) process.exit(0);

    const repoRoot = path.join(__dirname, '..', '..');
    let stagedOutput = '';
    try {
      stagedOutput = execSync(`git -C "${repoRoot}" diff --cached --name-only`, {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
      });
    } catch {
      process.exit(0);
    }
    const staged = stagedOutput.split('\n').filter(Boolean);
    const codeFiles = staged.filter(f => CODE_FILE_REGEX.test(f));
    if (codeFiles.length === 0) process.exit(0);

    const hasTestingLog = staged.some(f => f === 'TESTING_LOG.md');
    if (hasTestingLog) process.exit(0);

    const transcriptPath = data.transcript_path;
    if (transcriptPath) {
      const haystack = readRecentAssistantTexts(transcriptPath, N_RECENT_MESSAGES);
      if (BYPASS_PHRASE.test(haystack)) process.exit(0);
    }

    const filesPreview = codeFiles.slice(0, 3).join(', ') +
      (codeFiles.length > 3 ? ` ... (+${codeFiles.length - 3})` : '');

    console.error('\n=== ⚠️ КОМІТ ЗАБЛОКОВАНО (.claude/hooks/pre-commit-testing-log.js) ===\n');
    console.error(
      `🧪 ПРАВИЛО 6 CLAUDE.md (UI smoke-test): feat: коміт чіпає ${codeFiles.length} файлів коду ` +
      `(${filesPreview}) — а TESTING_LOG.md НЕ у staged. Без запису сценарію перевірки на iPhone ` +
      `фіча забудеться через 1-2 сесії (паттерн квітня: 12 сесій без перевірки).\n\n` +
      `ДІЯ: відкрий TESTING_LOG.md, додай у секцію «⏳ Чекає тесту» рядок:\n` +
      `   - Який сценарій юзер має перевірити рукою на iPhone (тап / свайп / введення / перехід)\n` +
      `   - Що має бути правильно (успіх) і що зламано (невдача)\n` +
      `   - Версію (CACHE_NAME або deploy log) + дату\n` +
      `Потім: git add TESTING_LOG.md і повтори commit.\n\n` +
      `BYPASS (тільки для інфраструктурних feat: без UI-впливу — нові хуки, скрипти, конфіги): ` +
      `додай фразу «testing-log: ok» у відповідь і повтори commit.`
    );
    console.error('\n=== Виправ і повтори commit. ===\n');
    process.exit(2);
  } catch {
    process.exit(0);
  }
});
