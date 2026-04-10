// NeverMind — точка входу (entry point)
// Імпорти всіх модулів — порядок важливий (відповідає порядку <script> тегів)

// Core (ядро)
import './core/nav.js';
import './core/utils.js';
import './core/trash.js';
import './core/logger.js';

// UI (інтерфейс)
import './ui/keyboard.js';
import './ui/swipe-delete.js';

// AI (штучний інтелект)
import './ai/core.js';

// OWL (агент)
import './owl/inbox-board.js';
import './owl/chips.js';
import './owl/board.js';
import './owl/proactive.js';
import './owl/followups.js';

// Tabs (вкладки) — порядок як в оригінальних <script> тегах
import './tabs/inbox.js';
import './tabs/tasks.js';
import './tabs/habits.js';
import './tabs/notes.js';
import './tabs/finance.js';
import './tabs/evening.js';
import './tabs/onboarding.js';
import './tabs/health.js';
import './tabs/projects.js';
import './tabs/calendar.js';

// Boot (завантаження — має бути останнім, викликає init/bootApp)
import './core/boot.js';
