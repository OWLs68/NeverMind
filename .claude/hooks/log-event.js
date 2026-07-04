#!/usr/bin/env node
// .claude/hooks/log-event.js — 📓 JSONL-журнал усіх хук-подій (P6, ADR-005).
//
// Порт ідеї з claude-code-best-practice (журнал подій хуків): зараз сторожі
// блокують/пускають, але сліду для розбору інцидентів не лишають. Цей хук
// дописує ОДИН JSON-рядок на кожну подію у .claude/hooks/logs/hooks-log.jsonl
// (лог у .gitignore — локальний слід сесії, не історія репо).
//
// Реєструється на: PreToolUse, PostToolUse, Stop, PostToolUseFailure,
// SubagentStart, SubagentStop (settings.json). Один файл — всі події.
//
// Принципи: ЗАВЖДИ exit 0 (fail-open — журнал ніколи не блокує роботу);
// нуль залежностей; довгі рядки payload ріжуться до 4КБ.

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'hooks-log.jsonl');
const MAX_STR = 4096;

let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  try {
    let d = {};
    try { d = JSON.parse(input || '{}'); } catch { d = { _raw: String(input).slice(0, 500) }; }
    const rec = {
      ts: new Date().toISOString(),
      event: d.hook_event_name || '?',
      tool: d.tool_name || undefined,
      // Позначка субагента: беремо будь-який наявний сигнал (точне поле
      // різниться між версіями Claude Code).
      subagent: !!(d.agent_id || d.agent_type || d.parent_tool_use_id || d.is_subagent) || undefined,
      session: d.session_id || undefined,
      payload: JSON.parse(JSON.stringify(d, (k, v) =>
        typeof v === 'string' && v.length > MAX_STR ? v.slice(0, MAX_STR) + '…[cut]' : v)),
    };
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(rec) + '\n');
  } catch {}
  process.exit(0);
});
