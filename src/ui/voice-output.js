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
const OPENAI_VOICE = 'nova';
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
    window.speechSynthesis.cancel();
    setTimeout(() => { try { window.speechSynthesis.speak(u); } catch (e) {} }, 50); // iOS 17 quirk
  } catch (e) {}
}

async function _speakOpenAI(text, key) {
  // gpt-4o-mini-tts (steerable) — приймає instructions, читає природною
  // українською набагато краще за tts-1. Ціна порівнянна з tts-1.
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: OPENAI_VOICE,
      input: text,
      instructions: _ttsInstruction(),
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error('tts ' + res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  stopSpeaking();
  _audio = new Audio(url);
  _audio.onended = () => { try { URL.revokeObjectURL(url); } catch (e) {} _audio = null; };
  await _audio.play();
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

  const key = localStorage.getItem('nm_gemini_key');
  const overCap = _ttsCharsToday() + clean.length > DAILY_CHAR_CAP;
  if (!key || overCap) {
    if (overCap && !_capWarned) {
      _capWarned = true;
      try { showToast(t('tts.cap', 'Денний ліміт природного голосу вичерпано — перехід на безкоштовний')); } catch (e) {}
    }
    _speakBrowser(clean);
    return;
  }
  _addTtsChars(clean.length); // резервуємо ДО fetch (без гонки)
  try { logTtsUsage(clean.length); } catch (e) {}
  try {
    await _speakOpenAI(clean, key);
  } catch (e) {
    _speakBrowser(clean); // мережа/помилка → безкоштовний голос, не мовчимо
  }
}

// Авто-озвучка відповідей OWL у чаті — ЛИШЕ активна вкладка + змістовні репліки
// (не «✓ Зроблено», не tool-підтвердження). Один хук на всі чати (подія з saveChatMsg).
if (typeof window !== 'undefined') {
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
  // У фон — зупинити озвучку.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeaking(); });
  window.nmVoiceSpeak = speak;
  window.nmVoiceToggle = toggleVoiceMode;
  window.nmVoiceIsOn = isVoiceMode;
  window.nmVoiceStop = stopSpeaking;
}
