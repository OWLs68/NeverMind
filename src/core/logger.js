import { currentTab, showToast } from './nav.js';

// === LOGGER ===
const NM_LOG_KEY = 'nm_error_log';
const NM_LOG_MAX = 200;

// Ring buffer останніх юзер-дій (у пам'яті, не localStorage) — додається до помилок
// як контекст "що юзер робив перед помилкою".
const _recentActions = [];
const ACTIONS_MAX = 10;

export function trackUserAction(action) {
  _recentActions.push({ action: String(action).slice(0, 80), tab: currentTab || '?', ts: Date.now() });
  if (_recentActions.length > ACTIONS_MAX) _recentActions.shift();
}

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

export function logError(type, message, source, stack) {
  const log = getErrorLog();
  log.push({
    ts: Date.now(),
    type,
    msg: String(message).slice(0, 500),
    src: source || '',
    tab: currentTab || '?',
    stack: stack ? String(stack).slice(0, 1500) : null,
    actions: _recentActions.slice(-3),
  });
  saveErrorLog(log);
  updateErrorLogBtn();
}

// Перехоплюємо JS помилки і promise rejections
window.addEventListener('error', e => {
  logError(
    'error',
    e.error?.message || e.message,
    (e.filename || '').replace(/.*\//, '') + ':' + e.lineno,
    e.error?.stack
  );
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  logError(
    'promise',
    r ? (r.message || String(r)) : 'Promise rejected',
    '',
    r?.stack
  );
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

  // Кольори бейджів під темне тло #0f0a1e — яскраві і читабельні
  const typeStyle = {
    error:   { bg: 'rgba(239,68,68,0.22)',   color: '#fca5a5', label: 'ERR' },
    promise: { bg: 'rgba(239,68,68,0.22)',   color: '#fca5a5', label: 'PROMISE' },
    err:     { bg: 'rgba(239,68,68,0.22)',   color: '#fca5a5', label: 'ERR' },
    warn:    { bg: 'rgba(251,191,36,0.22)',  color: '#fcd34d', label: 'WARN' },
    log:     { bg: 'rgba(96,165,250,0.22)',  color: '#93c5fd', label: 'LOG' },
  };

  if (log.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:64px 20px;color:rgba(255,255,255,0.35);font-size:14px">Лог порожній — помилок не знайдено 👍</div>';
  } else {
    const grouped = _groupConsecutive(log);
    list.innerHTML = '<div style="padding:12px 14px 32px;display:flex;flex-direction:column;gap:10px">' +
      [...grouped].reverse().map((e, idx) => {
        const d = new Date(e.lastTs || e.ts);
        const time = d.toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
        const date = d.toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit'});
        const s = typeStyle[e.type] || { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', label: e.type.toUpperCase() };
        const countBadge = e.count > 1
          ? `<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:rgba(251,191,36,0.22);color:#fcd34d">×${e.count}</span>`
          : '';
        const hasDetails = !!(e.stack || (e.actions && e.actions.length));
        const actionsHtml = (e.actions && e.actions.length)
          ? `<div style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px">
               <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Останні дії перед помилкою</div>
               ${e.actions.map(a => {
                 const at = new Date(a.ts).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
                 return `<div style="font-size:12px;color:rgba(255,255,255,0.82);line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">[${at}] [${escapeLog(a.tab)}] ${escapeLog(a.action)}</div>`;
               }).join('')}
             </div>`
          : '';
        const stackHtml = e.stack
          ? `<div style="margin-top:10px;padding:10px 12px;background:rgba(239,68,68,0.1);border-radius:10px;border-left:3px solid rgba(252,165,165,0.5)">
               <div style="font-size:10px;font-weight:800;color:#fca5a5;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Stack trace</div>
               <div style="font-size:11px;color:rgba(255,255,255,0.85);white-space:pre-wrap;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word;overflow-wrap:anywhere">${escapeLog(e.stack)}</div>
             </div>`
          : '';
        return `<div class="log-entry" data-idx="${idx}" ${hasDetails ? `onclick="toggleLogEntry(${idx})"` : ''} style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;cursor:${hasDetails ? 'pointer' : 'default'};-webkit-tap-highlight-color:transparent">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:${s.bg};color:${s.color};letter-spacing:0.3px">${s.label}</span>
            ${countBadge}
            <span style="font-size:11px;color:rgba(255,255,255,0.5);font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${date} ${time}</span>
            <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-left:auto;padding:2px 7px;border-radius:5px;background:rgba(255,255,255,0.06);text-transform:uppercase;letter-spacing:0.3px">${escapeLog(e.tab)}</span>
            ${hasDetails ? `<span class="log-expand-${idx}" style="font-size:13px;color:rgba(255,255,255,0.55);flex-shrink:0">▸</span>` : ''}
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,0.96);line-height:1.5;word-break:break-word;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeLog(e.msg)}</div>
          ${e.src ? `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word;overflow-wrap:anywhere">${escapeLog(e.src)}</div>` : ''}
          <div class="log-details-${idx}" style="display:none">${actionsHtml}${stackHtml}</div>
        </div>`;
      }).join('') +
      '</div>';
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
    let block = `[${time}][${e.type}][${e.tab}]${cnt} ${e.msg}${e.src ? ' @ ' + e.src : ''}`;
    if (e.actions && e.actions.length) {
      block += '\n  actions: ' + e.actions.map(a => {
        const at = new Date(a.ts).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
        return `[${at}][${a.tab}] ${a.action}`;
      }).join(' → ');
    }
    if (e.stack) {
      block += '\n  stack: ' + e.stack.split('\n').slice(0, 6).join(' | ');
    }
    return block;
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


function escapeLog(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toggleLogEntry(idx) {
  const details = document.querySelector(`.log-details-${idx}`);
  const arrow = document.querySelector(`.log-expand-${idx}`);
  if (!details) return;
  const isOpen = details.style.display === 'block';
  details.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}

// Автотрекінг дій через подію nm-data-changed (dispatchається з save-функцій).
// Майже безкоштовне покриття найважливіших операцій (задачі, звички, нотатки, фінанси).
window.addEventListener('nm-data-changed', e => {
  trackUserAction('data-changed:' + (e?.detail || 'unknown'));
});

// Functions called from HTML event handlers
Object.assign(window, { showErrorLog, copyLogForClaude, closeLogPanel, clearErrorLog, toggleLogEntry });
