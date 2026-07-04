// scripts/lib/glob-match.js — глоб-матчер шляхів БЕЗ regex (P3, ADR-005).
//
// Чому без regex: клас багів \b-кирилиця довів що regex-межі підступні;
// тут чисте посегментне порівняння рядків — клас неможливий за конструкцією.
//
// Підтримує рівно те що треба rules.json:
//   **  — будь-яка кількість сегментів (включно з нулем)
//   *   — будь-які символи В МЕЖАХ одного сегмента
//   решта — точний збіг сегмента.
//
// resolveChecklists(path, rules) → масив імен чеклістів (усі збіги + default).

// Сегмент проти шаблону сегмента з '*' (посимвольно, ітеративний wildcard-матч).
function segMatch(pattern, seg) {
  let p = 0, s = 0, star = -1, mark = 0;
  while (s < seg.length) {
    if (p < pattern.length && (pattern[p] === seg[s])) { p++; s++; }
    else if (p < pattern.length && pattern[p] === '*') { star = p++; mark = s; }
    else if (star !== -1) { p = star + 1; s = ++mark; }
    else return false;
  }
  while (p < pattern.length && pattern[p] === '*') p++;
  return p === pattern.length;
}

// Шлях проти глоба (посегментно, ** — рекурсивно углиб).
function globMatch(glob, path) {
  const g = glob.split('/').filter(Boolean);
  const p = path.split('/').filter(Boolean);
  function walk(gi, pi) {
    if (gi === g.length) return pi === p.length;
    if (g[gi] === '**') {
      // ** зʼїдає 0..N сегментів
      for (let skip = pi; skip <= p.length; skip++) {
        if (walk(gi + 1, skip)) return true;
      }
      return false;
    }
    if (pi >= p.length) return false;
    if (!segMatch(g[gi], p[pi])) return false;
    return walk(gi + 1, pi + 1);
  }
  return walk(0, 0);
}

// Повертає унікальний список чеклістів для шляху: всі збіги правил + default.
function resolveChecklists(path, rulesObj) {
  const out = [];
  for (const r of (rulesObj.rules || [])) {
    if (globMatch(r.glob, path)) {
      for (const c of r.checklists) if (!out.includes(c)) out.push(c);
    }
  }
  const def = rulesObj.default;
  if (def && !out.includes(def)) out.push(def);
  return out;
}

// Чи шлях у списку security-чутливих глобів (тригер P5-агента).
function isSecuritySensitive(path, rulesObj) {
  return (rulesObj.security_sensitive || []).some(g => globMatch(g, path));
}

module.exports = { segMatch, globMatch, resolveChecklists, isSecuritySensitive };
