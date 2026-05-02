// src/data/months.js — канонічний довідник назв місяців українською.
//
// Корінь чому потрібен: 5 файлів (ai/core, tabs/me, tabs/inbox, tabs/calendar,
// tabs/finance, tabs/habits) дублювали 4 формати масивів місяців:
// - genitive lowercase ('січня', 'лютого', ...) — для дат «5 січня»
// - nominative title ('Січень', 'Лютий', ...) — для заголовків
// - short caps 4-літерні ('СІЧ', 'ЛЮТ', ...) — для compact UI
// - short title 3-літерні ('Січ', 'Лют', ...) — для календаря
//
// При додаванні англійської мови інакше довелося б правити кожен файл окремо
// + ризик розбіжностей між ними. Тут — одна точка правди + обгортка t() для
// перекладу.
//
// Парсер дат у inbox.js:1008,1051 (стеми 'січн','лют',...) — ОКРЕМА логіка,
// тут не охоплюється: він не для відображення, а для розпізнавання тексту юзера
// українською. Коли буде i18n — парсер потребуватиме власної багатомовної мапи.

import { t } from '../core/utils.js';

const KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const FALL_GENITIVE  = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const FALL_NOMINATIVE = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const FALL_SHORT_CAPS = ['СІЧ','ЛЮТ','БЕР','КВІТ','ТРАВ','ЧЕРВ','ЛИП','СЕРП','ВЕР','ЖОВТ','ЛИСТ','ГРУД'];
const FALL_SHORT      = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];

// idx = 0..11 (як у Date.getMonth())
export function monthGenitive(idx)   { return t(`month.${KEYS[idx]}.gen`,        FALL_GENITIVE[idx]); }
export function monthNominative(idx) { return t(`month.${KEYS[idx]}.nom`,        FALL_NOMINATIVE[idx]); }
export function monthShortCaps(idx)  { return t(`month.${KEYS[idx]}.short_caps`, FALL_SHORT_CAPS[idx]); }
export function monthShort(idx)      { return t(`month.${KEYS[idx]}.short`,      FALL_SHORT[idx]); }
