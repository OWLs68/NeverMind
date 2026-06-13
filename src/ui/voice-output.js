// src/ui/voice-output.js
//
// Голос OWL: TTS — OWL озвучує табло (тап на 🔊) і відповіді в чаті (voice mode).
// ЄДИНИЙ шлях (v1d9eo): говорить рівно вибраний у Налаштуваннях двигун
// (ElevenLabs АБО OpenAI tts-1). Браузерний speechSynthesis-fallback ПРИБРАНО —
// саме він давав «голос не той». Нема чим озвучити (нема ключа/ліміт) → чесний
// стоп з тостом, не робот. Вхід — push-to-talk (тап 🎤), без авто-петлі (крихка на iOS).
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

import { t } from '../core/utils.js';
import { showToast, currentTab } from '../core/nav.js';
import { logTtsUsage } from '../core/usage-meter.js';
import { getSettings, updateSettings } from '../core/settings.js';
import { openChatBar } from '../ai/core.js';

// Живий діалог працює ЛИШЕ коли відкритий чат (Роман) — бо є куди говорити.
function _chatOpen() { try { return !!document.querySelector('.ai-bar-chat-window.open'); } catch (e) { return false; } }

const VOICE_MODE_KEY = 'nm_voice_mode';
const TTS_USAGE_KEY = 'nm_tts_usage';        // {date:'YYYY-MM-DD', chars:N}
const MAX_CHARS_PER_UTTERANCE = 500;
const DAILY_CHAR_CAP = 12000;                 // ~$0.18/день стеля OpenAI TTS
const DEFAULT_OPENAI_VOICE = 'nova';
const DEFAULT_ELEVEN_VOICE = '21m00Tcm4TlvDq8ikWAM'; // Rachel (multilingual, тепла)

// Налаштування голосу з nm_settings (вибір у Налаштуваннях → блок «Голос Агента»).
function _settings() { return getSettings(); }
const TTS1_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']; // які підтримує tts-1
function _openaiVoice() { const v = _settings().ttsVoice; return TTS1_VOICES.includes(v) ? v : DEFAULT_OPENAI_VOICE; }
function _elevenKey() { return (_settings().elevenKey || '').trim(); }
function _elevenVoice() { return _settings().elevenVoiceId || DEFAULT_ELEVEN_VOICE; }
// 0.05с тиша — розблокування аудіо на iOS (один раз з user-gesture).
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';

let _audio = null;
let _curResolve = null;   // resolver поточного аудіо-шматка (щоб stopSpeaking не лишав петлю висіти)
let _audioUnlocked = false;
let _capWarned = false;
let _lastSpoken = '';
let _lastSpokenTs = 0;
// Єдиний замок мовлення (Роман): поки хтось говорить (табло АБО чат) — інші
// мовчать. Природне завершення відпускає замок. Без авто-петлі слухання
// (push-to-talk: юзер сам тисне 🎤).
let _speaking = false;
function _done() { _speaking = false; }

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
}

// Запит дозволу мікрофона — щоб і ЗЕЛЕНА кнопка режиму (зверху), і ЧЕРВОНИЙ мік
// (у барі) питали дозвіл, залежно що натиснув першим (Роман). Дозвіл береться
// раз на сесію (браузер далі памʼятає; iOS-PWA може перепитати після перезапуску
// — обмеження Apple). Якщо дозвіл уже є — не нагнітаємо повторним запитом.
let _micPrimed = false;
export async function ensureMicPermission() {
  if (_micPrimed) return true;
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'microphone' });
      if (st.state === 'granted') { _micPrimed = true; return true; }
    }
  } catch (e) { /* iOS Safari не підтримує Permissions API → нижче через getUserMedia */ }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(tr => tr.stop()); // одразу відпускаємо мік
    _micPrimed = true;
    return true;
  } catch (e) { return false; }
}

export function stopSpeaking() {
  _speaking = false; // відпускаємо замок (це перерив, не природне завершення)
  try { if (_audio) { _audio.onended = null; _audio.pause(); _audio = null; } } catch (e) {}
  // розблоковуємо проміс поточного шматка — інакше _runSequential зависне на await
  if (_curResolve) { const r = _curResolve; _curResolve = null; try { r(); } catch (e) {} }
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

// Генерує аудіо-шматок (Blob) через OpenAI tts-1 — НЕ грає (цим керує
// _runSequential). tts-1 надійна + низьколатентна, приймає вибраний голос.
async function _genOpenAI(text, key) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: 'tts-1', voice: _openaiVoice(), input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error('tts ' + res.status);
  return res.blob();
}

// Грає один аудіо-шматок. Promise завершується коли шматок догрався АБО його
// перервали (stopSpeaking). НЕ викликає _done — цим керує _runSequential.
function _playOnce(blob) {
  return new Promise((resolve) => {
    if (!_speaking) { resolve(); return; }
    const url = URL.createObjectURL(blob);
    const fin = () => { try { URL.revokeObjectURL(url); } catch (e) {} if (_curResolve === resolve) _curResolve = null; resolve(); };
    try { if (_audio) { _audio.onended = null; _audio.pause(); } } catch (e) {}
    _audio = new Audio(url);
    _curResolve = resolve;
    _audio.onended = () => { _audio = null; fin(); };
    _audio.onerror = () => { _audio = null; fin(); };
    _audio.play().catch(() => fin());
  });
}

// Ріже текст на речення → перше (коротке) озвучується і грає одразу, решта
// довантажується поки слухаєш (Фікс затримки). Перше слово зʼявляється майже
// миттєво замість очікування всього файлу.
function _chunkText(text) {
  const parts = String(text).split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [text];
  // Перший шматок — САМЕ перше речення (найкоротше → перше слово майже миттєво,
  // навіть для короткого зразка «Прослухати»). Решту зливаємо у більші шматки
  // (менше запитів, плавніше). Наступний генерується поки грає поточний.
  const chunks = [parts[0]];
  let buf = '';
  for (let i = 1; i < parts.length; i++) {
    if (!buf) buf = parts[i];
    else if (buf.length < 80) buf += ' ' + parts[i];
    else { chunks.push(buf); buf = parts[i]; }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// Послідовно грає шматки, генеруючи наступний поки грає поточний (prefetch).
// _done() — РIВНО ОДИН РАЗ у кінці природного завершення (інакше жива петля
// мікрофона запуститься кілька разів / не запуститься — див. Pre-mortem).
async function _runSequential(chunks, gen, firstBlob) {
  let blob = firstBlob;
  for (let i = 0; i < chunks.length; i++) {
    if (!_speaking) return;
    const nextP = (i + 1 < chunks.length) ? gen(chunks[i + 1]) : null;
    if (nextP) nextP.catch(() => {}); // без unhandled rejection
    await _playOnce(blob);
    if (!_speaking) return; // перервали під час програвання
    if (nextP) {
      try { blob = await nextP; }
      catch (e) { break; } // наступний шматок не згенерувався → завершуємо
    }
  }
  _done();
}

// Пробує озвучити рушієм gen. Чекає лише ПЕРШИЙ шматок (щоб знати чи рушій
// живий). Успіх → запускає решту у фоні, повертає true. Невдача першого
// шматка → false (speak падає на наступний рушій).
async function _trySpeakChunks(chunks, gen) {
  let firstBlob;
  try { firstBlob = await gen(chunks[0]); }
  catch (e) { return false; }
  if (!_speaking) return true; // зупинили поки генерувалось — рушій робочий, далі не падаємо
  _runSequential(chunks, gen, firstBlob);
  return true;
}

// Генерує аудіо-шматок через ElevenLabs — НЕ грає. Найкраща якість/характер,
// українська майже без акценту (преміум, окремий ключ). turbo_v2_5 — низька
// затримка + багатомовна, добра українська.
async function _genEleven(text, key) {
  const voiceId = _elevenVoice();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
  });
  if (!res.ok) throw new Error('11labs ' + res.status);
  return res.blob();
}

// Озвучити текст (з тапу або авто). Чистить markdown/emoji, ріже, рахує ліміт.
export async function speak(text) {
  if (!text) return;
  if (typeof document !== 'undefined' && document.hidden) return; // у фоні не озвучуємо
  let clean = String(text).replace(/[*_`#>•·✔️✓🦉📋💰⚠️📷🖼✨🔊🔇→↑↓]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  // dedup: те саме за останні 5с — не повторюємо (захист від спаму табло/чату)
  if (clean === _lastSpoken && (Date.now() - _lastSpokenTs) < 5000) return;
  // 🔒 ЗАМОК: якщо вже хтось говорить (табло чи чат) — новий мовчить, не
  // перебиває (вимога Романа). Слово звільниться коли поточний договорить.
  if (_speaking) return;
  if (clean.length > MAX_CHARS_PER_UTTERANCE) clean = clean.slice(0, MAX_CHARS_PER_UTTERANCE) + '…';
  _lastSpoken = clean; _lastSpokenTs = Date.now();
  _speaking = true;

  // ЄДИНЕ ДЖЕРЕЛО ПРАВДИ (Фікс «голос не той»): говорить рівно той двигун, що
  // вибраний у списку Налаштувань. ElevenLabs — ЛИШЕ за явним вибором + ключем
  // (раніше ключ мовчки перекривав вибір зі списку → чув не те що вибрав).
  const choice = _settings().ttsVoice || DEFAULT_OPENAI_VOICE;
  const chunks = _chunkText(clean);
  const elevenKey = _elevenKey();

  // 1) ElevenLabs — тільки коли явно обрано «elevenlabs».
  if (choice === 'elevenlabs') {
    if (elevenKey) {
      if (await _trySpeakChunks(chunks, txt => _genEleven(txt, elevenKey))) return;
      // ElevenLabs впав → падаємо на OpenAI/браузер нижче
    } else {
      try { showToast(t('tts.no_eleven_key', 'Встав ключ ElevenLabs у Налаштуваннях або обери інший голос')); } catch (e) {}
    }
  }

  // 2) OpenAI tts-1 (вибраний голос) у межах денного ліміту.
  const key = localStorage.getItem('nm_gemini_key');
  const overCap = _ttsCharsToday() + clean.length > DAILY_CHAR_CAP;
  if (key && !overCap) {
    _addTtsChars(clean.length); // резервуємо ДО fetch (без гонки)
    try { logTtsUsage(clean.length); } catch (e) {}
    if (await _trySpeakChunks(chunks, txt => _genOpenAI(txt, key))) return;
    // OpenAI впав → браузер нижче
  } else if (overCap && !_capWarned) {
    _capWarned = true;
    try { showToast(t('tts.cap', 'Денний ліміт природного голосу вичерпано — перехід на безкоштовний')); } catch (e) {}
  }

  // Нема чим озвучити (нема ключа / ліміт / рушій впав) — ЧЕСНИЙ стоп. НЕ падаємо
  // на роботний браузерний голос (саме він давав «голос не той»). Замок звільнено.
  _speaking = false;
  if (!key) { try { showToast(t('tts.no_key', 'Додай OpenAI-ключ у Налаштуваннях щоб OWL озвучував')); } catch (e) {} }
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
// Тап → вмк/вимк озвучку: OWL озвучує відповіді. Говорити — push-to-talk (🎤 у барі).
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
    btn.title = t('voice.btn_title', 'Озвучка відповідей OWL (говорити — тисни 🎤)');
    btn.innerHTML = _voiceIcon(isVoiceMode());
    btn.addEventListener('click', () => {
      const on = toggleVoiceMode();           // тап = gesture → розблок аудіо/мік
      _syncVoiceButtons();
      if (on) {
        // Дозвіл мікрофона одразу (тап = gesture) — щоб push-to-talk потім не питав.
        try { ensureMicPermission(); } catch (e) {}
        // Відкриваємо чат поточної вкладки — діалог працює лише у відкритому чаті.
        try { openChatBar(currentTab); } catch (e) {}
        try { showToast(t('voice.on', '🎙 OWL озвучуватиме відповіді — тисни 🎤 щоб говорити')); } catch (e) {}
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
  // 🛡 БЕЗПЕКА (qpzj7k): голосовий режим НЕ зберігається між запусками. Інакше
  // на вході застосунок сам лізе до мікрофона і може зависнути/зациклитись
  // (Роман: завис, таббар не реагував). Голос — свідомий opt-in щосесії.
  try { localStorage.setItem(VOICE_MODE_KEY, '0'); } catch (e) {}
  // Міграція (Фікс «голос не той»): у кого вписаний ключ ElevenLabs і хто не
  // міняв голос — лишаємо ElevenLabs ЯВНИМ вибором у списку (раніше він мовчки
  // перекривав список → тепер вибір чесний). Одноразово, прапор у settings.
  try {
    const s = getSettings();
    if ((s.elevenKey || '').trim() && !s.ttsEngineMigrated) {
      const patch = { ttsEngineMigrated: true };
      if (!s.ttsVoice || s.ttsVoice === 'nova') patch.ttsVoice = 'elevenlabs';
      updateSettings(patch);
    }
  } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _injectVoiceButtons);
  else setTimeout(_injectVoiceButtons, 0);
  window.addEventListener('nm-voice-mode-changed', _syncVoiceButtons);
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
    if (!_chatOpen()) return; // чат закритий → відповіді не озвучуємо (це робить табло)
    const d = (e && e.detail) || {};
    if (!d.text) return;
    if (d.tab && d.tab !== currentTab) return;
    const txt = String(d.text).trim();
    // Озвучуємо лише змістовні репліки (не «✓ Зроблено»/підтвердження).
    // push-to-talk: мік юзер вмикає сам — без авто-петлі слухання.
    const speakable = txt.length >= 20 && !/^[✓✅\[(]/.test(txt);
    if (speakable) speak(txt);
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
  window.nmEnsureMic = ensureMicPermission;
  window.setTtsVoice = setTtsVoice;
  window.saveElevenKey = saveElevenKey;
  window.testTtsVoice = testTtsVoice;
  window.getVoicePrefs = getVoicePrefs;
}
