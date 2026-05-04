// chip-payload-store.js — окремий нейтральний модуль для зберігання chip-payload
// у denormalized map (nm_chip_payloads) замість inline у chat_log[].chips[].payload.
//
// Phase 12 Шар 6 (RGisY 04.05): винесено з chips.js щоб core.js saveChatMsg
// міг викликати externalize синхронно БЕЗ circular dependency
// (chips.js → core.js саveChatMsg → chips.js).
//
// Імпортується з:
// - src/owl/chips.js (normalizeChips, _gcChipPayloads)
// - src/ai/core.js (saveChatMsg — externalize ПЕРЕД записом chat_log)
// - src/owl/unified-storage.js (saveTabMessage)
// - src/core/boot.js (v10 міграція)

import { generateUUID } from '../core/uuid.js';

export const CHIP_PAYLOADS_KEY = 'nm_chip_payloads';

export function readChipPayloads() {
  try { return JSON.parse(localStorage.getItem(CHIP_PAYLOADS_KEY) || '{}'); }
  catch { return {}; }
}

export function writeChipPayloads(map) {
  try { localStorage.setItem(CHIP_PAYLOADS_KEY, JSON.stringify(map)); }
  catch (e) { console.warn('[chip-payload-store] write failed', e); }
}

// Ідемпотентна нормалізація chip-обʼєкта:
// - якщо string → {label, action:'chat'}
// - якщо нема id → generateUUID()
// - якщо є inline payload → виносить у map, замінює на payloadId
//
// УВАГА: повертає КЛОН. Викликач має зберегти результат назад у chat_log
// інакше source-обʼєкт не оновиться і наступний рендер створить ще один UUID.
export function ensureChipIdAndExternalize(c) {
  const obj = typeof c === 'string' ? { label: c, action: 'chat' } : { ...c };
  if (!obj.id) obj.id = generateUUID();
  if (obj.payload && typeof obj.payload === 'object') {
    const map = readChipPayloads();
    map[obj.id] = obj.payload;
    writeChipPayloads(map);
    obj.payloadId = obj.id;
    delete obj.payload;
  }
  return obj;
}
