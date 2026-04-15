// ============================================================
// app-health.js — Здоров'я — картки, трекер, AI bar
// Функції: renderHealth, openAddHealthCard, saveHealthCard, renderHealthCard, sendHealthBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { switchTab, showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { addToTrash } from '../core/trash.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { processUniversalAction } from './habits.js';
import { openNotesFolder } from './notes.js';
import { getEvents, saveEvents } from './calendar.js';

// === STORAGE ===

// Lazy-міграція старої структури картки у нову (Фаза 1, 15.04 jMR6m).
// Додає нові поля якщо відсутні, конвертує doctorNotes → history, медикаменти у новий формат.
function _migrateHealthCard(card) {
  let changed = false;
  if (card.doctor === undefined) { card.doctor = ''; changed = true; }
  if (card.doctorRecommendations === undefined) { card.doctorRecommendations = ''; changed = true; }
  if (card.doctorConclusion === undefined) { card.doctorConclusion = ''; changed = true; }
  if (card.startDate === undefined) { card.startDate = ''; changed = true; }
  if (card.nextAppointment === undefined) { card.nextAppointment = null; changed = true; }
  if (!Array.isArray(card.history)) { card.history = []; changed = true; }

  // Конвертація doctorNotes у history
  if (Array.isArray(card.doctorNotes) && card.doctorNotes.length > 0) {
    card.doctorNotes.forEach(n => {
      let ts = Date.now();
      if (typeof n.ts === 'number') ts = n.ts;
      else if (n.date) { const d = new Date(n.date); if (!isNaN(d)) ts = d.getTime(); }
      const prefix = n.doctor ? n.doctor + ': ' : '';
      card.history.push({ ts, type: 'doctor_visit', text: prefix + (n.text || '') });
    });
    delete card.doctorNotes;
    changed = true;
  }

  // Конвертація старих медикаментів {name, dose, time, taken} у нову структуру
  if (Array.isArray(card.medications)) {
    card.medications = card.medications.map(m => {
      if (m.dosage !== undefined) return m; // вже нова структура
      changed = true;
      return {
        id: m.id || (Date.now() + Math.floor(Math.random() * 1000)),
        name: m.name || '',
        dosage: m.dose || '',
        schedule: m.time ? [m.time] : [],
        courseDuration: '',
        log: m.taken ? [m.takenAt || Date.now()] : [],
        createTasks: false,
      };
    });
  }

  return { card, changed };
}

export function getHealthCards() {
  const raw = JSON.parse(localStorage.getItem('nm_health_cards') || '[]');
  if (raw.length === 0) return raw;
  if (localStorage.getItem('nm_health_migrated_v2') === '1') return raw;
  // Одноразова міграція
  let anyChanged = false;
  const result = raw.map(c => {
    const { card, changed } = _migrateHealthCard(c);
    if (changed) anyChanged = true;
    return card;
  });
  if (anyChanged) localStorage.setItem('nm_health_cards', JSON.stringify(result));
  localStorage.setItem('nm_health_migrated_v2', '1');
  return result;
}
function saveHealthCards(arr) { localStorage.setItem('nm_health_cards', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'health' })); }
export function getHealthLog() { return JSON.parse(localStorage.getItem('nm_health_log') || '{}'); }
function saveHealthLog(obj) { localStorage.setItem('nm_health_log', JSON.stringify(obj)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'health' })); }

// === АЛЕРГІЇ (Фаза 1, 15.04 jMR6m) ===
// Проста структура: {id, name, notes, createdAt}. Розширення з severity → ROADMAP.md Ideas.
export function getAllergies() { return JSON.parse(localStorage.getItem('nm_allergies') || '[]'); }
function saveAllergies(arr) { localStorage.setItem('nm_allergies', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'allergies' })); }
export function addAllergy(name, notes = '') {
  const clean = (name || '').trim();
  if (!clean) return null;
  const allergies = getAllergies();
  // Уникнути дублікату по назві (case-insensitive)
  if (allergies.some(a => a.name.toLowerCase() === clean.toLowerCase())) return null;
  const entry = { id: Date.now(), name: clean, notes: (notes || '').trim(), createdAt: Date.now() };
  allergies.push(entry);
  saveAllergies(allergies);
  return entry;
}
export function deleteAllergy(id) {
  const allergies = getAllergies();
  const idx = allergies.findIndex(a => a.id === id);
  if (idx === -1) return false;
  allergies.splice(idx, 1);
  saveAllergies(allergies);
  return true;
}

// State
let activeHealthCardId = null; // null = список, id = воркспейс
let healthBarLoading = false;
let healthBarHistory = [];
let _healthTypingEl = null;

// === RENDER HEALTH (головний екран — список) ===
export function renderHealth() {
  // Фаза 1.5 (15.04 6v2eR): lazy-housekeeping синку картка ↔ nm_events.
  // Викликаємо тільки на головному екрані щоб не блокувати workspace-рендер.
  // Порядок важливий: спочатку синкнути дати (event → card), потім архівувати,
  // потім orphan-detection (якщо подію видалили з Календаря).
  if (activeHealthCardId === null) {
    try { _syncEventDatesToCards(); } catch (e) {}
    try { _archivePastAppointments(); } catch (e) {}
    try { _detectOrphanAppointments(); } catch (e) {}
  }
  if (activeHealthCardId !== null) {
    renderHealthWorkspace(activeHealthCardId);
    return;
  }
  renderHealthList();
}

// B-28 fix (15.04 6v2eR): renderHealthList тепер сам генерує ВЕСЬ контент #health-scroll
// з нуля. Раніше покладався на статичний DOM у index.html — коли renderHealthWorkspace
// перезаписував innerHTML, статичні елементи (#health-allergies-card, #health-cards-list)
// зникали, і renderHealthList мовчки виходив через `if (!listEl) return`.
// B-31 (15.04 6v2eR): legacy блоки "Самопочуття тижня" + "Відмітити сьогодні" прибрано
// (не вписуються у нову концепцію — OWL класифікує текст у тренд замість шкал 1-10).
function renderHealthList() {
  const scrollEl = document.getElementById('health-scroll');
  if (!scrollEl) return;

  const cards = getHealthCards();
  const allergiesHtml = _buildAllergiesCardHtml();

  const statusColors = {
    active: { bg: 'rgba(234,88,12,0.1)', color: '#ea580c', label: 'Активне', bar: '#ea580c', opacity: 1 },
    controlled: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: 'Під контролем', bar: '#d97706', opacity: 1 },
    done: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Завершено ✓', bar: '#16a34a', opacity: 0.5 },
  };

  const cardsHtml = cards.length === 0
    ? `<div style="text-align:center;padding:32px 0">
        <div style="font-size:36px;margin-bottom:10px">🫀</div>
        <div style="font-size:15px;font-weight:700;color:rgba(30,16,64,0.5)">Немає карток здоров'я</div>
        <div style="font-size:13px;color:rgba(30,16,64,0.3);margin-top:4px">Додай першу — хворобу, стан або мету</div>
        <button onclick="openAddHealthCard()" style="margin-top:14px;font-size:13px;font-weight:700;color:white;background:#1a5c2a;border:none;border-radius:12px;padding:10px 20px;cursor:pointer">+ Додати картку</button>
      </div>`
    : cards.map(card => {
      const st = statusColors[card.status] || statusColors.active;
      const pct = card.progress || 0;
      const nextStep = card.nextStep || '';
      const pills = (card.treatments || []).slice(0, 4);
      const isDone = card.status === 'done';
      return `<div onclick="openHealthCard(${card.id})" class="card-glass" style="cursor:pointer;opacity:${st.opacity}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="flex:1">
            <div style="font-size:15px;font-weight:900;color:#1e1040">${escapeHtml(card.name)}</div>
            <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">${escapeHtml(card.subtitle || '')}</div>
          </div>
          <div style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;background:${st.bg};color:${st.color};flex-shrink:0;margin-left:8px">${st.label}</div>
        </div>
        <div style="height:4px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden;margin-bottom:${nextStep || pills.length ? 7 : 0}px">
          <div style="height:100%;width:${pct}%;background:${st.bar};border-radius:3px;transition:width 0.5s"></div>
        </div>
        ${!isDone && nextStep ? `<div style="font-size:10px;color:rgba(30,16,64,0.5);font-weight:600;margin-bottom:${pills.length ? 7 : 0}px">→ ${escapeHtml(nextStep)}</div>` : ''}
        ${pills.length > 0 && !isDone ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${pills.map(p => `<div style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(30,16,64,0.07);color:rgba(30,16,64,0.5)">${escapeHtml(p)}</div>`).join('')}</div>` : ''}
      </div>`;
    }).join('');

  const disclaimerHtml = `<div style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.15);border-radius:12px;padding:8px 12px;display:flex;gap:7px;align-items:flex-start;margin-bottom:10px">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" style="flex-shrink:0;margin-top:2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <div style="font-size:11px;color:rgba(234,88,12,0.75);font-weight:600;line-height:1.45">NeverMind не є медичним сервісом. OWL не ставить діагнози. Завжди консультуйся з лікарем.</div>
  </div>`;

  scrollEl.innerHTML = allergiesHtml + disclaimerHtml + cardsHtml;
}

// B-31 (15.04 6v2eR): функції _renderHealthWeekBars / _renderHealthTodayScales / setHealthScale
// видалені. Legacy шкали 1-10 (Енергія/Сон/Біль) не вписуються у нову концепцію —
// OWL класифікує текст користувача у тренд (покращення/стабільно/погіршення).
// Дані nm_health_log лишаються у localStorage як fallback до Фази 4 (класифікація OWL).

// === ФАЗА 2 (15.04 6v2eR): API для AI tool calling ===
//
// Helper-функції що використовуються з inbox.js handlers для tools:
// create_health_card, edit_health_card, delete_health_card, add_medication,
// edit_medication, log_medication_dose, add_health_history_entry.
// Алергії (add_allergy/delete_allergy) використовують вже існуючі addAllergy/deleteAllergy з ai/memory.js.

// Створити картку програмно (для tool call). Повертає створену картку або null.
// nextAppointment синкається з nm_events автоматично.
export function createHealthCardProgrammatic(opts) {
  const { name, subtitle, doctor, doctorRecommendations, doctorConclusion, startDate, nextAppointment, status, medications, initialHistoryEntry } = opts || {};
  if (!name || !name.trim()) return null;

  const cards = getHealthCards();
  const newCard = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name.trim(),
    subtitle: (subtitle || '').trim(),
    status: status || 'active',
    progress: 0,
    nextStep: '',
    treatments: [],
    medications: Array.isArray(medications) ? medications.map(m => ({
      id: Date.now() + Math.floor(Math.random() * 10000),
      name: m.name || '',
      dosage: m.dosage || '',
      schedule: Array.isArray(m.schedule) ? m.schedule : (m.schedule ? String(m.schedule).split(/[,;]\s*/).filter(Boolean) : []),
      courseDuration: m.courseDuration || '',
      log: [],
      createTasks: !!m.createTasks,
    })) : [],
    analyses: [],
    owlAnalysis: '',
    doctor: doctor || '',
    doctorRecommendations: doctorRecommendations || '',
    doctorConclusion: doctorConclusion || '',
    startDate: startDate || '',
    nextAppointment: null, // встановиться через _syncCardAppointmentToEvent нижче
    history: initialHistoryEntry ? [{ ts: Date.now(), type: 'manual', text: String(initialHistoryEntry) }] : [],
    createdAt: Date.now(),
  };
  newCard.nextAppointment = _syncCardAppointmentToEvent(newCard.id, newCard.name, nextAppointment, null);
  cards.unshift(newCard);
  saveHealthCards(cards);
  return newCard;
}

// Оновити поля існуючої картки. updates — об'єкт з частковими полями.
// Якщо updates.nextAppointment передано — синкається з nm_events.
export function editHealthCardProgrammatic(cardId, updates) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  const old = cards[idx];
  const next = { ...old };
  ['name', 'subtitle', 'doctor', 'doctorRecommendations', 'doctorConclusion', 'startDate', 'status', 'progress', 'nextStep'].forEach(k => {
    if (updates[k] !== undefined) next[k] = updates[k];
  });
  // nextAppointment: синк з подією
  if (updates.nextAppointment !== undefined) {
    const oldEventId = old.nextAppointment && old.nextAppointment.eventId;
    next.nextAppointment = _syncCardAppointmentToEvent(cardId, next.name, updates.nextAppointment, oldEventId);
  }
  cards[idx] = next;
  saveHealthCards(cards);
  return next;
}

// Видалити картку (з trash + синком події у trash).
export function deleteHealthCardProgrammatic(cardId) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1) return false;
  const removed = cards[idx];
  const eventId = removed.nextAppointment && removed.nextAppointment.eventId;
  if (eventId) {
    const events = getEvents();
    const eIdx = events.findIndex(e => e.id === eventId);
    if (eIdx !== -1) {
      const removedEvent = events.splice(eIdx, 1)[0];
      saveEvents(events);
      addToTrash('event', removedEvent);
    }
  }
  cards.splice(idx, 1);
  saveHealthCards(cards);
  addToTrash('health_card', removed);
  return true;
}

// Додати препарат до картки. med — { name, dosage, schedule, courseDuration, createTasks? }
export function addMedicationToCard(cardId, med) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1 || !med || !med.name) return null;
  if (!Array.isArray(cards[idx].medications)) cards[idx].medications = [];
  const newMed = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    name: String(med.name),
    dosage: med.dosage || '',
    schedule: Array.isArray(med.schedule) ? med.schedule : (med.schedule ? String(med.schedule).split(/[,;]\s*/).filter(Boolean) : []),
    courseDuration: med.courseDuration || '',
    log: [],
    createTasks: !!med.createTasks,
  };
  cards[idx].medications.push(newMed);
  saveHealthCards(cards);
  return newMed;
}

// Редагувати препарат у картці.
export function editMedicationInCard(cardId, medId, updates) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  const meds = cards[idx].medications || [];
  const mIdx = meds.findIndex(m => m.id === medId);
  if (mIdx === -1) return null;
  ['name', 'dosage', 'courseDuration'].forEach(k => {
    if (updates[k] !== undefined) meds[mIdx][k] = updates[k];
  });
  if (updates.schedule !== undefined) {
    meds[mIdx].schedule = Array.isArray(updates.schedule)
      ? updates.schedule
      : String(updates.schedule).split(/[,;]\s*/).filter(Boolean);
  }
  saveHealthCards(cards);
  return meds[mIdx];
}

// Записати дозу прийому препарату (Date.now() у med.log[]).
// medQuery — назва препарату (fuzzy match — нечіткий пошук) АБО medId.
export function logMedicationDose(cardId, medQuery) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  const meds = cards[idx].medications || [];
  let med = null;
  if (typeof medQuery === 'number') {
    med = meds.find(m => m.id === medQuery);
  } else if (typeof medQuery === 'string') {
    const q = medQuery.toLowerCase().trim();
    med = meds.find(m => (m.name || '').toLowerCase().includes(q));
  } else if (meds.length === 1) {
    med = meds[0]; // якщо препарат тільки один — без уточнення
  }
  if (!med) return null;
  if (!Array.isArray(med.log)) med.log = [];
  med.log.push(Date.now());
  // Дублюємо у history картки для timeline
  if (!Array.isArray(cards[idx].history)) cards[idx].history = [];
  cards[idx].history.unshift({ ts: Date.now(), type: 'dose_log', text: `Прийняв ${med.name}` });
  saveHealthCards(cards);
  return med;
}

// Додати запис у history картки.
// type: 'manual' | 'doctor_visit' | 'status_change' | 'auto'
export function addHealthHistoryEntry(cardId, type, text) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === cardId);
  if (idx === -1 || !text) return null;
  if (!Array.isArray(cards[idx].history)) cards[idx].history = [];
  const entry = {
    ts: Date.now(),
    type: type || 'manual',
    text: String(text),
  };
  cards[idx].history.unshift(entry);
  saveHealthCards(cards);
  return entry;
}

// === ВІДКРИТИ КАРТКУ (воркспейс) ===
function openHealthCard(id) {
  activeHealthCardId = id;
  renderHealthWorkspace(id);
}

function closeHealthCard() {
  activeHealthCardId = null;
  renderHealthList();
}

// B-29 fix: перемкнути вкладку + відкрити папку (аналог як у Проектах).
// openNotesFolder сам по собі тільки рендерить, але не перемикає tab.
function openHealthNotesFolder(folderName) {
  switchTab('notes');
  setTimeout(() => openNotesFolder(folderName), 150);
}

function renderHealthWorkspace(id) {
  const cards = getHealthCards();
  const card = cards.find(c => c.id === id);
  if (!card) { closeHealthCard(); return; }

  const statusColors = {
    active: { bg: 'rgba(234,88,12,0.1)', color: '#ea580c', label: 'Активне', bar: '#ea580c' },
    controlled: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: 'Під контролем', bar: '#d97706' },
    done: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Завершено ✓', bar: '#16a34a' },
  };
  const st = statusColors[card.status] || statusColors.active;
  const pct = card.progress || 0;
  const meds = card.medications || [];
  // Фаза 1 (15.04 jMR6m): doctorNotes мігровано в history. Читаємо записи лікаря з history.
  const doctorVisits = (card.history || []).filter(h => h.type === 'doctor_visit').sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const analyses = card.analyses || [];
  const owlAnalysis = card.owlAnalysis || '';
  // Фаза 1: помічник для відображення останньої відмітки ліки (з log[])
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isMedTakenToday = m => Array.isArray(m.log) && m.log.some(ts => ts >= todayStart.getTime());

  const scrollEl = document.getElementById('health-scroll');
  if (scrollEl) scrollEl.innerHTML = `
    <!-- Назад -->
    <div onclick="closeHealthCard()" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;cursor:pointer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      <span style="font-size:13px;font-weight:700;color:#1a5c2a">Назад</span>
    </div>

    <!-- Прогрес + статус -->
    <div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:18px;font-weight:900;color:#1e1040">${escapeHtml(card.name)}</div>
          <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">${escapeHtml(card.subtitle || '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <button onclick="openEditHealthCard(${id})" title="Редагувати" style="background:rgba(30,16,64,0.06);border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;color:rgba(30,16,64,0.65);cursor:pointer">Ред.</button>
          <div style="font-size:20px;font-weight:900;color:${st.color};line-height:1">${pct}%</div>
        </div>
      </div>
      <div style="height:6px;background:rgba(30,16,64,0.07);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct}%;background:${st.bar};border-radius:4px;transition:width 0.5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;background:${st.bg};color:${st.color}">${st.label}</div>
        <div style="display:flex;gap:6px">
          ${['active','controlled','done'].map(s => `<button onclick="setHealthCardStatus(${id},'${s}')" style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;border:1px solid ${s === card.status ? st.color : 'rgba(30,16,64,0.15)'};background:${s === card.status ? st.bg : 'transparent'};color:${s === card.status ? st.color : 'rgba(30,16,64,0.4)'};cursor:pointer">${s === 'active' ? 'Активне' : s === 'controlled' ? 'Контроль' : 'Завершено'}</button>`).join('')}
        </div>
      </div>
    </div>

    <!-- B-31 (15.04 6v2eR): блок "Самопочуття сьогодні" (шкали 1-10) прибрано.
         Замінить у Фазі 4 — OWL класифікує текст у тренд покращення/стабільно/погіршення. -->

    <!-- Препарати (Фаза 1: нова структура — dosage, schedule[], log[]) -->
    ${meds.length > 0 ? `<div class="card-glass">
      <div class="section-label">Препарати</div>
      ${meds.map((m,i) => {
        const takenToday = isMedTakenToday(m);
        const schedStr = Array.isArray(m.schedule) && m.schedule.length ? m.schedule.join(', ') : '';
        const course = m.courseDuration ? ' · ' + escapeHtml(m.courseDuration) : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < meds.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.06)' : ''}">
        <div class="icon-circle" style="width:28px;height:28px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="2.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(m.name)}</div>
          <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:1px">${escapeHtml(m.dosage || '')}${course}</div>
        </div>
        <div style="font-size:11px;font-weight:800;color:${takenToday ? '#16a34a' : '#ea580c'}">${takenToday ? '✓ прийнято' : escapeHtml(schedStr)}</div>
      </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Лікар + рекомендації + наступний прийом (Фаза 1 нові поля) -->
    ${(card.doctor || card.doctorRecommendations || card.doctorConclusion || (card.nextAppointment && card.nextAppointment.date)) ? `<div class="card-glass">
      <div class="section-label">Лікування</div>
      ${card.doctor ? `<div style="font-size:11px;color:rgba(30,16,64,0.5);font-weight:600;margin-bottom:4px"><b style="color:#1e1040">Лікар:</b> ${escapeHtml(card.doctor)}</div>` : ''}
      ${card.doctorRecommendations ? `<div style="font-size:11px;color:rgba(30,16,64,0.55);font-weight:600;margin-bottom:4px;line-height:1.45"><b style="color:#1e1040">Рекомендації:</b> ${escapeHtml(card.doctorRecommendations)}</div>` : ''}
      ${card.doctorConclusion ? `<div style="font-size:11px;color:rgba(30,16,64,0.55);font-weight:600;margin-bottom:4px;line-height:1.45"><b style="color:#1e1040">Висновок:</b> ${escapeHtml(card.doctorConclusion)}</div>` : ''}
      ${(card.nextAppointment && card.nextAppointment.date) ? `<div style="font-size:11px;color:#ea580c;font-weight:700;margin-top:6px">📅 Наступний прийом: ${escapeHtml(card.nextAppointment.date)}${card.nextAppointment.time ? ' о ' + escapeHtml(card.nextAppointment.time) : ''}</div>` : ''}
    </div>` : ''}

    <!-- Записи лікаря (Фаза 1: тепер з card.history filter(type=doctor_visit)) -->
    ${doctorVisits.length > 0 ? `<div class="card-glass">
      <div class="section-label">Записи лікаря</div>
      ${doctorVisits.map(h => {
        const d = new Date(h.ts);
        const dateStr = isNaN(d) ? '' : d.toLocaleDateString('uk-UA');
        return `<div style="background:rgba(255,255,255,0.5);border-radius:10px;padding:9px 11px;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.35);margin-bottom:4px">${escapeHtml(dateStr)}</div>
        <div style="font-size:12px;font-weight:600;color:#1e1040;line-height:1.45">${escapeHtml(h.text || '')}</div>
      </div>`;
      }).join('')}
    </div>` : ''}

    <!-- OWL аналіз -->
    ${owlAnalysis ? `<div style="background:rgba(12,6,28,0.78);border-radius:14px;padding:11px 13px;margin-bottom:10px">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:5px">OWL · аналіз</div>
      <div style="font-size:12px;font-weight:600;color:white;line-height:1.55">${escapeHtml(owlAnalysis)}</div>
    </div>` : ''}

    <!-- Нотатки → папка (B-29 fix: switchTab + delayed openNotesFolder) -->
    <div onclick="openHealthNotesFolder('${escapeHtml(card.name)}')" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.55);border:1.5px dashed rgba(30,16,64,0.14);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer">
      <div class="icon-circle" style="width:30px;height:30px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#1e1040">Нотатки · ${escapeHtml(card.name)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:1px">Перейти у вкладку Нотатки →</div>
      </div>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.25)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Дисклеймер -->
    <div style="background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.15);border-radius:10px;padding:7px 10px;display:flex;gap:6px;align-items:flex-start;margin-bottom:10px">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" style="flex-shrink:0;margin-top:2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
      <div style="font-size:10px;color:rgba(234,88,12,0.7);font-weight:600;line-height:1.45">Для діагностики і лікування консультуйся з лікарем.</div>
    </div>
  `;
}

function setHealthCardStatus(id, status) {
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === id);
  if (idx !== -1) {
    const progress = status === 'done' ? 100 : status === 'controlled' ? 70 : cards[idx].progress || 0;
    cards[idx] = { ...cards[idx], status, progress };
    saveHealthCards(cards);
    renderHealthWorkspace(id);
  }
}

// === ДОДАТИ НОВУ КАРТКУ ===
// Створює картку у НОВІЙ структурі (Фаза 1, 15.04 jMR6m).
// Нормальний флоу створення через Inbox + чат-бари + tool calling — Фаза 2.
// B-30 (15.04 6v2eR): prompt() замінено на стилізовану модалку #health-card-modal.
// B-27 (15.04 6v2eR): та сама модалка використовується для редагування існуючих карток
// (UI доступу до нових полів Фази 1 — лікар, рекомендації, висновок, препарати, дати).
// Режими: 'create' (новий стан) / 'edit' (редагування). Id активної картки у _editingHealthCardId.
let _editingHealthCardId = null;

function openAddHealthCard() {
  _editingHealthCardId = null;
  _fillHealthCardModal(null);
  _showHealthCardModal('Новий стан', false);
}

function openEditHealthCard(id) {
  const card = getHealthCards().find(c => c.id === id);
  if (!card) return;
  _editingHealthCardId = id;
  _fillHealthCardModal(card);
  _showHealthCardModal('Редагувати стан', true);
}

function _showHealthCardModal(title, showDelete) {
  const modal = document.getElementById('health-card-modal');
  if (!modal) return;
  const titleEl = document.getElementById('health-card-modal-title');
  const delBtn = document.getElementById('health-card-delete-btn');
  if (titleEl) titleEl.textContent = title;
  if (delBtn) delBtn.style.display = showDelete ? 'block' : 'none';
  modal.style.display = 'flex';
  // iOS fix — фокус на перше поле з затримкою
  setTimeout(() => {
    const nameEl = document.getElementById('health-card-name');
    if (nameEl && !showDelete) nameEl.focus();
  }, 100);
}

function closeHealthCardModal() {
  const modal = document.getElementById('health-card-modal');
  if (modal) modal.style.display = 'none';
  _editingHealthCardId = null;
}

// Заповнити поля модалки. Якщо card=null — порожня форма (режим create).
function _fillHealthCardModal(card) {
  const c = card || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('health-card-name', c.name);
  setVal('health-card-subtitle', c.subtitle);
  setVal('health-card-doctor', c.doctor);
  setVal('health-card-recommendations', c.doctorRecommendations);
  setVal('health-card-conclusion', c.doctorConclusion);
  setVal('health-card-start-date', c.startDate);
  setVal('health-card-appt-date', c.nextAppointment && c.nextAppointment.date ? c.nextAppointment.date : '');
  setVal('health-card-appt-time', c.nextAppointment && c.nextAppointment.time ? c.nextAppointment.time : '');

  // Статус
  const status = c.status || 'active';
  document.querySelectorAll('.health-status-btn').forEach(btn => {
    const isActive = btn.dataset.status === status;
    btn.dataset.active = isActive ? '1' : '0';
    btn.style.background = isActive ? '#1a5c2a' : 'white';
    btn.style.color = isActive ? 'white' : 'rgba(30,16,64,0.5)';
    btn.style.borderColor = isActive ? '#1a5c2a' : 'rgba(30,16,64,0.12)';
    btn.onclick = () => _setHealthCardModalStatus(btn.dataset.status);
  });

  // Препарати
  const medsList = document.getElementById('health-card-meds-list');
  if (medsList) {
    medsList.innerHTML = '';
    const meds = c.medications || [];
    meds.forEach(m => _appendMedicationRow(m));
  }
}

function _setHealthCardModalStatus(status) {
  document.querySelectorAll('.health-status-btn').forEach(btn => {
    const isActive = btn.dataset.status === status;
    btn.dataset.active = isActive ? '1' : '0';
    btn.style.background = isActive ? '#1a5c2a' : 'white';
    btn.style.color = isActive ? 'white' : 'rgba(30,16,64,0.5)';
    btn.style.borderColor = isActive ? '#1a5c2a' : 'rgba(30,16,64,0.12)';
  });
}

function _getHealthCardModalStatus() {
  for (const btn of document.querySelectorAll('.health-status-btn')) {
    if (btn.dataset.active === '1') return btn.dataset.status;
  }
  return 'active';
}

function addHealthMedicationRow() {
  _appendMedicationRow({ name: '', dosage: '', schedule: [], courseDuration: '' });
}

function _appendMedicationRow(m) {
  const list = document.getElementById('health-card-meds-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'health-med-row';
  row.style.cssText = 'display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,0.55);border:1.5px solid rgba(30,16,64,0.08);border-radius:12px;padding:10px';
  const schedStr = Array.isArray(m.schedule) ? m.schedule.join(', ') : (m.schedule || '');
  row.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center">
      <input type="text" class="med-name" placeholder="Назва (Омез)" value="${escapeHtml(m.name || '')}"
        style="flex:1;border:1px solid rgba(30,16,64,0.1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;background:white">
      <button type="button" onclick="this.closest('.health-med-row').remove()" style="background:none;border:none;font-size:20px;color:rgba(30,16,64,0.3);cursor:pointer;padding:0 4px">×</button>
    </div>
    <div style="display:flex;gap:6px">
      <input type="text" class="med-dosage" placeholder="Дозування (20мг)" value="${escapeHtml(m.dosage || '')}"
        style="flex:1;border:1px solid rgba(30,16,64,0.1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;background:white">
      <input type="text" class="med-course" placeholder="Курс (14 днів)" value="${escapeHtml(m.courseDuration || '')}"
        style="flex:1;border:1px solid rgba(30,16,64,0.1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;background:white">
    </div>
    <input type="text" class="med-schedule" placeholder="Графік (08:00, 20:00)" value="${escapeHtml(schedStr)}"
      style="width:100%;border:1px solid rgba(30,16,64,0.1);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;background:white;box-sizing:border-box">
  `;
  list.appendChild(row);
}

// === ФАЗА 1.5 (15.04 6v2eR): СИНК КАРТКА ↔ ПОДІЯ ===
//
// Синхронізує `card.nextAppointment` з подією у nm_events.
// Викликається після save картки.
//
// Логіка:
//   appt є + eventId є  → оновити подію (title/date/time)
//   appt є + eventId нема → створити нову подію, повернути її id для запису в картку
//   appt нема + eventId є → видалити стару подію (через trash)
//   appt нема + eventId нема → нічого не робити
//
// Поверне oновлену структуру nextAppointment (з eventId якщо створена нова подія).
// Структура події розширена: sourceCardId (id картки-джерела), archived (для минулих прийомів).
function _syncCardAppointmentToEvent(cardId, cardName, newAppointment, oldEventId) {
  const events = getEvents();
  const hasNewAppt = newAppointment && newAppointment.date;

  // appt прибрано — видалити стару подію якщо була
  if (!hasNewAppt && oldEventId) {
    const idx = events.findIndex(e => e.id === oldEventId);
    if (idx !== -1) {
      const removed = events.splice(idx, 1)[0];
      saveEvents(events);
      addToTrash('event', removed);
    }
    return null;
  }
  if (!hasNewAppt) return null;

  const title = `Прийом: ${cardName}`;

  // Оновити існуючу
  if (oldEventId) {
    const idx = events.findIndex(e => e.id === oldEventId);
    if (idx !== -1) {
      events[idx].title = title;
      events[idx].date = newAppointment.date;
      events[idx].time = newAppointment.time || '';
      events[idx].priority = 'important';
      events[idx].sourceCardId = cardId;
      // Якщо подія раніше була архівована (минулий прийом), а юзер виставив нову дату — реактивувати
      if (events[idx].archived && newAppointment.date >= new Date().toISOString().slice(0, 10)) {
        events[idx].archived = false;
      }
      saveEvents(events);
      return { date: newAppointment.date, time: newAppointment.time || '', eventId: oldEventId };
    }
    // eventId був, але події нема (видалили з Календаря) → fall through на create
  }

  // Створити нову
  const newEvent = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title,
    date: newAppointment.date,
    time: newAppointment.time || '',
    priority: 'important',
    sourceCardId: cardId,
    createdAt: Date.now(),
  };
  events.push(newEvent);
  saveEvents(events);
  return { date: newAppointment.date, time: newAppointment.time || '', eventId: newEvent.id };
}

// Архівація минулих прийомів. Викликається lazy у renderHealth().
// Для кожної картки з nextAppointment у минулому:
//   - подія у nm_events позначається archived:true (не видаляється — лишається у Календарі як історія)
//   - у card.history додається запис типу 'doctor_visit' ("Прийом відбувся {date}")
//   - card.nextAppointment очищається щоб звільнити слот
function _archivePastAppointments() {
  const cards = getHealthCards();
  const todayISO = new Date().toISOString().slice(0, 10);
  let cardsChanged = false;
  let eventsChanged = false;
  const events = getEvents();

  cards.forEach(card => {
    const appt = card.nextAppointment;
    if (!appt || !appt.date || appt.date >= todayISO) return;

    // Минула — архівуємо
    if (appt.eventId) {
      const ev = events.find(e => e.id === appt.eventId);
      if (ev && !ev.archived) {
        ev.archived = true;
        eventsChanged = true;
      }
    }
    // Запис у history
    if (!Array.isArray(card.history)) card.history = [];
    card.history.unshift({
      ts: Date.now(),
      type: 'doctor_visit',
      text: `Прийом відбувся ${appt.date}${appt.time ? ' о ' + appt.time : ''}`,
    });
    card.nextAppointment = null;
    cardsChanged = true;
  });

  if (eventsChanged) saveEvents(events);
  if (cardsChanged) saveHealthCards(cards);
}

// Перевірка orphan-карток: якщо card.nextAppointment.eventId вказує на подію якої більше нема
// (видалена з Календаря) — лишаємо nextAppointment але прибираємо eventId, щоб при наступному
// save картки створилась нова подія замість пошуку видаленої.
function _detectOrphanAppointments() {
  const cards = getHealthCards();
  const eventIds = new Set(getEvents().map(e => e.id));
  let changed = false;

  cards.forEach(card => {
    const appt = card.nextAppointment;
    if (appt && appt.eventId && !eventIds.has(appt.eventId)) {
      delete appt.eventId;
      changed = true;
    }
  });

  if (changed) saveHealthCards(cards);
}

// Зворотний синк дат: якщо подія була змінена у Календарі (нова дата/час), оновити
// відповідне card.nextAppointment. Робимо lazy щоб не імпортувати health у calendar.js
// (уникнення circular dependency — циклічної залежності між модулями).
function _syncEventDatesToCards() {
  const cards = getHealthCards();
  const events = getEvents();
  let changed = false;

  cards.forEach(card => {
    const appt = card.nextAppointment;
    if (!appt || !appt.eventId) return;
    const ev = events.find(e => e.id === appt.eventId);
    if (!ev) return; // orphan — обробить _detectOrphanAppointments
    const evTime = ev.time || '';
    if (ev.date !== appt.date || evTime !== (appt.time || '')) {
      appt.date = ev.date;
      appt.time = evTime;
      changed = true;
    }
  });

  if (changed) saveHealthCards(cards);
}

function saveHealthCardFromModal() {
  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const name = getVal('health-card-name');
  if (!name) { showToast('Потрібна назва'); return; }

  const subtitle = getVal('health-card-subtitle');
  const doctor = getVal('health-card-doctor');
  const doctorRecommendations = getVal('health-card-recommendations');
  const doctorConclusion = getVal('health-card-conclusion');
  const startDate = getVal('health-card-start-date');
  const apptDate = getVal('health-card-appt-date');
  const apptTime = getVal('health-card-appt-time');
  const nextAppointment = apptDate ? { date: apptDate, time: apptTime } : null;
  const status = _getHealthCardModalStatus();

  // Препарати
  const meds = [];
  document.querySelectorAll('.health-med-row').forEach(row => {
    const mName = row.querySelector('.med-name')?.value.trim() || '';
    if (!mName) return;
    const dosage = row.querySelector('.med-dosage')?.value.trim() || '';
    const courseDuration = row.querySelector('.med-course')?.value.trim() || '';
    const schedStr = row.querySelector('.med-schedule')?.value.trim() || '';
    const schedule = schedStr ? schedStr.split(/[,;]\s*/).filter(Boolean) : [];
    meds.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: mName,
      dosage,
      schedule,
      courseDuration,
      log: [],
      createTasks: false,
    });
  });

  const cards = getHealthCards();
  if (_editingHealthCardId) {
    // Edit режим
    const idx = cards.findIndex(c => c.id === _editingHealthCardId);
    if (idx !== -1) {
      // Зберегти старі log[] для медикаментів з тим же ім'ям
      const oldMeds = cards[idx].medications || [];
      meds.forEach(newMed => {
        const old = oldMeds.find(o => o.name === newMed.name);
        if (old && Array.isArray(old.log)) newMed.log = old.log;
      });
      // Фаза 1.5: синк nextAppointment ↔ nm_events.
      // Передаємо старий eventId з картки, отримуємо оновлений nextAppointment з eventId.
      const oldEventId = cards[idx].nextAppointment && cards[idx].nextAppointment.eventId;
      const syncedAppt = _syncCardAppointmentToEvent(cards[idx].id, name, nextAppointment, oldEventId);
      cards[idx] = {
        ...cards[idx],
        name, subtitle, doctor, doctorRecommendations, doctorConclusion,
        startDate, nextAppointment: syncedAppt, status, medications: meds,
      };
      saveHealthCards(cards);
      showToast('✓ Збережено');
    }
  } else {
    // Create режим
    const newCard = {
      id: Date.now(),
      name, subtitle,
      status,
      progress: 0,
      nextStep: '',
      treatments: [],
      medications: meds,
      analyses: [],
      owlAnalysis: '',
      doctor, doctorRecommendations, doctorConclusion,
      startDate, nextAppointment,
      history: [],
      createdAt: Date.now(),
    };
    // Фаза 1.5: синк — створює подію якщо є nextAppointment.date, повертає nextAppointment з eventId.
    newCard.nextAppointment = _syncCardAppointmentToEvent(newCard.id, name, nextAppointment, null);
    cards.unshift(newCard);
    saveHealthCards(cards);
    showToast('✓ Картку додано');
  }

  closeHealthCardModal();
  renderHealth();
}

function deleteHealthCardFromModal() {
  if (!_editingHealthCardId) return;
  if (!confirm('Видалити картку назавжди?')) return;
  const cards = getHealthCards();
  const idx = cards.findIndex(c => c.id === _editingHealthCardId);
  if (idx !== -1) {
    // Фаза 1.5: видалити прив'язану подію (через trash, не назавжди)
    const removed = cards[idx];
    const eventId = removed.nextAppointment && removed.nextAppointment.eventId;
    if (eventId) {
      const events = getEvents();
      const eIdx = events.findIndex(e => e.id === eventId);
      if (eIdx !== -1) {
        const removedEvent = events.splice(eIdx, 1)[0];
        saveEvents(events);
        addToTrash('event', removedEvent);
      }
    }
    cards.splice(idx, 1);
    saveHealthCards(cards);
    showToast('Картку видалено');
  }
  closeHealthCardModal();
  activeHealthCardId = null;
  renderHealth();
}

// === ДОДАТИ АЛЕРГІЮ (Фаза 1, простий UI з prompt — розширити у Фазі 3) ===
function openAddAllergy() {
  const name = prompt('Назва алергену (наприклад: горіхи, пеніцилін, лактоза):');
  if (!name || !name.trim()) return;
  const notes = prompt('Нотатки (необов\'язково — симптоми, деталі реакції):') || '';
  const added = addAllergy(name, notes);
  if (added) {
    showToast('✓ Алергію додано');
    renderHealth();
  } else {
    showToast('Така алергія вже є');
  }
}

function deleteAllergyById(id) {
  if (!confirm('Видалити алергію?')) return;
  if (deleteAllergy(id)) {
    showToast('Алергію видалено');
    renderHealth();
  }
}

// Білдер HTML картки алергій — повертає рядок (вставляється з renderHealthList).
// Раніше писав напряму в #health-allergies-card, але після видалення статичного DOM
// в index.html (B-28 fix) — все рендериться через innerHTML #health-scroll.
function _buildAllergiesCardHtml() {
  const allergies = getAllergies();
  const coralBg = 'rgba(255,120,117,0.08)';
  const coralBorder = 'rgba(255,120,117,0.28)';
  const coralText = '#d9534f';

  if (allergies.length === 0) {
    return `<div style="background:${coralBg};border:1.5px solid ${coralBorder};border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:800;color:${coralText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">Алергії</div>
        <div style="font-size:11px;color:rgba(30,16,64,0.5);font-weight:600">Немає записаних. OWL не знає про що попереджати.</div>
      </div>
      <button onclick="openAddAllergy()" style="font-size:11px;font-weight:800;padding:6px 11px;border-radius:8px;border:1.5px solid ${coralBorder};background:white;color:${coralText};cursor:pointer;white-space:nowrap;flex-shrink:0">+ Додати</button>
    </div>`;
  }

  return `<div style="background:${coralBg};border:1.5px solid ${coralBorder};border-radius:12px;padding:10px 12px;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
      <div style="font-size:10px;font-weight:800;color:${coralText};text-transform:uppercase;letter-spacing:0.08em">🚨 Алергії (${allergies.length})</div>
      <button onclick="openAddAllergy()" style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:7px;border:1.5px solid ${coralBorder};background:white;color:${coralText};cursor:pointer">+ Додати</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${allergies.map(a => `<div style="background:white;border:1.5px solid ${coralBorder};border-radius:8px;padding:5px 8px 5px 10px;display:flex;align-items:center;gap:8px">
        <div>
          <div style="font-size:12px;font-weight:800;color:${coralText};line-height:1.2">${escapeHtml(a.name)}</div>
          ${a.notes ? `<div style="font-size:9px;color:rgba(30,16,64,0.45);font-weight:600;margin-top:1px">${escapeHtml(a.notes)}</div>` : ''}
        </div>
        <div onclick="deleteAllergyById(${a.id})" style="cursor:pointer;font-size:16px;color:rgba(30,16,64,0.35);line-height:1;padding:0 2px" title="Видалити">×</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// Контекст здоров'я для AI (Фаза 1 переписано 15.04 jMR6m — експортується і підключається у getAIContext)
// Включає: алергії (завжди зверху, УВАГА-попередження), активні/контрольовані картки з усіма полями,
// ліки з графіком, наступні прийоми, legacy-шкали (fallback до Фази 3).
export function getHealthContext() {
  const parts = [];

  // Алергії — ЗАВЖДИ зверху. Активні правила для OWL у всіх чатах.
  // Фаза 2 (15.04 6v2eR): id видно у контексті — для tools delete_allergy + 4.12 антидублювання.
  const allergies = getAllergies();
  if (allergies.length > 0) {
    const list = allergies.map(a => `[ID:${a.id}] ${a.name}${a.notes ? ' (' + a.notes + ')' : ''}`).join(', ');
    parts.push(`🚨 АЛЕРГІЇ (УВАГА — попереджай юзера при будь-якій згадці цих алергенів у записах Inbox/Фінансів/Нотаток: ${list})`);
  }

  // Картки стану
  const cards = getHealthCards();
  const active = cards.filter(c => c.status === 'active' || c.status === 'controlled');
  if (active.length > 0) {
    parts.push(`Активні стани здоров'я (${active.length}):`);
    active.slice(0, 5).forEach(card => {
      const lines = [`- [ID:${card.id}] "${card.name}"${card.subtitle ? ' — ' + card.subtitle : ''} [${card.status}, прогрес: ${card.progress || 0}%]`];
      if (card.startDate) {
        const d = new Date(card.startDate);
        if (!isNaN(d)) {
          const daysSince = Math.round((Date.now() - d.getTime()) / 86400000);
          if (daysSince >= 0) lines.push(`  курс: ${daysSince} дн від ${card.startDate}`);
        }
      }
      if (card.doctor) lines.push(`  лікар: ${card.doctor}`);
      if (card.doctorRecommendations) lines.push(`  рекомендації: ${card.doctorRecommendations}`);
      if (card.nextAppointment && card.nextAppointment.date) {
        const t = card.nextAppointment.time ? ' ' + card.nextAppointment.time : '';
        lines.push(`  наступний прийом: ${card.nextAppointment.date}${t}`);
      }
      if (Array.isArray(card.medications) && card.medications.length > 0) {
        const meds = card.medications.map(m => {
          const sched = Array.isArray(m.schedule) && m.schedule.length ? ' (' + m.schedule.join(', ') + ')' : '';
          const course = m.courseDuration ? ' · курс ' + m.courseDuration : '';
          // Фаза 2: med id у контексті — для tools edit_medication + log_medication_dose
          return `[medID:${m.id}] ${m.name}${m.dosage ? ' ' + m.dosage : ''}${sched}${course}`;
        }).join('; ');
        lines.push(`  ліки: ${meds}`);
      }
      if (card.nextStep) lines.push(`  наступний крок: ${card.nextStep}`);
      parts.push(lines.join('\n'));
    });
  }

  // Legacy шкали (fallback — живуть до Фази 3)
  const log = getHealthLog();
  const today = new Date().toDateString();
  const entry = log[today] || {};
  if (entry.energy || entry.sleep || entry.pain) {
    parts.push(`Самопочуття сьогодні (legacy шкали 1-10): Енергія ${entry.energy||'—'}, Сон ${entry.sleep||'—'}, Біль ${entry.pain||'—'}`);
  }

  return parts.join('\n');
}

// === HEALTH AI BAR ===
function addHealthChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('health-chat-messages');
  if (!el) return;
  if (_healthTypingEl) { _healthTypingEl.remove(); _healthTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _healthTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('health'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') healthBarHistory.push({ role: 'user', content: text });
  else healthBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('health', role, text);
}

export async function sendHealthBarMessage() {
  if (healthBarLoading) return;
  const input = document.getElementById('health-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addHealthChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addHealthChatMsg('user', text);
  healthBarLoading = true;
  addHealthChatMsg('typing', '');

  const cards = getHealthCards();
  const activeCard = activeHealthCardId ? cards.find(c => c.id === activeHealthCardId) : null;
  // Фаза 1 (15.04 jMR6m): getHealthContext() тепер включений у getAIContext() — локальний виклик прибрано (уникнути дублювання токенів).
  const aiContext = getAIContext();

  const systemPrompt = `${getOWLPersonality()} Ти допомагаєш з вкладкою Здоров'я в NeverMind.
ВАЖЛИВО: Ти НЕ лікар і НЕ ставиш діагнози. Тільки допомагаєш відслідковувати і систематизувати.
${activeCard ? `Активна картка: "${activeCard.name}" — ${activeCard.subtitle || ''}. Статус: ${activeCard.status}. Прогрес: ${activeCard.progress}%.` : ''}
${aiContext ? '\n\n' + aiContext : ''}

Ти можеш (відповідай JSON якщо потрібна дія):
- Зберегти запис про самопочуття: {"action":"log_health","energy":7,"sleep":8,"pain":2}
- Додати препарат до картки: {"action":"add_medication","card_id":${activeHealthCardId || 'null'},"name":"назва","dose":"дозування","time":"час"}
- Записати нотатку: {"action":"create_note","text":"текст","folder":"${activeCard ? activeCard.name : 'Здоровʼя'}"}
- Оновити прогрес картки: {"action":"update_health_progress","card_id":${activeHealthCardId || 'null'},"progress":число 0-100,"nextStep":"наступний крок"}
Також вмієш (для будь-яких записів, не тільки здоров'я):
- Задача: {"action":"create_task","title":"назва","steps":[]}
- Звичка: {"action":"create_habit","name":"назва","days":[0,1,2,3,4,5,6]}
- Редагувати звичку: {"action":"edit_habit","habit_id":ID,"name":"нова назва","days":[0,1,2,3,4,5,6]}
- Закрити задачу: {"action":"complete_task","task_id":ID}
- Відмітити звичку: {"action":"complete_habit","habit_name":"назва"}
- Редагувати задачу: {"action":"edit_task","task_id":ID,"title":"назва","dueDate":"YYYY-MM-DD","priority":"normal|important|critical"}
- Видалити задачу: {"action":"delete_task","task_id":ID}
- Видалити звичку: {"action":"delete_habit","habit_id":ID}
- Перевідкрити задачу: {"action":"reopen_task","task_id":ID}
- Записати момент дня: {"action":"add_moment","text":"що сталося"}
- Витрата: {"action":"save_finance","fin_type":"expense","amount":число,"category":"категорія","comment":"текст"}
- Дохід: {"action":"save_finance","fin_type":"income","amount":число,"category":"категорія","comment":"текст"}
- Подія з датою: {"action":"create_event","title":"назва","date":"YYYY-MM-DD","time":null,"priority":"normal"}
- Змінити подію: {"action":"edit_event","event_id":ID,"date":"YYYY-MM-DD"}
- Видалити подію: {"action":"delete_event","event_id":ID}
- Змінити нотатку: {"action":"edit_note","note_id":ID,"text":"новий текст"}
- Розпорядок: {"action":"save_routine","day":"mon" або масив,"blocks":[{"time":"07:00","activity":"Підйом"}]}
- Нагадування: {"action":"set_reminder","time":"HH:MM","text":"що нагадати","date":"YYYY-MM-DD"} (date за замовч.=сьогодні). "НАГАДАЙ" = ЗАВЖДИ set_reminder. Маркери: вранці=08:00, вдень=12:00, після обіду=14:00, ввечері=18:00, перед сном=22:00
ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.
Інакше — відповідай текстом 1-3 речення українською. НЕ вигадуй медичних рекомендацій.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...healthBarHistory.slice(-8)], max_tokens: 250, temperature: 0.6 })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) { addHealthChatMsg('agent', 'Щось пішло не так.'); healthBarLoading = false; return; }

    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : reply);

      if (parsed.action === 'log_health') {
        // B-31 (15.04 6v2eR): legacy action — шкали 1-10 прибрано з UI.
        // Запис даних лишаємо (fallback для старих AI відповідей), але без рендеру.
        // Буде повністю замінено у Фазі 4 — класифікація тексту у тренд.
        const log = getHealthLog();
        const today = new Date().toDateString();
        if (!log[today]) log[today] = {};
        if (parsed.energy) log[today].energy = parseInt(parsed.energy);
        if (parsed.sleep) log[today].sleep = parseInt(parsed.sleep);
        if (parsed.pain !== undefined) log[today].pain = parseInt(parsed.pain);
        saveHealthLog(log);
        addHealthChatMsg('agent', `✓ Записав самопочуття.`);
      } else if (parsed.action === 'update_health_progress' && parsed.card_id) {
        const cards = getHealthCards();
        const idx = cards.findIndex(c => c.id === parsed.card_id);
        if (idx !== -1) {
          cards[idx].progress = Math.min(100, Math.max(0, parsed.progress || 0));
          if (parsed.nextStep) cards[idx].nextStep = parsed.nextStep;
          saveHealthCards(cards);
          renderHealth();
          addHealthChatMsg('agent', `✓ Оновлено прогрес: ${cards[idx].progress}%${parsed.nextStep ? ' → ' + parsed.nextStep : ''}`);
        }
      } else if (parsed.action === 'add_medication' && parsed.card_id) {
        const cards = getHealthCards();
        const idx = cards.findIndex(c => c.id === parsed.card_id);
        if (idx !== -1) {
          if (!cards[idx].medications) cards[idx].medications = [];
          cards[idx].medications.push({ name: parsed.name, dose: parsed.dose || '', time: parsed.time || '', taken: false });
          if (parsed.name && !cards[idx].treatments.includes(parsed.name)) cards[idx].treatments.push(parsed.name);
          saveHealthCards(cards);
          renderHealth();
          addHealthChatMsg('agent', `✓ Додав ${parsed.name} до картки`);
        }
      } else if (processUniversalAction(parsed, text, addHealthChatMsg)) {
        // handled
      } else {
        safeAgentReply(reply, addHealthChatMsg);
      }
    } catch { safeAgentReply(reply, addHealthChatMsg); }
  } catch { addHealthChatMsg('agent', 'Мережева помилка.'); }
  healthBarLoading = false;
}

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddHealthCard, sendHealthBarMessage,
  openHealthCard, closeHealthCard, setHealthCardStatus,
  openAddAllergy, deleteAllergyById,
  openHealthNotesFolder,
  // B-27 + B-30 (15.04 6v2eR): модалка створення/редагування
  openEditHealthCard, closeHealthCardModal, saveHealthCardFromModal,
  deleteHealthCardFromModal, addHealthMedicationRow,
});
