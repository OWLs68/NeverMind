import { currentTab, showToast } from './nav.js';

// === LOGGER ===
const NM_LOG_KEY = 'nm_error_log';
const NM_LOG_MAX = 200;

function getErrorLog() {
  try { return JSON.parse(localStorage.getItem(NM_LOG_KEY) || '[]'); } catch { return []; }
}
function saveErrorLog(arr) {
  try { localStorage.setItem(NM_LOG_KEY, JSON.stringify(arr.slice(-NM_LOG_MAX))); } catch {}
}

// Групування послідовних однакових записів.
// Якщо N однакових помилок поспіль — збираємо у один об'єкт {count:N, firstTs, lastTs}.
// Ключ дедуплікації: type + msg + src (tab ігноруємо бо може змінюватись між записами).
function _groupConsecutive(log) {
  const out = [];
  for (const e of log) {
    const prev = out[out.length - 1];
    if (prev && prev.type === e.type && prev.msg === e.msg && prev.src === e.src) {
      prev.count++;
      prev.lastTs = e.ts;
    } else {
      out.push({ ...e, count: 1, firstTs: e.ts, lastTs: e.ts });
    }
  }
  return out;
}

export function logError(type, message, source) {
  const log = getErrorLog();
  log.push({
    ts: Date.now(),
    type,
    msg: String(message).slice(0, 500),
    src: source || '',
    tab: currentTab || '?'
  });
  saveErrorLog(log);
  updateErrorLogBtn();
}

// Перехоплюємо JS помилки і promise rejections
window.addEventListener('error', e => {
  logError('error', e.message, (e.filename || '').replace(/.*\//, '') + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  logError('promise', e.reason ? (e.reason.message || String(e.reason)) : 'Promise rejected', '');
});

// Перехоплюємо console.log / warn / error
(function() {
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _err = console.error.bind(console);
  console.log = (...a) => { _log(...a); logError('log', a.map(String).join(' '), ''); };
  console.warn = (...a) => { _warn(...a); logError('warn', a.map(String).join(' '), ''); };
  console.error = (...a) => { _err(...a); logError('err', a.map(String).join(' '), ''); };
})();

// Візуальна панель логів
function showErrorLog() {
  const log = getErrorLog();
  const panel = document.getElementById('log-panel');
  const list = document.getElementById('log-panel-list');
  if (!panel || !list) return;

  const typeStyle = {
    error:   { bg: 'rgba(239,68,68,0.15)',   color: '#dc2626' },
    promise: { bg: 'rgba(239,68,68,0.15)',   color: '#dc2626' },
    err:     { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
    warn:    { bg: 'rgba(251,191,36,0.15)',  color: '#b45309' },
    log:     { bg: 'rgba(99,102,241,0.10)',  color: '#4338ca' },
  };

  if (log.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">Лог порожній — помилок не знайдено 👍</div>';
  } else {
    const grouped = _groupConsecutive(log);
    list.innerHTML = [...grouped].reverse().map(e => {
      const d = new Date(e.lastTs || e.ts);
      const time = d.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
      const date = d.toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'});
      const s = typeStyle[e.type] || { bg: 'rgba(30,16,64,0.06)', color: 'rgba(30,16,64,0.5)' };
      const countBadge = e.count > 1
        ? `<span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(194,121,10,0.15);color:#7a4e05">×${e.count}</span>`
        : '';
      return `<div style="padding:10px 14px;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:${s.bg};color:${s.color};text-transform:uppercase">${e.type}</span>
          ${countBadge}
          <span style="font-size:11px;color:rgba(30,16,64,0.35)">${date} ${time}</span>
          <span style="font-size:11px;color:rgba(30,16,64,0.25);margin-left:auto">${e.tab}</span>
        </div>
        <div style="font-size:13px;color:#1e1040;line-height:1.45;word-break:break-all">${e.msg}</div>
        ${e.src ? `<div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:3px;font-family:monospace">${e.src}</div>` : ''}
      </div>`;
    }).join('');
  }

  const countEl = document.getElementById('log-panel-count');
  if (countEl) {
    const grouped = _groupConsecutive(log);
    const groupedN = grouped.length;
    const txt = groupedN === log.length
      ? `${log.length} записів · свіжіші зверху`
      : `${log.length} записів · ${groupedN} груп · свіжіші зверху`;
    countEl.textContent = txt;
  }

  panel.style.display = 'flex';
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function copyLogForClaude() {
  const log = getErrorLog();
  if (!log.length) { showToast('Лог порожній'); return; }
  // Групуємо послідовні дублі щоб Claude не гортав 8 однакових TypeError
  const grouped = _groupConsecutive(log);
  const lastGroups = grouped.slice(-50);
  const lines = lastGroups.map(e => {
    const time = new Date(e.lastTs || e.ts).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const cnt = e.count > 1 ? ` ×${e.count}` : '';
    return `[${time}][${e.type}][${e.tab}]${cnt} ${e.msg}${e.src ? ' @ ' + e.src : ''}`;
  }).join('\n');
  // Додаємо deploy info з бейджа щоб я бачив яка версія на телефоні
  const badge = document.getElementById('deploy-version');
  const deployLine = badge
    ? `\nВерсія: ${badge.textContent || '?'} · коміт: ${badge.dataset.commit || 'local'} · з гілки: ${badge.dataset.source || 'dev'}`
    : '';
  const header = `NeverMind Logs (${lastGroups.length} груп з ${grouped.length}, всього ${log.length} записів):${deployLine}`;
  const text = `${header}\n\`\`\`\n${lines}\n\`\`\``;
  navigator.clipboard?.writeText(text)
    .then(() => showToast('✓ Скопійовано — вставляй в чат з Claude'));
}

function closeLogPanel() {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  panel.style.opacity = '0';
  setTimeout(() => { panel.style.display = 'none'; }, 250);
}

function copyErrorLog() {
  const log = getErrorLog();
  if (!log.length) { showToast('Лог порожній'); return; }
  const lines = log.map(e => {
    const time = new Date(e.ts).toLocaleString('uk-UA');
    return `[${time}] [${e.type}] [${e.tab}] ${e.msg}${e.src ? ' → ' + e.src : ''}`;
  }).join('\n');
  navigator.clipboard?.writeText('NeverMind Log\n' + '='.repeat(40) + '\n' + lines)
    .then(() => showToast('✓ Лог скопійовано (' + log.length + ' записів)'));
}

function clearErrorLog() {
  localStorage.removeItem(NM_LOG_KEY);
  showToast('✓ Лог очищено');
  updateErrorLogBtn();
  const list = document.getElementById('log-panel-list');
  if (list) list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">Лог порожній — помилок не знайдено 👍</div>';
}

export function updateErrorLogBtn() {
  const btn = document.getElementById('error-log-btn');
  if (!btn) return;
  const count = getErrorLog().length;
  btn.textContent = count > 0 ? count : '0';
  btn.style.background = count > 0 ? 'rgba(234,88,12,0.12)' : '';
  btn.style.color = count > 0 ? '#ea580c' : '';
}


// Functions called from HTML event handlers
Object.assign(window, { showErrorLog, copyLogForClaude, closeLogPanel, clearErrorLog });
