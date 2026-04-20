// ============================================================
// app-projects.js — Проекти — список, воркспейс, AI бар
// Функції: renderProjects, openProjectWorkspace, closeProjectWorkspace, openAddProject, sendProjectsBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab, showToast, switchTab } from '../core/nav.js';
import { escapeHtml, extractJsonBlocks } from '../core/utils.js';
import { callAIWithTools, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg } from '../ai/core.js';
import { UI_TOOLS_RULES } from '../ai/prompts.js';
import { UI_TOOLS, UI_TOOL_NAMES, handleUITool } from '../ai/ui-tools.js';
import { addFact } from '../ai/memory.js';
import { addInboxChatMsg } from './inbox.js';
import { getTasks, saveTasks } from './tasks.js';
import { processUniversalAction } from './habits.js';
import { getNotes, openNotesFolder } from './notes.js';
import { getCurrency } from './finance.js';

// === STORAGE ===
export function getProjects() { return JSON.parse(localStorage.getItem('nm_projects') || '[]'); }
export function saveProjects(arr) { localStorage.setItem('nm_projects', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'projects' })); }

// State
let activeProjectId = null;
let projectsBarLoading = false;
let projectsBarHistory = [];
let _projectsTypingEl = null;

// === ГОЛОВНИЙ РЕНДЕР ===
export function renderProjects() {
  if (activeProjectId !== null) {
    renderProjectWorkspace(activeProjectId);
  } else {
    renderProjectsList();
  }
}

// === СПИСОК ПРОЕКТІВ ===
function renderProjectsList() {
  const projects = getProjects();
  const listEl = document.getElementById('projects-list');
  const emptyEl = document.getElementById('projects-empty');
  if (!listEl) return;

  if (projects.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const now = Date.now();
  listEl.innerHTML = projects.map(p => {
    const steps = p.steps || [];
    const doneSteps = steps.filter(s => s.done).length;
    const pct = steps.length > 0 ? Math.round(doneSteps / steps.length * 100) : (p.progress || 0);
    const nextStep = steps.find(s => !s.done);
    const silenceDays = p.lastActivity ? Math.floor((now - p.lastActivity) / (1000 * 60 * 60 * 24)) : null;
    const silenceWarn = silenceDays !== null && silenceDays >= 3;

    // Перші 3 кроки для картки
    const visibleSteps = steps.slice(0, 4);

    return `<div onclick="openProjectWorkspace(${p.id})" class="card-glass" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:15px;font-weight:900;color:#1e1040;line-height:1.2">${escapeHtml(p.name)}</div>
          ${p.subtitle ? `<div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">${escapeHtml(p.subtitle)}</div>` : ''}
        </div>
        <div style="font-size:30px;font-weight:900;color:#3d2e1e;line-height:1;margin-left:8px">${pct}%</div>
      </div>
      <div style="height:5px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct}%;background:#3d2e1e;border-radius:3px;transition:width 0.5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${visibleSteps.length ? 8 : 0}px">
        ${p.tempo ? `<span style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600">При темпі: ~${escapeHtml(p.tempo)}</span>` : '<span></span>'}
        ${silenceWarn ? `<span style="font-size:10px;font-weight:700;color:#c2410c">${silenceDays} дн. тиші</span>` : ''}
      </div>
      ${visibleSteps.length > 0 ? visibleSteps.map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <div style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${s.done ? '#3d2e1e' : 'rgba(30,16,64,0.18)'};background:${s.done ? '#3d2e1e' : 'rgba(255,255,255,0.65)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:white">${s.done ? '✓' : ''}</div>
          <div style="font-size:12px;font-weight:${!s.done && s === nextStep ? 700 : 500};color:${s.done ? 'rgba(30,16,64,0.3)' : (!s.done && s === nextStep ? '#1e1040' : 'rgba(30,16,64,0.55)')};${s.done ? 'text-decoration:line-through' : ''};flex:1">${!s.done && s === nextStep ? '→ ' : ''}${escapeHtml(s.text)}</div>
        </div>`).join('') : ''}
      <!-- Нотатки -->
      <div style="margin-top:${visibleSteps.length ? 8 : 0}px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.45);border:1px dashed rgba(30,16,64,0.12);border-radius:9px;padding:6px 9px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.3)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;flex:1">${p.notesPreview || 'Нотатки проекту...'}</div>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.2)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }).join('');
}

// === ВОРКСПЕЙС ПРОЕКТУ ===
function openProjectWorkspace(id) {
  activeProjectId = id;
  // Оновлюємо lastActivity
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx !== -1) {
    projects[idx].lastActivity = Date.now();
    saveProjects(projects);
  }
  renderProjectWorkspace(id);
  // Скидаємо history бару до контексту цього проекту
  projectsBarHistory = [];
}

function closeProjectWorkspace() {
  activeProjectId = null;
  renderProjectsList();
}

function renderProjectWorkspace(id) {
  const projects = getProjects();
  const p = projects.find(pr => pr.id === id);
  if (!p) { closeProjectWorkspace(); return; }

  const steps = p.steps || [];
  const doneSteps = steps.filter(s => s.done).length;
  const pct = steps.length > 0 ? Math.round(doneSteps / steps.length * 100) : (p.progress || 0);
  const nextStep = steps.find(s => !s.done);
  const budget = p.budget || { total: 0, spent: 0, items: [] };
  const metrics = p.metrics || [];
  const decisions = p.decisions || [];
  const risks = p.risks || '';
  const resources = p.resources || [];
  const spentPct = budget.total > 0 ? Math.min(100, Math.round(budget.spent / budget.total * 100)) : 0;

  const scrollEl = document.getElementById('projects-scroll');
  if (!scrollEl) return;

  scrollEl.innerHTML = `
    <!-- Назад -->
    <div onclick="closeProjectWorkspace()" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;cursor:pointer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d2e1e" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      <span style="font-size:13px;font-weight:700;color:#3d2e1e">Проекти</span>
    </div>

    <!-- Назва + % + 3 сценарії темпу -->
    <div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:16px;font-weight:900;color:#1e1040">${escapeHtml(p.name)}</div>
          ${p.subtitle ? `<div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:2px">${escapeHtml(p.subtitle)}</div>` : ''}
        </div>
        <div style="font-size:30px;font-weight:900;color:#3d2e1e;line-height:1;margin-left:8px">${pct}%</div>
      </div>
      <div style="height:6px;background:rgba(30,16,64,0.07);border-radius:4px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${pct}%;background:#3d2e1e;border-radius:4px;transition:width 0.5s"></div>
      </div>
      <!-- 3 сценарії -->
      <div style="display:flex;gap:5px">
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(30,16,64,0.04);border:1px solid rgba(30,16,64,0.07)">
          <div style="font-size:13px;font-weight:800;color:#1e1040">${p.tempoNow || '?'}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(30,16,64,0.38);margin-top:1px">зараз</div>
        </div>
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(234,88,12,0.06);border:1px solid rgba(234,88,12,0.12)">
          <div style="font-size:13px;font-weight:800;color:#ea580c">${p.tempoMore || '?'}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(234,88,12,0.5);margin-top:1px">+1год/день</div>
        </div>
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.14)">
          <div style="font-size:13px;font-weight:800;color:#16a34a">${p.tempoIdeal || '?'}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(22,163,74,0.5);margin-top:1px">ідеально</div>
        </div>
      </div>
    </div>

    <!-- Бюджет -->
    ${budget.total > 0 || budget.items.length > 0 ? `<div class="card-glass">
      <div class="section-label" style="margin-bottom:8px">Бюджет проекту</div>
      ${budget.total > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;font-weight:700;color:#1e1040">Витрачено</span>
        <span style="font-size:12px;font-weight:900;color:#c2410c">${getCurrency()}${budget.spent} / ${getCurrency()}${budget.total}</span>
      </div>
      <div style="height:4px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${spentPct}%;background:#c2410c;border-radius:3px"></div>
      </div>` : ''}
      ${budget.items.map((item, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;${i < budget.items.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
        <span style="font-size:12px;font-weight:600;color:rgba(30,16,64,0.55)">${escapeHtml(item.name)}</span>
        <span style="font-size:12px;font-weight:800;color:${item.amount > 0 ? '#c2410c' : item.amount < 0 ? '#16a34a' : 'rgba(30,16,64,0.35)'}">${item.amount > 0 ? '-' : item.amount < 0 ? '+' : ''}${getCurrency()}${Math.abs(item.amount) || item.label || ''}</span>
      </div>`).join('')}
    </div>` : ''}

    <!-- Наступна дія -->
    ${nextStep ? `<div style="display:flex;align-items:center;gap:9px;border-radius:12px;padding:10px 12px;margin-bottom:10px;background:rgba(61,46,30,0.08);border:1.5px solid rgba(61,46,30,0.15)">
      <div style="width:24px;height:24px;border-radius:8px;background:#3d2e1e;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div style="font-size:13px;font-weight:700;color:#3d2e1e">${escapeHtml(nextStep.text)}</div>
    </div>` : ''}

    <!-- Ключові метрики -->
    ${metrics.length > 0 ? `<div class="card-glass">
      <div class="section-label">Ключові метрики</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${metrics.map(m => `<div style="flex:1;min-width:60px;background:rgba(255,255,255,0.5);border-radius:10px;padding:8px 5px;text-align:center">
          <div style="font-size:18px;font-weight:900;color:${m.color || '#3d2e1e'}">${escapeHtml(String(m.value))}</div>
          <div style="font-size:9px;font-weight:700;color:rgba(30,16,64,0.38);margin-top:2px;line-height:1.3">${escapeHtml(m.label)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Хронологія / план -->
    ${steps.length > 0 ? `<div class="card-glass" id="proj-timeline-${p.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin-bottom:0">Хронологія · план</div>
        <span onclick="toggleProjectTimeline(${p.id})" style="font-size:10px;font-weight:700;color:#3d2e1e;cursor:pointer" id="proj-timeline-toggle-${p.id}">розгорнути ↓</span>
      </div>
      <!-- Згорнутий вигляд -->
      <div id="proj-timeline-collapsed-${p.id}" style="background:rgba(255,255,255,0.5);border-radius:10px;padding:9px 11px">
        ${steps.slice(0,3).map((s,i) => {
          const isCurrent = !s.done && s === nextStep;
          const opacity = s.done ? 0.35 : i === 0 ? 1 : i === 1 ? 0.55 : 0.3;
          return `<div style="display:flex;align-items:center;gap:7px;${i > 0 ? 'margin-top:4px' : ''};opacity:${opacity}">
            <div style="width:7px;height:7px;border-radius:50%;background:${s.done ? '#3d2e1e' : isCurrent ? '#3d2e1e' : 'rgba(61,46,30,0.3)'};flex-shrink:0"></div>
            <div style="font-size:11px;font-weight:${isCurrent ? 800 : 600};color:${isCurrent ? '#1e1040' : 'rgba(30,16,64,0.55)'};${s.done ? 'text-decoration:line-through' : ''}">${isCurrent ? '→ ' : ''}${escapeHtml(s.text)}</div>
          </div>`;
        }).join('')}
      </div>
      <!-- Розгорнутий вигляд -->
      <div id="proj-timeline-full-${p.id}" style="display:none">
        ${steps.map((s,i) => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;${i < steps.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
          <div onclick="toggleProjectStep(${p.id},${s.id})" style="width:18px;height:18px;border-radius:6px;border:1.5px solid ${s.done ? '#3d2e1e' : 'rgba(30,16,64,0.18)'};background:${s.done ? '#3d2e1e' : 'rgba(255,255,255,0.65)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:10px;color:white">${s.done ? '✓' : ''}</div>
          <div style="flex:1;font-size:13px;font-weight:${!s.done && s === nextStep ? 700 : 500};color:${s.done ? 'rgba(30,16,64,0.3)' : '#1e1040'};${s.done ? 'text-decoration:line-through' : ''}">${escapeHtml(s.text)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Лог рішень -->
    ${decisions.length > 0 ? `<div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin-bottom:0">Лог рішень</div>
        <span style="font-size:9px;color:rgba(30,16,64,0.3);font-weight:600">OWL · авто</span>
      </div>
      ${decisions.map((d,i) => `<div style="padding:5px 0;${i < decisions.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
        <div style="font-size:12px;font-weight:700;color:#1e1040">${escapeHtml(d.title)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:500;margin-top:1px">${escapeHtml(d.reason)}</div>
      </div>`).join('')}
    </div>` : ''}

    <!-- Нотатки → папка -->
    <div onclick="switchTab('notes');setTimeout(()=>openNotesFolder('${escapeHtml(p.name)}'),150)" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.55);border:1.5px dashed rgba(30,16,64,0.14);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer">
      <div style="width:30px;height:30px;border-radius:9px;background:rgba(61,46,30,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d2e1e" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#1e1040">Нотатки проекту</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:1px">${_countProjectNotes(p.name)} записів у папці "${escapeHtml(p.name)}" →</div>
      </div>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.25)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- OWL персональні ризики -->
    ${risks ? `<div style="background:rgba(12,6,28,0.78);border-radius:14px;padding:11px 13px;margin-bottom:10px">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:5px">OWL · персональні ризики</div>
      <div style="font-size:12px;font-weight:600;color:white;line-height:1.55">${escapeHtml(risks)}</div>
    </div>` : ''}

    <!-- Корисна інфа -->
    ${resources.length > 0 ? `<div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin-bottom:0">Корисна інфа</div>
        <span style="font-size:9px;color:rgba(30,16,64,0.3);font-weight:600">поточний етап</span>
      </div>
      ${resources.map((r,i) => {
        const badgeColors = { 'Книга':'rgba(99,102,241,0.1)|#6366f1', 'Спільнота':'rgba(234,88,12,0.1)|#ea580c', 'Інструмент':'rgba(22,163,74,0.1)|#16a34a', 'Стаття':'rgba(251,191,36,0.15)|#d97706' };
        const [bg, color] = (badgeColors[r.type] || 'rgba(30,16,64,0.07)|rgba(30,16,64,0.5)').split('|');
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;${i < resources.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
          <div style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:5px;flex-shrink:0;background:${bg};color:${color}">${escapeHtml(r.type)}</div>
          <div style="font-size:11px;font-weight:600;color:#1e1040;flex:1;line-height:1.3">${escapeHtml(r.title)}</div>
          ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" style="font-size:11px;font-weight:800;color:${color};text-decoration:none">→</a>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
}

function _countProjectNotes(projectName) {
  try {
    return getNotes().filter(n => n.folder === projectName).length;
  } catch(e) { return 0; }
}

function toggleProjectTimeline(id) {
  const collapsed = document.getElementById(`proj-timeline-collapsed-${id}`);
  const full = document.getElementById(`proj-timeline-full-${id}`);
  const toggle = document.getElementById(`proj-timeline-toggle-${id}`);
  if (!collapsed || !full) return;
  const isCollapsed = full.style.display === 'none';
  collapsed.style.display = isCollapsed ? 'none' : 'block';
  full.style.display = isCollapsed ? 'block' : 'none';
  if (toggle) toggle.textContent = isCollapsed ? 'згорнути ↑' : 'розгорнути ↓';
}

function toggleProjectStep(projectId, stepId) {
  const projects = getProjects();
  const p = projects.find(pr => pr.id === projectId);
  if (!p) return;
  const step = (p.steps || []).find(s => s.id === stepId);
  if (step) {
    step.done = !step.done;
    step.doneAt = step.done ? Date.now() : null;
    p.lastActivity = Date.now();
    // Перераховуємо прогрес
    const done = p.steps.filter(s => s.done).length;
    p.progress = p.steps.length > 0 ? Math.round(done / p.steps.length * 100) : 0;
    saveProjects(projects);
    renderProjectWorkspace(projectId);
    // Синхронізація з Tasks
    _syncProjectStepToTasks(p, step);
  }
}

function _syncProjectStepToTasks(project, step) {
  // Якщо крок виконано — шукаємо відповідну задачу і закриваємо
  try {
    if (!step.done) return;
    const tasks = getTasks();
    const match = tasks.find(t => t.status === 'active' &&
      t.title.toLowerCase().includes(step.text.toLowerCase().substring(0, 15)));
    if (match) {
      match.status = 'done';
      match.completedAt = Date.now();
      saveTasks(tasks);
    }
  } catch(e) {}
}

// === ДОДАТИ ПРОЕКТ ===
function openAddProject() {
  const modal = document.getElementById('project-modal');
  if (!modal) return;
  document.getElementById('project-input-name').value = '';
  document.getElementById('project-input-subtitle').value = '';
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('project-input-name').focus(), 100);
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  if (modal) modal.style.display = 'none';
}

function saveNewProject() {
  const name = (document.getElementById('project-input-name').value || '').trim();
  if (!name) return;
  const subtitle = (document.getElementById('project-input-subtitle').value || '').trim();
  const projects = getProjects();
  const newProject = {
    id: Date.now(),
    name,
    subtitle,
    progress: 0,
    steps: [],
    budget: { total: 0, spent: 0, items: [] },
    metrics: [],
    decisions: [],
    resources: [],
    risks: '',
    tempoNow: '?',
    tempoMore: '?',
    tempoIdeal: '?',
    notesPreview: '',
    lastActivity: Date.now(),
    createdAt: Date.now(),
  };
  projects.unshift(newProject);
  saveProjects(projects);
  closeProjectModal();
  showToast('✓ Проект створено');
  openProjectWorkspace(newProject.id);
  // OWL починає інтервʼю по проекту в Inbox
  setTimeout(() => startProjectInboxInterview(name, subtitle), 600);
}

export async function startProjectInboxInterview(projectName, projectSubtitle) {
  // Переходимо на Inbox де відбувається вся комунікація
  if (currentTab !== 'inbox') switchTab('inbox');

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    setTimeout(() => addInboxChatMsg('agent',
      `Проект "${projectName}" створено! Розкажи — який у тебе стартовий капітал, скільки часу на тиждень можеш вкладати, і що найбільше лякає в цьому?`
    ), 400);
    return;
  }

  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Щойно створено новий проект "${projectName}"${projectSubtitle ? ` — "${projectSubtitle}"` : ''}.
Твоя роль — персональний наставник. Постав ОДНЕ перше питання щоб краще зрозуміти цей проект.
Питай про стартовий капітал або ресурси. Коротко, по-людськи, без зайвих слів.
Відповідай українською. Тільки текст, без JSON.
${aiContext ? '\n\n' + aiContext : ''}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        max_tokens: 100,
        temperature: 0.75
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      setTimeout(() => {
        addInboxChatMsg('agent', reply);
        // Зберігаємо що OWL чекає відповідь по темі проекту
        localStorage.setItem('nm_guide_waiting_topic', 'project_' + Date.now());
        // Додаємо в масив тем провідника щоб продовжити розпитувати
        const shownTopics = JSON.parse(localStorage.getItem('nm_guide_shown_topics') || '[]');
        // Питання про час на тиждень — наступне
        localStorage.setItem('nm_project_interview_step', '1');
        localStorage.setItem('nm_project_interview_name', projectName);
      }, 500);
    }
  } catch(e) {
    setTimeout(() => addInboxChatMsg('agent',
      `Проект "${projectName}" створено! Розкажи — який у тебе стартовий капітал для цього?`
    ), 400);
  }
}

// Контекст проектів для AI
export function getProjectsContext() {
  const projects = getProjects();
  if (projects.length === 0) return '';
  const now = Date.now();
  const parts = [`Активні проекти (використовуй ID для майбутніх дій):`];
  projects.slice(0, 5).forEach(p => {
    const steps = p.steps || [];
    const done = steps.filter(s => s.done).length;
    const pct = steps.length > 0 ? Math.round(done / steps.length * 100) : (p.progress || 0);
    const next = steps.find(s => !s.done);
    const silenceDays = p.lastActivity ? Math.floor((now - p.lastActivity) / 86400000) : null;
    const silence = silenceDays !== null && silenceDays >= 3 ? ` ⚠️ ${silenceDays} дн. тиші` : '';
    parts.push(`- [ID:${p.id}] "${p.name}" ${pct}%${next ? ' → наступний крок: ' + next.text : ''}${silence}`);
  });
  return parts.join('\n');
}

// === PROJECTS AI BAR ===
function addProjectsChatMsg(role, text, _noSave = false) {
  const el = document.getElementById('projects-chat-messages');
  if (!el) return;
  if (_projectsTypingEl) { _projectsTypingEl.remove(); _projectsTypingEl = null; }
  if (role === 'typing') {
    const td = document.createElement('div');
    td.style.cssText = 'display:flex';
    td.innerHTML = '<div style="background:rgba(255,255,255,0.12);border-radius:4px 12px 12px 12px;padding:5px 10px"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
    el.appendChild(td);
    _projectsTypingEl = td;
    el.scrollTop = el.scrollHeight;
    return;
  }
  try { openChatBar('projects'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (role !== 'agent') projectsBarHistory.push({ role: 'user', content: text });
  else projectsBarHistory.push({ role: 'assistant', content: text });
  if (!_noSave) saveChatMsg('projects', role, text);
}

export async function sendProjectsBarMessage() {
  if (projectsBarLoading) return;
  const input = document.getElementById('projects-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addProjectsChatMsg('agent', 'Введи OpenAI ключ в налаштуваннях.'); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addProjectsChatMsg('user', text);
  projectsBarLoading = true;
  addProjectsChatMsg('typing', '');

  const projects = getProjects();
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
  const projCtx = getProjectsContext();
  const aiContext = getAIContext();

  const activeSteps = activeProject ? (activeProject.steps || []).map(s =>
    `[ID:${s.id}] ${s.done ? '✓' : '○'} ${s.text}`).join('\n') : '';

  const systemPrompt = `${getOWLPersonality()} Ти особистий наставник по проектах в NeverMind.
${activeProject ? `Активний проект: "${activeProject.name}" (${activeProject.progress || 0}%). Підзаголовок: ${activeProject.subtitle || ''}.
Кроки:\n${activeSteps || 'немає кроків'}` : projCtx}
${aiContext ? '\n\n' + aiContext : ''}

Ти можеш (відповідай JSON якщо потрібна дія):
- Виконати крок: {"action":"complete_project_step","project_id":${activeProjectId || 'null'},"step_id":ID}
- Додати крок: {"action":"add_project_step","project_id":${activeProjectId || 'null'},"step":"текст кроку"}
- Оновити прогрес: {"action":"update_project_progress","project_id":${activeProjectId || 'null'},"progress":число 0-100}
- Додати рішення: {"action":"add_project_decision","project_id":${activeProjectId || 'null'},"title":"рішення","reason":"чому"}
- Додати метрику: {"action":"add_project_metric","project_id":${activeProjectId || 'null'},"label":"назва","value":"значення","color":"#hex"}
- Додати ресурс: {"action":"add_project_resource","project_id":${activeProjectId || 'null'},"type":"Книга|Спільнота|Інструмент|Стаття","title":"назва","url":"посилання"}
- Оновити темп: {"action":"update_project_tempo","project_id":${activeProjectId || 'null'},"tempoNow":"6 тиж","tempoMore":"4 тиж","tempoIdeal":"2 тиж"}
- Записати ризики: {"action":"update_project_risks","project_id":${activeProjectId || 'null'},"risks":"текст"}
- Нотатку: {"action":"create_note","text":"текст","folder":"${activeProject ? activeProject.name : 'Проекти'}"}
- Створити папку нотаток: {"action":"create_folder","folder":"назва папки"}
- Задачу: {"action":"create_task","title":"назва","steps":[]}
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
ЗАДАЧА = дія ЗРОБИТИ. ПОДІЯ = факт що СТАНЕТЬСЯ. "Перенеси подію" = edit_event.

ПАМ'ЯТЬ (Один мозок — доступно з будь-якого чату):
- Факт про юзера: {"action":"save_memory_fact","text":"короткий факт","category":"preferences|health|work|relationships|context|goals","ttl_days":30}
- Жорсткий тригер: "Запам'ятай що X" / "Запиши що X" → ТІЛЬКИ save_memory_fact, БЕЗ інших дій. НЕ вигадуй задачі-протилежність.

Інакше — відповідай текстом 1-3 речення. Якщо незрозуміло — перепитуй. НЕ вигадуй дані яких немає.

${UI_TOOLS_RULES}`;

  try {
    // "Один мозок #1": callAIWithTools(UI_TOOLS) — навігація через tool calling,
    // проектні CRUD — через існуючий текстовий JSON.
    const msg = await callAIWithTools(systemPrompt, projectsBarHistory.slice(-10), UI_TOOLS);

    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (UI_TOOL_NAMES.has(tc.function.name)) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
          const res = handleUITool(tc.function.name, args);
          if (res && res.text) addProjectsChatMsg('agent', res.text);
        }
      }
      projectsBarLoading = false;
      return;
    }

    const reply = msg && msg.content ? msg.content.trim() : '';
    if (!reply) { addProjectsChatMsg('agent', 'Щось пішло не так.'); projectsBarLoading = false; return; }

    // Обробка одного JSON блоку. Повертає true якщо оброблено.
    const _processOne = (parsed) => {
      // Один мозок (20.04 NRw8G): save_memory_fact доступний з чату Проектів.
      if (parsed.action === 'save_memory_fact' && parsed.text) {
        try {
          addFact({ text: parsed.text, category: parsed.category, ttlDays: parsed.ttl_days });
          addProjectsChatMsg('agent', 'Запам\'ятав ✓');
        } catch (e) { console.warn('[projects save_memory_fact]', e); }
        return true;
      }
      const pid = parsed.project_id;
      if (parsed.action === 'complete_project_step' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          const step = (p.steps || []).find(s => s.id === parsed.step_id);
          if (step) {
            step.done = true;
            step.doneAt = Date.now();
            p.progress = Math.round(p.steps.filter(s => s.done).length / p.steps.length * 100);
            p.lastActivity = Date.now();
            saveProjects(projs);
            renderProjects();
            addProjectsChatMsg('agent', `✅ Крок "${step.text}" виконано! Прогрес: ${p.progress}%`);
            return true;
          }
        }
        return false;
      }
      if (parsed.action === 'add_project_step' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          if (!p.steps) p.steps = [];
          p.steps.push({ id: Date.now(), text: parsed.step, done: false });
          p.lastActivity = Date.now();
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Додав крок: "${parsed.step}"`);
          return true;
        }
        return false;
      }
      if (parsed.action === 'update_project_progress' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          p.progress = Math.min(100, Math.max(0, parsed.progress));
          p.lastActivity = Date.now();
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Прогрес оновлено: ${p.progress}%`);
        }
        return true;
      }
      if (parsed.action === 'add_project_decision' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          if (!p.decisions) p.decisions = [];
          p.decisions.unshift({ title: parsed.title, reason: parsed.reason });
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Рішення записано: "${parsed.title}"`);
        }
        return true;
      }
      if (parsed.action === 'add_project_metric' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          if (!p.metrics) p.metrics = [];
          p.metrics.push({ label: parsed.label, value: parsed.value, color: parsed.color || '#3d2e1e' });
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Метрику "${parsed.label}: ${parsed.value}" додано`);
        }
        return true;
      }
      if (parsed.action === 'add_project_resource' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          if (!p.resources) p.resources = [];
          p.resources.push({ type: parsed.type, title: parsed.title, url: parsed.url || '' });
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Ресурс "${parsed.title}" додано`);
        }
        return true;
      }
      if (parsed.action === 'update_project_tempo' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          p.tempoNow = parsed.tempoNow || p.tempoNow;
          p.tempoMore = parsed.tempoMore || p.tempoMore;
          p.tempoIdeal = parsed.tempoIdeal || p.tempoIdeal;
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Темп оновлено`);
        }
        return true;
      }
      if (parsed.action === 'update_project_risks' && pid) {
        const projs = getProjects();
        const p = projs.find(pr => pr.id === pid);
        if (p) {
          p.risks = parsed.risks;
          saveProjects(projs);
          renderProjects();
          addProjectsChatMsg('agent', `✓ Ризики записано`);
        }
        return true;
      }
      if (processUniversalAction(parsed, text, addProjectsChatMsg)) return true;
      return false;
    };

    // Розбиваємо AI-відповідь на окремі JSON блоки (кілька дій одразу).
    const blocks = extractJsonBlocks(reply);
    let handled = false;
    for (const parsed of blocks) {
      if (_processOne(parsed)) handled = true;
    }
    if (!handled) safeAgentReply(reply, addProjectsChatMsg);
  } catch { addProjectsChatMsg('agent', 'Мережева помилка.'); }
  projectsBarLoading = false;
}

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddProject, saveNewProject, closeProjectModal,
  sendProjectsBarMessage, openProjectWorkspace, closeProjectWorkspace,
  toggleProjectTimeline, toggleProjectStep, switchTab,
});
