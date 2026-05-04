#!/usr/bin/env node
// .claude/hooks/pre-push-check.js
//
// PreToolUse hook (запускається ПЕРЕД виконанням Bash команди).
// Активний лише для команд `git push`. Реалізує три правила з CLAUDE.md:
//
// 1) Правило 6 «UI smoke-test після міграцій ID/формату/схеми + після нових
//    AI tools що пишуть дані» — блокує push якщо у останніх повідомленнях
//    асистента є тригер-слова (міграція / UUID / формат / нова tool)
//    і немає bypass-фрази що smoke-test зроблено рукою на iPhone.
//
// 2) Правило «🧹 Edit/Delete/Cleanup у плані фічі» — блокує push якщо у
//    останніх повідомленнях є слова створення AI-tool / нова фіча
//    і немає згадки про delete-механізм / UI-кнопку чистки / warning при
//    конфлікті.
//
// 3) Правило ротації SESSION_STATE — блокує push якщо у
//    _ai-tools/SESSION_STATE.md більше 2 активних детальних блоків
//    (паттерн «прапор архіву накопичується» — повторювалось 3 рази
//    поспіль у kGX6g→UG1Fr→m4Q1o→oknnM до архівації у SK6E2 29.04).
//
// 4) Правило CACHE_NAME bump — блокує push якщо у diff проти origin/main
//    змінено user-facing код (src/, index.html, style.css) але CACHE_NAME
//    у sw.js не змінено. Без bump'у юзер не побачить оновлення на iPhone
//    бо PWA закешує старі файли (Service Worker — фоновий скрипт що керує
//    кешем браузера).
//
// Універсальний bypass: фраза `pre-push: ok` у будь-якому з останніх
// повідомлень асистента — пропускає всі check-и (для випадків
// false positive: інфраструктурні зміни в .claude/, документація тощо).
//
// Створено: 29.04.2026 oknnM (третя автоматизація після уроку «декларативне
// правило без автоматичного контролю»). Кандидати «правило 6» і «cleanup»
// раніше тримались на дисципліні Claude — не працювало.
// Розширено: 29.04.2026 SK6E2 (правило ротації SESSION_STATE).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const N_RECENT_MESSAGES = 5; // дивимось у короткий хвіст щоб уникнути false positive

// === SMOKE/CLEANUP тригери шукають у GIT DIFF (реальних змінах коду),
// НЕ у тексті відповіді Claude ===
//
// Корінь регресії 12+ false positives за UvEHE+rC4TO+NpBmN (RGisY 04.05):
// старі регекси типу /міграц/ і /\b(create|add|repeat|save)_[a-z]+\b/
// матчили слова «міграція», «save_note», «create_event» у звичайних
// текстових поясненнях Claude (description комітів, обговорення змін).
// Текст асистента ≠ реальні зміни схеми.
//
// Нова логіка: тригери = регекси на ДОДАНІ рядки (`^\+`) у diff src/+sw.js.
// Якщо у diff є нова `name:'create_*'` у tools-array → справжня нова tool.
// Якщо у тексті обговорення є слово «save_note» → ігнорується.

const SMOKE_DIFF_TRIGGERS = [
  // Нова AI-tool у src/ai/tools.js, prompts.js, *-tools.js (entry в схемі)
  /^\+\s*name:\s*['"](create|add|repeat|save|update|delete|complete)_[a-z_]+['"]/m,
  // Нова функція міграції у src/core/boot.js / utils.js
  /^\+\s*(async\s+)?function\s+migrate[A-Z]/m,
  // Новий прапор-стан міграції nm_*_v*_done / _wipe / _cleared
  /^\+.*['"]nm_[a-z_]+_v\d+_(done|wipe|cleared|migrated)['"]/m,
  // UUID-міграція ID-формату (нова точка генерації id у схемі)
  /^\+\s*id:\s*generateUUID/m,
  // Новий ключ localStorage nm_*
  /^\+.*localStorage\.setItem\(\s*['"]nm_[a-z_]+['"]/m,
];

const SMOKE_BYPASS = [
  /протестував рукою/i,
  /smoke[\s-]?test\s*(зроблено|готово|ok|пройдено|не потріб)/i,
  /iphone[\s-]?тест\s*(пройдено|ok|готово|зроблено)/i,
  /перевірив\s+на\s+iphone/i,
  /\biphone\s+ok\b/i,
];

const CLEANUP_DIFF_TRIGGERS = [
  // Нова create_*/add_*/repeat_*/save_* tool у схемі (без delete-counterpart)
  /^\+\s*name:\s*['"](create|add|repeat|save)_[a-z_]+['"]/m,
  // Нова bulk-функція у src/
  /^\+\s*(async\s+)?function\s+\w*[Bb]ulk\w*\s*\(/m,
];

const CLEANUP_BYPASS = [
  /\bdelete_[a-z]+\b/i,
  /свайп[\s-]?видален/i,
  /ui[\s-]?кнопк[ау]\s+(чистки|видален)/i,
  /warning\s+при\s+конфлікт/i,
  /видален[ня]?\s+серії/i,
  /очищен[ня]?\s+спис/i,
];

const UNIVERSAL_BYPASS = /pre-push:\s*ok/i;

const MAX_ACTIVE_SESSION_BLOCKS = 2;
const SESSION_STATE_PATH = path.join(__dirname, '..', '..', '_ai-tools', 'SESSION_STATE.md');

// CACHE_NAME bump перевірка
// Файли користувацького коду що впливають на PWA-кеш
const CODE_FILE_REGEX = /^(src\/.+\.(js|css|html)|index\.html|style\.css)$/;

// === Doc-only check (xHQfi 30.04 — false-positive whitelist) ===
// Якщо у пуші змінено ТІЛЬКИ документацію/хуки/конфіги — пропускаємо
// SMOKE_TRIGGERS і CLEANUP_TRIGGERS бо у коміт-меседжі могли бути згадані
// слова типу "нова tool" / "міграція" / "create_*" — описані, а не зроблені.
// CACHE_NAME bump check уже має свою логіку (тільки src/ файли) — не чіпаємо.
const DOC_FILE_REGEX = /^(.*\.md|\.claude\/.+|_ai-tools\/.+|_archive\/.+|docs\/.+|scripts\/.+|i18n-baseline\.json|package(-lock)?\.json|\.gitignore|build\.js|package\.json)$/;

function isDocOnlyPush(repoRoot) {
  try {
    // Беремо ТІЛЬКИ коміти які зараз пушаться (нелижі у upstream).
    // Якщо upstream нема (перший пуш гілки) — fallback на останній коміт.
    let diffRange = null;
    try {
      execSync(`git -C "${repoRoot}" rev-parse @{u}`, { stdio: 'pipe' });
      diffRange = '@{u}..HEAD';
    } catch {
      diffRange = 'HEAD~1..HEAD';
    }

    const filesOutput = execSync(`git -C "${repoRoot}" diff --name-only ${diffRange}`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
    });
    const files = filesOutput.split('\n').filter(Boolean);
    if (files.length === 0) return false;

    // Якщо хоч один файл НЕ підпадає під DOC_FILE_REGEX — це не doc-only пуш
    return files.every(f => DOC_FILE_REGEX.test(f));
  } catch {
    return false;
  }
}

// Витягує git diff src/+index.html+sw.js проти origin/main (або @{u}, HEAD~1).
// Використовується SMOKE/CLEANUP тригерами щоб шукати реальні зміни схеми,
// а не слова у тексті асистента (false positive ×12 у UvEHE+rC4TO+NpBmN).
function getRealCodeDiff(repoRoot) {
  try {
    // B1.5 fix (RGisY 04.05): порівнюємо з upstream бранчем (@{u}), а не з
    // origin/main. Інакше для feature-гілок з 10+ комітами SMOKE_DIFF_TRIGGERS
    // ловлять зміни ВСІХ комітів феча-гілки → false positive у кожному push'і.
    // Треба бачити ТІЛЬКИ нові коміти що зараз пушаться.
    let diffRange = null;
    try {
      execSync(`git -C "${repoRoot}" rev-parse @{u}`, { stdio: 'pipe' });
      diffRange = '@{u}..HEAD';
    } catch {
      // Першoyzпуш гілки — upstream немає, дивимось останній коміт як fallback
      diffRange = 'HEAD~1..HEAD';
    }
    return execSync(
      `git -C "${repoRoot}" diff ${diffRange} -- src/ index.html sw.js`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 10 * 1024 * 1024 }
    );
  } catch {
    return '';
  }
}

function checkCacheNameBump(repoRoot) {
  try {
    // Пробуємо порівняти з origin/main, інакше HEAD~1
    let diffRange = null;
    for (const candidate of ['origin/main...HEAD', 'HEAD~1...HEAD']) {
      try {
        execSync(`git -C "${repoRoot}" rev-parse ${candidate.split('...')[0]}`, { stdio: 'pipe' });
        diffRange = candidate;
        break;
      } catch {}
    }
    if (!diffRange) return null;

    const filesOutput = execSync(`git -C "${repoRoot}" diff --name-only ${diffRange}`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
    });
    const codeFiles = filesOutput.split('\n').filter(Boolean).filter(f => CODE_FILE_REGEX.test(f));
    if (codeFiles.length === 0) return null; // Чисто документаційний коміт

    // Перевіряємо чи у diff sw.js змінилась стрічка CACHE_NAME
    let swDiff = '';
    try {
      swDiff = execSync(`git -C "${repoRoot}" diff ${diffRange} -- sw.js`, {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
      });
    } catch {}

    // Шукаємо рядок «+const CACHE_NAME» або «+CACHE_NAME» у diff sw.js
    const hasBump = /^\+\s*(const\s+)?CACHE_NAME\s*=/m.test(swDiff);
    if (hasBump) return null;

    return { codeFiles, count: codeFiles.length };
  } catch {
    return null; // Не блокуємо push при помилках самого хука
  }
}

function countActiveSessionBlocks() {
  if (!fs.existsSync(SESSION_STATE_PATH)) return { count: 0, blocks: [] };
  const content = fs.readFileSync(SESSION_STATE_PATH, 'utf8');
  const lines = content.split('\n');
  const blocks = [];
  for (const line of lines) {
    // Заголовок детального блоку: "## 🔧 Поточна сесія X — ..." / "## 🔧 Сесія X — ..." / "## 🔧 Попередня сесія X — ..."
    if (/^## 🔧 (Поточна сесія|Сесія|Попередня сесія) /.test(line)) {
      // Пропускаємо stub-посилання (заголовок містить «архівовано»)
      if (!/архівовано/.test(line)) {
        // Витягуємо ID сесії (5-символьний код після слова «сесія»)
        const m = line.match(/сесія\s+([A-Za-z0-9]+)/i);
        blocks.push(m ? m[1] : line.slice(0, 60));
      }
    }
  }
  return { count: blocks.length, blocks };
}

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

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = (data.tool_input && data.tool_input.command) || '';

    // Активуємось ЛИШЕ на git push — інші Bash команди пропускаємо
    if (!/\bgit\s+push\b/.test(command)) process.exit(0);

    const transcriptPath = data.transcript_path;
    if (!transcriptPath) process.exit(0);

    const haystack = readRecentAssistantTexts(transcriptPath, N_RECENT_MESSAGES);
    if (!haystack || haystack.length < 30) process.exit(0);

    // Універсальний bypass — обчислюємо ФЛАГ, але НЕ виходимо одразу.
    // Якщо bypass використано АЛЕ жодного check не активувалось — попереджаємо
    // про непотрібний ритуал (антипаттерн «pre-push: ok як звичка», знайдено
    // RGisY 04.05 — Claude писав bypass у 12 з 12 комітів коли хук не блокував).
    const bypassed = UNIVERSAL_BYPASS.test(haystack);

    const repoRoot = path.join(__dirname, '..', '..');
    const docOnly = isDocOnlyPush(repoRoot);

    // SMOKE/CLEANUP тригери шукають у git diff src/+sw.js (реальних змінах
    // схеми/tools/міграцій), НЕ у тексті відповіді Claude. Bypass по тексту
    // лишається (haystack) — щоб Роман міг сказати «протестував рукою».
    const realCodeDiff = docOnly ? '' : getRealCodeDiff(repoRoot);
    const smokeTriggered = !docOnly && SMOKE_DIFF_TRIGGERS.some(re => re.test(realCodeDiff));
    const smokeBypassed = SMOKE_BYPASS.some(re => re.test(haystack));
    const cleanupTriggered = !docOnly && CLEANUP_DIFF_TRIGGERS.some(re => re.test(realCodeDiff));
    const cleanupBypassed = CLEANUP_BYPASS.some(re => re.test(haystack));

    const issues = [];
    if (smokeTriggered && !smokeBypassed) {
      issues.push(
        '🧪 SMOKE-TEST (правило 6 CLAUDE.md): у твоєму плані є міграція / нова AI-tool / UUID / зміна схеми. ' +
        'Перед пушем — РУЧНА перевірка на iPhone (тап ✓, свайп, відкриття модалки). ' +
        'Якщо протестував — додай фразу «протестував рукою на iPhone, smoke-test зроблено» у відповідь і повтори push. ' +
        'Якщо це false positive (інфраструктурні зміни без UI) — додай фразу «pre-push: ok».'
      );
    }
    if (cleanupTriggered && !cleanupBypassed) {
      issues.push(
        '🧹 CLEANUP (правило «Edit/Delete/Cleanup у плані фічі»): додаєш створення (`create_*` / `add_*` / `repeat_*`) ' +
        '— а є `delete_*` tool / UI-кнопка чистки / warning при конфлікті? ' +
        'Якщо ні — фіча буде «напівфабрикатом» (паттерн відкату Календар Phase 2 / маскот / B-104). ' +
        'Або додай cleanup, або підтверди фразою «pre-push: ok».'
      );
    }

    // Правило CACHE_NAME bump (вже використовує repoRoot з блоку doc-only check)
    const cacheIssue = checkCacheNameBump(repoRoot);
    if (cacheIssue) {
      const filesPreview = cacheIssue.codeFiles.slice(0, 3).join(', ') +
        (cacheIssue.count > 3 ? ` ... (+${cacheIssue.count - 3})` : '');
      issues.push(
        `🔄 CACHE_NAME bump: змінено ${cacheIssue.count} файлів коду (${filesPreview}) ` +
        `але CACHE_NAME у sw.js не змінено. Юзер не побачить оновлення на iPhone — ` +
        `Service Worker (фоновий скрипт PWA) віддасть закешовані старі файли. ` +
        `Виправ: оновити CACHE_NAME у sw.js (формат: nm-YYYYMMDD-HHMM, команда date). ` +
        `Якщо це не торкається користувацького коду (коментарі/console.log) — додай фразу «pre-push: ok».`
      );
    }

    // Правило ротації SESSION_STATE
    const { count: sessionBlocks, blocks } = countActiveSessionBlocks();
    if (sessionBlocks > MAX_ACTIVE_SESSION_BLOCKS) {
      const blocksStr = blocks.join(', ');
      issues.push(
        `📋 SESSION_STATE РОТАЦІЯ: у _ai-tools/SESSION_STATE.md ${sessionBlocks} активних блоків (дозволено ${MAX_ACTIVE_SESSION_BLOCKS}). ` +
        `Активні: ${blocksStr}. Винеси найстаріші у _archive/SESSION_STATE_archive.md (паттерн з C8uQD/qG4fj/8bSsE архівації — заміни блок stub-посиланням на якір). ` +
        `Якщо інфраструктурний коміт без чіпання SESSION_STATE — додай фразу «pre-push: ok».`
      );
    }

    // Логіка bypass + issues:
    // 1. issues є + bypass є → bypass виправдано, push пройде (exit 0)
    // 2. issues є + bypass немає → блокуємо (exit 2)
    // 3. issues немає + bypass є → попереджаємо про непотрібний bypass (exit 0)
    // 4. issues немає + bypass немає → норма (exit 0)
    if (issues.length > 0 && !bypassed) {
      console.error('\n=== ⚠️ PRE-PUSH ПЕРЕВІРКА (.claude/hooks/pre-push-check.js) ===\n');
      console.error(issues.join('\n\n'));
      console.error('\n=== Виправ і повтори push. ===\n');
      process.exit(2);
    }
    if (issues.length === 0 && bypassed) {
      console.error('\n⚠️  PRE-PUSH: фразу «pre-push: ok» написано, але хук НІЧОГО не блокував би. Bypass-ритуал замість реакції на проблему — антипаттерн (RGisY 04.05). На майбутнє: пиши тільки коли хук фактично заблокував і ти перевірив що це false positive.\n');
    }
    process.exit(0);
  } catch (e) {
    // Не блокуємо push при помилках самого хука
    process.exit(0);
  }
});
