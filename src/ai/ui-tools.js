// ============================================================
// ai/ui-tools.js — UI Tools (4.17) — навігація, фільтри, налаштування
// Створено 18.04.2026 (сесія VJF2M)
// ============================================================
//
// Принцип "мінімального тертя": агент виконує hands-free дії навігації,
// фільтрів, налаштувань по голосу або тексту. НЕ відкриває порожні форми
// (CRUD даних робиться звичайними tools save_task/save_finance тощо).
//
// Повний довідник → docs/AI_TOOLS.md розділ "UI Tools (4.17)".
//
// Handlers викликають нативні функції з nav/finance/health/онбординг.
// Dispatcher `handleUITool(name, args)` повертає { text } — короткий звіт
// що показується у чаті і як toast.
// ============================================================

import { switchTab, openSettings } from '../core/nav.js';

// ===== UI_TOOLS — function definitions для OpenAI =====
export const UI_TOOLS = [
  {
    type: "function",
    function: {
      name: "switch_tab",
      description: "Перемкнути активну вкладку у застосунку. Юзер каже 'відкрий календар', 'покажи задачі', 'перейди до фінансів'. ВИКОРИСТОВУЙ ЛИШЕ значення з enum target — інші недоступні.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["inbox", "tasks", "notes", "finance", "habits", "me", "evening", "health", "projects", "calendar"],
            description: "Назва вкладки"
          }
        },
        required: ["target"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_memory",
      description: "Відкрити модалку 'Пам'ять агента' — що агент знає про юзера. Юзер каже 'що ти про мене знаєш', 'покажи пам'ять'.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "open_calendar",
      description: "Відкрити модалку Календаря. Використовуй коли юзер питає про заплановані події, розклад, 'що на цьому тижні', 'які в мене події', 'який завтра день', 'що запланував', 'відкрий календар'. Якщо highlight_events:true — клітинки-дні з подіями будуть пульсувати бірюзовим (яскрава відповідь на питання про події). Якщо false — просто відкрити календар без підсвічувань. ОКРІМ виклику цього tool — ЗАВЖДИ дай коротку текстову відповідь у чаті: скільки подій, найближча з датою/часом.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          highlight_events: {
            type: "boolean",
            description: "true — коли юзер питає ПРО події (підсвітити пульсацією дні з подіями). false — коли юзер просто попросив ВІДКРИТИ календар (без підсвічень)."
          }
        },
        required: ["highlight_events"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_settings",
      description: "Відкрити модалку Налаштувань. Юзер каже 'відкрий налаштування', 'покажи налаштування'.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "set_finance_period",
      description: "Перемкнути період відображення у Фінансах. Юзер каже 'покажи за тиждень', 'за місяць', 'за 3 місяці'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "3months"] }
        },
        required: ["period"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_finance_analytics",
      description: "Відкрити екран Аналітики Фінансів (графіки, метрики, 50/30/20). Юзер каже 'відкрий аналітику', 'покажи графіки витрат'.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "set_owl_mode",
      description: "Змінити характер OWL — Тренер (прямий, підштовхує), Партнер (теплий, підтримує), Наставник (мудрий, ставить питання). Юзер каже 'переключись на Ментора', 'будь тренером'.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["coach", "partner", "mentor"] }
        },
        required: ["mode"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_health_card",
      description: "Відкрити модалку 'Медична картка' — готовий текст з алергіями/станами/ліками для копіювання лікарю. Юзер каже 'експортуй медкартку', 'зроби медичну картку'.",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "request_quiet",
      description: "Вмикає режим тиші коли юзер просить не турбувати, дати спокій, відчепитися, не зайобувати, помовчати, не доставати. Сова мовчить вказану кількість годин у табло, brain pulse, проактивних повідомленнях. Чат лишається доступним для прямих питань юзера. Тривалість: 'на годинку'=1, 'до вечора'=різниця до 22:00, 'на пів дня'=6, 'до завтра'=різниця до завтрашнього 08:00, без уточнення=4.",
      parameters: {
        type: "object",
        properties: {
          duration_hours: {
            type: "number",
            description: "Тривалість тиші у годинах (1-24). За замовчуванням 4."
          }
        },
        required: ["duration_hours"]
      }
    }
  }
];

// ===== UI_TOOL_NAMES — для швидкої перевірки у dispatch =====
export const UI_TOOL_NAMES = new Set(UI_TOOLS.map(t => t.function.name));

// ===== handleUITool — dispatcher =====
export function handleUITool(name, args) {
  try {
    switch (name) {
      case 'switch_tab': {
        const t = args.target;
        if (t === 'calendar') {
          if (typeof window.openCalendarModal === 'function') {
            window.openCalendarModal();
            return { text: 'Відкрив Календар.' };
          }
          return { text: 'Календар недоступний.' };
        }
        if (t === 'habits') {
          switchTab('tasks');
          // Перемикаємо підтаб «Звички» — інакше юзер бачить Задачі
          if (typeof window.switchProdTab === 'function') {
            setTimeout(() => { try { window.switchProdTab('habits'); } catch(e) {} }, 50);
          }
          return { text: 'Відкрив Звички.' };
        }
        if (t === 'tasks') {
          switchTab('tasks');
          if (typeof window.switchProdTab === 'function') {
            setTimeout(() => { try { window.switchProdTab('tasks'); } catch(e) {} }, 50);
          }
          return { text: 'Відкрив Задачі.' };
        }
        if (!document.getElementById(`page-${t}`)) {
          return { text: `Вкладка "${t}" недоступна.` };
        }
        switchTab(t);
        return { text: `Відкрив ${_tabLabel(t)}.` };
      }

      case 'open_memory':
        if (typeof window.openMemoryModal === 'function') {
          window.openMemoryModal();
          return { text: 'Відкрив Пам\'ять.' };
        }
        return { text: 'Пам\'ять недоступна.' };

      case 'open_calendar': {
        if (typeof window.openCalendarModal !== 'function') {
          return { text: 'Календар недоступний.' };
        }
        window.openCalendarModal();
        if (args.highlight_events && typeof window.highlightEventDays === 'function') {
          // Даємо модалці час розкритися (анімація scale 0→1 займає ~350мс)
          setTimeout(() => { try { window.highlightEventDays(); } catch(e) {} }, 400);
          return { text: 'Відкрив Календар — дні з подіями пульсують.' };
        }
        return { text: 'Відкрив Календар.' };
      }

      case 'open_settings':
        openSettings();
        return { text: 'Відкрив Налаштування.' };

      case 'set_finance_period': {
        if (typeof window.setFinPeriod === 'function') window.setFinPeriod(args.period);
        const label = { week: 'тиждень', month: 'місяць', '3months': '3 місяці' }[args.period] || args.period;
        return { text: `Фінанси: ${label}.` };
      }

      case 'open_finance_analytics':
        switchTab('finance');
        if (typeof window.openFinAnalytics === 'function') {
          setTimeout(() => window.openFinAnalytics(), 120);
        }
        return { text: 'Відкрив Аналітику Фінансів.' };

      case 'set_owl_mode': {
        const settings = JSON.parse(localStorage.getItem('nm_settings') || '{}');
        settings.owl_mode = args.mode;
        localStorage.setItem('nm_settings', JSON.stringify(settings));
        const label = { coach: 'Тренер', partner: 'Партнер', mentor: 'Наставник' }[args.mode] || args.mode;
        return { text: `Характер OWL: ${label}.` };
      }

      case 'export_health_card':
        if (typeof window.openHealthExport === 'function') {
          switchTab('health');
          setTimeout(() => window.openHealthExport(), 120);
          return { text: 'Відкрив Медичну картку.' };
        }
        return { text: 'Вкладка Здоров\'я ще не готова.' };

      case 'request_quiet': {
        const hours = Math.max(1, Math.min(24, Number(args.duration_hours) || 4));
        const expiresAt = Date.now() + hours * 3600000;
        localStorage.setItem('nm_owl_silence_until', String(expiresAt));
        try { window.dispatchEvent(new CustomEvent('nm-data-changed', { detail: 'silence' })); } catch {}
        const endTime = new Date(expiresAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        return { text: `🤫 Зрозуміла. Мовчу до ${endTime}. У чаті можеш питати — відповім.` };
      }

      default:
        return { text: `Невідомий UI tool: ${name}` };
    }
  } catch (e) {
    console.error('[ui-tools]', name, e);
    return { text: `Не вдалось виконати: ${name}` };
  }
}

function _tabLabel(key) {
  return {
    inbox: 'Inbox',
    tasks: 'Задачі',
    notes: 'Нотатки',
    finance: 'Фінанси',
    habits: 'Звички',
    me: 'Я',
    evening: 'Вечір',
    health: 'Здоров\'я',
    projects: 'Проекти',
    calendar: 'Календар'
  }[key] || key;
}

// Експорт у window для можливого ручного тестування
try { Object.assign(window, { handleUITool, UI_TOOLS, UI_TOOL_NAMES }); } catch {}
