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
    const msgs = JSON.parse(localStorage.getItem('nm_owl_board') || '[]');
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

// Functions called from HTML event handlers
Object.assign(window, { toggleHealthDetails });
