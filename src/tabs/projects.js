// ============================================================
// app-projects.js — Проекти — список, воркспейс, AI бар
// Функції: renderProjects, openProjectWorkspace, closeProjectWorkspace, openAddProject, sendProjectsBarMessage
// Залежності: app-core.js, app-ai.js
// ============================================================

import { currentTab, showToast, switchTab } from '../core/nav.js';
import { makeProject } from '../data/entity-factories.js';
import { assessProjectCompleteness, PROJECT_DIM_LABELS, PROJECT_GAP_PROMPTS } from '../data/project-completeness.js';
import { escapeHtml, safeHref, parseContentChips, t } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { callAIWithTools, getAIContext, getOWLPersonality, openChatBar, safeAgentReply, saveChatMsg, INBOX_TOOLS, handleChatError } from '../ai/core.js';
import { getProjectsChatSystem } from '../ai/prompts.js';
import { dispatchChatToolCalls } from '../ai/tool-dispatcher.js';
import { shouldClarify } from '../owl/clarify-guard.js';
import { renderChips } from '../owl/chips.js';
import { addInboxChatMsg } from './inbox.js';
import { getTasks, saveTasks } from './tasks.js';
import { getNotes, openNotesFolder } from './notes.js';
import { getCurrency, getFinance } from './finance.js';
import { addToTrash, showUndoToast } from '../core/trash.js';
import { attachSwipeDelete } from '../ui/swipe-delete.js';

// === STORAGE ===
export function getProjects() { try { return JSON.parse(localStorage.getItem('nm_projects') || '[]'); } catch { return []; } }
export function saveProjects(arr) { localStorage.setItem('nm_projects', JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'projects' })); }

// Створити проект програмно. Використовується у inbox.js (create_project tool flow)
// та tool-dispatcher.js (create_project з будь-якого чату). Виносимо щоб не дублювати
// 18-рядковий schema в кількох місцях.
// QDIGl 04.05: програмне видалення проекту з кошиком + undo + interview cleanup.
// Викликається з tool-dispatcher (delete_project tool). Повертає видалений
// item або null якщо не знайдено. Без addMsg — caller сам пише підтвердження.
export function deleteProjectProgrammatic(projectId) {
  const projects = getProjects();
  const idStr = String(projectId);
  const item = projects.find(x => String(x.id) === idStr);
  if (!item) return null;
  addToTrash('project', item);
  saveProjects(projects.filter(x => String(x.id) !== idStr));
  _cleanupProjectInterviewIfMatches(item);
  showUndoToast();
  return item;
}

// Знаходить проект по name (case-insensitive, fuzzy через includes якщо ≥3 літер).
// Повертає proj або null. Захист від empty-query (як D fix у habits.js delete_task).
export function findProjectByName(query) {
  const q = (query || '').toLowerCase().trim();
  if (q.length < 3) return null;
  const projects = getProjects();
  // QDIGl audit fix: пріоритет exact match → потім startsWith → потім includes.
  // Раніше includes ловив випадковий проект із спільним префіксом
  // («Хімчистка-А» при запиті «Хімчистка-Б»). Тепер точний матч перший.
  const exact = projects.find(p => (p.name || '').toLowerCase() === q);
  if (exact) return exact;
  const starts = projects.find(p => (p.name || '').toLowerCase().startsWith(q));
  if (starts) return starts;
  // Fuzzy: тільки якщо ОДИН кандидат з includes — інакше null (ambiguous).
  const matches = projects.filter(p => (p.name || '').toLowerCase().includes(q.slice(0, 12)));
  return matches.length === 1 ? matches[0] : null;
}

export function createProjectProgrammatic(name, subtitle = '') {
  const projects = getProjects();
  const newProject = makeProject({ name, subtitle });
  projects.unshift(newProject);
  saveProjects(projects);
  return newProject;
}

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
  // Ховаємо воркспейс, показуємо список (повернення з проекту).
  const wsEl = document.getElementById('projects-workspace');
  if (wsEl) { wsEl.style.display = 'none'; wsEl.innerHTML = ''; }
  listEl.style.display = '';

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

    return `<div class="project-card-wrap" data-id="${p.id}" style="position:relative">
      <div data-action="open-project" data-id="${p.id}" class="card-glass project-card" id="project-card-${p.id}" style="cursor:pointer;position:relative;z-index:2;background:rgba(248,239,224,0.95)">
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
        ${p.tempo ? `<span style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600">${t('projects.card.tempo_prefix', 'При темпі')}: ~${escapeHtml(p.tempo)}</span>` : '<span></span>'}
        ${silenceWarn ? `<span style="font-size:10px;font-weight:700;color:#c2790a">${t('projects.card.silence_days', '{n} дн без оновлень', { n: silenceDays })}</span>` : ''}
      </div>
      ${visibleSteps.length > 0 ? visibleSteps.map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <div style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${s.done ? '#3d2e1e' : 'rgba(30,16,64,0.18)'};background:${s.done ? '#3d2e1e' : 'rgba(255,255,255,0.65)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:white">${s.done ? '✓' : ''}</div>
          <div style="font-size:12px;font-weight:${!s.done && s === nextStep ? 700 : 500};color:${s.done ? 'rgba(30,16,64,0.3)' : (!s.done && s === nextStep ? '#1e1040' : 'rgba(30,16,64,0.55)')};${s.done ? 'text-decoration:line-through' : ''};flex:1">${!s.done && s === nextStep ? '→ ' : ''}${escapeHtml(s.text)}</div>
        </div>`).join('') : `
        <div style="font-size:11px;font-weight:600;color:rgba(30,16,64,0.4);padding:4px 0;font-style:italic">${t('projects.card.no_steps', 'Кроки ще не додані — відкрий і запитай OWL')}</div>`}
      <!-- Нотатки -->
      <div style="margin-top:${visibleSteps.length ? 8 : 0}px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.45);border:1px dashed rgba(30,16,64,0.12);border-radius:9px;padding:6px 9px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.3)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;flex:1">${p.notesPreview || t('projects.card.notes_placeholder', 'Нотатки проекту...')}</div>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.2)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      </div>
    </div>`;
  }).join('');

  // Свайп вліво → видалити проект з відкатом 5 сек (B-116 fix mUpS8 02.05).
  // Pattern як у notes.js — обгортка .project-card-wrap, всередині .project-card,
  // addToTrash + showUndoToast з можливістю відновлення.
  _attachProjectsSwipeDelete();
}

// NpBmN audit fix #1: cleanup interview-state коли видаляється проект-тема.
// Дивимось і за name (legacy) і за id (на майбутнє коли interview зберігатиме id).
function _cleanupProjectInterviewIfMatches(deletedProject) {
  if (!deletedProject) return;
  const interviewName = localStorage.getItem('nm_project_interview_name') || '';
  if (interviewName && deletedProject.name && interviewName === deletedProject.name) {
    localStorage.removeItem('nm_project_interview_step');
    localStorage.removeItem('nm_project_interview_name');
    // Скидаємо й waiting_topic якщо він project_*
    const wt = localStorage.getItem('nm_guide_waiting_topic') || '';
    if (wt.startsWith('project_')) localStorage.removeItem('nm_guide_waiting_topic');
  }
}

function _attachProjectsSwipeDelete() {
  document.querySelectorAll('.project-card-wrap').forEach(wrap => {
    const card = wrap.querySelector('.project-card');
    if (!card) return;
    const id = wrap.dataset.id;
    attachSwipeDelete(wrap, card, () => {
      const all = getProjects();
      const item = all.find(x => String(x.id) === id);
      const idx = all.findIndex(x => String(x.id) === id);
      const predecessorId = idx > 0 ? all[idx - 1].id : null;
      if (item) addToTrash('project', item);
      saveProjects(all.filter(x => String(x.id) !== id));
      // NpBmN audit fix #1: коли видалений проект був темою активного
      // інтерв'ю — скидаємо стейт. Інакше OWL ставив би питання 2-5 про
      // неіснуючий проект на наступному повідомленні (зомбі-інтерв'ю).
      _cleanupProjectInterviewIfMatches(item);
      renderProjectsList();
      if (item) showUndoToast(t('projects.toast.deleted', 'Проект видалено'), () => {
        const projs = getProjects();
        let insertIdx;
        if (predecessorId === null) insertIdx = 0;
        else {
          const predIdx = projs.findIndex(x => x.id === predecessorId);
          insertIdx = predIdx !== -1 ? predIdx + 1 : projs.length;
        }
        projs.splice(insertIdx, 0, item);
        saveProjects(projs);
        renderProjectsList();
      });
    });
  });
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
  // Фаза 3 інтеграції: фактичні витрати проекту = сума витрат у Фінансах
  // позначених тегом цього проекту (projectId). Похідне, не зберігається окремо
  // у проекті — немає дублювання суми. Якщо нічого не тегнуто — fallback на
  // ручний budget.spent (легасі/планові).
  let projectSpent = 0;
  try {
    projectSpent = getFinance()
      .filter(tx => tx && tx.projectId === p.id && tx.type === 'expense')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  } catch(e) {}
  const budgetSpent = projectSpent || budget.spent || 0;
  const spentPct = budget.total > 0 ? Math.min(100, Math.round(budgetSpent / budget.total * 100)) : 0;
  // Темп показуємо лише коли OWL його реально порахував — інакше три «?» виглядають
  // як поломка (Council 7uxlr7: головна точка «не розумію» для нового проекту).
  const hasTempo = [p.tempoNow, p.tempoMore, p.tempoIdeal].some(v => v && v !== '?');
  const isNewProject = steps.length === 0;
  const noteCount = _countProjectNotes(p.name);
  const hasBrief = !!(p.brief && p.brief.trim());
  const briefPrompt = t('projects.brief.prompt', 'Хочу розповісти про цей проект — що це, яка головна ціль і контекст');
  // Детермінований рахунок повноти (src/data/project-completeness.js) — єдине
  // джерело правди «чи досить контексту щоб радити». Не здогад моделі.
  const completeness = assessProjectCompleteness(p);
  const hasContext = hasBrief || steps.length > 0; // старі проекти з кроками теж «живі»
  // Мʼякі прогалини: до 3 «уточнити: …» (живий абзац, не форма/лічильник).
  const gapChips = hasBrief
    ? completeness.missing.filter(k => k !== 'essence' && PROJECT_GAP_PROMPTS[k]).slice(0, 3)
        .map(k => ({ label: PROJECT_DIM_LABELS[k], prompt: PROJECT_GAP_PROMPTS[k] }))
    : [];
  // Поради (план/бюджет/ризики) — ЛИШЕ коли код каже canAdvise (суть+для кого).
  const emptyChips = (isNewProject && completeness.canAdvise) ? [
    { label: t('projects.empty.chip_plan', '📋 Склади план'), prompt: t('projects.empty.prompt_plan', 'Склади план перших кроків для цього проекту') },
    { label: t('projects.empty.chip_budget', '💰 Бюджет і темп'), prompt: t('projects.empty.prompt_budget', 'Допоможи оцінити бюджет і темп роботи для цього проекту') },
    { label: t('projects.empty.chip_risks', '⚠️ Які ризики'), prompt: t('projects.empty.prompt_risks', 'Які головні ризики і складнощі в цьому проекті?') },
  ] : [];

  // Наповнення воркспейсу (qpzj7k) — усе детерміноване, без AI-витрат:
  const silenceDays = p.lastActivity ? Math.floor((Date.now() - p.lastActivity) / (1000 * 60 * 60 * 24)) : null;
  // 🦉 Жива репліка OWL про стан проекту.
  let owlInsight = '';
  if (hasContext) {
    if (steps.length > 0 && !nextStep) owlInsight = t('projects.insight.all_done', 'Усі кроки закрито 🎉 Додай нові або признач проект завершеним.');
    else if (silenceDays !== null && silenceDays >= 3 && nextStep) owlInsight = t('projects.insight.silence', 'Не чіпав {n} дн. Продовжимо? Наступне — {step}', { n: silenceDays, step: escapeHtml(nextStep.text) });
    else if (nextStep) owlInsight = t('projects.insight.next', 'Рухаємось 👌 Наступне — {step}', { step: escapeHtml(nextStep.text) });
    else if (!hasBrief) owlInsight = '';
    else owlInsight = t('projects.insight.start', 'Готово до старту. Додай перший крок або спитай мене з чого почати.');
  }
  // Чіпи лінкованих сутностей (тап → перехід).
  const linkStats = [];
  if (hasContext) {
    linkStats.push({ icon: '📋', label: t('projects.stat.steps', 'Кроки {d}/{t}', { d: doneSteps, t: steps.length }), action: '' });
    linkStats.push({ icon: '📝', label: t('projects.stat.notes', 'Нотатки {n}', { n: noteCount }), action: 'notes' });
    if (projectSpent > 0) linkStats.push({ icon: '💰', label: `${getCurrency()}${projectSpent}`, action: '' });
  }

  const qaStepPrompt = t('projects.qa.add_step_prompt', 'Додай крок до цього проекту');
  const qaAskPrompt = t('projects.qa.ask_prompt', 'Маю питання по цьому проекту');
  const stuckPrompt = nextStep ? t('projects.next.stuck_prompt', 'Я застряг на кроці "{step}" — допоможи зрушити', { step: nextStep.text }) : '';

  const scrollEl = document.getElementById('projects-workspace');
  if (!scrollEl) return;
  // Показуємо воркспейс, ховаємо список (не затираємо #projects-list — інакше
  // «назад» не мав куди рендерити список, qpzj7k фікс).
  const listEl0 = document.getElementById('projects-list');
  const emptyEl0 = document.getElementById('projects-empty');
  if (listEl0) listEl0.style.display = 'none';
  if (emptyEl0) emptyEl0.style.display = 'none';
  scrollEl.style.display = 'block';

  scrollEl.innerHTML = `
    <!-- Назад. B-118 (mUpS8 02.05): position+z-index щоб OWL board overlay
         не перехоплював клік. Padding 8×4 + negative margin = більша hit-area
         (44px рекомендований Apple HIG) без візуальних зсувів. -->
    <div data-action="close-project-workspace" style="display:flex;align-items:center;gap:6px;padding:8px 4px;margin:-8px -4px 4px -4px;cursor:pointer;position:relative;z-index:10">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d2e1e" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      <span style="font-size:13px;font-weight:700;color:#3d2e1e">${t('projects.workspace.back', 'Проекти')}</span>
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
      ${hasTempo ? `<div style="display:flex;gap:5px">
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(30,16,64,0.04);border:1px solid rgba(30,16,64,0.07)">
          <div style="font-size:13px;font-weight:800;color:#1e1040">${escapeHtml(p.tempoNow && p.tempoNow !== '?' ? p.tempoNow : '—')}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(30,16,64,0.38);margin-top:1px">${t('projects.tempo.now', 'зараз')}</div>
        </div>
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(234,88,12,0.06);border:1px solid rgba(234,88,12,0.12)">
          <div style="font-size:13px;font-weight:800;color:#ea580c">${escapeHtml(p.tempoMore && p.tempoMore !== '?' ? p.tempoMore : '—')}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(234,88,12,0.5);margin-top:1px">${t('projects.tempo.more', '+1год/день')}</div>
        </div>
        <div style="flex:1;border-radius:9px;padding:7px 5px;text-align:center;background:rgba(22,163,74,0.06);border:1px solid rgba(22,163,74,0.14)">
          <div style="font-size:13px;font-weight:800;color:#16a34a">${escapeHtml(p.tempoIdeal && p.tempoIdeal !== '?' ? p.tempoIdeal : '—')}</div>
          <div style="font-size:9px;font-weight:600;color:rgba(22,163,74,0.5);margin-top:1px">${t('projects.tempo.ideal', 'ідеально')}</div>
        </div>
      </div>` : ''}
    </div>

    <div class="card-glass">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:13px">💬</span>
        <div class="section-label" style="margin-bottom:0">${t('projects.brief.title', 'Про проект')}</div>
      </div>
      ${hasBrief
        ? `<div style="font-size:12.5px;font-weight:500;color:#1e1040;line-height:1.55">${escapeHtml(p.brief)}</div>
           ${gapChips.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:9px">
             ${gapChips.map(c => `<button data-action="project-chat-prompt" data-prompt="${escapeHtml(c.prompt)}" style="font-size:10.5px;font-weight:600;color:rgba(30,16,64,0.55);background:rgba(255,255,255,0.4);border:1px dashed rgba(30,16,64,0.18);border-radius:8px;padding:4px 9px;cursor:pointer">${t('projects.brief.clarify', 'уточнити')}: ${escapeHtml(c.label)}</button>`).join('')}
           </div>` : ''}`
        : `<div style="font-size:12px;font-weight:500;color:rgba(30,16,64,0.5);line-height:1.5;margin-bottom:10px">${t('projects.brief.empty', 'OWL ще не знає що це за проект. Розкажи суть, ціль і контекст (можна фото) — без цього поради неможливі.')}</div>
           <button data-action="project-chat-prompt" data-prompt="${escapeHtml(briefPrompt)}" style="font-size:12px;font-weight:700;color:white;background:#3d2e1e;border:none;border-radius:10px;padding:8px 14px;cursor:pointer">${t('projects.brief.cta', '💬 Розкажи про проект →')}</button>`
      }
    </div>

    ${owlInsight ? `<div style="display:flex;gap:9px;align-items:flex-start;background:rgba(12,6,28,0.78);border-radius:14px;padding:11px 13px;margin-bottom:10px">
      <span style="font-size:16px;flex-shrink:0">🦉</span>
      <div style="font-size:12.5px;font-weight:600;color:white;line-height:1.5">${owlInsight}</div>
    </div>` : ''}

    ${hasContext ? `<div style="display:flex;gap:6px;margin-bottom:10px">
      <button data-action="project-chat-prompt" data-prompt="${escapeHtml(qaStepPrompt)}" style="flex:1;font-size:11px;font-weight:700;color:#3d2e1e;background:rgba(255,255,255,0.5);border:1px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 4px;cursor:pointer">＋ ${t('projects.qa.step', 'крок')}</button>
      <button data-action="open-notes-folder" data-folder="${escapeHtml(p.name)}" style="flex:1;font-size:11px;font-weight:700;color:#3d2e1e;background:rgba(255,255,255,0.5);border:1px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 4px;cursor:pointer">＋ ${t('projects.qa.note', 'нотатка')}</button>
      <button data-action="call" data-fn="openProjectImagePicker" style="flex:1;font-size:11px;font-weight:700;color:#3d2e1e;background:rgba(255,255,255,0.5);border:1px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 4px;cursor:pointer">🖼 ${t('projects.qa.photo', 'фото')}</button>
      <button data-action="project-chat-prompt" data-prompt="${escapeHtml(qaAskPrompt)}" style="flex:1;font-size:11px;font-weight:700;color:#3d2e1e;background:rgba(255,255,255,0.5);border:1px solid rgba(30,16,64,0.1);border-radius:10px;padding:8px 4px;cursor:pointer">💬 OWL</button>
    </div>` : ''}

    ${linkStats.length ? `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${linkStats.map(s => s.action === 'notes'
        ? `<div data-action="open-notes-folder" data-folder="${escapeHtml(p.name)}" style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.6);background:rgba(255,255,255,0.45);border-radius:8px;padding:5px 9px;cursor:pointer">${s.icon} ${escapeHtml(s.label)}</div>`
        : `<div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.6);background:rgba(255,255,255,0.45);border-radius:8px;padding:5px 9px">${s.icon} ${escapeHtml(s.label)}</div>`
      ).join('')}
    </div>` : ''}

    ${(isNewProject && completeness.canAdvise) ? `<div class="card-glass" style="text-align:center">
      <div style="font-size:22px;margin-bottom:6px">✨</div>
      <div style="font-size:13px;font-weight:500;color:rgba(30,16,64,0.55);line-height:1.5;margin-bottom:10px">${t('projects.empty.hint2', 'OWL зрозумів проект. Що далі?')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
        ${emptyChips.map(c => `<button data-action="project-chat-prompt" data-prompt="${escapeHtml(c.prompt)}" style="font-size:12px;font-weight:700;color:#3d2e1e;background:rgba(61,46,30,0.08);border:1px solid rgba(61,46,30,0.15);border-radius:10px;padding:7px 12px;cursor:pointer">${escapeHtml(c.label)}</button>`).join('')}
      </div>
    </div>` : ''}

    <!-- Бюджет -->
    ${budget.total > 0 || budget.items.length > 0 || budgetSpent > 0 ? `<div class="card-glass">
      <div class="section-label" style="margin-bottom:8px">${t('projects.section.budget', 'Бюджет проекту')}</div>
      ${budget.total > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;font-weight:700;color:#1e1040">${t('projects.budget.spent', 'Витрачено')}</span>
        <span style="font-size:12px;font-weight:900;color:#c2410c">${getCurrency()}${budgetSpent} / ${getCurrency()}${budget.total}</span>
      </div>
      <div style="height:4px;background:rgba(30,16,64,0.07);border-radius:3px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${spentPct}%;background:#c2410c;border-radius:3px"></div>
      </div>` : (budgetSpent > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700;color:#1e1040">${t('projects.budget.spent', 'Витрачено')}</span>
        <span style="font-size:12px;font-weight:900;color:#c2410c">${getCurrency()}${budgetSpent}</span>
      </div>` : '')}
      ${budget.items.map((item, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;${i < budget.items.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
        <span style="font-size:12px;font-weight:600;color:rgba(30,16,64,0.55)">${escapeHtml(item.name)}</span>
        <span style="font-size:12px;font-weight:800;color:${item.amount > 0 ? '#c2410c' : item.amount < 0 ? '#16a34a' : 'rgba(30,16,64,0.35)'}">${item.amount > 0 ? '-' : item.amount < 0 ? '+' : ''}${getCurrency()}${Math.abs(item.amount) || item.label || ''}</span>
      </div>`).join('')}
    </div>` : ''}

    ${nextStep ? `<div style="border-radius:12px;padding:11px 13px;margin-bottom:10px;background:rgba(61,46,30,0.1);border:1.5px solid rgba(61,46,30,0.2)">
      <div style="font-size:9px;font-weight:800;color:rgba(61,46,30,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${t('projects.next.label', 'Наступний крок')}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div data-action="toggle-project-step" data-project-id="${p.id}" data-step-id="${nextStep.id}" style="width:24px;height:24px;border-radius:8px;border:2px solid #3d2e1e;background:rgba(255,255,255,0.6);flex-shrink:0;cursor:pointer"></div>
        <div style="flex:1;font-size:14px;font-weight:800;color:#1e1040;line-height:1.3">${escapeHtml(nextStep.text)}</div>
      </div>
      <div data-action="project-chat-prompt" data-prompt="${escapeHtml(stuckPrompt)}" style="font-size:11px;font-weight:700;color:#3d2e1e;margin-top:8px;cursor:pointer;opacity:0.7">${t('projects.next.stuck', 'застряг? → спитати OWL')}</div>
    </div>` : ''}

    <!-- Ключові метрики -->
    ${metrics.length > 0 ? `<div class="card-glass">
      <div class="section-label">${t('projects.section.metrics', 'Ключові метрики')}</div>
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
        <div class="section-label" style="margin-bottom:0">${t('projects.section.timeline', 'Хронологія · план')}</div>
        <span data-action="toggle-project-timeline" data-id="${p.id}" style="font-size:10px;font-weight:700;color:#3d2e1e;cursor:pointer" id="proj-timeline-toggle-${p.id}">${t('projects.timeline.expand', 'розгорнути ↓')}</span>
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
          <div data-action="toggle-project-step" data-project-id="${p.id}" data-step-id="${s.id}" style="width:18px;height:18px;border-radius:6px;border:1.5px solid ${s.done ? '#3d2e1e' : 'rgba(30,16,64,0.18)'};background:${s.done ? '#3d2e1e' : 'rgba(255,255,255,0.65)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:10px;color:white">${s.done ? '✓' : ''}</div>
          <div style="flex:1;font-size:13px;font-weight:${!s.done && s === nextStep ? 700 : 500};color:${s.done ? 'rgba(30,16,64,0.3)' : '#1e1040'};${s.done ? 'text-decoration:line-through' : ''}">${escapeHtml(s.text)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Лог рішень -->
    ${decisions.length > 0 ? `<div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin-bottom:0">${t('projects.section.decisions', 'Лог рішень')}</div>
        <span style="font-size:9px;color:rgba(30,16,64,0.3);font-weight:600">${t('projects.decisions.owl_auto', 'OWL · авто')}</span>
      </div>
      ${decisions.map((d,i) => `<div style="padding:5px 0;${i < decisions.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
        <div style="font-size:12px;font-weight:700;color:#1e1040">${escapeHtml(d.title)}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:500;margin-top:1px">${escapeHtml(d.reason)}</div>
      </div>`).join('')}
    </div>` : ''}

    <!-- Нотатки → папка -->
    <div data-action="open-notes-folder" data-folder="${escapeHtml(p.name)}" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.55);border:1.5px dashed rgba(30,16,64,0.14);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer">
      <div style="width:30px;height:30px;border-radius:9px;background:rgba(61,46,30,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d2e1e" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#1e1040">${t('projects.notes.title', 'Нотатки проекту')}</div>
        <div style="font-size:10px;color:rgba(30,16,64,0.4);font-weight:600;margin-top:1px">${noteCount > 0 ? t('projects.notes.count_in_folder', '{n} записів у папці "{name}" →', { n: noteCount, name: escapeHtml(p.name) }) : t('projects.notes.empty_cta', 'Додай першу думку по проекту →')}</div>
      </div>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.25)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- OWL персональні ризики -->
    ${risks ? `<div style="background:rgba(12,6,28,0.78);border-radius:14px;padding:11px 13px;margin-bottom:10px">
      <div style="font-size:9px;font-weight:800;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:5px">${t('projects.section.risks', 'OWL · персональні ризики')}</div>
      <div style="font-size:12px;font-weight:600;color:white;line-height:1.55">${escapeHtml(risks)}</div>
    </div>` : ''}

    <!-- Корисна інфа -->
    ${resources.length > 0 ? `<div class="card-glass">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin-bottom:0">${t('projects.section.resources', 'Корисна інфа')}</div>
        <span style="font-size:9px;color:rgba(30,16,64,0.3);font-weight:600">${t('projects.resources.stage_label', 'поточний етап')}</span>
      </div>
      ${resources.map((r,i) => {
        const badgeColors = { 'Книга':'rgba(99,102,241,0.1)|#6366f1', 'Спільнота':'rgba(234,88,12,0.1)|#ea580c', 'Інструмент':'rgba(22,163,74,0.1)|#16a34a', 'Стаття':'rgba(251,191,36,0.15)|#d97706' };
        const [bg, color] = (badgeColors[r.type] || 'rgba(30,16,64,0.07)|rgba(30,16,64,0.5)').split('|');
        // safeHref блокує javascript:/data: схеми (security-аудит vdlyeg) — посилання
        // рендеримо лише якщо URL безпечний. rel=noopener проти tabnabbing.
        const safeUrl = safeHref(r.url);
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;${i < resources.length-1 ? 'border-bottom:1px solid rgba(30,16,64,0.05)' : ''}">
          <div style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:5px;flex-shrink:0;background:${bg};color:${color}">${escapeHtml(r.type)}</div>
          <div style="font-size:11px;font-weight:600;color:#1e1040;flex:1;line-height:1.3">${escapeHtml(r.title)}</div>
          ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener" style="font-size:11px;font-weight:800;color:${color};text-decoration:none">→</a>` : ''}
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
  if (toggle) toggle.textContent = isCollapsed ? t('projects.timeline.collapse', 'згорнути ↑') : t('projects.timeline.expand', 'розгорнути ↓');
}

function toggleProjectStep(projectId, stepId) {
  const projects = getProjects();
  const p = projects.find(pr => pr.id === projectId);
  if (!p) return;
  const step = (p.steps || []).find(s => String(s.id) === String(stepId));
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
  // Якщо крок виконано — закриваємо повʼязану задачу.
  // qpzj7k безпека (Council 🔴): раніше match по підрядку 15 символів міг
  // закрити ЧУЖУ активну задачу зі схожою назвою. Тепер — ТIЛЬКИ точний
  // збіг назви і ТIЛЬКИ якщо така задача одна (немає неоднозначності).
  try {
    if (!step.done) return;
    const stepTitle = (step.text || '').trim().toLowerCase();
    if (!stepTitle) return;
    const tasks = getTasks();
    const matches = tasks.filter(t => t.status === 'active' && (t.title || '').trim().toLowerCase() === stepTitle);
    if (matches.length === 1) {
      matches[0].status = 'done';
      matches[0].completedAt = Date.now();
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
  const newProject = makeProject({ name, subtitle });
  projects.unshift(newProject);
  saveProjects(projects);
  closeProjectModal();
  openProjectWorkspace(newProject.id);
  // OWL починає інтервʼю по проекту в Inbox
  setTimeout(() => startProjectInboxInterview(name, subtitle, newProject.id), 600);
}

export async function startProjectInboxInterview(projectName, projectSubtitle, projectId) {
  // Переходимо на Inbox де відбувається вся комунікація
  if (currentTab !== 'inbox') switchTab('inbox');
  // Старт нового інтерв'ю — чистимо буфер відповідей попереднього проекту.
  localStorage.removeItem('nm_project_interview_answers');
  if (projectId) localStorage.setItem('nm_project_interview_id', String(projectId));
  else localStorage.removeItem('nm_project_interview_id');

  const key = localStorage.getItem('nm_gemini_key');
  if (!key) {
    setTimeout(() => addInboxChatMsg('agent',
      t('projects.intro.no_key', 'Проект "{name}" створено! Розкажи — який у тебе стартовий капітал, скільки часу на тиждень можеш вкладати, і що найбільше лякає в цьому?', { name: projectName })
    ), 400);
    return;
  }

  const aiContext = getAIContext();
  const systemPrompt = `${getOWLPersonality()} Щойно створено новий проект "${projectName}"${projectSubtitle ? ` — "${projectSubtitle}"` : ''}.
Твоя роль — персональний наставник. Це ПЕРШЕ питання інтерв'ю — ти ще не знаєш що це за проект.
Постав ОДНЕ коротке ВІДКРИТЕ питання щоб зрозуміти суть і головну ціль проекту (про що він, чого хочеш досягти, на якому етапі). НЕ питай одразу про гроші/дедлайн — спершу зрозумій контекст.
Коротко, по-людськи, без зайвих слів. Відповідай українською. Тільки текст, без JSON.
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
    if (data?.usage) logUsage('projects-ai', data.usage, data.model);
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      setTimeout(() => {
        addInboxChatMsg('agent', reply);
        // Адаптивне інтерв'ю (qpzj7k): зберігаємо ЦЕ питання щоб спарувати з
        // відповіддю юзера, і активуємо лічильник. Далі continueProjectInterview
        // генерує кожне наступне питання під контекст відповідей.
        localStorage.setItem('nm_project_interview_step', '1');
        localStorage.setItem('nm_project_interview_name', projectName);
        localStorage.setItem('nm_project_interview_lastq', reply);
      }, 500);
    }
  } catch(e) {
    setTimeout(() => addInboxChatMsg('agent',
      t('projects.intro.network_error', 'Проект "{name}" створено! Розкажи — який у тебе стартовий капітал для цього?', { name: projectName })
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
    // brief (суть) — щоб OWL у будь-якому чаті знав ПРО ЩО проект, не лише назву.
    const briefShort = p.brief ? ` — ${String(p.brief).slice(0, 120)}` : '';
    parts.push(`- [ID:${p.id}] "${p.name}" ${pct}%${briefShort}${next ? ' → наступний крок: ' + next.text : ''}${silence}`);
  });
  return parts.join('\n');
}

// === PROJECTS AI BAR ===
export function addProjectsChatMsg(role, text, _noSave = false, chips = null) {
  // MPVly 05.05 — інлайн-парсинг чіпів (один мозок).
  if (role === 'agent' && (!chips || chips.length === 0) && text) {
    const _p = parseContentChips(text);
    if (_p.chips) { text = _p.text; chips = _p.chips; }
  }
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
  if (role === 'agent') el.querySelectorAll('.chat-chips-row').forEach(n => n.remove());
  try { openChatBar('projects'); } catch(e) {}
  const isAgent = role === 'agent';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;${isAgent ? '' : 'justify-content:flex-end'}`;
  div.innerHTML = `<div class="msg-bubble ${isAgent ? 'msg-bubble--agent' : 'msg-bubble--user'}">${escapeHtml(text).replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  if (isAgent && Array.isArray(chips) && chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'chat-chips-row';
    renderChips(chipsRow, chips, 'projects');
    el.appendChild(chipsRow);
    // B-119 + UvEHE chips clipping fix: scrollIntoView надійніше за scrollTop+rAF
    // на iOS Safari — браузер сам рахує реальний layout після append.
    requestAnimationFrame(() => chipsRow.scrollIntoView({ block: 'end', inline: 'nearest' }));
  }
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  if (role !== 'agent') projectsBarHistory.push({ role: 'user', content: text });
  else projectsBarHistory.push({ role: 'assistant', content: text });
  // 64CXo: cap 20 — memory leak fix.
  if (projectsBarHistory.length > 20) projectsBarHistory = projectsBarHistory.slice(-20);
  if (!_noSave) saveChatMsg('projects', role, text, chips);
}

// Кнопка-підказка з порожнього воркспейсу: вставляє готове прохання у поле
// чату проектів і надсилає. Чат використовує INBOX_TOOLS + dispatcher — тобто
// OWL реально викликає add_project_step / update_project_tempo / set_project_budget
// з контекстом activeProject (наповнює проект, не просто відповідає текстом).
export function sendProjectsBarPrompt(text) {
  const input = document.getElementById('projects-bar-input');
  if (!input || !text) return;
  input.value = text;
  sendProjectsBarMessage();
}

export async function sendProjectsBarMessage() {
  if (projectsBarLoading) return;
  const input = document.getElementById('projects-bar-input');
  const text = input.value.trim();
  if (!text) return;
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { addProjectsChatMsg('agent', t('projects.chat.no_key', 'Введи OpenAI ключ в налаштуваннях.')); return; }
  input.value = ''; input.style.height = 'auto';
  input.focus();
  addProjectsChatMsg('user', text);
  projectsBarLoading = true;
  addProjectsChatMsg('typing', '');

  // Фаза 4 "Один мозок V2" (20.04 Gg3Fy): Projects chat на INBOX_TOOLS + dispatcher.
  const projects = getProjects();
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
  const projectsContext = getProjectsContext();
  const activeSteps = activeProject ? (activeProject.steps || []).map(s =>
    `[ID:${s.id}] ${s.done ? '✓' : '○'} ${s.text}`).join('\n') : '';

  const completeness = activeProject ? assessProjectCompleteness(activeProject) : null;
  const systemPrompt = getProjectsChatSystem({ activeProject, projectsContext, activeSteps, completeness })
    + (getAIContext() ? '\n\n' + getAIContext() : '');

  try {
    const msg = await callAIWithTools(systemPrompt, projectsBarHistory.slice(-10), INBOX_TOOLS, 'projects-bar');

    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const guard = shouldClarify(text, msg.tool_calls, 'projects');
      if (guard) {
        addProjectsChatMsg('agent', guard.question, false, guard.chips);
        projectsBarLoading = false;
        return;
      }
      dispatchChatToolCalls(msg.tool_calls, addProjectsChatMsg, text);
      if (msg.content) {
        const { text: replyText, chips } = parseContentChips(msg.content);
        if (replyText) addProjectsChatMsg('agent', replyText, false, chips);
      }
      projectsBarLoading = false;
      return;
    }

    const reply = msg && msg.content ? msg.content.trim() : '';
    if (!reply) { handleChatError(addProjectsChatMsg); projectsBarLoading = false; return; }
    // v3pexs: одне слово без інструмента (bareNoun) → справжні клікабельні чіпи.
    const bnGuard = shouldClarify(text, [], 'projects');
    if (bnGuard) { addProjectsChatMsg('agent', bnGuard.question, false, bnGuard.chips); projectsBarLoading = false; return; }
    const { text: replyText, chips } = parseContentChips(reply);
    if (replyText) {
      const looksLikeJson = (replyText.startsWith('{') && replyText.endsWith('}')) || (replyText.startsWith('[') && replyText.endsWith(']'));
      if (looksLikeJson) { try { JSON.parse(replyText); addProjectsChatMsg('agent', t('projects.chat.done', 'Зроблено ✓')); } catch { addProjectsChatMsg('agent', replyText, false, chips); } }
      else addProjectsChatMsg('agent', replyText, false, chips);
    }
  } catch { addProjectsChatMsg('agent', t('projects.chat.network_error', 'Мережева помилка.')); }
  projectsBarLoading = false;
}

// Фото у проекті — через спільний механізм src/ui/chat-image.js (один мозок):
// кнопка 🖼 у барі = data-action="pick-chat-image" data-tab="projects".

// === WINDOW EXPORTS (HTML handlers only) ===
Object.assign(window, {
  openAddProject, saveNewProject, closeProjectModal,
  sendProjectsBarMessage, sendProjectsBarPrompt, openProjectWorkspace, closeProjectWorkspace,
  toggleProjectTimeline, toggleProjectStep, switchTab,
});
