// scripts/resolve-anchor.js — детермінований резолвер якорів знахідок (P2, ADR-005).
//
// Порт alibaba internal/diff/resolver.go. Модель рев'ю дає existing_code (дослівні
// рядки), НЕ номер рядка (моделі галюцинують і номери, і шляхи). Цей резолвер
// сам знаходить місце: нормалізує рядки → шукає послідовний збіг у hunks нової
// сторони diff, потім старої, потім ковзним вікном по всьому файлу (з пропуском
// порожніх рядків).
//
// 🔑 НУЛЬ REGEX — чисте порівняння рядків і split. Клас багів \b-кирилиця
// неможливий за конструкцією (немає жодного regex який міг би зустріти кирилицю).
// Парсинг заголовка hunk `@@ -a,b +c,d @@` — теж через split, не regex.
//
// resolveAnchor({ existingCode, diff, newFileContent }) →
//   { startLine, endLine, source } | null   (source: 'hunk-new'|'hunk-old'|'file')
//
// Протокол рев'ю (робить Голова, не цей файл): не знайшло → ОДИН LLM-ретрай «дай
// точніший сніпет з diff» → інакше позначити «без якоря», НЕ вгадувати. Шлях
// файлу завжди перезаписувати реальним (модель могла зґалюцинувати).

// Прибрати пробіли з країв + провідний маркер +/- (дзеркалить normalizeLine у Go).
function normalizeLine(s) {
  let t = String(s == null ? '' : s).trim();
  if (t[0] === '+' || t[0] === '-') t = t.slice(1);
  return t.trim();
}

// Розбити код на нормалізовані непорожні рядки.
function splitAndNormalize(code) {
  return String(code == null ? '' : code).split('\n')
    .map(normalizeLine).filter(l => l !== '');
}

// Парсер unified-diff у hunks. Заголовок `@@ -oldStart,c +newStart,c @@` —
// через split (без regex). Рядки: ' ' context, '+' added, '-' deleted.
function parseHunks(diff) {
  const hunks = [];
  if (!diff) return hunks;
  let cur = null;
  for (const raw of String(diff).split('\n')) {
    if (raw.startsWith('@@')) {
      // @@ -a,b +c,d @@ …  → беремо токен що починається на '-' і на '+'
      const parts = raw.split(' ');
      let oldStart = 0, newStart = 0;
      for (const p of parts) {
        if (p[0] === '-') oldStart = parseInt(p.slice(1).split(',')[0], 10) || 0;
        else if (p[0] === '+') newStart = parseInt(p.slice(1).split(',')[0], 10) || 0;
      }
      cur = { oldStart, newStart, lines: [] };
      hunks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith('+')) cur.lines.push({ type: 'add', content: raw.slice(1) });
    else if (raw.startsWith('-')) cur.lines.push({ type: 'del', content: raw.slice(1) });
    else if (raw.startsWith(' ')) cur.lines.push({ type: 'ctx', content: raw.slice(1) });
    else if (raw === '') cur.lines.push({ type: 'ctx', content: '' });
    // '\' (No newline at end of file) та інші — ігноруємо
  }
  return hunks;
}

// Одна сторона hunk: newSide=true → context+added з новими номерами;
// newSide=false → context+deleted зі старими номерами.
function extractSideLines(hunk, newSide) {
  const out = [];
  let oldLine = hunk.oldStart, newLine = hunk.newStart;
  for (const l of hunk.lines) {
    if (l.type === 'ctx') {
      out.push({ lineNum: newSide ? newLine : oldLine, content: normalizeLine(l.content) });
      oldLine++; newLine++;
    } else if (l.type === 'add') {
      if (newSide) out.push({ lineNum: newLine, content: normalizeLine(l.content) });
      newLine++;
    } else if (l.type === 'del') {
      if (!newSide) out.push({ lineNum: oldLine, content: normalizeLine(l.content) });
      oldLine++;
    }
  }
  return out;
}

// Знайти послідовний прогін sideLines що збігається з усіма targetLines.
function matchConsecutive(sideLines, targetLines) {
  if (targetLines.length === 0 || sideLines.length < targetLines.length) return null;
  for (let i = 0; i <= sideLines.length - targetLines.length; i++) {
    let ok = true;
    for (let j = 0; j < targetLines.length; j++) {
      if (sideLines[i + j].content !== targetLines[j]) { ok = false; break; }
    }
    if (ok) return { startLine: sideLines[i].lineNum, endLine: sideLines[i + targetLines.length - 1].lineNum };
  }
  return null;
}

// Ковзне вікно по всьому новому файлу (пропускаємо порожні рядки — «послідовний»
// означає сусідні непорожні).
function resolveFromFileContent(newFileContent, targetLines) {
  if (!newFileContent) return null;
  const fileLines = String(newFileContent).split('\n');
  const norm = [], nums = [];
  for (let i = 0; i < fileLines.length; i++) {
    // TrimRight('\r') без regex (обіцянка «нуль regex» у резолвері — залізна).
    let line = fileLines[i];
    while (line.length && line[line.length - 1] === '\r') line = line.slice(0, -1);
    const n = normalizeLine(line);
    if (n === '') continue;
    norm.push(n); nums.push(i + 1);
  }
  if (norm.length < targetLines.length) return null;
  for (let i = 0; i <= norm.length - targetLines.length; i++) {
    let ok = true;
    for (let j = 0; j < targetLines.length; j++) {
      if (norm[i + j] !== targetLines[j]) { ok = false; break; }
    }
    if (ok) return { startLine: nums[i], endLine: nums[i + targetLines.length - 1] };
  }
  return null;
}

// Головний вхід: existing_code → номери рядків. null якщо не знайдено.
function resolveAnchor({ existingCode, diff, newFileContent } = {}) {
  const targetLines = splitAndNormalize(existingCode);
  if (targetLines.length === 0) return null;

  const hunks = parseHunks(diff);
  for (const h of hunks) {
    const hit = matchConsecutive(extractSideLines(h, true), targetLines);
    if (hit) return { ...hit, source: 'hunk-new' };
  }
  for (const h of hunks) {
    const hit = matchConsecutive(extractSideLines(h, false), targetLines);
    if (hit) return { ...hit, source: 'hunk-old' };
  }
  const fromFile = resolveFromFileContent(newFileContent, targetLines);
  if (fromFile) return { ...fromFile, source: 'file' };
  return null;
}

module.exports = { resolveAnchor, normalizeLine, splitAndNormalize, parseHunks, extractSideLines, matchConsecutive, resolveFromFileContent };
