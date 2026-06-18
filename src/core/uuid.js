// UUID-генератор для ID нових сутностей (замість Date.now()) перед Supabase.
//
// v7 (RFC 9562, time-ordered) — НЕ v4 (випадковий). Чому (Council web-дослід 17.06):
// у Postgres випадковий v4 змушує B-tree індекс шукати місце посеред сторінки при
// кожній вставці → фрагментація («page splitting») → деградація INSERT у 2-10×.
// v7 кладе 48-бітну мітку часу у старші біти → нові id завжди йдуть у кінець індексу
// (як автоінкремент, але глобально унікальний). Готує дані до швидкого sync.
//
// Існуючі живі записи — v4 (ними згенеровані до 17.06); лишаються валідними UUID
// поряд (format ідентичний, 36 символів). Змішування v4/v7 безпечне: ніде не
// сортуємо за id (усюди createdAt/created_at), тож часовий порядок id не критичний.
//
// crypto.randomUUID() дає лише v4 — тому v7 збираємо вручну через crypto.getRandomValues
// (доступний з iOS 11, тобто без потреби у fallback на старіші Safari).
export function generateUUID() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);

  // 48-бітна мітка часу (мс) у buf[0..5], старший байт перший.
  // Через % 256 / Math.floor, НЕ побітово: побітове & у JS звужує до 32 біт і
  // зламало б молодші байти (Date.now() > 2^31).
  const ts = Date.now();
  buf[0] = Math.floor(ts / 2 ** 40) % 256;
  buf[1] = Math.floor(ts / 2 ** 32) % 256;
  buf[2] = Math.floor(ts / 2 ** 24) % 256;
  buf[3] = Math.floor(ts / 2 ** 16) % 256;
  buf[4] = Math.floor(ts / 2 ** 8) % 256;
  buf[5] = ts % 256;

  buf[6] = (buf[6] & 0x0f) | 0x70; // version 7
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10 (RFC 4122/9562)

  const hex = [...buf].map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
