#!/usr/bin/env node
// .claude/hooks/pre-push-check.js
//
// PreToolUse hook (запускається ПЕРЕД виконанням Bash команди).
// Активний лише для команд `git push`. Реалізує два правила з CLAUDE.md:
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
// Універсальний bypass: фраза `pre-push: ok` у будь-якому з останніх
// повідомлень асистента — пропускає обидва check-и (для випадків
// false positive: інфраструктурні зміни в .claude/, документація тощо).
//
// Створено: 29.04.2026 oknnM (третя автоматизація після уроку «декларативне
// правило без автоматичного контролю»). Кандидати «правило 6» і «cleanup»
// раніше тримались на дисципліні Claude — не працювало.

const fs = require('fs');

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
