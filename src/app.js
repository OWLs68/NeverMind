// NeverMind — точка входу (entry point)
// Імпорти всіх модулів — порядок важливий

// Core
import './core/nav.js';
import './core/utils.js';
import './core/trash.js';
import './core/logger.js';

// UI
import './ui/keyboard.js';
import './ui/swipe-delete.js';

// AI
import './ai/core.js';

// OWL
import './owl/inbox-board.js';
import './owl/chips.js';
import './owl/board.js';
import './owl/proactive.js';

// Boot (має бути останнім — викликає init/bootApp)
import './core/boot.js';
