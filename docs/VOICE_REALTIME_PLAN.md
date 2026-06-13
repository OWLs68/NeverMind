# VOICE_PLAN — системний стабільний голос NeverMind

> Створено qpzj7k (13.06.2026) як «Realtime API». **Переписано v1d9eo (13.06.2026)** після red-team дослідження (3 паралельні агенти + ~50 джерел) ТА brain/Fable-аналізу Романа — обидва незалежно зійшлись. Рішення: **КОНВЕЄР STT→мозок→TTS, НЕ OpenAI Realtime.** Велику збірку — **окремою сесією після Supabase**.
>
> (Назва файлу лишилась `VOICE_REALTIME_PLAN.md` бо на неї посилаються SESSION_STATE/ROADMAP — зміст новий.)

---

## 0. Що вже зроблено у v1d9eo (інтерим, БЕЗ великої збірки)

Малими змінами у `src/ui/voice-output.js` + `index.html` (коміти `632a10c`, `+наступний`):
- **«голос не той»** — список голосів у Налаштуваннях = ЄДИНЕ джерело правди: говорить рівно вибраний двигун. Раніше ключ ElevenLabs мовчки перекривав вибір. Додано явний пункт «ElevenLabs» + одноразова міграція.
- **Web Speech synthesis fallback ПРИБРАНО** — саме мовчазний перехід на роботний браузерний голос (при ліміті/збої) давав невідповідність. Тепер нема чим озвучити → чесний стоп + тост, не робот.
- **затримка** — озвучка ріжеться на речення, перше (коротке) грає одразу, решта prefetch'иться. Перше слово майже миттєво.
- **STT → push-to-talk** — прибрано крихку авто-петлю слухання (мік сам відкривався → «вмикається/текст не пише»). Тепер: тап 🎤 → говориш → текст → мозок → OWL озвучує відповідь. Наступний хід — знову тапаєш 🎤.
- ⚠️ Усе треба засмоукати на **реальному iPhone** (з хмари не чути).

Це **стоп-ґеп**, не заміна великій збірці.

## 1. Корінь проблеми

Поточний голос = зшивка **3-4 систем**: Web Speech STT + Web Speech synthesis + OpenAI tts + ElevenLabs. Звідси весь клас багів: вибраний голос ≠ що грає (мовчазний fallback), затримка (REST без стріму), мік флакає (Web Speech restart-крихкість). Латками стабільним не стане — треба ОДИН шлях на кожен шар.

## 2. ⛔ Чому НЕ OpenAI Realtime (red-team + brain, v1d9eo)

1. **Фрагментує «один мозок».** Realtime-модель говорить САМА, минаючи наш GPT-4o-mini + 47 tools. Для «поговорити з inbox» це неправильно — голос має бути I/O шаром на ІСНУЮЧИЙ мозок (як фото-vision), не окремим агентом.
2. **iOS вбиває веб-голос у фоні/при блокуванні** — політика Apple, обходу нема (стосується і WebRTC, і конвеєра — це обмеження продукту).
3. **Дорого + cost-bomb** — re-білінг аудіо-історії: 20-хв сесія ~×100 першої хвилини. ~$0.06-0.30/хв проти ~$0.02-0.04 конвеєра.
4. **Баги:** VAD ламає function-calling + обриває мовця; echo на iOS Safari; розриви.

**Realtime лишаємо лише як майбутню опцію «живий компаньйон», не основу.**

## 3. ✅ Системне рішення — КОНВЕЄР, ОДИН шлях на шар

```
[Тап 🎤] → мікрофон
  → STT → текст
  → МОЗОК: ТЕПЕРІШНІЙ GPT-4o-mini + 47 tools (БЕЗ переробки — як фото-vision)
  → TTS (стрім) → аудіо OWL
```

**Три шари, кожен — один контрольований шлях (рішення Романа/brain):**

- **STT** — інтерим: простий push-to-talk (Web Speech поки лишається як рушій розпізнавання, але БЕЗ авто-петлі). Надійно (з Supabase): запис → Edge Function → **Whisper / gpt-4o-transcribe**.
- **TTS** — ОДИН шлях через Edge Function, **стрімом** (Opus, ~0.3-0.6с до звуку). Основа за рішенням Романа — **OpenAI tts**. Браузерний synthesis прибрано.
- **Мозок** — без змін.

**⚠️ Відкрите рішення (велика сесія): OpenAI tts vs ElevenLabs для TTS.** Brain Романа: тільки OpenAI tts (один провайдер, один Edge-шлях, просто). Агенти-дослідники: ElevenLabs дає українську **без акценту** (OpenAI tts гаркавить), офіційний партнер Мінцифри. Це вибір **простота vs якість української**. Рекомендація Голови: лишити ElevenLabs опцією «без акценту» поряд з OpenAI tts (обидва через Edge), юзер обирає — як зараз у списку. Фінально — на старті великої сесії.

## 4. Послідовність (рішення Романа)

1. **ЗАРАЗ (до Supabase)** — звести до push-to-talk + ОДИН TTS-шлях (прибрати дубль-fallback). Просто, але не криво. ✅ зроблено v1d9eo (розділ 0).
2. **З SUPABASE** — справжній пайплайн: TTS-стрім + Whisper STT + ключі на сервері (Edge Function) + денна грошова стеля server-side + лог `voice_sessions`. = стабільна система.
3. **Realtime** — не зараз (можлива майбутня опція).

## 5. Про Supabase (відповідь на «чи краще з Supabase»)

Так — Edge Function = одне місце для TTS-стріму + Whisper STT + ключ на сервері + один контрольований шлях + грошова стеля ПЕРЕД викликом + логи. Web Speech у браузері завжди флакатиме на iOS. Затримка на старт від Edge мізерна (~125-400мс), аудіо йде далі напряму.

## 6. iOS / PWA — закласти у дизайн

- **Фон/блокування = голос мертвий** на будь-якому веб-підході. Голос лише при відкритому чаті + активному екрані (вже так); на `visibilitychange`/`pagehide` — стоп, «тапни щоб продовжити».
- Перший старт — з user-gesture (тап) → дозвіл мікрофона + аудіо-розблок (вже робимо).
- Дозвіл мікрофона у PWA може не персистити між запусками.

## 7. Відкриті рішення (велика сесія)

- **TTS: OpenAI tts only vs + ElevenLabs опція** (простота vs українська без акценту) — див. розділ 3.
- STT: Whisper через Edge (рішення) — підтвердити модель (`whisper-1` vs `gpt-4o-transcribe`).
- Транскрипт розмови писати у чат-історію?
- Ліміт: хвилини/день чи $/день — яке число.

## 8. Файли (велика збірка)

- Чіпати: `src/ui/voice-input.js` (STT шлях), `src/ui/voice-output.js` (TTS-стрім), `src/ai/*` (мозок — БЕЗ змін, лише виклик), `src/core/usage-meter.js` (лог голосу), `index.html`, `sw.js` CACHE.
- Supabase: Edge Function `voice-tts` (стрім) + `voice-stt` (Whisper) + таблиця `voice_sessions`.
- NM_KEYS: `nm_voice_usage` (денний лічильник, як `nm_tts_usage`).

## Джерела (дослідження v1d9eo, 13.06.2026)

**Realtime — чому ні:**
- Apple Dev Forums — background WebRTC немає обходу: https://developer.apple.com/forums/thread/774239
- OpenAI Realtime cost anomaly (re-білінг): https://community.openai.com/t/realtime-api-cost-anomaly-disproportionate-charges-on-audio-input/1285295
- Managing Realtime costs: https://developers.openai.com/api/docs/guides/realtime-costs
- VAD ламає tool use: https://community.openai.com/t/using-server-vad-breaks-tool-use-in-realtime-api/1362139
- echo cancellation iOS Safari: https://community.openai.com/t/realtime-api-echo-cancellation-bug-on-ios-safari/1075890

**TTS/STT якість:**
- OpenAI tts streaming (Opus): https://platform.openai.com/docs/guides/text-to-speech
- ElevenLabs × Мінцифри (українська): https://digitalstate.gov.ua/news/tech/ukrainian-government-services-to-speak-via-ai-digital-ministry-launches-partnership-with-elevenlabs
- ElevenLabs streaming + Supabase кеш: https://elevenlabs.io/docs/cookbooks/text-to-speech/streaming-and-caching-with-supabase
- real-time S2S vs cascading (конвеєр): https://softcery.com/lab/ai-voice-agents-real-time-vs-turn-based-tts-stt-architecture

**Supabase Edge:**
- Supabase secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase rate limiting: https://supabase.com/docs/guides/functions/examples/rate-limiting
