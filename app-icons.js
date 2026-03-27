// NeverMind — SVG icons registry
const NMIcons = {
  // checkmark — галочка для задачі в сплеш
  'checkmark': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0e7490" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,

  // shield — щит для звички в сплеш
  'shield': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,

  // file — файл для нотатки в сплеш
  'file': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a6a3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`,

  // user-avatar — аватар на онбордингу
  'user-avatar': `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M12 13c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/><circle cx="10" cy="7" r="1" fill="#7c3aed"/><circle cx="14" cy="7" r="1" fill="#7c3aed"/><path d="M10.5 9.5c.4.3.9.5 1.5.5s1.1-.2 1.5-.5"/></svg>`,

  // bolt — блискавка для coach
  'bolt': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,

  // users — дві особи для partner
  'users': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,

  // user — одна особа для mentor
  'user': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/><circle cx="10" cy="7.2" r=".8" fill="#7c3aed"/><circle cx="14" cy="7.2" r=".8" fill="#7c3aed"/></svg>`,

  // lock — замок
  'lock': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,

  // chat — чат бабл
  'chat': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,

  // trash — смітник
  'trash': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>`,

  // plus — плюс (загальна кнопка додавання)
  'plus': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,

  // plus-sm — маленький плюс для drum-plus-btn та табаробару
  'plus-sm': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.4)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,

  // send — паперовий літак (кнопка відправки)
  'send': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,

  // send-white — паперовий літак (на світлому фоні)
  'send-white': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,

  // send-dialog — літак для діалогу evening
  'send-dialog': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,

  // camera — камера
  'camera': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,

  // mic — мікрофон
  'mic': `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,

  // chevron-right — стрілка вправо (для settings chevron)
  'chevron-right': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.3)" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`,

  // chevron-right-accent — стрілка вправо (акцентна для How to use)
  'chevron-right-accent': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b6914" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`,

  // chevron-left — стрілка вліво (назад у note view)
  'chevron-left': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,

  // chevron-right-help — стрілка вправо у help drawer
  'chevron-right-help': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,

  // search — лупа
  'search': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,

  // warning — трикутник попередження
  'warning': `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" style="flex-shrink:0;margin-top:2px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  // arrow-left — стрілка назад (в note view header)
  'arrow-left': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,

  // more — три крапки (меню)
  'more': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,

  // note-tab — іконка нотатки у вкладці
  'note-tab': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,

  // chat-tab — іконка чату у вкладці
  'chat-tab': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,

  // user-settings — іконка профілю в налаштуваннях (одна людина, зелена)
  'user-settings': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,

  // shield-settings — щит у конфіденційності (settings info)
  'shield-settings': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,

  // trash-red — смітник червоний (видалити дані)
  'trash-red': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/><path d="M10 11v6M14 11v6"/></svg>`,

  // pencil — олівець (редагувати нотатку в note-menu)
  'pencil': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,

  // folder — папка (перемістити нотатку в note-menu)
  'folder': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,

  // copy — копіювати (скопіювати текст нотатки в note-menu)
  'copy': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,

  // help-circle — коло з питанням (як користуватися NeverMind у settings)
  'help-circle': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b6914" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  // chevron-right-gold — стрілка вправо золота (для how-to-use row у settings)
  'chevron-right-gold': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b6914" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`,

  // coin — монета/валюта (settings profile currency row)
  'coin': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v2m0 8v2"/><path d="M9.5 9.5A2.5 2.5 0 0 1 12 8h.5a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5H12a2.5 2.5 0 0 0 2.5-1.5"/></svg>`,

  // sun — сонце/мова (settings language row)
  'sun': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/></svg>`,

  // mic-purple — мікрофон фіолетовий (settings notifications row)
  'mic-purple': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,

  // database — база даних (settings memory row)
  'database': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,

  // file-terms — файл з рядками (settings terms of use)
  'file-terms': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,

  // chat-settings — чат бабл (settings feedback/write to author)
  'chat-settings': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,

  // info — інформаційне коло (settings what's new)
  'info': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(30,16,64,0.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,

  // notes-owl — іконка OWL у баннері notes ai banner (маленький юзер)
  'notes-owl': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/></svg>`,
};

function nmIcon(name) {
  return NMIcons[name] || '';
}

function initIcons() {
  document.querySelectorAll('[data-nm-icon]').forEach(el => {
    const name = el.getAttribute('data-nm-icon');
    if (NMIcons[name]) el.innerHTML = NMIcons[name];
  });
}

document.addEventListener('DOMContentLoaded', initIcons);
