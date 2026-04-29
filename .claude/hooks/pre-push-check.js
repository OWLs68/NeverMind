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

const SMOKE_TRIGGERS = [
  /міграц/i,
  /\buuid[\s-]?(міграц|формат|схем)/i,
  /формат[ауи]?\s+ідентифікатор/i,
  /схем[уаи]?\s+(даних|localStorage)/i,
  /\b(create|add|repeat|save)_[a-z]+\b/,
  /нов[аиу]\s+(ai[\s-]?)?tool/i,
  /bulk[\s-]?(операц|створ|генерац)/i,
];

const SMOKE_BYPASS = [
  /протестував рукою/i,
  /smoke[\s-]?test\s*(зроблено|готово|ok|пройдено|не потріб)/i,
  /iphone[\s-]?тест\s*(пройдено|ok|готово|зроблено)/i,
  /перевірив\s+на\s+iphone/i,
  /\biphone\s+ok\b/i,
];

const CLEANUP_TRIGGERS = [
  /нов[аиу]\s+tool\s+(create|add|repeat|save)/i,
  /tool\s+(create|add|repeat|save)_/i,
  /ai\s+(створює|генерує)\s+(дан|записи|серії)/i,
  /bulk[\s-]?(операц|створ|генерац)/i,
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

    // Універсальний bypass
    if (UNIVERSAL_BYPASS.test(haystack)) process.exit(0);

    const smokeTriggered = SMOKE_TRIGGERS.some(re => re.test(haystack));
    const smokeBypassed = SMOKE_BYPASS.some(re => re.test(haystack));
    const cleanupTriggered = CLEANUP_TRIGGERS.some(re => re.test(haystack));
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

    // Правило CACHE_NAME bump
    const repoRoot = path.join(__dirname, '..', '..');
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

    if (issues.length > 0) {
      console.error('\n=== ⚠️ PRE-PUSH ПЕРЕВІРКА (.claude/hooks/pre-push-check.js) ===\n');
      console.error(issues.join('\n\n'));
      console.error('\n=== Виправ і повтори push. ===\n');
      process.exit(2);
    }

    process.exit(0);
  } catch (e) {
    // Не блокуємо push при помилках самого хука
    process.exit(0);
  }
});
