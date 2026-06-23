// .claude/hooks/lib/byyou-release.js
//
// Спільна логіка push-замку /byyou. ОДИН код для хука (byyou-push-lock.js) і
// контракт-тесту (scripts/check-byyou-lock.js). Урок gfrvu5: сам замок мав баг
// (\b-кирилиця → не пускав «Деплой») бо не був покритий тестом. «Хто стереже
// сторожів» — тепер сторож сам під тестом.
//
// БЕЗ \b — у JS \b не працює з кирилицею (той самий клас бага що ловлять
// контракт-тести застосунку).

const RELEASE_WORD = /деплой/i;

// Чи дозволено push у режимі /byyou.
//   recentUserText    — останні повідомлення Романа (його слова, не Claude).
//   releaseWindowOpen — чи відкрите вікно self-correction (маркер існує):
//                       Роман уже сказав «деплой» для цього блоку → дозволяємо
//                       авто-перепуш ВИПРАВЛЕНЬ того ж блоку поки CI не зелений,
//                       без повторного «деплой» (self-correction loop).
function isReleaseApproved(recentUserText, releaseWindowOpen) {
  if (releaseWindowOpen) return true;
  return RELEASE_WORD.test(recentUserText || '');
}

module.exports = { RELEASE_WORD, isReleaseApproved };
