// Health Check — перевірка стану систем NeverMind
// Використовується у панелі логу (logger.js) і може викликатись програмно
// з будь-якого модуля через runHealthCheck().

function getLocalStorageSize() {
  let total = 0;
  for (const key in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
    total += ((localStorage[key]?.length || 0) + key.length) * 2;
  }
  return total;
}

export function runHealthCheck() {
  const checks = [];

  // 1. localStorage доступний
  try {
    const testKey = '__nm_health_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    checks.push({ name: 'Сховище', status: 'ok', message: 'Доступне' });
  } catch (e) {
    checks.push({
      name: 'Сховище',
      status: 'fail',
      message: 'Недоступне',
      hint: 'Safari у приватному режимі або квоту вичерпано'
    });
  }

  // 2. Обсяг localStorage
  try {
    const size = getLocalStorageSize();
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    if (size > 4 * 1024 * 1024) {
      checks.push({
        name: 'Обсяг',
        status: 'warn',
        message: `${sizeMB} МБ — близько до ліміту 5 МБ`,
        hint: 'Очисти кошик і старі логи'
      });
    } else if (size > 2 * 1024 * 1024) {
      checks.push({ name: 'Обсяг', status: 'warn', message: `${sizeMB} МБ` });
    } else {
      checks.push({ name: 'Обсяг', status: 'ok', message: `${sizeMB} МБ` });
    }
  } catch (e) {
    checks.push({ name: 'Обсяг', status: 'warn', message: 'Не вдалося виміряти' });
  }

  // 3. API ключ
  const hasKey = !!localStorage.getItem('nm_gemini_key');
  checks.push({
    name: 'API ключ',
    status: hasKey ? 'ok' : 'fail',
    message: hasKey ? 'Присутній' : 'Відсутній',
    hint: hasKey ? null : 'Налаштування → OpenAI API ключ'
  });

  // 4. Service Worker
  const swActive = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  checks.push({
    name: 'Service Worker',
    status: swActive ? 'ok' : 'warn',
    message: swActive ? 'Активний' : 'Не активний',
    hint: swActive ? null : 'Застосунок не працюватиме офлайн'
  });

  // 5. Онбординг
  const onboardingDone = !!localStorage.getItem('nm_onboarding_done');
  checks.push({
    name: 'Онбординг',
    status: onboardingDone ? 'ok' : 'warn',
    message: onboardingDone ? 'Пройдено' : 'Не пройдено',
    hint: onboardingDone ? null : 'Покажеться при наступному запуску'
  });

  // 6. Критичні дані — tasks/notes/habits (parseable + count)
  const dataKeys = [
    { key: 'nm_tasks', label: 'Задачі' },
    { key: 'nm_notes', label: 'Нотатки' },
    { key: 'nm_habits2', label: 'Звички' },
    { key: 'nm_finance', label: 'Операції' },
  ];
  for (const { key, label } of dataKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      checks.push({ name: label, status: 'ok', message: '0 записів' });
      continue;
    }
    try {
      const arr = JSON.parse(raw);
      const n = Array.isArray(arr) ? arr.length : 0;
      checks.push({ name: label, status: 'ok', message: `${n} записів` });
    } catch (e) {
      checks.push({
        name: label,
        status: 'fail',
        message: 'Зламаний JSON',
        hint: `Ключ ${key} пошкоджений — експортуй логи ДО дій`
      });
    }
  }

  // 7. OWL Auto-silence (активне мовчання)
  try {
    const silenceUntil = parseInt(localStorage.getItem('nm_owl_silence_until') || '0');
    if (silenceUntil > Date.now()) {
      const mins = Math.ceil((silenceUntil - Date.now()) / 60000);
      checks.push({
        name: 'OWL Auto-silence',
        status: 'warn',
        message: `Активний ще ${mins} хв`,
        hint: 'Натисни чіп щоб скинути, або очисти у консолі'
      });
    }
  } catch (e) {}

  // 8. Застаріле повідомлення табло (ознака залиплого _boardGenerating)
  try {
    const attemptTs = parseInt(localStorage.getItem('nm_owl_board_ts') || '0');
    // Шар 2 "Один мозок V2" (rJYkw 21.04): читаємо з unified storage
    const msgs = JSON.parse(localStorage.getItem('nm_owl_board_unified') || '[]');
    const msgTs = msgs[0]?.ts || msgs[0]?.id || 0;
    const sinceAttempt = Date.now() - attemptTs;
    const sinceMsg = Date.now() - msgTs;
    if (attemptTs > 0 && sinceAttempt > 2 * 60 * 60 * 1000 && sinceMsg > 2 * 60 * 60 * 1000) {
      checks.push({
        name: 'OWL табло',
        status: 'warn',
        message: `Не оновлюється ${Math.round(sinceAttempt / 3600000)} год`,
        hint: 'Можливо прапорець генерації залип. Перезапусти застосунок.'
      });
    }
  } catch (e) {}

  // 9. Критичні глобальні функції (перевірка що bundle.js зібрався)
  const criticalGlobals = ['switchTab', 'showErrorLog', 'sendOwlReply', 'toggleOwlTabChat'];
  const missing = criticalGlobals.filter(g => typeof window[g] !== 'function');
  if (missing.length > 0) {
    checks.push({
      name: 'Модулі',
      status: 'fail',
      message: `Не завантажено: ${missing.join(', ')}`,
      hint: 'Bundle не зібрався. Зроби hard refresh.'
    });
  } else {
    checks.push({ name: 'Модулі', status: 'ok', message: 'Завантажені' });
  }

  return checks;
}

export function renderHealthCheck() {
  const checks = runHealthCheck();
  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;

  const overall = fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'ok';
  const overallIcon = { ok: '✓', warn: '⚠', fail: '✗' }[overall];
  const overallText = fails > 0
    ? `${fails} критичних ${fails === 1 ? 'проблема' : 'проблем'}`
    : warns > 0 ? `${warns} ${warns === 1 ? 'попередження' : 'попереджень'}` : 'Усе гаразд';
  const overallColor = { ok: '#16a34a', warn: '#b45309', fail: '#dc2626' }[overall];
  const overallBg = { ok: 'rgba(34,197,94,0.08)', warn: 'rgba(251,191,36,0.12)', fail: 'rgba(239,68,68,0.08)' }[overall];
  const overallBorder = { ok: 'rgba(34,197,94,0.25)', warn: 'rgba(251,191,36,0.35)', fail: 'rgba(239,68,68,0.3)' }[overall];

  const statusIcon = { ok: '✓', warn: '⚠', fail: '✗' };
  const statusColor = { ok: '#16a34a', warn: '#b45309', fail: '#dc2626' };

  return `<div style="margin:12px 14px 0;padding:14px 16px;background:${overallBg};border:1px solid ${overallBorder};border-radius:12px">
    <div onclick="toggleHealthDetails()" style="display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <span style="font-size:22px;color:${overallColor};line-height:1;flex-shrink:0">${overallIcon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:800;color:${overallColor};text-transform:uppercase;letter-spacing:0.5px">Стан систем</div>
        <div style="font-size:14px;color:#1e1040;font-weight:700;margin-top:1px">${overallText}</div>
      </div>
      <span id="health-expand-arrow" style="font-size:14px;color:rgba(30,16,64,0.5);flex-shrink:0">▸</span>
    </div>
    <div id="health-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid ${overallBorder};flex-direction:column;gap:8px">
      ${checks.map(c => `
        <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.4">
          <span style="color:${statusColor[c.status]};font-weight:800;flex-shrink:0;width:14px;font-size:13px">${statusIcon[c.status]}</span>
          <div style="flex:1;min-width:0">
            <div><span style="color:#1e1040;font-weight:600">${c.name}:</span><span style="color:rgba(30,16,64,0.75)"> ${c.message}</span></div>
            ${c.hint ? `<div style="color:rgba(30,16,64,0.55);font-size:12px;margin-top:3px;font-style:italic">${c.hint}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function toggleHealthDetails() {
  const details = document.getElementById('health-details');
  const arrow = document.getElementById('health-expand-arrow');
  if (!details) return;
  const isOpen = details.style.display === 'flex';
  details.style.display = isOpen ? 'none' : 'flex';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}

// ============================================================
// Smoke Tests — базові авто-тести що застосунок коректно працює
// Виконуються при рендері діагностики або вручну.
// Тимчасовий ключ __nm_smoke_test__ ізольований від юзерських даних.
// ============================================================

const SMOKE_TEST_KEY = '__nm_smoke_test__';

export function runSmokeTests() {
  const tests = [];
  const start = performance.now();

  // 1. localStorage write/read/delete
  tests.push(_runTest('Сховище write/read', () => {
    const payload = { v: 'ok', ts: Date.now() };
    localStorage.setItem(SMOKE_TEST_KEY, JSON.stringify(payload));
    const read = JSON.parse(localStorage.getItem(SMOKE_TEST_KEY));
    if (read.v !== 'ok') throw new Error('Read value mismatch');
    localStorage.removeItem(SMOKE_TEST_KEY);
    if (localStorage.getItem(SMOKE_TEST_KEY) !== null) throw new Error('Remove не спрацював');
  }));

  // 2. JSON парсинг критичних ключів — має бути масивом
  const arrayKeys = ['nm_tasks', 'nm_notes', 'nm_habits2', 'nm_finance', 'nm_trash',
                     'nm_moments', 'nm_projects', 'nm_events', 'nm_health_cards', 'nm_inbox'];
  tests.push(_runTest('JSON цілісність (масиви)', () => {
    const broken = [];
    for (const k of arrayKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (!Array.isArray(v)) broken.push(`${k}:не-масив`);
      } catch (e) {
        broken.push(`${k}:invalid`);
      }
    }
    if (broken.length) throw new Error(broken.join(', '));
  }));

  // 3. JSON парсинг об'єктних ключів
  const objectKeys = ['nm_settings', 'nm_habit_log2', 'nm_quit_log', 'nm_finance_budget',
                      'nm_finance_cats', 'nm_folders_meta'];
  tests.push(_runTest('JSON цілісність (об\'єкти)', () => {
    const broken = [];
    for (const k of objectKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const v = JSON.parse(raw);
        if (typeof v !== 'object' || v === null) broken.push(`${k}:не-об'єкт`);
      } catch (e) {
        broken.push(`${k}:invalid`);
      }
    }
    if (broken.length) throw new Error(broken.join(', '));
  }));

  // 4. Date формати
  tests.push(_runTest('Формат дат', () => {
    const iso = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`ISO date broken: ${iso}`);
    const utc = new Date().toDateString();
    if (!utc || utc.length < 10) throw new Error(`toDateString broken: ${utc}`);
  }));

  // 5. Критичні DOM елементи
  tests.push(_runTest('DOM структура', () => {
    const required = ['log-panel', 'toast', 'tab-bar', 'onboarding', 'splash'];
    const missing = required.filter(id => !document.getElementById(id));
    if (missing.length) throw new Error('відсутні: ' + missing.join(', '));
  }));

  // 6. Критичні глобальні функції у window
  tests.push(_runTest('Глобальні функції', () => {
    const required = ['switchTab', 'showErrorLog', 'sendOwlReply', 'toggleOwlTabChat',
                      'scrollOwlTabChips', 'closeLogPanel', 'copyLogForClaude'];
    const missing = required.filter(g => typeof window[g] !== 'function');
    if (missing.length) throw new Error('відсутні: ' + missing.join(', '));
  }));

  // 7. CSS-змінна висоти таббару
  tests.push(_runTest('CSS --tabbar-h', () => {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h');
    if (!val || val.trim() === '') throw new Error('не встановлена');
  }));

  // 8. Event dispatcher (nm-data-changed)
  tests.push(_runTest('Event система', () => {
    let received = false;
    const handler = e => { if (e.detail === 'smoke-test') received = true; };
    window.addEventListener('nm-data-changed', handler);
    window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'smoke-test' }));
    window.removeEventListener('nm-data-changed', handler);
    if (!received) throw new Error('nm-data-changed не отримано');
  }));

  // 9. Clipboard API (не критично, але хочемо знати)
  tests.push(_runTest('Clipboard API', () => {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('недоступний');
    }
  }));

  const totalMs = Math.round(performance.now() - start);
  return { tests, totalMs };
}

function _runTest(name, fn) {
  const start = performance.now();
  try {
    fn();
    const ms = Math.round((performance.now() - start) * 10) / 10;
    return { name, status: 'pass', message: 'ok', ms };
  } catch (e) {
    const ms = Math.round((performance.now() - start) * 10) / 10;
    return { name, status: 'fail', message: e.message || String(e), ms };
  }
}

export function renderSmokeTests() {
  const { tests, totalMs } = runSmokeTests();
  const fails = tests.filter(t => t.status === 'fail').length;
  const passes = tests.length - fails;

  const overall = fails > 0 ? 'fail' : 'ok';
  const overallIcon = fails > 0 ? '✗' : '✓';
  const overallText = fails > 0
    ? `${passes}/${tests.length} пройшли · ${fails} провал`
    : `${tests.length}/${tests.length} пройшли · ${totalMs}мс`;
  const overallColor = fails > 0 ? '#dc2626' : '#16a34a';
  const overallBg = fails > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
  const overallBorder = fails > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)';

  const statusIcon = { pass: '✓', fail: '✗' };
  const statusColor = { pass: '#16a34a', fail: '#dc2626' };

  return `<div style="margin:10px 14px 0;padding:14px 16px;background:${overallBg};border:1px solid ${overallBorder};border-radius:12px">
    <div onclick="toggleSmokeDetails()" style="display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <span style="font-size:22px;color:${overallColor};line-height:1;flex-shrink:0">${overallIcon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:800;color:${overallColor};text-transform:uppercase;letter-spacing:0.5px">Smoke тести</div>
        <div style="font-size:14px;color:#1e1040;font-weight:700;margin-top:1px">${overallText}</div>
      </div>
      <span id="smoke-expand-arrow" style="font-size:14px;color:rgba(30,16,64,0.5);flex-shrink:0">▸</span>
    </div>
    <div id="smoke-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid ${overallBorder};flex-direction:column;gap:6px">
      ${tests.map(t => `
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.4">
          <span style="color:${statusColor[t.status]};font-weight:800;flex-shrink:0;width:14px">${statusIcon[t.status]}</span>
          <div style="flex:1;min-width:0">
            <span style="color:#1e1040;font-weight:600">${t.name}</span>
            ${t.status === 'fail' ? `<span style="color:#dc2626"> — ${t.message}</span>` : ''}
          </div>
          <span style="font-size:11px;color:rgba(30,16,64,0.5);font-family:ui-monospace,Menlo,monospace;flex-shrink:0">${t.ms}мс</span>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function toggleSmokeDetails() {
  const details = document.getElementById('smoke-details');
  const arrow = document.getElementById('smoke-expand-arrow');
  if (!details) return;
  const isOpen = details.style.display === 'flex';
  details.style.display = isOpen ? 'none' : 'flex';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}

// ============================================================
// Performance Monitor — автоматично моніторить:
//   - Startup time (від старту до domContentLoadedEnd)
//   - Long tasks (>50мс — блокування UI, Safari не підтримує longtask API)
//   - Fetch calls (monkey-patch window.fetch — API latency, помилки)
// Запускається одразу при імпорті модуля.
// ============================================================

const _perfData = {
  longTasks: [],
  fetches: [],
  startupMs: null,
  longTaskSupported: false,
};
const MAX_FETCHES = 30;
const MAX_LONGTASKS = 20;

function _initPerformanceMonitor() {
  // Startup time з Navigation Timing API
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav) {
      const dcl = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      _perfData.startupMs = dcl > 0 ? dcl : null;
    }
  } catch (e) {}
  // Якщо DCL ще не наступив — дочекатись
  if (!_perfData.startupMs) {
    window.addEventListener('DOMContentLoaded', () => {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav) _perfData.startupMs = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      } catch (e) {}
    }, { once: true });
  }

  // Long tasks (>50мс блокують головний потік)
  try {
    const supported = typeof PerformanceObserver !== 'undefined'
      && PerformanceObserver.supportedEntryTypes?.includes('longtask');
    if (supported) {
      _perfData.longTaskSupported = true;
      const obs = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          _perfData.longTasks.push({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
            ts: Date.now(),
          });
          if (_perfData.longTasks.length > MAX_LONGTASKS) _perfData.longTasks.shift();
        }
      });
      obs.observe({ entryTypes: ['longtask'] });
    }
  } catch (e) {}

  // Monkey-patch window.fetch — ловимо всі HTTP-запити
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      const start = performance.now();
      const url = typeof input === 'string' ? input : (input?.url || '');
      const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const record = (status, error) => {
        const duration = Math.round(performance.now() - start);
        _perfData.fetches.push({
          url: _shortenUrl(url),
          method,
          duration,
          status,
          error: error || null,
          ts: Date.now(),
        });
        if (_perfData.fetches.length > MAX_FETCHES) _perfData.fetches.shift();
      };
      return origFetch(input, init).then(
        res => { record(res.status); return res; },
        err => { record(0, err?.message || 'Network error'); throw err; }
      );
    };
  } catch (e) {}
}

function _shortenUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    const path = u.pathname.length > 40 ? u.pathname.slice(0, 37) + '...' : u.pathname;
    return u.host + path;
  } catch {
    return String(url).slice(0, 60);
  }
}

// Ініціалізуємо одразу при імпорті
_initPerformanceMonitor();

export function getPerformanceData() {
  return {
    longTasks: _perfData.longTasks.slice(),
    fetches: _perfData.fetches.slice(),
    startupMs: _perfData.startupMs,
    longTaskSupported: _perfData.longTaskSupported,
  };
}

export function renderPerformance() {
  const data = getPerformanceData();

  // Startup
  const startupStr = data.startupMs != null ? `${data.startupMs}мс` : 'невідомо';
  const startupStatus = data.startupMs == null ? 'unknown'
    : data.startupMs < 1500 ? 'ok'
    : data.startupMs < 3000 ? 'warn' : 'fail';

  // Long tasks
  const longTasksCount = data.longTasks.length;
  const worstLongTask = data.longTasks.reduce((max, t) => t.duration > max ? t.duration : max, 0);
  const longTasksStatus = !data.longTaskSupported ? 'unknown'
    : longTasksCount === 0 ? 'ok'
    : worstLongTask > 200 ? 'warn' : 'ok';

  // Fetches
  const okFetches = data.fetches.filter(f => f.status >= 200 && f.status < 400);
  const failedFetches = data.fetches.filter(f => f.status === 0 || f.status >= 400);
  const avgFetchMs = okFetches.length > 0
    ? Math.round(okFetches.reduce((s, f) => s + f.duration, 0) / okFetches.length)
    : 0;
  const slowFetches = data.fetches.filter(f => f.duration > 3000);
  const fetchStatus = failedFetches.length > 0 ? 'fail'
    : slowFetches.length > 0 ? 'warn' : 'ok';

  // Overall
  const statuses = [startupStatus, longTasksStatus, fetchStatus].filter(s => s !== 'unknown');
  const overall = statuses.includes('fail') ? 'fail'
    : statuses.includes('warn') ? 'warn' : 'ok';

  const overallIcon = { ok: '✓', warn: '⚠', fail: '✗' }[overall];
  const overallColor = { ok: '#16a34a', warn: '#b45309', fail: '#dc2626' }[overall];
  const overallBg = { ok: 'rgba(34,197,94,0.08)', warn: 'rgba(251,191,36,0.12)', fail: 'rgba(239,68,68,0.08)' }[overall];
  const overallBorder = { ok: 'rgba(34,197,94,0.25)', warn: 'rgba(251,191,36,0.35)', fail: 'rgba(239,68,68,0.3)' }[overall];

  const summaryParts = [];
  summaryParts.push(`Старт ${startupStr}`);
  if (data.longTaskSupported) summaryParts.push(`${longTasksCount} лагів`);
  summaryParts.push(`${data.fetches.length} запитів`);
  if (failedFetches.length > 0) summaryParts.push(`${failedFetches.length} з помилкою`);
  const overallText = summaryParts.join(' · ');

  const statusIcon = { ok: '✓', warn: '⚠', fail: '✗', unknown: '·' };
  const statusColor = { ok: '#16a34a', warn: '#b45309', fail: '#dc2626', unknown: 'rgba(30,16,64,0.45)' };

  const rows = [];

  // Startup
  rows.push(`<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.4">
    <span style="color:${statusColor[startupStatus]};font-weight:800;flex-shrink:0;width:14px">${statusIcon[startupStatus]}</span>
    <div style="flex:1;min-width:0">
      <span style="color:#1e1040;font-weight:600">Час запуску</span>
      <span style="color:rgba(30,16,64,0.7)">: ${startupStr}</span>
    </div>
  </div>`);

  // Long tasks
  if (data.longTaskSupported) {
    const msg = longTasksCount === 0
      ? 'немає'
      : `${longTasksCount} (найдовший ${worstLongTask}мс)`;
    rows.push(`<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.4">
      <span style="color:${statusColor[longTasksStatus]};font-weight:800;flex-shrink:0;width:14px">${statusIcon[longTasksStatus]}</span>
      <div style="flex:1;min-width:0">
        <span style="color:#1e1040;font-weight:600">Лаги UI >50мс</span>
        <span style="color:rgba(30,16,64,0.7)">: ${msg}</span>
      </div>
    </div>`);
  } else {
    rows.push(`<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.4">
      <span style="color:${statusColor.unknown};font-weight:800;flex-shrink:0;width:14px">·</span>
      <div style="flex:1;min-width:0">
        <span style="color:rgba(30,16,64,0.6);font-weight:600">Лаги UI</span>
        <span style="color:rgba(30,16,64,0.55);font-style:italic">: Safari не підтримує цей API</span>
      </div>
    </div>`);
  }

  // Fetches summary
  const fetchMsg = data.fetches.length === 0
    ? 'ще не було'
    : `${data.fetches.length} запитів · середній ${avgFetchMs}мс` + (failedFetches.length > 0 ? ` · ${failedFetches.length} з помилкою` : '');
  rows.push(`<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.4">
    <span style="color:${statusColor[fetchStatus]};font-weight:800;flex-shrink:0;width:14px">${statusIcon[fetchStatus]}</span>
    <div style="flex:1;min-width:0">
      <span style="color:#1e1040;font-weight:600">HTTP запити</span>
      <span style="color:rgba(30,16,64,0.7)">: ${fetchMsg}</span>
    </div>
  </div>`);

  // Останні 5 запитів (детально)
  if (data.fetches.length > 0) {
    const recent = data.fetches.slice(-5).reverse();
    rows.push('<div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(30,16,64,0.1)"><div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.55);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Останні запити</div>' +
      recent.map(f => {
        const col = f.status === 0 || f.status >= 400 ? '#dc2626' : f.duration > 3000 ? '#b45309' : '#16a34a';
        const statusStr = f.status === 0 ? 'FAIL' : String(f.status);
        return `<div style="font-size:11px;line-height:1.5;font-family:ui-monospace,Menlo,monospace;color:rgba(30,16,64,0.85);display:flex;gap:8px;align-items:baseline">
          <span style="color:${col};font-weight:700;flex-shrink:0;width:44px">${statusStr}</span>
          <span style="color:rgba(30,16,64,0.55);flex-shrink:0;width:48px">${f.duration}мс</span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.method} ${f.url}</span>
        </div>`;
      }).join('') +
      '</div>');
  }

  return `<div style="margin:10px 14px 0;padding:14px 16px;background:${overallBg};border:1px solid ${overallBorder};border-radius:12px">
    <div onclick="togglePerfDetails()" style="display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">
      <span style="font-size:22px;color:${overallColor};line-height:1;flex-shrink:0">${overallIcon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:800;color:${overallColor};text-transform:uppercase;letter-spacing:0.5px">Performance</div>
        <div style="font-size:13px;color:#1e1040;font-weight:700;margin-top:1px">${overallText}</div>
      </div>
      <span id="perf-expand-arrow" style="font-size:14px;color:rgba(30,16,64,0.5);flex-shrink:0">▸</span>
    </div>
    <div id="perf-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid ${overallBorder};flex-direction:column;gap:8px">
      ${rows.join('')}
    </div>
  </div>`;
}

function togglePerfDetails() {
  const details = document.getElementById('perf-details');
  const arrow = document.getElementById('perf-expand-arrow');
  if (!details) return;
  const isOpen = details.style.display === 'flex';
  details.style.display = isOpen ? 'none' : 'flex';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
}

// Functions called from HTML event handlers
Object.assign(window, { toggleHealthDetails, toggleSmokeDetails, togglePerfDetails });
