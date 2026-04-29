#!/usr/bin/env node
// .claude/hooks/check-estimate-without-read.js
//
// Stop hook (запускається коли я закінчив відповідь).
// Сканує моє останнє повідомлення на маркери оцінки часу
// («N годин», «займе X хв» тощо) і перевіряє чи у останніх 5 turn'ах
// я викликав інструменти читання коду (Read / Grep / Bash з wc/grep/find).
//
// Якщо оцінка є БЕЗ попереднього читання коду — записує warning у
// .claude/last-estimate-warnings.txt. Файл показує show-violations.sh
// при наступному повідомленні Романа.
//
// Створено: 29.04.2026 SK6E2 (третя автоматизація після уроку
// «оцінка часу без читання коду» — об'єднує заниження xGe1H та
// завищення m4Q1o, корінь — «не читаю код перед оцінкою»).

const fs = require('fs');
const path = require('path');

const WARNINGS_FILE = path.resolve(__dirname, '..', 'last-estimate-warnings.txt');

// Маркери оцінки часу у моїй відповіді
const ESTIMATE_PATTERNS = [
  /\b\d+\s*(годин[ауи]?|год\.?|hr)\b/i,
  /\b\d+\s*(хвилин[ауи]?|хв\.?|min)\b/i,
  /\b\d+\s*[-–]\s*\d+\s*(годин[ауи]?|год\.?|хв\.?|хвилин[ауи]?)/i,
  /\b(займе|буде|потребує|орієнтовно|приблизно|десь)\s+~?\s*\d+/i,
  /~\s*\d+\s*(год|хв)/i,
];

// Bypass-фрази: я явно визнав що оцінка з пам'яті або попросив прочитати
const ESTIMATE_BYPASS = [
  /оцінк[аиу]\s+з\s+(памʼяті|пам'яті|повітря)/i,
  /без\s+читання\s+коду/i,
  /треба\s+прочитати\s+код/i,
  /я\s+(щойно\s+)?(читав|прочитав)\s+(код|файл)/i,
  /код\s+я\s+(вже\s+)?(читав|прочитав)/i,
  /з\s+читанн[ям]\s+коду/i,
  /після\s+читання\s+файл/i,
  /estimate:\s*ok/i,
];

// Інструменти що рахуються як «читав код»
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const READ_BASH_PATTERNS = [
  /\bwc\s+-l/,
  /\bgrep\b/,
  /\bfind\s+/,
  /\bcat\s+/,
  /\bhead\s+/,
  /\btail\s+/,
  /\bls\s+/,
  /\bsed\b/,
  /\bawk\b/,
];

// === Утиліти читання transcript JSONL ===

function readLastAssistantTurn(transcriptPath) {
  // Повертає content array (текст + tool_use blocks) останнього assistant entry.
  if (!fs.existsSync(transcriptPath)) return null;
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== 'assistant' || !entry.message) continue;
      const content = entry.message.content;
      if (Array.isArray(content)) return content;
      if (typeof content === 'string') return [{ type: 'text', text: content }];
    } catch {}
  }
  return null;
}

function readRecentToolUses(transcriptPath, n = 5) {
  // Збирає tool_use блоки з останніх n assistant turn'ів.
  if (!fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  const tools = [];
  let turns = 0;
  for (let i = lines.length - 1; i >= 0 && turns < n; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== 'assistant' || !entry.message) continue;
      turns++;
      const content = entry.message.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === 'tool_use') tools.push(c);
        }
      }
    } catch {}
  }
  return tools;
}

function hasRecentCodeReading(tools) {
  return tools.some(t => {
    if (READ_TOOLS.has(t.name)) return true;
    if (t.name === 'Bash' && t.input && typeof t.input.command === 'string') {
      return READ_BASH_PATTERNS.some(re => re.test(t.input.command));
    }
    return false;
  });
}

function findEstimateMatches(text) {
  // Витягуємо всі унікальні фрази-оцінки (до 3 прикладів).
  const matches = [];
  for (const re of ESTIMATE_PATTERNS) {
    const reGlobal = new RegExp(re.source, re.flags + (re.flags.includes('g') ? '' : 'g'));
    let m;
    while ((m = reGlobal.exec(text)) !== null) {
      const phrase = m[0].trim();
      if (!matches.includes(phrase)) matches.push(phrase);
      if (matches.length >= 3) return matches;
    }
  }
  return matches;
}

function cleanupWarnings() {
  try { if (fs.existsSync(WARNINGS_FILE)) fs.unlinkSync(WARNINGS_FILE); } catch {}
}

// === MAIN ===

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const transcriptPath = data.transcript_path;
    if (!transcriptPath) { cleanupWarnings(); return; }

    const lastTurn = readLastAssistantTurn(transcriptPath);
    if (!lastTurn) { cleanupWarnings(); return; }

    // Збираємо весь текст з останнього turn'а
    const lastText = lastTurn.filter(c => c.type === 'text' && c.text).map(c => c.text).join('\n');
    if (!lastText || lastText.length < 30) { cleanupWarnings(); return; }

    // Bypass: я явно визнав «оцінка з памʼяті» / «треба прочитати код»
    if (ESTIMATE_BYPASS.some(re => re.test(lastText))) { cleanupWarnings(); return; }

    const matches = findEstimateMatches(lastText);
    if (matches.length === 0) { cleanupWarnings(); return; }

    // Чи був Read / Grep / Bash-читання у останніх 5 turn'ах?
    const recentTools = readRecentToolUses(transcriptPath, 5);
    if (hasRecentCodeReading(recentTools)) { cleanupWarnings(); return; }

    // Знайшли оцінку без читання — записуємо warning
    const lines = [
      `🧠 ОЦІНКА ЧАСУ БЕЗ ЧИТАННЯ КОДУ у попередній відповіді: знайдено оцінк${matches.length > 1 ? 'и' : 'у'} часу але за останні 5 turn'ів не було Read / Grep / Bash з wc/grep/find:`,
      '',
      matches.map(m => `   • «${m}»`).join('\n'),
      '',
      'Анти-патерн з lessons.md (oknnM 29.04): «оцінка часу без читання коду» — летить ×3 в обидва боки (заниження xGe1H, завищення m4Q1o).',
      '',
      'У наступній відповіді: визнай що дав оцінку з памʼяті, виконай wc -l + Grep call-sites + швидкий перегляд складності, і дай чесне число. Якщо оцінка вже базується на читанні коду яке не виявив хук — додай у відповідь фразу «estimate: ok».',
    ];
    fs.writeFileSync(WARNINGS_FILE, lines.join('\n') + '\n');
  } catch {
    cleanupWarnings();
  }
});
