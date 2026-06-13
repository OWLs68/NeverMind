// src/data/project-completeness.js
//
// Детермінований «мозок» розуміння проекту (qpzj7k, Council-затверджено).
// «OWL знає чого не знає» — це ОБЛІК, не красномовство: маленька модель
// ненадійно оцінює «чи досить контексту», тому рішення приймає КОД, а модель
// лише витягує факти у поля. Ця чиста функція рахує повноту за 7 вимірами
// консультантської рамки, читаючи ІСНУЮЧІ поля проекту (без дубль-структури —
// 5 з 7 вимірів уже є полями: brief/budget/tempo/risks/metrics).
//
// 🚫 ЧИСТА функція: нічого не читає/пише у localStorage і DOM. Приймає об'єкт
//    проекту, повертає оцінку. Поряд з ua-time-parser.js (детерміновані хелпери).

// 7 вимірів + як визначаємо «заповнено» з реальних полів проекту.
// essence/audience — ядро (без них поради наосліп). Решта — поглиблення.
function _dimFilled(p) {
  const brief = (p && p.brief ? String(p.brief) : '').trim();
  const risks = (p && p.risks ? String(p.risks) : '').trim();
  const tempoSet = !!(p && p.tempoNow && p.tempoNow !== '?');
  return {
    essence: brief.length >= 20,                                   // суть/результат → brief
    audience: !!(p && p.targetAudience && String(p.targetAudience).trim()), // для кого → нове поле
    stage: !!(p && (p.currentStage && String(p.currentStage).trim())),       // етап → нове поле
    resources: !!(p && p.budget && p.budget.total > 0),            // ресурси → плановий бюджет
    deadline: !!(p && p.deadline) || tempoSet,                     // строки → дедлайн або темп
    risks: risks.length >= 5,                                      // ризики → існуюче поле
    success: !!(p && Array.isArray(p.metrics) && p.metrics.length > 0), // успіх → метрики
  };
}

// Людські (укр) лейбли вимірів — для мʼяких підказок «уточнити: …» в UI.
// Тут лишаємо як канонічні назви даних (не i18n-обгортка — джерело правди форми).
export const PROJECT_DIM_LABELS = {
  essence: 'суть',
  audience: 'для кого',
  stage: 'етап',
  resources: 'ресурси',
  deadline: 'строки',
  risks: 'ризики',
  success: 'успіх',
};

const _DIM_ORDER = ['essence', 'audience', 'stage', 'resources', 'deadline', 'risks', 'success'];

// assessProjectCompleteness(project) → детермінована оцінка повноти.
// {
//   filled:    string[]  ключі заповнених вимірів (у фіксованому порядку)
//   missing:   string[]  ключі порожніх вимірів (порядок = пріоритет питань)
//   pct:       0..100     заповнено/7
//   canAdvise: boolean    чи КОД дозволяє давати поради (ядро: суть + для кого)
//   nextAsk:   string|null  найважливіший порожній вимір (що питати далі)
// }
export function assessProjectCompleteness(project) {
  const has = _dimFilled(project || {});
  const filled = _DIM_ORDER.filter(k => has[k]);
  const missing = _DIM_ORDER.filter(k => !has[k]);
  const pct = Math.round((filled.length / _DIM_ORDER.length) * 100);
  // Ядро для будь-якої осмисленої поради: знаємо ЩО будуємо і ДЛЯ КОГО.
  const canAdvise = has.essence && has.audience;
  return { filled, missing, pct, canAdvise, nextAsk: missing[0] || null };
}
