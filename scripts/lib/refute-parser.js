// scripts/lib/refute-parser.js — детермінований розбір відповіді фактчекера (P1, ADR-005).
//
// Порт контракту alibaba review_filter: фактчекер повертає голий JSON-масив ID
// знахідок які diff ПРЯМО СПРОСТОВУЄ. Ми відсіюємо саме ці ID, решту лишаємо.
//
// 🔑 FAIL-OPEN (критично): будь-яка неоднозначність — битий JSON, не-масив,
// невідомі ID, зайвий текст навколо — означає «нічого впевнено не спростовано»
// → повертаємо ВСІ знахідки. Краще лишити сумнівну знахідку на очі Голові,
// ніж тихо вбити валідну через збій парсера.
//
// applyRefutation(findings, rawReply) → { kept, refutedIds, failOpen }
//   findings — [{ id, ... }] (id типу 'c-0'); rawReply — рядок від LLM.

// Витягнути перший JSON-масив рядків з відповіді (LLM часто загортає у ```json).
function extractIdArray(raw) {
  if (typeof raw !== 'string') return null;
  // Прибрати code-fence якщо є.
  const fenced = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  const candidate = fenced ? fenced[1] : raw.trim();
  // Знайти перший '[' … відповідний ']' (без regex-жадібності через власний скан).
  const start = candidate.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === '[') depth++;
    else if (candidate[i] === ']') {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          const arr = JSON.parse(slice);
          if (Array.isArray(arr) && arr.every(x => typeof x === 'string')) return arr;
          return null;
        } catch { return null; }
      }
    }
  }
  return null;
}

function applyRefutation(findings, rawReply) {
  const all = Array.isArray(findings) ? findings : [];
  const ids = extractIdArray(rawReply);

  // Fail-open: не розпарсили масив рядків → нічого не відсіюємо.
  if (ids === null) {
    return { kept: all, refutedIds: [], failOpen: true };
  }

  const knownIds = new Set(all.map(f => f && f.id));
  // Всі повернені ID мусять існувати; будь-який невідомий ID = недовіра → fail-open.
  const validRefuted = ids.filter(id => knownIds.has(id));
  if (validRefuted.length !== ids.length) {
    return { kept: all, refutedIds: [], failOpen: true };
  }

  const refutedSet = new Set(validRefuted);
  const kept = all.filter(f => !refutedSet.has(f && f.id));
  return { kept, refutedIds: validRefuted, failOpen: false };
}

module.exports = { extractIdArray, applyRefutation };
