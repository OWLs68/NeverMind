// src/ui/chat-image.js
//
// «Один мозок» для фото (qpzj7k): кнопка 🖼 у будь-якому чат-барі → юзер кидає
// фото → OWL «бачить» його (gpt-4o-mini vision) → перетворює на короткий опис
// від першої особи → опис іде у поле того чату і запускається ЗВИЧАЙНИЙ потік
// чату. Тобто кожна вкладка обробляє фото своїм мозком (Inbox може створити
// задачу/витрату, Проект — оновити розуміння, тощо) — без окремої логіки на
// кожен таб. Саме фото не зберігаємо (памʼять iOS) — лише текст що OWL зчитав.

import { showToast } from '../core/nav.js';
import { t } from '../core/utils.js';
import { logUsage } from '../core/usage-meter.js';
import { getChatVisionPrompt } from '../ai/prompts.js';

// Таб → (поле вводу, функція надсилання). Один мозок: далі все йде звичайним
// потоком кожного бару (той самий dispatcher і tools).
const TAB_INPUT = {
  inbox: 'inbox-input', tasks: 'tasks-chat-input', notes: 'notes-bar-input',
  me: 'me-chat-input', evening: 'evening-bar-input', finance: 'finance-bar-input',
  projects: 'projects-bar-input',
};
const TAB_SEND = {
  inbox: 'sendToAI', tasks: 'sendTasksBarMessage', notes: 'sendNotesBarMessage',
  me: 'sendMeChatMessage', evening: 'sendEveningBarMessage', finance: 'sendFinanceBarMessage',
  projects: 'sendProjectsBarMessage',
};

let _pendingTab = null;

// Тап на 🖼 у барі — запамʼятовуємо таб і відкриваємо вибір фото.
export function pickChatImage(tab) {
  _pendingTab = TAB_INPUT[tab] ? tab : 'inbox';
  const inp = document.getElementById('chat-image-input');
  if (inp) inp.click();
}

// Зменшуємо фото до 1024px (менше токенів, швидше, дешевше).
function _downscale(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Vision: фото → короткий опис від першої особи (щоб мозок чату обробив його
// як звичайне повідомлення юзера).
async function _visionDescribe(dataUrl, key) {
  const sys = getChatVisionPrompt();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: [
          { type: 'text', text: 'Photo' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] },
      ],
      max_tokens: 300,
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  if (data?.usage) logUsage('chat-vision', data.usage, data.model);
  return (data.choices?.[0]?.message?.content || '').trim();
}

// data-on-change на спільному прихованому file-input.
export async function onChatImagePicked(dataset, el) {
  const input = el || document.getElementById('chat-image-input');
  const file = input && input.files && input.files[0];
  if (input) input.value = '';
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  const tab = _pendingTab || 'inbox';
  const inputId = TAB_INPUT[tab];
  const sendFn = TAB_SEND[tab];
  const key = localStorage.getItem('nm_gemini_key');
  if (!key) { try { showToast(t('chatimg.no_key', 'Спершу введи OpenAI ключ у Налаштуваннях')); } catch (e) {} return; }
  try {
    showToast(t('chatimg.looking', 'Дивлюсь фото…'));
    const dataUrl = await _downscale(file, 1024);
    const desc = await _visionDescribe(dataUrl, key);
    if (!desc) { showToast(t('chatimg.fail', 'Не вдалось розпізнати фото')); return; }
    const inp = document.getElementById(inputId);
    if (inp) {
      inp.value = desc;
      // Downstream-обробка опису теж належить до способу «фото» (для розбивки витрат).
      try { window.__nm_inputMode = 'photo'; } catch (e) {}
      if (typeof window[sendFn] === 'function') window[sendFn]();
    }
  } catch (e) {
    try { showToast(t('chatimg.fail', 'Не вдалось розпізнати фото')); } catch (e2) {}
  }
}

if (typeof window !== 'undefined') {
  window.pickChatImage = pickChatImage;
  window.onChatImagePicked = onChatImagePicked;
}
