// ============================================================
// app-health.js — Здоров'я — картки, трекер, AI bar
// Функції: renderHealth, openAddHealthCard, saveHealthCard, renderHealthCard, sendHealthBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { showToast } from '../core/nav.js';
import { escapeHtml } from '../core/utils.js';
import { getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { processUniversalAction } from './habits.js';
import { openNotesFolder } from './notes.js';

// === STORAGE ===
export function getHealthCards() { return JSON.parse(localStorage.getItem('nm_health_cards') || '[]'); }
function saveHealthCards(arr) { localStorage.setItem('nm_health_cards', JSON.stringify(arr)); }
export function getHealthLog() { return JSON.parse(localStorage.getItem('nm_health_log') || '{}'); }
function saveHealthLog(obj) { localStorage.setItem('nm_health_log', JSON.stringify(obj)); }

// State
let activeHealthCardId = null; // null = список, id = воркспейс
let healthBarLoading = false;
let healthBarHistory = [];
let _healthTypingEl = null;

// === RENDER HEALTH (головний екран — список) ===
export function renderHealth() {
  if (activeHealthCardId !== null) {
    renderHealthWorkspace(activeHealthCardId);
    return;
  }
  renderHealthList();
}

function renderHealthList() {
  _renderHealthWeekBars();
  _renderHealthTodayScales();

  const cards = getHealthCards();
  const listEl = document.getElementById('health-cards-list');
  const emptyEl = document.getElementById('health-empty');
  if (!listEl) return;

  if (cards.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const statusColors = {
    active: { bg: 'rgba(234,88,12,0.1)', color: '#ea580c', label: 'Активне', bar: '#ea580c', opacity: 1 },
    controlled: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: 'Під контролем', bar: '#d97706', opacity: 1 },
    done: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Завершено ✓', bar: '#16a34a', opacity: 0.5 },
  };

  listEl.innerHTML = cards.map(card => {
    const st = statusColors[card.status] || statusColors.active;
    const pct = card.progress || 0;
    const nextStep = card.nextStep || '';
    const pills = (card.treatments || []).slice(0, 4);
    const isDone = card.status === 'done';
    return `<div onclick="openHealthCard(${card.id})" style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:13px 14px;margin-bottom:10px;cursor:pointer;opacity:${st.opacity}">
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
}

// Трекер тижня — три шкали (Енергія/Сон/Біль)
function _renderHealthWeekBars() {
  const el = document.getElementById('health-week-bars');
  if (!el) return;
  const log = getHealthLog();
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7;
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const maxH = 36;

  el.innerHTML = days.map((d, i) => {
    const daysAgo = todayDow - i;
    const future = daysAgo < 0;
    if (future) {
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end">
        <div style="display:flex;gap:1px;align-items:flex-end;height:${maxH}px">
          <div style="width:5px;height:3px;background:rgba(30,16,64,0.05);border-radius:2px 2px 0 0"></div>
          <div style="width:5px;height:3px;background:rgba(30,16,64,0.05);border-radius:2px 2px 0 0"></div>
          <div style="width:5px;height:3px;background:rgba(30,16,64,0.04);border-radius:2px 2px 0 0"></div>
        </div>
        <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.25)">${d}</div>
      </div>`;
    }
    const date = new Date(now); date.setDate(now.getDate() - daysAgo);
    const ds = date.toDateString();
    const entry = log[ds] || {};
    const energy = entry.energy || 0;
    const sleep = entry.sleep || 0;
    const pain = entry.pain || 0;
    const eH = energy > 0 ? Math.max(3, Math.round(energy / 10 * maxH)) : 3;
    const sH = sleep > 0 ? Math.max(3, Math.round(sleep / 10 * maxH)) : 3;
    const pHraw = pain > 0 ? Math.max(3, Math.round(pain / 10 * maxH)) : 3;
    const eColor = energy > 0 ? (energy >= 7 ? '#16a34a' : energy >= 4 ? '#d97706' : '#ef4444') : 'rgba(30,16,64,0.07)';
    const sColor = sleep > 0 ? '#6366f1' : 'rgba(30,16,64,0.07)';
    const pColor = pain > 0 ? (pain <= 3 ? 'rgba(239,68,68,0.3)' : pain <= 6 ? '#f97316' : '#ef4444') : 'rgba(30,16,64,0.05)';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end">
      <div style="display:flex;gap:1px;align-items:flex-end;height:${maxH}px">
        <div style="width:5px;height:${eH}px;background:${eColor};border-radius:2px 2px 0 0"></div>
        <div style="width:5px;height:${sH}px;background:${sColor};border-radius:2px 2px 0 0"></div>
        <div style="width:5px;height:${pHraw}px;background:${pColor};border-radius:2px 2px 0 0"></div>
      </div>
      <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.35)">${d}</div>
    </div>`;
  }).join('');
}

// Шкали сьогодні — тап щоб виставити значення
function _renderHealthTodayScales() {
  const el = document.getElementById('health-today-scales');
  if (!el) return;
  const log = getHealthLog();
  const today = new Date().toDateString();
  const entry = log[today] || {};

  const scales = [
    { key: 'energy', label: 'Енергія', color: '#16a34a' },
    { key: 'sleep', label: 'Сон', color: '#6366f1' },
    { key: 'pain', label: 'Біль', color: '#ef4444' },
  ];

  el.innerHTML = scales.map(s => {
    const val = entry[s.key] || 0;
    const dots = Array.from({length: 10}, (_, i) => {
      const filled = i < val;
      return `<div onclick="setHealthScale('${s.key}',${i+1})" style="width:11px;height:11px;border-radius:3px;background:${filled ? s.color : 'rgba(30,16,64,0.08)'};cursor:pointer;transition:background 0.15s"></div>`;
    }).join('');
    return `<div style="text-align:center">
      <div style="font-size:10px;font-weight:700;color:${s.color};margin-bottom:5px">${s.label}</div>
      <div style="display:flex;gap:1px;flex-wrap:wrap;justify-content:center">${dots}</div>
      <div style="font-size:9px;color:rgba(30,16,64,0.35);font-weight:600;margin-top:3px">${val > 0 ? val + '/10' : '—'}</div>
    </div>`;
  }).join('');
}

function setHealthScale(key, val) {
  const log = getHealthLog();
  const today = new Date().toDateString();
  if (!log[today]) log[today] = {};
  // Тап на вже виставлене значення — скидає до 0
  log[today][key] = log[today][key] === val ? 0 : val;
  saveHealthLog(log);
  _renderHealthTodayScales();
  _renderHealthWeekBars();
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

function renderHealthWorkspace(id) {
  const cards = getHealthCards();
  const card = cards.find(c => c.id === id);
  if (!card) { closeHealthCard(); return; }

  const log = getHealthLog();
  const today = new Date().toDateString();
  const entry = log[today] || {};

  const statusColors = {
    active: { bg: 'rgba(234,88,12,0.1)', color: '#ea580c', label: 'Активне', bar: '#ea580c' },
    controlled: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: 'Під контролем', bar: '#d97706' },
    done: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', label: 'Завершено ✓', bar: '#16a34a' },
  };
  const st = statusColors[card.status] || statusColors.active;
  const pct = card.progress || 0;
  const meds = card.medications || [];
  const doctorNotes = card.doctorNotes || [];
  const analyses = card.analyses || [];
  const owlAnalysis = card.owlAnalysis || '';

  const scrollEl = document.getElementById('health-scroll');
  if (scrollEl) scrollEl.innerHTML = `
    <!-- Назад -->
    <div onclick="closeHealthCard()" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;cursor:pointer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      <span style="font-size:13px;font-weight:700;color:#1a5c2a">Назад</span>
    </div>

    <!-- Прогрес + статус -->
    <div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:13px 14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-size:18px;font-weight:900;color:#1e1040">${escapeHtml(card.name)}</div>
          <div style="font-size:11px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">${escapeHtml(card.subtitle || '')}</div>
        </div>
        <div style="font-size:20px;font-weight:900;color:${st.color};line-height:1;margin-left:8px">${pct}%</div>
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

    <!-- Динаміка самопочуття сьогодні -->
    <div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:13px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Самопочуття сьогодні</div>
      <div style="display:flex;gap:8px">
        ${[
          {k:'energy', l:'Енергія', c:'#16a34a'},
          {k:'sleep', l:'Сон', c:'#6366f1'},
          {k:'pain', l:'Біль', c:'#ef4444'}
        ].map(s => `<div style="flex:1;text-align:center;background:rgba(255,255,255,0.5);border-radius:10px;padding:8px 4px">
          <div style="font-size:22px;font-weight:900;color:${s.c};line-height:1">${entry[s.k] || '—'}</div>
          <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.4);margin-top:3px">${s.l}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Препарати -->
    ${meds.length > 0 ? `<div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:13px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Препарати</div>
      ${meds.map((m,i) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < meds.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.06)' : ''}">
        <div style="width:28px;height:28px;border-radius:9px;background:rgba(26,92,42,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="2.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:#1e1040">${escapeHtml(m.name)}</div>
          <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:1px">${escapeHtml(m.dose || '')}</div>
        </div>
        <div style="font-size:11px;font-weight:800;color:${m.taken ? '#16a34a' : '#ea580c'}">${m.taken ? '✓ прийнято' : (m.time || '')}</div>
      </div>`).join('')}
    </div>` : ''}

    <!-- Записи лікаря -->
    ${doctorNotes.length > 0 ? `<div style="background:rgba(255,255,255,0.72);border:1.5px solid rgba(255,255,255,0.75);border-radius:16px;padding:13px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:800;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Записи лікаря</div>
      ${doctorNotes.map(n => `<div style="background:rgba(255,255,255,0.5);border-radius:10px;padding:9px 11px;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.35);margin-bottom:4px">${escapeHtml(n.date || '')} · ${escapeHtml(n.doctor || '')}</div>
        <div style="font-size:12px;font-weight:600;color:#1e1040;line-height:1.45">${escapeHtml(n.text || '')}</div>
      </div>`).join('')}
    </div>` : ''}

    <!-- OWL аналіз -->
    ${owlAnalysis ? `<div style="background:rgba(12,6,28,0.78);border-radius:14px;padding:11px 13px;margin-bottom:10px">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:5px">OWL · аналіз</div>
      <div style="font-size:12px;font-weight:600;color:white;line-height:1.55">${escapeHtml(owlAnalysis)}</div>
    </div>` : ''}

    <!-- Нотатки → папка -->
    <div onclick="openNotesFolder('${escapeHtml(card.name)}')" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.55);border:1.5px dashed rgba(30,16,64,0.14);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer">
      <div style="width:30px;height:30px;border-radius:9px;background:rgba(26,92,42,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
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
function openAddHealthCard() {
  const name = prompt('Назва (хвороба, стан або мета):');
  if (!name || !name.trim()) return;
  const subtitle = prompt('Підзаголовок (необов\'язково):') || '';
  const cards = getHealthCards();
  const newCard = {
    id: Date.now(),
    name: name.trim(),
    subtitle: subtitle.trim(),
    status: 'active',
    progress: 0,
    nextStep: '',
    treatments: [],
    medications: [],
    doctorNotes: [],
    analyses: [],
    owlAnalysis: '',
    createdAt: Date.now(),
  };
  cards.unshift(newCard);
  saveHealthCards(cards);
  showToast('✓ Картку додано');
  renderHealth();
}

// Контекст здоров'я для AI
function getHealthContext() {
  const cards = getHealthCards();
  if (cards.length === 0) return '';
  const log = getHealthLog();
  const today = new Date().toDateString();
  const entry = log[today] || {};
  const parts = [`Здоров'я: ${cards.filter(c=>c.status!=='done').length} активних карток`];
  const active = cards.filter(c => c.status === 'active').slice(0,3);
  if (active.length) parts.push('Активні: ' + active.map(c => c.name + (c.nextStep ? ' → ' + c.nextStep : '')).join('; '));
  if (entry.energy || entry.sleep || entry.pain) parts.push(`Самопочуття сьогодні: Енергія ${entry.energy||'—'}/10, Сон ${entry.sleep||'—'}/10, Біль ${entry.pain||'—'}/10`);
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
  div.innerHTML = `<div style="max-width:85%;background:${isAgent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.88)'};color:${isAgent ? 'white' : '#1e1040'};border-radius:${isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px'};padding:8px 12px;font-size:15px;line-height:1.5;font-weight:500">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
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
  const healthCtx = getHealthContext();
  const aiContext = getAIContext();

  const systemPrompt = `${getOWLPersonality()} Ти допомагаєш з вкладкою Здоров'я в NeverMind.
ВАЖЛИВО: Ти НЕ лікар і НЕ ставиш діагнози. Тільки допомагаєш відслідковувати і систематизувати.
${activeCard ? `Активна картка: "${activeCard.name}" — ${activeCard.subtitle || ''}. Статус: ${activeCard.status}. Прогрес: ${activeCard.progress}%.` : ''}
${healthCtx ? healthCtx : ''}
${aiContext ? '\n\n' + aiContext : ''}

Ти можеш (відповідай JSON якщо потрібна дія):
- Зберегти запис про самопочуття: {"action":"log_health","energy":7,"sleep":8,"pain":2}
- Додати препарат до картки: {"action":"add_medication","card_id":${activeHealthCardId || 'null'},"name":"назва","dose":"дозування","time":"час"}
- Записати нотатку: {"action":"create_note","text":"текст","folder":"${activeCard ? activeCard.name : 'Здоровʼя'}"}
- Оновити прогрес картки: {"action":"update_health_progress","card_id":${activeHealthCardId || 'null'},"progress":число 0-100,"nextStep":"наступний крок"}
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
        const log = getHealthLog();
        const today = new Date().toDateString();
        if (!log[today]) log[today] = {};
        if (parsed.energy) log[today].energy = parseInt(parsed.energy);
        if (parsed.sleep) log[today].sleep = parseInt(parsed.sleep);
        if (parsed.pain !== undefined) log[today].pain = parseInt(parsed.pain);
        saveHealthLog(log);
        _renderHealthTodayScales();
        _renderHealthWeekBars();
        addHealthChatMsg('agent', `✓ Записав: Енергія ${log[today].energy || '—'}/10, Сон ${log[today].sleep || '—'}/10, Біль ${log[today].pain || '—'}/10`);
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
  openHealthCard, closeHealthCard, setHealthScale, setHealthCardStatus,
});
