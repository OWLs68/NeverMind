// src/ui/voice-output.js
//
// Голос OWL (qpzj7k, Council-hardened): TTS — OWL озвучує табло (тап на 🔊) і
// відповіді в чаті (voice mode). Двигун: OpenAI tts-1 (природний голос), fallback
// браузерний speechSynthesis (безкоштовно) при перевищенні ліміту/без ключа.
//
// ЛІМІТИ (Роман: «не влетіти фінансово»):
//   - стеля довжини на озвучку (довге ріжемо);
//   - денний ліміт символів (резервуємо ДО виклику — без гонки) → fallback браузер;
//   - voice mode за замовч. ВИМКНЕНО (opt-in).
// iOS (Council 🍎):
//   - autoplay блокується без user-gesture → unlockAudio() на першому тапі +
//     при toggle voice mode (теж тап);
//   - не озвучуємо коли застосунок у фоні (document.hidden);
//   - browser-голос через onvoiceschanged (getVoices порожній синхронно).
// Фільтр спаму (Council 🕵️): озвучуємо лише змістовні репліки активної вкладки,
// не «✓ Зроблено» / tool-підтвердження; dedup однакового тексту.

import { t, getLang } from '../core/utils.js';
import { showToast, currentTab } from '../core/nav.js';
import { logTtsUsage } from '../core/usage-meter.js';
import { getSettings, updateSettings } from '../core/settings.js';
import { openChatBar } from '../ai/core.js';

// Живий діалог працює ЛИШЕ коли відкритий чат (Роман) — бо є куди говорити.
function _chatOpen() { try { return !!document.querySelector('.ai-bar-chat-window.open'); } catch (e) { return false; } }

// Інструкція вимови та locale браузерного голосу — за мовою застосунку
// (getLang). Додаємо мови сюди коли зʼявляються (forward-looking під i18n).
const TTS_INSTRUCTIONS = {
  uk: 'Speak in natural, fluent Ukrainian with correct Ukrainian pronunciation and a warm, calm, friendly tone. Do not use an English or Russian accent.',
  en: 'Speak in natural, fluent English with a warm, calm, friendly tone.',
};
const BROWSER_LOCALE = { uk: 'uk-UA', en: 'en-US' };
function _ttsInstruction() { return TTS_INSTRUCTIONS[getLang()] || TTS_INSTRUCTIONS.uk; }
function _browserLocale() { return BROWSER_LOCALE[getLang()] || 'uk-UA'; }

const VOICE_MODE_KEY = 'nm_voice_mode';
const TTS_USAGE_KEY = 'nm_tts_usage';        // {date:'YYYY-MM-DD', chars:N}
const MAX_CHARS_PER_UTTERANCE = 500;
const DAILY_CHAR_CAP = 12000;                 // ~$0.18/день стеля OpenAI TTS
const DEFAULT_OPENAI_VOICE = 'nova';
const DEFAULT_ELEVEN_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel (multilingual, тепла)

// Налаштування голосу з nm_settings (вибір у Налаштуваннях → блок «Голос Агента»).
function _settings() { return getSettings(); }
function _openaiVoice() { return _settings().ttsVoice || DEFAULT_OPENAI_VOICE; }
function _elevenKey() { return (_settings().elevenKey || '').trim(); }
function _elevenVoice() { return _settings().elevenVoiceId || DEFAULT_ELEVEN_VOICE; }
// 0.05с тиша — розблокування аудіо на iOS (один раз з user-gesture).
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';

let _audio = null;
let _audioUnlocked = false;
let _capWarned = false;
let _lastSpoken = '';
let _lastSpokenTs = 0;

export function isVoiceMode() { return localStorage.getItem(VOICE_MODE_KEY) === '1'; }
export function setVoiceMode(on) {
  localStorage.setItem(VOICE_MODE_KEY, on ? '1' : '0');
  try { window.dispatchEvent(new CustomEvent('nm-voice-mode-changed', { detail: { on: !!on } })); } catch (e) {}
}
export function toggleVoiceMode() {
  unlockAudio();                 // тап = user-gesture → розблоковуємо iOS-аудіо
  const next = !isVoiceMode();
  setVoiceMode(next);
  if (!next) stopSpeaking();
  return next;
}

// iOS: розблокувати відтворення (програти 0с тиші + порожній utterance) — один
// раз, з user-gesture. Далі авто-озвучка у цій сесії дозволена.
export function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  try { const s = new Audio(SILENT_WAV); s.play().catch(() => {}); } catch (e) {}
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }
  } catch (e) {}
}

export function stopSpeaking() {
  try { if (_audio) { _audio.pause(); _audio = null; } } catch (e) {}
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
}

function _todayStr() { return new Date().toISOString().slice(0, 10); }
function _ttsCharsToday() {
  try {
    const u = JSON.parse(localStorage.getItem(TTS_USAGE_KEY) || '{}');
    return u.date === _todayStr() ? (u.chars || 0) : 0;
  } catch (e) { return 0; }
}
function _addTtsChars(n) {
  const chars = _ttsCharsToday() + n;
  try { localStorage.setItem(TTS_USAGE_KEY, JSON.stringify({ date: _todayStr(), chars })); } catch (e) {}
}

function _browserVoices() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve([]); return; }
    let v = window.speechSynthesis.getVoices();
    if (v && v.length) { resolve(v); return; }
    let done = false;
    window.speechSynthesis.onvoiceschanged = () => { if (!done) { done = true; resolve(window.speechSynthesis.getVoices() || []); } };
    setTimeout(() => { if (!done) { done = true; resolve(window.speechSynthesis.getVoices() || []); } }, 600);
  });
}

async function _speakBrowser(text) {
  try {
    if (!window.speechSynthesis) return;
    const voices = await _browserVoices();
    const u = new SpeechSynthesisUtterance(text);
    const loc = _browserLocale();
    u.lang = loc;
    const pref = loc.slice(0, 2);
    const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(pref));
    if (v) u.voice = v;
    u.onend = () => _afterSpeak();
    window.speechSynthesis.cancel();
    setTimeout(() => { try { window.speechSynthesis.speak(u); } catch (e) {} }, 50); // iOS 17 quirk
  } catch (e) {}
}

async function _speakOpenAI(text, key) {
  // tts-1 — надійна + низьколатентна, приймає вибраний голос. (gpt-4o-mini-tts
  // не на всіх ключах → падало на браузерний голос. Точність укр-вимови без
  // акценту — через ElevenLabs.)
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'tts-1',
      voice: _openaiVoice(),
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error('tts ' + res.status);
  const blob = await res.blob();
  await _playBlob(blob);
}

async function _playBlob(blob) {
  const url = URL.createObjectURL(blob);
  stopSpeaking();
  _audio = new Audio(url);
  _audio.onended = () => { try { URL.revokeObjectURL(url); } catch (e) {} _audio = null; _afterSpeak(); };
  await _audio.play();
}

// Жива петля (Jarvis): коли OWL договорив і голосовий режим увімкнено —
// автоматично починаємо слухати юзера. Так розмова йде без тапів.
function _afterSpeak() {
  if (!isVoiceMode()) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!_chatOpen()) return; // лише поки чат відкритий
  setTimeout(() => { try { if (window.nmStartListening) window.nmStartListening(); } catch (e) {} }, 400);
}

// ElevenLabs — найкраща якість/характер, українська майже без акценту (преміум,
// окремий ключ у Налаштуваннях). multilingual_v2 стабільно тягне українську.
async function _speakElevenLabs(text, key) {
  const voiceId = _elevenVoice();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    // turbo_v2_5 — низька затримка (Роман: голос з'являвся з лагом) +
    // багатомовна, добра українська. Якість трохи нижча за multilingual_v2,
    // але відчутно швидше.
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
  });
  if (!res.ok) throw new Error('11labs ' + res.status);
  await _playBlob(await res.blob());
}

// Озвучити текст (з тапу або авто). Чистить markdown/emoji, ріже, рахує ліміт.
export async function speak(text) {
  if (!text) return;
  if (typeof document !== 'undefined' && document.hidden) return; // у фоні не озвучуємо
  let clean = String(text).replace(/[*_`#>•·✔️✓🦉📋💰⚠️📷🖼✨🔊🔇→↑↓]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  // dedup: те саме за останні 5с — не повторюємо (захист від спаму табло/чату)
  if (clean === _lastSpoken && (Date.now() - _lastSpokenTs) < 5000) return;
  if (clean.length > MAX_CHARS_PER_UTTERANCE) clean = clean.slice(0, MAX_CHARS_PER_UTTERANCE) + '…';
  _lastSpoken = clean; _lastSpokenTs = Date.now();

  // 1) ElevenLabs (преміум, окремий ключ) — якщо заданий. Найкраща вимова.
  const elevenKey = _elevenKey();
  if (elevenKey) {
    try { await _speakElevenLabs(clean, elevenKey); return; }
    catch (e) { /* нижче падаємо на OpenAI/браузер */ }
  }
  // 2) OpenAI gpt-4o-mini-tts (твій ключ) у межах денного ліміту.
  const key = localStorage.getItem('nm_gemini_key');
  const overCap = _ttsCharsToday() + clean.length > DAILY_CHAR_CAP;
  if (key && !overCap) {
    _addTtsChars(clean.length); // резервуємо ДО fetch (без гонки)
    try { logTtsUsage(clean.length); } catch (e) {}
    try { await _speakOpenAI(clean, key); return; }
    catch (e) { /* нижче браузер */ }
  } else if (overCap && !_capWarned) {
    _capWarned = true;
    try { showToast(t('tts.cap', 'Денний ліміт природного голосу вичерпано — перехід на безкоштовний')); } catch (e) {}
  }
  // 3) Браузерний голос (безкоштовно) — крайній fallback.
  _speakBrowser(clean);
}

// === Налаштування голосу (блок «Голос Агента») ===
export function setTtsVoice(voice) { if (voice) updateSettings({ ttsVoice: voice }); }
export function saveElevenKey(val) { updateSettings({ elevenKey: (val || '').trim() }); }
export function getVoicePrefs() {
  const s = _settings();
  return { ttsVoice: s.ttsVoice || DEFAULT_OPENAI_VOICE, elevenKey: s.elevenKey || '' };
}
// 🎧 Прослухати — тап (gesture) → озвучити зразок поточним голосом.
export function testTtsVoice() {
  unlockAudio();
  _lastSpoken = ''; // дозволити повтор того ж зразка
  speak(t('tts.sample', 'Привіт! Я твій агент NeverMind. Ось так звучить мій голос.'));
}

// === Кнопка голосового режиму у шапці (біля ⚙️) ===
// Тап → вмк/вимк живий діалог: OWL озвучує відповіді + мікрофон слухає юзера.
function _voiceIcon(on) {
  // Увімк → білий мік на зеленому колі; вимк → приглушений сірий.
  const stroke = on ? '#ffffff' : 'rgba(30,16,64,0.35)';
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
}
function _syncVoiceButtons() {
  const on = isVoiceMode();
  document.querySelectorAll('.voice-mode-btn').forEach(b => {
    b.innerHTML = _voiceIcon(on);
    b.style.background = on ? '#16a34a' : 'transparent';
    b.style.borderRadius = '50%';
    b.style.boxShadow = on ? '0 0 0 2px rgba(22,163,74,0.25)' : 'none';
    b.classList.toggle('voice-on', on);
  });
}
function _injectVoiceButtons() {
  document.querySelectorAll('.header-actions').forEach(ha => {
    if (ha.querySelector('.voice-mode-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn voice-mode-btn';
    btn.type = 'button';
    btn.title = t('voice.btn_title', 'Голосовий режим (OWL говорить і слухає)');
    btn.innerHTML = _voiceIcon(isVoiceMode());
    btn.addEventListener('click', () => {
      const on = toggleVoiceMode();           // тап = gesture → розблок аудіо/мік
      _syncVoiceButtons();
      if (on) {
        // Відкриваємо чат поточної вкладки — діалог працює лише у відкритому чаті.
        try { openChatBar(currentTab); } catch (e) {}
        try { showToast(t('voice.on', '🎙 Голосовий режим увімкнено — говоріть')); } catch (e) {}
        try { if (window.nmStartListening) setTimeout(() => window.nmStartListening(), 300); } catch (e) {}
      } else {
        stopSpeaking();
        try { showToast(t('voice.off', 'Голосовий режим вимкнено')); } catch (e) {}
      }
    });
    const settingsBtn = ha.querySelector('[data-action="open-settings"]');
    if (settingsBtn) ha.insertBefore(btn, settingsBtn); else ha.appendChild(btn);
  });
  _syncVoiceButtons();
}

// Авто-озвучка відповідей OWL у чаті — ЛИШЕ активна вкладка + змістовні репліки
// (не «✓ Зроблено», не tool-підтвердження). Один хук на всі чати (подія з saveChatMsg).
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _injectVoiceButtons);
  else setTimeout(_injectVoiceButtons, 0);
  window.addEventListener('nm-voice-mode-changed', _syncVoiceButtons);
  // Чат відкрито (у т.ч. повторно) + голосовий режим увімк → слухати юзера.
  window.addEventListener('nm-chat-opened', () => {
    if (!isVoiceMode()) return;
    setTimeout(() => { try { if (window.nmStartListening) window.nmStartListening(); } catch (e) {} }, 350);
  });
  // Табло оновилось → озвучуємо ТIЛЬКИ коли голос увімк І чат ЗАКРИТИЙ (Роман).
  // Коли чат відкритий — озвучуються відповіді, табло не дублюємо.
  window.addEventListener('nm-board-message', (e) => {
    if (!isVoiceMode()) return;
    if (_chatOpen()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const txt = (e && e.detail && e.detail.text) ? String(e.detail.text).trim() : '';
    if (txt.length >= 8) speak(txt);
  });
  window.addEventListener('nm-agent-message', (e) => {
    if (!isVoiceMode()) return;
    const d = (e && e.detail) || {};
    if (!d.text) return;
    if (d.tab && d.tab !== currentTab) return;
    const txt = String(d.text).trim();
    if (txt.length < 20) return;
    if (/^[✓✅\[(]/.test(txt)) return;
    speak(txt);
  });
  // Перший тап будь-де — розблокувати аудіо на iOS.
  document.addEventListener('touchend', unlockAudio, { once: true, passive: true });
  // У фон / згортання PWA / перехід в інший застосунок — зупинити озвучку.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });
  window.addEventListener('pagehide', stopSpeaking);
  window.addEventListener('blur', () => { if (document.hidden) stopSpeaking(); });
  window.nmVoiceSpeak = speak;
  window.nmVoiceToggle = toggleVoiceMode;
  window.nmVoiceIsOn = isVoiceMode;
  window.nmVoiceStop = stopSpeaking;
  window.setTtsVoice = setTtsVoice;
  window.saveElevenKey = saveElevenKey;
  window.testTtsVoice = testTtsVoice;
  window.getVoicePrefs = getVoicePrefs;
}
