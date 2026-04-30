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
const { execSync } = require('child_process');

const VIOLATIONS_FILE = path.resolve(__dirname, '..', 'last-violations.txt');
// Append-only журнал для треку прогресу між сесіями. Кожен рядок:
// ISO-timestamp [sessionId] N unique / M total: word1×K, word2, ...
const VIOLATIONS_LOG_FILE = path.resolve(__dirname, '..', 'violations-log.txt');
// Anti-loop: якщо 3+ блоки підряд за 30 хв — не блокуємо (шанс що regex дурить).
const BLOCK_COUNTER_FILE = path.resolve(__dirname, '..', 'block-counter.json');
const ANTI_LOOP_WINDOW_MS = 30 * 60 * 1000;
const ANTI_LOOP_MAX = 3;

function readBlockCounter() {
  try {
    if (!fs.existsSync(BLOCK_COUNTER_FILE)) return { count: 0, lastTs: 0 };
    const data = JSON.parse(fs.readFileSync(BLOCK_COUNTER_FILE, 'utf8'));
    if (Date.now() - (data.lastTs || 0) > ANTI_LOOP_WINDOW_MS) return { count: 0, lastTs: 0 };
    return data;
  } catch { return { count: 0, lastTs: 0 }; }
}
function writeBlockCounter(data) {
  try { fs.writeFileSync(BLOCK_COUNTER_FILE, JSON.stringify(data)); } catch {}
}
function resetBlockCounter() {
  try { if (fs.existsSync(BLOCK_COUNTER_FILE)) fs.unlinkSync(BLOCK_COUNTER_FILE); } catch {}
}

function getSessionId() {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = branch.match(/claude\/start-session-([A-Za-z0-9]+)/);
    return m ? m[1] : (branch || 'unknown');
  } catch (e) {
    return 'unknown';
  }
}

// === Українські технічні терміни які потребують пояснення в дужках ===
// Порожній список після переформулювання правила 29.04.2026 (7PQ1a). Українські
// терміни типу «функція», «коміт», «деплой» — Роман давно у словнику. Лишаємо
// масив для майбутніх рідкісних додавань (наприклад нові концепції UVKL1).
const UKR_TECH_TERMS = [
  // Залишено порожнім — додавати тільки реально незнайомі терміни.
];

// === Whitelist: загальні слова + назви проекту що НЕ потребують пояснення ===
// Оновлено 29.04.2026 (7PQ1a) — розширено з 14 до 100+ слів після уроку
// «хук флагав push/pull/merge/today/before». Усі ці слова Роман знає щодня.
const ALLOWED_LATIN = new Set([
  // === Назви проекту/інструментів ===
  'OWL', 'NeverMind', 'Roman', 'Claude', 'Code', 'Gemini', 'AI', 'OpenAI', 'GPT',
  'iPhone', 'iOS', 'PWA', 'GitHub', 'Git', 'git', 'Anthropic', 'Inbox',
  // === Усталені абревіатури ===
  'CSS', 'HTML', 'JS', 'JSON', 'API', 'URL', 'URI', 'ID', 'UI', 'UX', 'DB',
  'CI', 'CD', 'IDE', 'CLI', 'SDK', 'PDF', 'SVG', 'PNG', 'JPG', 'GIF', 'JPEG',
  'HTTP', 'HTTPS', 'SSL', 'TLS', 'TCP', 'IP', 'DNS', 'SQL', 'NoSQL', 'XML', 'YAML',
  'JWT', 'OAuth', 'CORS', 'XSS', 'CSRF', 'GDPR', 'WCAG', 'A11y', 'i18n',
  'MVP', 'PMF', 'KPI', 'ROI', 'SaaS', 'B2B', 'B2C', 'NPS',
  // === Git-команди і терміни ===
  'push', 'pull', 'merge', 'commit', 'commits', 'branch', 'branches', 'fetch',
  'rebase', 'checkout', 'clone', 'fork', 'PR', 'MR', 'repo', 'repository', 'repos',
  'hash', 'hashes', 'main', 'master', 'origin', 'upstream', 'staging', 'HEAD',
  'tag', 'tags', 'stash', 'reset', 'revert', 'diff', 'log', 'remote', 'tracking',
  // === Загальні англійські слова часто використовувані ===
  'one', 'two', 'three', 'four', 'five', 'today', 'yesterday', 'tomorrow',
  'before', 'after', 'next', 'last', 'first', 'second', 'third', 'final',
  'week', 'month', 'year', 'day', 'hour', 'min', 'sec', 'now',
  'update', 'updates', 'updated', 'fix', 'fixes', 'fixed', 'add', 'added', 'remove',
  'feedback', 'review', 'audit', 'test', 'tests', 'tested', 'check', 'checked',
  'bump', 'release', 'deploy', 'build', 'rebuild', 'fix', 'patch', 'hotfix',
  'feature', 'bug', 'task', 'tasks', 'note', 'notes', 'project', 'projects',
  'idea', 'ideas', 'plan', 'plans', 'phase', 'phases', 'step', 'steps', 'item',
  'data', 'info', 'log', 'logs', 'config', 'env', 'mode', 'flag', 'flags',
  'click', 'tap', 'swipe', 'scroll', 'drag', 'drop', 'hover', 'focus', 'blur',
  // === IT-сленг проекту ===
  'brain', 'roman', 'web', 'mobile', 'desktop', 'frontend', 'backend',
  'monorepo', 'sandbox', 'production', 'prod', 'dev', 'local', 'remote',
  // === Загальні короткі ===
  'ok', 'OK', 'yes', 'no', 'true', 'false', 'null', 'undefined', 'void',
  'pre', 'post', 'sub', 'super', 'meta', 'self', 'auto', 'manual',
  // === Часто згадувані файли проекту і константи ===
  // (всі _CASE будуть зловлені окремо як snake_case — додаємо тут щоб НЕ ловило)
  'CACHE_NAME', 'SESSION_STATE', 'BUGS_HISTORY', 'DO_NOT_TOUCH', 'CHANGES',
  'ROADMAP', 'CLAUDE', 'README', 'LESSONS', 'INDEX', 'TODO', 'NOTES',
  'AGENT_INTELLIGENCE_SCALE', 'OWL_SILENCE_PRUNING_PLAN', 'EVENING',
  'FINANCE', 'DATA_SCHEMA', 'TECHNICAL_REFERENCE', 'DESIGN_SYSTEM',
  'FILE_STRUCTURE', 'ARCHITECTURE', 'GIT_EMERGENCY', 'AI_TOOLS', 'SKILLS_PLAN',
  'CONCEPTS_ACTIVE', 'NEVERMIND_BUGS', 'NEVERMIND_LOGIC', 'FEATURES_ROADMAP',
  // === Storage-ключі (nm_*) теж пропускаємо — Роман їх щодня бачить ===
  // Ці слова сами по собі snake_case, тому потраплять у NEW логіку нижче.
  // Додамо явно в whitelist щоб НЕ ловило.
  'nm_inbox', 'nm_tasks', 'nm_notes', 'nm_habits2', 'nm_finance',
  'nm_health_cards', 'nm_projects', 'nm_events', 'nm_moments', 'nm_trash',
  'nm_settings', 'nm_facts', 'nm_owl_board', 'nm_data_changed',
  // === Деякі назви хуків/скілів ===
  'PostToolUse', 'PreToolUse', 'UserPromptSubmit', 'Stop', 'SessionStart',
]);

// Регекси що повністю ігноруються (хеші коміту, ID сесій, версії).
const ALLOWED_PATTERNS = [
  // хеш-коміту: 7-12 hex символів (типу f98b61f, c110b43)
  /^[0-9a-f]{7,12}$/i,
  // ID сесій: 4-7 символів буква+цифра (наприклад SK6E2, m4Q1o, 7PQ1a, kGX6g).
  // Розширено 7PQ1a 29.04 — раніше регекс вимагав ОБОВʼЯЗКОВО мала+велика,
  // через це SK6E2 (тільки великі+цифри) флагалось.
  // Нова умова: має бути ≥1 буква + ≥1 цифра у послідовності 4-7 символів.
  /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{4,7}$/,
  // Розширено xHQfi 30.04 — деякі ID сесій бувають БЕЗ цифр, тільки mixed case
  // (наприклад EhxzJ, dIooU, gHCOh, xHQfi). Регекс: 4-7 чистих букв з ≥1 малою
  // і ≥1 великою. Ризик false-positive (MyClass, BoardLog) — низький бо такі
  // слова рідко без backticks у моїх відповідях, і там у whitelist `getX`/`setY`
  // через camelCase матчер вже спрацьовує природно.
  /^(?=.*[A-Z])(?=.*[a-z])[A-Za-z]{4,7}$/,
  // Версії: v123, v1234, v12345
  /^v\d{1,5}$/i,
];

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

// Повертає вміст backtick-блоку у якому знаходиться позиція pos.
// null якщо позиція не у backticks. Використовується щоб визначити чи весь
// блок схожий на identifier (file path, hash, kebab-case) — тоді всі слова
// в ньому пропускаємо.
function getBacktickContent(text, pos) {
  let openPos = -1;
  let count = 0;
  for (let i = 0; i < pos; i++) {
    if (text[i] === '`' && text[i - 1] !== '\\') {
      if (count % 2 === 0) openPos = i;
      count++;
    }
  }
  if (count % 2 === 0) return null;
  for (let i = pos; i < text.length; i++) {
    if (text[i] === '`' && text[i - 1] !== '\\') {
      return text.slice(openPos + 1, i);
    }
  }
  return null;
}

// НОВА ЛОГІКА (29.04.2026 7PQ1a): флагати тільки слова що ВИГЛЯДАЮТЬ як код.
// Раніше ловило ВСЕ що не у whitelist → засмічення повідомлень дужками над
// загальними словами (push/pull/merge/today/before). Інверсія: пропускаємо
// все, флагаємо тільки специфічні патерни коду.
function looksLikeCode(word) {
  // 1. snake_case з малими літерами (reflect_on_feeling, get_ai_context).
  //    Принаймні одне підкреслення між літерами.
  if (/[a-z]_[a-z]/.test(word)) return 'snake_case';
  // 2. SCREAMING_SNAKE_CASE з великими (NEW_CONSTANT, MAX_RETRIES).
  //    Принаймні одне підкреслення між великими літерами.
  //    Але CACHE_NAME, SESSION_STATE — у whitelist окремо.
  if (/[A-Z]_[A-Z]/.test(word)) return 'screaming_snake';
  // 3. camelCase: маленька літера → велика (getAIContext, addEventListener).
  //    НЕ флагає назви типу Roman, Claude (одна початкова велика).
  if (/[a-z][A-Z]/.test(word)) return 'camelCase';
  // 4. PascalCase з ≥2 великими і ≥1 малою (MyClass, BoardContext).
  //    Має містити: 1+ велика на початку, 1+ мала після, ще 1+ велика далі.
  if (/^[A-Z][a-z]+[A-Z]/.test(word)) return 'PascalCase';
  // 5. Усе решта — пропускаємо (загальні слова push/pull/today/тощо).
  return null;
}

function findViolations(text) {
  const cleaned = stripCodeBlocks(text);
  const violations = new Map(); // word → { count, sample_pos }

  // === 1. Слова що виглядають як код (snake_case, camelCase, PascalCase) ===
  const latinRe = /\b([A-Za-z][A-Za-z0-9_]{2,})\b/g;
  let match;
  while ((match = latinRe.exec(cleaned)) !== null) {
    const word = match[1];
    const wordStart = match.index;
    const wordEnd = wordStart + word.length;

    if (ALLOWED_LATIN.has(word)) continue;
    if (ALLOWED_PATTERNS.some(re => re.test(word))) continue;

    // НОВЕ: пропускаємо все що НЕ виглядає як код
    const codeStyle = looksLikeCode(word);
    if (!codeStyle) continue;

    // Скіпаємо у backticks-блоках з identifier-вмістом (file paths, kebab-case)
    const btContent = getBacktickContent(cleaned, wordStart);
    if (btContent && /[0-9./_-]/.test(btContent) && btContent !== word) continue;
    // Скіпаємо якщо метод (`obj.method`)
    if (cleaned[wordStart - 1] === '.') continue;
    // Скіпаємо у файлових шляхах
    if (cleaned.slice(wordEnd, wordEnd + 6).match(FILE_EXT_RE)) continue;
    if (isInsideFilePath(cleaned, wordStart)) continue;
    // Скіпаємо URL
    const before30 = cleaned.slice(Math.max(0, wordStart - 30), wordStart);
    if (before30.match(/https?:\/\/[^\s]*$/)) continue;
    // Скіпаємо HEX (preceded by #)
    if (cleaned[wordStart - 1] === '#') continue;
    // Скіпаємо одиниці виміру у HEX/числах
    if (cleaned[wordStart - 1] && /[0-9]/.test(cleaned[wordStart - 1])) continue;

    // Перевіряємо чи є пояснення поряд
    if (hasNearbyExplanation(cleaned, wordEnd)) continue;

    const wordLower = word.toLowerCase();
    if (!violations.has(wordLower)) {
      violations.set(wordLower, { word, count: 0, type: codeStyle });
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
      resetBlockCounter();
      return;
    }

    // Сортуємо за частотою + типом, обмежуємо 15 елементами
    const sorted = [...violations.values()].sort((a, b) => b.count - a.count).slice(0, 15);
    const totalCount = [...violations.values()].reduce((acc, v) => acc + v.count, 0);

    const wordsList = sorted.map(v => `«${v.word}»${v.count > 1 ? ` ×${v.count}` : ''}`).join(', ');

    const lines = [
      `🔍 Можливо потребують пояснення (виглядають як код, ${violations.size} унікальних, ${totalCount} згадувань):`,
      '',
      sorted.map(v => `   • «${v.word}»${v.count > 1 ? ` ×${v.count}` : ''} [${v.type}]`).join('\n'),
      '',
      'Правило з CLAUDE.md (переформульовано 29.04.2026 7PQ1a): пояснюй ТІЛЬКИ незнайомі коди — назви функцій (snake_case/camelCase), CSS-властивості, новий жаргон. Загальні англійські слова (push/pull/merge/today тощо) — НЕ пояснюй, Роман у словнику.',
      '',
      'У наступній відповіді: якщо слово зі списку — реальна нова назва коду яку Роман не знає → додай пояснення. Якщо це загальний термін що випадково має camelCase — пропусти. Не визнавай «порушення» механічно як раніше.',
    ];
    fs.writeFileSync(VIOLATIONS_FILE, lines.join('\n') + '\n');

    // === Метрика прогресу: append у violations-log.txt ===
    try {
      const timestamp = new Date().toISOString();
      const sessionId = getSessionId();
      const wordsCompact = sorted
        .map(v => `${v.word}${v.count > 1 ? `×${v.count}` : ''}`)
        .join(', ');
      const logLine = `${timestamp} [${sessionId}] ${violations.size} unique / ${totalCount} total: ${wordsCompact}\n`;
      fs.appendFileSync(VIOLATIONS_LOG_FILE, logLine);
    } catch (e) {}

    // === БЛОКУВАЛЬНИЙ РЕЖИМ (xHQfi 30.04) ===
    // exit-code 2 — Stop hook повертає Claude примусове повідомлення про необхідність переписати.
    // Anti-loop: якщо вже ANTI_LOOP_MAX блоків підряд за 30 хв — пропускаємо (regex може дурити).
    const counter = readBlockCounter();
    if (counter.count >= ANTI_LOOP_MAX) {
      // Перевищили ліміт — лише пишемо у файл (як раніше), не блокуємо.
      // Counter сам обнулиться через 30 хв тиші або при чистій відповіді.
      writeBlockCounter({ count: counter.count + 1, lastTs: Date.now() });
      return;
    }
    writeBlockCounter({ count: counter.count + 1, lastTs: Date.now() });

    const reasonLines = [
      '',
      '=== ⚠️ ВІДПОВІДЬ ЗАБЛОКОВАНА (.claude/hooks/check-response-violations.js) ===',
      '',
      `Знайдено ${violations.size} слів які виглядають як код без пояснень: ${wordsList}.`,
      '',
      'ПРАВИЛО CLAUDE.md (UI-задачі і пояснення в дужках):',
      '• Назви функцій (snake_case/camelCase), CSS-властивості, технічний жаргон → пояснюй у дужках простими словами що це робить для юзера.',
      '• Описуй ВИГЛЯД на екрані замість назв коду — Роман не дивиться у код, він дивиться на телефон.',
      '• Загальні англійські слова (push/pull/merge/today/before) — НЕ потребують пояснення.',
      '',
      `ДІЯ: перепиши ОСТАННЮ відповідь Роману людською мовою. Кожне слово зі списку (${wordsList}) — або заміни на людський опис («плашка зверху», «кнопка», «значення часу»), або поясни в дужках одним реченням що це.`,
      '',
      `Anti-loop: блокувань підряд ${counter.count + 1}/${ANTI_LOOP_MAX}. Після ${ANTI_LOOP_MAX} підряд — пропускатиму на 30 хв (можливі false-positive).`,
      '',
      '=== Перепиши відповідь і надішли заново. ===',
      ''
    ];
    console.error(reasonLines.join('\n'));
    process.exit(2);
  } catch (e) {
    cleanupViolations();
  }
});

function cleanupViolations() {
  // Видаляємо файл порушень якщо його нема порушень — щоб не показати застарілий
  try { if (fs.existsSync(VIOLATIONS_FILE)) fs.unlinkSync(VIOLATIONS_FILE); } catch {}
}
