# VOICE_REALTIME_PLAN — системний голосовий діалог (OpenAI Realtime API)

> Створено сесією qpzj7k (13.06.2026). Виконувати **окремою сесією** (свіжа памʼять, повний фокус). Це заміна крихкого Web-Speech-голосу на справжній real-time канал.

---

## 1. Корінь проблеми (чому переписуємо)

Поточний голос = зшивка **3 окремих систем**: браузерне розпізнавання (Web Speech `SpeechRecognition`, на iOS PWA глючне/ненадійне) + окремий TTS (OpenAI `tts-1`) + ручна петля «сказав→слухаю» у JS. Звідси ВЕСЬ клас багів цієї сесії:
- треба чекати таймаут перш ніж відправить (Web Speech не знає коли юзер замовк);
- мік не вмикається сам / не перезапускається;
- два голоси накладаються (Audio + speechSynthesis — різні канали);
- перемикання навушник↔динамік (зміна аудіо-рушія);
- автоплей блокується на iOS без тапу;
- акцент (англо-навчені голоси).

Лоскутами це стабільним НЕ стане — фундамент хибний.

## 2. Системне рішення

**OpenAI Realtime API через WebRTC** — ОДИН канал робить усе на сервері:
мікрофон → серверний VAD (визначає коли юзер замовк) → розпізнавання → LLM → синтез → аудіо назад через WebRTC-трек.

Дає:
- **сабсекундна затримка**, **barge-in** (перебити голосом) — жива розмова;
- зникає весь клас наших багів (немає таймаута, безперервна сесія = мік не перезапускати, один канал = немає двох голосів / перемикання маршруту, WebRTC-трек = немає проблем автоплею);
- **WebRTC на iOS Safari 16.4+ / standalone PWA працює надійно** (на відміну від Web Speech);
- підтримує **function calling** → «один мозок» (інструменти NeverMind) працює і голосом.

Моделі: `gpt-4o-mini-realtime` (дешевше, для розмови) — дефолт; `gpt-realtime` (краще function calling) — опція.

## 3. Архітектура (потік)

```
[Кнопка 🎙 голос] → getUserMedia(mic)
   → RTCPeerConnection (offer SDP)
   → POST OpenAI realtime (ephemeral token) → answer SDP
   → DataChannel (події: session.update, tools, transcripts, function_call)
   → ontrack: <audio autoplay> ← голос OWL
session.update: { voice, instructions(OWL personality+lang), tools:[NeverMind tools], turn_detection: server_vad }
function_call подія → dispatchChatToolCalls (існуючий) → function_call_output назад
```

Компоненти:
- `src/ui/voice-realtime.js` (новий) — WebRTC сесія, події, lifecycle, ліміти.
- bridge до `tool-dispatcher.js` (існуючі INBOX_TOOLS → realtime tools-формат).
- UI: та сама кнопка 🎙 у шапці (вже є) → тепер відкриває realtime-сесію замість Web-Speech-петлі.

## 4. Фази

- **P1 — базова розмова.** WebRTC сесія + ephemeral token (стоп-ґеп: мінт ключем на клієнті) + аудіо туди-назад + server_vad. Голос↔голос без інструментів. Кнопка 🎙 запускає/зупиняє сесію. Транскрипти у чат (опц.).
- **P2 — «один мозок» (tools).** Перекласти INBOX_TOOLS у realtime `tools`, обробляти `function_call` через існуючий `dispatchChatToolCalls`, повертати результат. Передати per-tab контекст (як у getXChatSystem) у `instructions`.
- **P3 — ліміти + UX + мова.** Жорсткі ліміти (макс хвилин/сесію, денний грошовий стоп → авто-завершення), індикатор «слухаю/говорю», вибір голосу з Налаштувань, мова з `getLang()`. Логування вартості у usage-meter (рядок «Голос», realtime audio tokens).
- **P4 — Supabase Edge ephemeral.** Перенести мінт токена на Edge Function (ключ зникає з клієнта). Робити РАЗОМ з Supabase-фазою.

## 5. Ліміти (Роман: «не влетіти фінансово»)

- `gpt-4o-mini-realtime` за замовч.
- Макс тривалість сесії (напр. 3 хв) → авто-disconnect + toast.
- Денний ліміт (хвилини або $) у localStorage `nm_realtime_usage` (як `nm_tts_usage`) → перевищення = режим недоступний на сьогодні (toast).
- Сесія закривається при: вимкненні режиму, згортанні PWA (visibilitychange/pagehide), закритті чату (як зараз — лише при відкритому чаті), тиші N сек.
- Вартість → usage-meter (нове `logRealtimeUsage(seconds/tokens)`, mode='voice').

## 6. iOS / PWA нюанси

- WebRTC + getUserMedia: iOS Safari 16.4+ ✅, standalone PWA ✅ (надійніше за SpeechRecognition).
- Перший старт — з user-gesture (тап кнопки) → дозвіл мікрофона + аудіо-розблок (вже робимо).
- `<audio>` для ontrack — `playsinline` + autoplay після gesture.
- Беззвучний перемикач: WebRTC аудіо йде як медіа — перевірити маршрут (краще за HTML Audio, але протестувати на реальному iPhone).

## 7. Безпека / ephemeral token

- **Правильно:** клієнт просить ефемерний токен у НАШОГО сервера (Edge Function) → той ключем мінтить session → клієнт юзає токен для WebRTC. TTL 2 год.
- **Стоп-ґеп (P1, без бекенду):** мінт session прямо з клієнта головним ключем (той самий клас ризику що ключ у localStorage зараз). Прийнятно до Supabase (P4).

## 8. Що прибрати / лишити

- **Прибрати** (після P1-P2 стабільні): Web-Speech-ПЕТЛЮ авто-діалогу у `voice-input.js` (`nmStartListening`, авто-send-loop) + `_afterSpeak`-петлю у `voice-output.js`. Realtime замінює їх.
- **Лишити:** ручне **диктування** (Web Speech mic у поле вводу) — окрема корисна фіча, не чіпати. TTS-озвучку табло коли чат закритий (nm-board-message) — можна лишити на tts-1 АБО теж через realtime (рішення у P3).
- Кнопка 🎙 у шапці (вже є) — перенаправити на realtime.

## 9. Файли

- НОВИЙ: `src/ui/voice-realtime.js`, `src/app.js` import.
- Чіпати: `src/ai/tool-dispatcher.js` (bridge), `src/ai/prompts.js` (instructions-білдер для realtime), `src/core/usage-meter.js` (logRealtimeUsage), `src/ui/voice-output.js` + `voice-input.js` (прибрати петлю), `index.html` (кнопка 🎙 → realtime), `sw.js` CACHE.
- NM_KEYS: `nm_realtime_usage`.

## 10. Відкриті рішення (спитати Романа на старті фази)

- Транскрипт розмови писати у чат-історію? (так = видно текст + дешевше повторно; ні = чистий голос).
- Озвучку табло лишити на tts-1 чи теж realtime?
- Ліміт: хвилини/день чи $/день? Яке число.
- gpt-4o-mini-realtime достатньо, чи треба gpt-realtime для надійних tool-calls?

## Джерела
- OpenAI Realtime WebRTC guide: https://developers.openai.com/api/docs/guides/realtime-webrtc
- Realtime & audio guide: https://platform.openai.com/docs/guides/realtime
- gpt-4o-mini-realtime model: https://developers.openai.com/api/docs/models/gpt-4o-mini-realtime-preview
- webrtcHacks unofficial guide: https://webrtchacks.com/the-unofficial-guide-to-openai-realtime-webrtc-api/
