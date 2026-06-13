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

import { t } from '../core/utils.js';
import { currentTab } from '../core/nav.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
// Реєстр барів для живого діалогу (Jarvis-петля): tab → запустити слухання.
const _bars = {};
const SUPPORTED = !!SR;

const MIC_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

function createMicButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-btn';
  btn.setAttribute('aria-label', t('voice.input', 'Голосовий ввід'));
  btn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.2s,transform 0.2s';
  btn.innerHTML = MIC_SVG;
  return btn;
}

function attachVoiceToTextarea(textarea, button, sendBtn) {
  if (!SUPPORTED || !textarea || !button) return;
  if (button.dataset.voiceAttached === '1') return;
  button.dataset.voiceAttached = '1';

  let rec = null;
  let baseText = '';
  let pendingSendClick = false;

  function startRecording() {
    if (rec) return;
    // qpzj7k (Council): заткнути голос OWL перш ніж слухати — інакше мік ловить
    // власну озвучку у транскрипцію.
    try { window.nmVoiceStop && window.nmVoiceStop(); } catch (e) {}
    try {
      rec = new SR();
      rec.lang = 'uk-UA';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
    } catch (e) {
      try { window.showToast && window.showToast(t('voice.unavailable', 'Голосовий ввід недоступний')); } catch {}
      rec = null;
      return;
    }

    baseText = textarea.value ? (textarea.value + (textarea.value.endsWith(' ') ? '' : ' ')) : '';
    button.classList.add('recording');
    // Живий діалог: у голосовому режимі після паузи авто-надсилаємо (без тапу).
    try { if (window.nmVoiceIsOn && window.nmVoiceIsOn()) pendingSendClick = true; } catch (e) {}

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
      // no-speech/aborted — нормально під час діалогу, БЕЗ toast (Роман: «помилка
      // мікрофона» вискакувала постійно).
      if (err === 'no-speech' || err === 'aborted') return;
      let msg = t('voice.error_mic', 'Помилка мікрофона');
      if (err === 'not-allowed' || err === 'service-not-allowed') msg = t('voice.error_permission', 'Дозволь мікрофон у налаштуваннях');
      else if (err === 'network') msg = t('voice.error_network', 'Немає інтернету для розпізнавання');
      try { window.showToast && window.showToast(msg); } catch {}
    };

    rec.onend = () => {
      button.classList.remove('recording');
      rec = null;
      try { textarea.focus(); } catch {}
      const hasContent = (textarea.value || '').trim().length > 0;
      // Авто-надсилання: у голосовому режимі ЗАВЖДИ (не лише за pendingSendClick) —
      // інакше після диктування доводилось тиснути «відправити» вручну (Роман).
      let voiceOn = false;
      try { voiceOn = !!(window.nmVoiceIsOn && window.nmVoiceIsOn()); } catch (e) {}
      if (sendBtn && hasContent && (pendingSendClick || voiceOn)) {
        pendingSendClick = false;
        try { window.__nm_inputMode = 'voice'; } catch {}
        setTimeout(() => { try { sendBtn.click(); } catch {} }, 60);
      } else {
        pendingSendClick = false;
      }
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

  if (sendBtn && !sendBtn.dataset.voiceIntercept) {
    sendBtn.dataset.voiceIntercept = '1';
    sendBtn.addEventListener('click', (ev) => {
      if (rec) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        pendingSendClick = true;
        stopRecording();
      }
    }, true);
  }

  // Реєструємо бар для живого діалогу — щоб voice-output міг запустити слухання
  // після того як OWL договорив (Jarvis-петля).
  const tab = textarea.dataset.tab;
  if (tab) _bars[tab] = { start: startRecording, isRec: () => !!rec };
}

// Жива петля: запустити слухання на активній вкладці (викликає voice-output
// після завершення озвучки, якщо голосовий режим увімкнено).
if (typeof window !== 'undefined') {
  window.nmStartListening = () => {
    try {
      const b = _bars[currentTab];
      if (b && !b.isRec()) b.start();
    } catch (e) {}
  };
}

function initVoiceInput() {
  if (!SUPPORTED) return;

  const existingInboxBtn = document.querySelector('#inbox-ai-bar .ai-bar-input-box > button[disabled]');
  if (existingInboxBtn) {
    existingInboxBtn.removeAttribute('disabled');
    existingInboxBtn.style.opacity = '';
    existingInboxBtn.classList.add('voice-btn');
    const inboxInput = document.getElementById('inbox-input');
    const inboxSend = document.getElementById('ai-send-btn') || document.querySelector('#inbox-ai-bar .ai-bar-send-btn');
    if (inboxInput) attachVoiceToTextarea(inboxInput, existingInboxBtn, inboxSend);
  }

  const boxes = document.querySelectorAll('.ai-bar-new .ai-bar-input-box');
  boxes.forEach(box => {
    const textarea = box.querySelector('textarea');
    // qpzj7k: виключаємо кнопку 🖼 (pick-chat-image) — вона теж .ai-bar-send-btn,
    // але справжня send-кнопка та що НЕ відкриває фото.
    const sendBtn = box.querySelector('.ai-bar-send-btn:not([data-action="pick-chat-image"])');
    if (!textarea || !sendBtn) return;
    if (box.querySelector('.voice-btn')) return;

    const micBtn = createMicButton();
    box.insertBefore(micBtn, sendBtn);
    attachVoiceToTextarea(textarea, micBtn, sendBtn);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceInput);
} else {
  setTimeout(initVoiceInput, 0);
}

window.initVoiceInput = initVoiceInput;
