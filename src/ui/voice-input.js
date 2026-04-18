// ============================================================
// ui/voice-input.js — Голосовий ввід у чат-бари через Web Speech API
// Створено 18.04.2026 (сесія VJF2M)
// ============================================================
//
// Що робить:
//   - Автоматично додає кнопку 🎤 у кожен чат-бар при DOMContentLoaded
//   - Натиск → запис голосу через SpeechRecognition (lang='uk-UA')
//   - Результат підставляється у textarea (interim + final)
//   - Пауза → автостоп, друге натискання → ручний стоп
//   - Червоне підсвічування під час запису
//   - Fallback: якщо браузер не підтримує API — кнопка просто не з'являється
// ============================================================

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SUPPORTED = !!SR;

const MIC_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

function createMicButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-btn';
  btn.setAttribute('aria-label', 'Голосовий ввід');
  btn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.2s,transform 0.2s';
  btn.innerHTML = MIC_SVG;
  return btn;
}

function attachVoiceToTextarea(textarea, button) {
  if (!SUPPORTED || !textarea || !button) return;
  if (button.dataset.voiceAttached === '1') return;
  button.dataset.voiceAttached = '1';

  let rec = null;
  let baseText = '';

  function startRecording() {
    if (rec) return;
    try {
      rec = new SR();
      rec.lang = 'uk-UA';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
    } catch (e) {
      try { window.showToast && window.showToast('Голосовий ввід недоступний'); } catch {}
      rec = null;
      return;
    }

    baseText = textarea.value ? (textarea.value + (textarea.value.endsWith(' ') ? '' : ' ')) : '';
    button.classList.add('recording');

    rec.onresult = (ev) => {
      let interim = '';
      let fin = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const txt = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += txt;
        else interim += txt;
      }
      textarea.value = baseText + fin + interim;
      if (fin) baseText = textarea.value;
      try { window.autoResizeTextarea && window.autoResizeTextarea(textarea); } catch {}
    };

    rec.onerror = (ev) => {
      const err = ev.error || '';
      let msg = 'Помилка мікрофона';
      if (err === 'not-allowed' || err === 'service-not-allowed') msg = 'Дозволь мікрофон у налаштуваннях';
      else if (err === 'no-speech') msg = 'Не чую голосу';
      else if (err === 'network') msg = 'Немає інтернету для розпізнавання';
      try { window.showToast && window.showToast(msg); } catch {}
    };

    rec.onend = () => {
      button.classList.remove('recording');
      rec = null;
      try { textarea.focus(); } catch {}
    };

    try {
      rec.start();
    } catch (e) {
      button.classList.remove('recording');
      rec = null;
    }
  }

  function stopRecording() {
    if (!rec) return;
    try { rec.stop(); } catch {}
  }

  button.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (rec) stopRecording();
    else startRecording();
  });
}

function initVoiceInput() {
  if (!SUPPORTED) return;

  const existingInboxBtn = document.querySelector('#inbox-ai-bar .ai-bar-input-box > button[disabled]');
  if (existingInboxBtn) {
    existingInboxBtn.removeAttribute('disabled');
    existingInboxBtn.style.opacity = '';
    existingInboxBtn.classList.add('voice-btn');
    const inboxInput = document.getElementById('inbox-input');
    if (inboxInput) attachVoiceToTextarea(inboxInput, existingInboxBtn);
  }

  const boxes = document.querySelectorAll('.ai-bar-new .ai-bar-input-box');
  boxes.forEach(box => {
    const textarea = box.querySelector('textarea');
    const sendBtn = box.querySelector('.ai-bar-send-btn');
    if (!textarea || !sendBtn) return;
    if (box.querySelector('.voice-btn')) return;

    const micBtn = createMicButton();
    box.insertBefore(micBtn, sendBtn);
    attachVoiceToTextarea(textarea, micBtn);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceInput);
} else {
  setTimeout(initVoiceInput, 0);
}

window.initVoiceInput = initVoiceInput;
