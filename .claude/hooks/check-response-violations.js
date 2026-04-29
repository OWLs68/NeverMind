#!/usr/bin/env node
// .claude/hooks/check-response-violations.js
//
// Stop hook (запускається коли я закінчив відповідь). Читає запис розмови
// (transcript JSONL), знаходить моє останнє повідомлення, шукає порушення
// правила «пояснення в дужках для всіх англомовних та технічних термінів».
//
// Якщо знайдено — записує список у .claude/last-violations.txt.
// Файл прочитає UserPromptSubmit-хук show-violations.sh при наступному
// повідомленні Романа і покаже мені як системне нагадування.
//
// Створено: 29.04.2026 m4Q1o (друга спроба автоматизації після уроку №1
// з UG1Fr — «декларативне правило без автоматичного контролю розкладається»).
//
// АРХІТЕКТУРА:
//   1. Я відповідаю Роману
//   2. Stop-хук → цей скрипт сканує мою відповідь
//   3. Якщо порушення → запис у .claude/last-violations.txt
//   4. Роман пише наступне повідомлення
//   5. UserPromptSubmit-хук → показує мені список порушень як системне нагадування
//   6. Я починаю відповідь з визнання порушень і пропоную переписати

const fs = require('fs');
const path = require('path');

const VIOLATIONS_FILE = path.resolve(__dirname, '..', 'last-violations.txt');

// === Українські технічні терміни які потребують пояснення в дужках ===
const UKR_TECH_TERMS = [
  'функція', 'функції', 'функцію', 'функцій',
  'параметр', 'параметри', 'параметрів',
  'змінна', 'змінні', 'змінну',
  'метод', 'методи', 'методу',
  'клас', 'класи',
  'масив', 'масиви', 'масиву',
  'обʼєкт', "об'єкт", 'обʼєкти', "об'єкти",
  'деплой', 'деплою',
  'коміт', 'коміти', 'коміту',
  'хук', 'хука', 'хуки',
  'білд', 'білду',
  'бандл', 'бандла', 'бандлу',
  'токен', 'токени', 'токенів',
  'парсер', 'парсинг',
  'регекс', 'регекси',
  'cache', 'cache_name',
];

// Слова які НЕ рахуються як англомовні (вони стали фактично українськими або
// вже всім зрозумілі у контексті проекту):
const ALLOWED_LATIN = new Set([
  // Вкладки/назви проекту
  'OWL', 'NeverMind', 'Roman', 'Claude', 'Gemini', 'AI', 'OpenAI', 'GPT',
  // Стандартні
  'iPhone', 'iOS', 'PWA', 'GitHub', 'Anthropic',
  // Технічно повністю в укр контексті
  'CSS', 'HTML', 'JS', 'JSON',
]);

// Прийнятні розширення файлів
const FILE_EXT_RE = /\.(js|css|html|md|json|sh|jsonl|txt|py|sql)\b/i;

function readLastAssistantText(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return null;
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      // Шукаємо останнє повідомлення асистента з текстовим блоком
      if (entry.type !== 'assistant' || !entry.message) continue;
      const content = entry.message.content;
      if (Array.isArray(content)) {
        // Збираємо ВСІ текстові блоки (може бути кілька між tool_use)
        const texts = content.filter(c => c.type === 'text' && c.text).map(c => c.text);
        if (texts.length > 0) return texts.join('\n');
      } else if (typeof content === 'string' && content.length > 0) {
        return content;
      }
    } catch (e) { continue; }
  }
  return null;
}

function stripCodeBlocks(text) {
  // Видаляємо блоки ```...``` (вони можуть містити приклади коду — не порушення)
  let out = text.replace(/```[\s\S]*?```/g, '');
  return out;
}

// Чи є дужки-пояснення поряд (у наступних 80 символах, у тому ж реченні)
function hasNearbyExplanation(text, posEnd) {
  const window = text.slice(posEnd, posEnd + 80);
  // Шукаємо `(` до того як зустрінемо кінець речення (. ! ? \n)
  for (let i = 0; i < window.length; i++) {
    const c = window[i];
    if (c === '.' || c === '!' || c === '?' || c === '\n') return false;
    if (c === '(' || c === '—') return true;
    // Тире через дефіс ` — ` теж рахується як пояснення
  }
  return false;
}

// Чи знаходиться позиція всередині шляху до файлу (типу src/core/utils.js)
function isInsideFilePath(text, pos) {
  // Дивимось на 30 символів навколо
  const start = Math.max(0, pos - 30);
  const around = text.slice(start, pos + 30);
  return /[\w/.-]+\.(js|css|html|md|json|sh|py)/i.test(around);
}

// Чи знаходиться у inline-коді з backticks `xxx`
function isInsideBackticks(text, pos) {
  // Простий підхід: рахуємо backticks до позиції. Непарна кількість = всередині.
  let count = 0;
  for (let i = 0; i < pos; i++) {
    if (text[i] === '`' && text[i - 1] !== '\\') count++;
  }
  return count % 2 === 1;
}

function findViolations(text) {
  const cleaned = stripCodeBlocks(text);
  const violations = new Map(); // word → { count, sample_pos }

  // === 1. Англомовні слова (Latin 3+ chars) ===
  const latinRe = /\b([A-Za-z][A-Za-z0-9_]{2,})\b/g;
  let match;
  while ((match = latinRe.exec(cleaned)) !== null) {
    const word = match[1];
    const wordStart = match.index;
    const wordEnd = wordStart + word.length;

    if (ALLOWED_LATIN.has(word)) continue;
    // Скіпаємо якщо є dotted lower-case (методи `obj.method`)
    if (cleaned[wordStart - 1] === '.') continue;
    // Скіпаємо файлові розширення
    if (cleaned.slice(wordEnd, wordEnd + 6).match(FILE_EXT_RE)) continue;
    // Скіпаємо у файлових шляхах
    if (isInsideFilePath(cleaned, wordStart)) continue;
    // Скіпаємо URL
    const before30 = cleaned.slice(Math.max(0, wordStart - 30), wordStart);
    if (before30.match(/https?:\/\/[^\s]*$/)) continue;
    // Скіпаємо HEX (preceded by #)
    if (cleaned[wordStart - 1] === '#') continue;
    // Скіпаємо одиниці виміру у HEX/числах (3px, 5em тощо)
    if (cleaned[wordStart - 1] && /[0-9]/.test(cleaned[wordStart - 1])) continue;

    // Перевіряємо чи є пояснення поряд
    if (hasNearbyExplanation(cleaned, wordEnd)) continue;

    // Перевіряємо чи у backticks (це теж порушення, бо backticks ≠ пояснення)
    // Для backticks-слів все одно рахуємо як порушення — Роман прямо сказав
    // що `t(key, fallback)` без пояснення це порушення.

    const wordLower = word.toLowerCase();
    if (!violations.has(wordLower)) {
      violations.set(wordLower, { word, count: 0, type: 'latin' });
    }
    violations.get(wordLower).count++;
  }

  // === 2. Українські технічні терміни ===
  for (const term of UKR_TECH_TERMS) {
    // Збираємо всі форми зі списку у regex (case-insensitive)
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    while ((match = re.exec(cleaned)) !== null) {
      const matched = match[0];
      const wordEnd = match.index + matched.length;
      if (hasNearbyExplanation(cleaned, wordEnd)) continue;
      if (isInsideBackticks(cleaned, match.index)) continue;
      const key = matched.toLowerCase();
      if (!violations.has(key)) {
        violations.set(key, { word: matched, count: 0, type: 'ukr' });
      }
      violations.get(key).count++;
    }
  }

  return violations;
}

// === MAIN ===

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const transcriptPath = data.transcript_path;
    if (!transcriptPath) {
      // Тиха відсутність — можливо викликали без правильного інпуту
      cleanupViolations();
      return;
    }

    const lastText = readLastAssistantText(transcriptPath);
    if (!lastText || lastText.length < 50) {
      // Дуже коротка відповідь — нічого перевіряти
      cleanupViolations();
      return;
    }

    const violations = findViolations(lastText);
    if (violations.size === 0) {
      cleanupViolations();
      return;
    }

    // Сортуємо за частотою + типом, обмежуємо 15 елементами
    const sorted = [...violations.values()].sort((a, b) => b.count - a.count).slice(0, 15);
    const totalCount = [...violations.values()].reduce((acc, v) => acc + v.count, 0);

    const lines = [
      `🚨 ПОРУШЕННЯ ПРАВИЛА у попередній відповіді: ${violations.size} унікальних слів без пояснень у дужках (${totalCount} згадувань):`,
      '',
      sorted.map(v => `   • «${v.word}»${v.count > 1 ? ` ×${v.count}` : ''}`).join('\n'),
      '',
      'Правило з CLAUDE.md: «Після КОЖНОГО англійського слова + КОЖНОГО технічного терміну — пояснення в дужках».',
      '',
      'У наступній відповіді: визнай порушення коротко (1 рядок) і перепиши кожне слово зі списку як `слово (пояснення)`. Не виправдовуйся, не додавай нову інформацію — тільки переписи.',
    ];
    fs.writeFileSync(VIOLATIONS_FILE, lines.join('\n') + '\n');
  } catch (e) {
    // Тиха помилка — не спамити стдер хука
    cleanupViolations();
  }
});

function cleanupViolations() {
  // Видаляємо файл порушень якщо його нема порушень — щоб не показати застарілий
  try { if (fs.existsSync(VIOLATIONS_FILE)) fs.unlinkSync(VIOLATIONS_FILE); } catch {}
}
