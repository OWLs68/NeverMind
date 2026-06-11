// src/core/settings.js
//
// Канонічний доступ до nm_settings (профіль + налаштування юзера).
// Доменний аксесор для ОДНОГО ключа — рівно як getTasks/saveTasks для nm_tasks,
// getInbox/saveInbox для nm_inbox. Це НЕ заборонена generic db.js-абстракція:
// працює виключно з nm_settings, не приймає довільний ключ. До Supabase
// nm_settings стане рядком таблиці user_settings (Свіжий-погляд Council 11.06).
//
// Навіщо: раніше 10 місць (nav/onboarding/finance/ui-tools/inbox-board) робили
// read-merge-write вручну — кожне дублювало JSON.parse(get)→зміна поля→setItem.
// Тепер усі через updateSettings(patch). Єдина точка → при Supabase замінити
// один файл, а не полювати 10 розкиданих setItem.

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('nm_settings') || '{}');
  } catch {
    return {};
  }
}

// updateSettings(patch) — shallow-merge patch у nm_settings, повертає новий об'єкт.
// НЕ диспатчить nm-data-changed: жоден слухач на settings не реагує
// (boot.js DETAIL_TO_KEY не містить 'settings') — поведінка як була раніше.
export function updateSettings(patch) {
  const s = getSettings();
  Object.assign(s, patch);
  localStorage.setItem('nm_settings', JSON.stringify(s));
  return s;
}
