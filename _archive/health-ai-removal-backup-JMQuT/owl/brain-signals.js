// ============================================================
// brain-signals.js — Signal Collector для Brain Pulse
// ============================================================
// "Один мозок на все" — замість N check-функцій по вкладках,
// один збирач аналізує стан усіх вкладок і повертає структурований
// список "живих сигналів". Далі Brain Pulse (brain-pulse.js) передає
// їх моделі — мозок сам вирішує куди і що писати (або мовчати).
//
// Додано у сесії ZJmdF (21.04.2026) — Фаза B "Один мозок" Варіант 2.
// Замінює частину роботи старого followups.js (stuck-task, event-passed)
// + додає 6 нових типів сигналів на 6 нових вкладках.
// ============================================================

import { getTasks } from '../tabs/tasks.js';
import { getEvents } from '../tabs/calendar.js';
import { getFinance, getFinBudget } from '../tabs/finance.js';
import { getHabits, getHabitLog, getHabitStreak } from '../tabs/habits.js';
import { getHealthCards } from '../tabs/health.js';
import { getProjects } from '../tabs/projects.js';
import { owlCdExpired } from './inbox-board.js';

// === ПАРАМЕТРИ ДЕТЕКЦІЇ ===
const STUCK_TASK_DAYS = 3;
const BUDGET_WARN_THRESHOLD = 80;
const APPOINTMENT_SOON_HOURS = 48;
const EVENT_PASSED_MIN_MIN = 30;
const EVENT_PASSED_MAX_HR = 24;
const EVENT_UPCOMING_MIN_HR = 1;
const EVENT_UPCOMING_MAX_HR = 3;
const STREAK_RISK_HOUR = 18;
const PROJECT_STUCK_DAYS = 5;

// Per-signal cooldown — 24 год (щоб не дублювати один і той самий сигнал)
const PER_SIGNAL_CD = 24 * 60 * 60 * 1000;

/**
 * Головна функція збирача. Повертає масив сигналів.
 * Формат: { tab, type, urgency, context, cdKey, cdMs }
 *   tab     — куди писати (tasks/notes/me/finance/health/projects)
 *   type    — тип тригера (stuck-task/budget-warn/streak-risk/...)
 *   urgency — 'normal' | 'critical'
 *   context — дані для промпту (назва задачі, % бюджету, імʼя звички)
 *   cdKey   — ключ у nm_owl_cooldowns щоб після надсилання поставити cd
 *   cdMs    — тривалість cooldown
 */
export function collectBrainSignals() {
  const signals = [];
  try { signals.push(..._collectStuckTasks()); } catch (e) { console.warn('[brain-signals] stuck-tasks failed:', e); }
  try { signals.push(..._collectPassedEvents()); } catch (e) { console.warn('[brain-signals] passed-events failed:', e); }
  try { signals.push(..._collectUpcomingEvents()); } catch (e) { console.warn('[brain-signals] upcoming-events failed:', e); }
  try { signals.push(..._collectBudgetWarn()); } catch (e) { console.warn('[brain-signals] budget-warn failed:', e); }
  try { signals.push(..._collectAppointmentSoon()); } catch (e) { console.warn('[brain-signals] appointment-soon failed:', e); }
  try { signals.push(..._collectStreakRisk()); } catch (e) { console.warn('[brain-signals] streak-risk failed:', e); }
  try { signals.push(..._collectProjectStuck()); } catch (e) { console.warn('[brain-signals] project-stuck failed:', e); }
  try { signals.push(..._collectWeeklyReview()); } catch (e) { console.warn('[brain-signals] weekly-review failed:', e); }
  return signals;
}

function _collectStuckTasks() {
  const cutoff = Date.now() - STUCK_TASK_DAYS * 24 * 60 * 60 * 1000;
  const tasks = getTasks()
    .filter(t => t.status === 'active')
    .filter(t => t.createdAt && t.createdAt < cutoff)
    .filter(t => owlCdExpired(`brain_stuck_${t.id}`, PER_SIGNAL_CD))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (tasks.length === 0) return [];
  const t = tasks[0];
  const daysOld = Math.floor((Date.now() - t.createdAt) / (24 * 60 * 60 * 1000));
  return [{
    tab: 'tasks',
    type: 'stuck-task',
    urgency: 'normal',
    context: { title: t.title, daysOld },
    cdKey: `brain_stuck_${t.id}`,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectPassedEvents() {
  const now = Date.now();
  const minAgo = EVENT_PASSED_MIN_MIN * 60 * 1000;
  const maxAgo = EVENT_PASSED_MAX_HR * 60 * 60 * 1000;
  const events = getEvents()
    .filter(ev => ev.time && ev.date)
    .filter(ev => {
      const [h, m] = ev.time.split(':').map(Number);
      const [y, mo, d] = ev.date.split('-').map(Number);
      if ([h, m, y, mo, d].some(isNaN)) return false;
      const ts = new Date(y, mo - 1, d, h, m).getTime();
      const diff = now - ts;
      return diff > minAgo && diff < maxAgo;
    })
    .filter(ev => owlCdExpired(`brain_passed_${ev.id}`, PER_SIGNAL_CD));
  if (events.length === 0) return [];
  const ev = events.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  return [{
    tab: 'tasks', // календар живе всередині Продуктивності
    type: 'event-passed',
    urgency: 'normal',
    context: { title: ev.title },
    cdKey: `brain_passed_${ev.id}`,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectUpcomingEvents() {
  const now = Date.now();
  const minAhead = EVENT_UPCOMING_MIN_HR * 60 * 60 * 1000;
  const maxAhead = EVENT_UPCOMING_MAX_HR * 60 * 60 * 1000;
  const events = getEvents()
    .filter(ev => ev.time && ev.date)
    .filter(ev => {
      const [h, m] = ev.time.split(':').map(Number);
      const [y, mo, d] = ev.date.split('-').map(Number);
      if ([h, m, y, mo, d].some(isNaN)) return false;
      const ts = new Date(y, mo - 1, d, h, m).getTime();
      const ahead = ts - now;
      return ahead >= minAhead && ahead <= maxAhead;
    })
    .filter(ev => owlCdExpired(`brain_upcoming_${ev.id}`, PER_SIGNAL_CD));
  if (events.length === 0) return [];
  const ev = events.sort((a, b) => {
    const tsA = new Date(a.date + 'T' + a.time).getTime();
    const tsB = new Date(b.date + 'T' + b.time).getTime();
    return tsA - tsB;
  })[0];
  return [{
    tab: 'tasks',
    type: 'event-upcoming',
    urgency: 'critical',
    context: { title: ev.title, time: ev.time, date: ev.date },
    cdKey: `brain_upcoming_${ev.id}`,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectBudgetWarn() {
  const budget = getFinBudget();
  if (!budget || !budget.total || budget.total <= 0) return [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const txs = getFinance();
  const spent = txs
    .filter(t => t.type === 'expense' && t.ts >= monthStart)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const pct = Math.round((spent / budget.total) * 100);
  if (pct < BUDGET_WARN_THRESHOLD) return [];
  const urgency = pct >= 100 ? 'critical' : 'normal';
  const type = pct >= 100 ? 'budget-overflow' : 'budget-warn';
  const cdKey = `brain_${type}`;
  if (!owlCdExpired(cdKey, PER_SIGNAL_CD)) return [];
  return [{
    tab: 'finance',
    type,
    urgency,
    context: { percentage: pct, spent: Math.round(spent), budget: budget.total },
    cdKey,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectAppointmentSoon() {
  const now = Date.now();
  const maxAhead = APPOINTMENT_SOON_HOURS * 60 * 60 * 1000;
  const cards = getHealthCards();
  const candidates = [];
  for (const c of cards) {
    const appt = c.nextAppointment;
    if (!appt || !appt.date) continue;
    const t = appt.time || '09:00';
    const [h, m] = t.split(':').map(Number);
    const [y, mo, d] = appt.date.split('-').map(Number);
    if ([h, m, y, mo, d].some(isNaN)) continue;
    const ts = new Date(y, mo - 1, d, h, m).getTime();
    const ahead = ts - now;
    if (ahead <= 0 || ahead > maxAhead) continue;
    const cdKey = `brain_appt_${c.id}_${appt.date}`;
    if (!owlCdExpired(cdKey, PER_SIGNAL_CD)) continue;
    candidates.push({ card: c, appt, ahead, cdKey });
  }
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => a.ahead - b.ahead);
  const best = candidates[0];
  const hoursAhead = Math.round(best.ahead / (60 * 60 * 1000));
  return [{
    tab: 'health',
    type: 'appointment-soon',
    urgency: hoursAhead <= 3 ? 'critical' : 'normal',
    context: {
      cardName: best.card.name,
      doctor: best.card.doctor || '',
      date: best.appt.date,
      time: best.appt.time,
      hoursAhead,
    },
    cdKey: best.cdKey,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectStreakRisk() {
  const hour = new Date().getHours();
  if (hour < STREAK_RISK_HOUR) return [];
  const today = new Date().toDateString();
  const log = getHabitLog();
  const todayLog = log[today] || {};
  const habits = getHabits().filter(h => h.type === 'gain');
  const candidates = [];
  for (const h of habits) {
    const streak = getHabitStreak(h.id);
    if (streak < 3) continue;
    const dow = (new Date().getDay() + 6) % 7;
    const days = h.days || [0, 1, 2, 3, 4];
    if (!days.includes(dow)) continue;
    const done = (todayLog[h.id] || 0) >= (h.targetCount || 1);
    if (done) continue;
    const cdKey = `brain_streak_${h.id}`;
    if (!owlCdExpired(cdKey, PER_SIGNAL_CD)) continue;
    candidates.push({ habit: h, streak, cdKey });
  }
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.streak - a.streak);
  const best = candidates[0];
  return [{
    tab: 'me', // звички зараз у вкладці "Я" / без окремого чат-бару → пишемо в Я
    type: 'streak-risk',
    urgency: 'normal',
    context: { habitName: best.habit.name, streak: best.streak },
    cdKey: best.cdKey,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectProjectStuck() {
  const cutoff = Date.now() - PROJECT_STUCK_DAYS * 24 * 60 * 60 * 1000;
  const projects = getProjects()
    .filter(p => (p.progress || 0) < 100)
    .filter(p => p.lastActivity && p.lastActivity < cutoff)
    .filter(p => owlCdExpired(`brain_project_${p.id}`, PER_SIGNAL_CD))
    .sort((a, b) => (a.lastActivity || 0) - (b.lastActivity || 0));
  if (projects.length === 0) return [];
  const p = projects[0];
  const daysStuck = Math.floor((Date.now() - p.lastActivity) / (24 * 60 * 60 * 1000));
  return [{
    tab: 'projects',
    type: 'project-stuck',
    urgency: 'normal',
    context: { name: p.name, daysStuck, progress: p.progress || 0 },
    cdKey: `brain_project_${p.id}`,
    cdMs: PER_SIGNAL_CD,
  }];
}
function _collectWeeklyReview() {
  const now = new Date();
  // Неділя 18:00-21:59 — час тижневого огляду
  if (now.getDay() !== 0) return [];
  const h = now.getHours();
  if (h < 18 || h >= 22) return [];
  // Один раз на тиждень
  const cdKey = 'brain_weekly_review';
  if (!owlCdExpired(cdKey, 6 * 24 * 60 * 60 * 1000)) return [];
  return [{
    tab: 'me',
    type: 'weekly-review',
    urgency: 'normal',
    context: { dayOfWeek: 'sunday' },
    cdKey,
    cdMs: 6 * 24 * 60 * 60 * 1000, // 6 днів (щоб не спрацювало наступної неділі)
  }];
}
