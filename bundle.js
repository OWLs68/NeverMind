(() => {
  // src/core/nav.js
  var TAB_THEMES = {
    inbox: {
      bg: "linear-gradient(160deg, #f5f0e8, #ffffff)",
      orb: "rgba(220,200,170,0.25)",
      tabBg: "rgb(220,200,170)",
      accent: "#5c4a2a",
      accent2: "#8b6914"
    },
    tasks: {
      bg: "linear-gradient(160deg, #fdb87a, #ffd4a8)",
      orb: "rgba(234,88,12,0.15)",
      tabBg: "rgb(253,184,122)",
      accent: "#ea580c",
      accent2: "#f97316"
    },
    notes: {
      bg: "linear-gradient(160deg, #fed7aa, #ffedd5)",
      orb: "rgba(234,88,12,0.10)",
      tabBg: "rgb(254,215,170)",
      accent: "#c2620a",
      accent2: "#f97316"
    },
    me: {
      bg: "linear-gradient(160deg, #e8d5c4, #f5ede4)",
      orb: "rgba(124,74,42,0.12)",
      tabBg: "rgb(200,160,130)",
      accent: "#7c4a2a",
      accent2: "#c2620a"
    },
    evening: {
      bg: "linear-gradient(160deg, #1e3350, #3a5a80)",
      orb: "rgba(30,51,80,0.20)",
      tabBg: "rgb(25,45,75)",
      accent: "#1e3350",
      accent2: "#3a5a80"
    },
    finance: {
      bg: "linear-gradient(160deg, #fcd9bd, #fff7ed)",
      orb: "rgba(249,115,22,0.12)",
      tabBg: "rgb(249,155,100)",
      accent: "#c2410c",
      accent2: "#f97316"
    },
    health: {
      bg: "linear-gradient(160deg, #d4e8d8, #edf7ef)",
      orb: "rgba(26,92,42,0.12)",
      tabBg: "rgb(26,92,42)",
      accent: "#1a5c2a",
      accent2: "#16a34a"
    },
    projects: {
      bg: "linear-gradient(160deg, #e8e0d5, #f5f0ea)",
      orb: "rgba(61,46,30,0.10)",
      tabBg: "rgb(61,46,30)",
      accent: "#3d2e1e",
      accent2: "#7c5c3a"
    }
  };
  var currentTab2 = "inbox";
  function switchTab2(tab) {
    if (tab === currentTab2) return;
    animateTabSwitch(tab);
    currentTab2 = tab;
    try {
      closeAllChatBars();
    } catch (e) {
    }
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById(`page-${tab}`).classList.add("active");
    updateDrumTabbar(tab);
    applyTheme2(tab);
    ["inbox", "tasks", "notes", "me", "evening", "finance", "health", "projects"].forEach((t) => {
      const bar = document.getElementById(t + "-ai-bar");
      if (!bar) return;
      const show = t === tab;
      bar.style.display = show ? "flex" : "none";
      if (!show) {
        if (t !== "inbox") {
          const cw = bar.querySelector(".ai-bar-chat-window");
          if (cw) cw.classList.remove("open");
        }
      }
    });
    if (tab === "inbox") {
      try {
        renderInbox();
      } catch (e) {
      }
    }
    if (tab === "tasks") {
      renderTasks();
      if (currentProdTab === "habits") renderProdHabits();
      updateProdTabCounters();
    }
    if (tab === "notes") {
      currentNotesFolder = null;
      renderNotes();
      checkAndSuggestFolders();
    }
    if (tab === "me") {
      renderMe();
      renderMeHabitsStats();
    }
    if (tab === "evening") {
      renderEvening();
    }
    if (tab === "finance") {
      try {
        renderFinance();
      } catch (e) {
        console.error("renderFinance error:", e);
      }
    }
    if (tab === "health") {
      try {
        renderHealth();
      } catch (e) {
      }
    }
    if (tab === "projects") {
      try {
        renderProjects();
      } catch (e) {
      }
    }
    setTimeout(() => showFirstVisitTip(tab), 600);
    setTimeout(() => {
      try {
        tryTabBoardUpdate(tab);
      } catch (e) {
      }
    }, 700);
    if (["me", "evening", "health", "projects", "inbox"].includes(tab)) {
      setTimeout(() => {
        try {
          applyBoardOverlays();
        } catch (e) {
        }
      }, 750);
    }
  }
  var DEFAULT_TABS = ["inbox", "notes"];
  var ALL_TABS_CONFIG = [
    {
      id: "inbox",
      label: "Inbox",
      accent: "#8b6914",
      bg: "rgba(245,240,232,0.9)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
    },
    {
      id: "tasks",
      label: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432.",
      accent: "#c2410c",
      bg: "rgba(253,184,122,0.25)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
    },
    {
      id: "notes",
      label: "\u041D\u043E\u0442\u0430\u0442\u043A\u0438",
      accent: "#c2620a",
      bg: "rgba(254,215,170,0.3)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>'
    },
    {
      id: "me",
      label: "\u042F",
      accent: "#7c4a2a",
      bg: "rgba(232,213,196,0.35)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
    },
    {
      id: "evening",
      label: "\u0412\u0435\u0447\u0456\u0440",
      accent: "#1e3350",
      bg: "rgba(30,51,80,0.12)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    },
    {
      id: "finance",
      label: "\u0424\u0456\u043D\u0430\u043D\u0441\u0438",
      accent: "#c2410c",
      bg: "rgba(252,217,189,0.35)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="14" r="2"/></svg>'
    },
    {
      id: "health",
      label: "\u0417\u0434\u043E\u0440\u043E\u0432'\u044F",
      accent: "#1a5c2a",
      bg: "rgba(212,232,216,0.4)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
    },
    {
      id: "projects",
      label: "\u041F\u0440\u043E\u0435\u043A\u0442\u0438",
      accent: "#3d2e1e",
      bg: "rgba(232,224,213,0.4)",
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    }
  ];
  function getActiveTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem("nm_active_tabs") || "null");
      if (Array.isArray(saved) && saved.length >= 1) return saved;
    } catch (e) {
    }
    return [...DEFAULT_TABS];
  }
  function saveActiveTabs(arr) {
    localStorage.setItem("nm_active_tabs", JSON.stringify(arr));
  }
  function openTabSelector() {
    const active = getActiveTabs();
    const locked = ["inbox", "notes"];
    const overlay = document.createElement("div");
    overlay.id = "tab-selector-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)";
    var cardsHtml = ALL_TABS_CONFIG.map(function(t) {
      var isActive = active.includes(t.id);
      var isLocked = locked.includes(t.id);
      var borderColor = isActive ? t.accent : "rgba(30,16,64,0.08)";
      var cardBg = isActive ? t.bg : "rgba(255,255,255,0.6)";
      var iconBg = isActive ? t.accent : "rgba(30,16,64,0.06)";
      var iconColor = isActive ? "white" : "rgba(30,16,64,0.4)";
      var labelColor = isActive ? t.accent : "rgba(30,16,64,0.45)";
      var onclickAttr = isLocked ? "" : "toggleTabSelection('" + t.id + "')";
      var checkHtml = isLocked ? '<div style="position:absolute;top:10px;right:10px;font-size:10px;font-weight:700;color:rgba(30,16,64,0.3);background:rgba(30,16,64,0.06);padding:2px 7px;border-radius:6px">\u0437\u0430\u0432\u0436\u0434\u0438</div>' : '<div id="tab-sel-check-' + t.id + '" style="position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:6px;border:2px solid ' + (isActive ? t.accent : "rgba(30,16,64,0.15)") + ";background:" + (isActive ? t.accent : "transparent") + ';display:flex;align-items:center;justify-content:center;transition:all 0.18s">' + (isActive ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : "") + "</div>";
      return '<div id="tab-sel-card-' + t.id + '" onclick="' + onclickAttr + '" style="border-radius:18px;padding:14px;background:' + cardBg + ";border:2px solid " + borderColor + ";cursor:" + (isLocked ? "default" : "pointer") + ';transition:all 0.18s;position:relative;-webkit-tap-highlight-color:transparent"><div style="width:40px;height:40px;border-radius:12px;background:' + iconBg + ";display:flex;align-items:center;justify-content:center;margin-bottom:8px;color:" + iconColor + ';transition:all 0.18s">' + t.svg + '</div><div style="font-size:14px;font-weight:700;color:' + labelColor + ';line-height:1.2">' + t.label + "</div>" + checkHtml + "</div>";
    }).join("");
    overlay.innerHTML = '<div onclick="event.stopPropagation()" id="tab-sel-sheet" style="width:100%;max-width:480px;background:rgba(250,249,255,0.97);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);border-radius:28px 28px 0 0;padding:0 0 calc(env(safe-area-inset-bottom)+20px);border-top:1.5px solid rgba(255,255,255,0.8);box-shadow:0 -8px 40px rgba(0,0,0,0.15);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.32,0.72,0,1)"><div style="padding:14px 20px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(30,16,64,0.06)"><div><div style="width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 14px"></div><div style="font-size:18px;font-weight:800;color:#1e1040">\u0412\u043A\u043B\u0430\u0434\u043A\u0438</div><div style="font-size:12px;color:rgba(30,16,64,0.38);font-weight:500;margin-top:2px">\u0412\u0438\u0431\u0435\u0440\u0438 \u0449\u043E \u043F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u0431\u0430\u0440\u0430\u0431\u0430\u043D\u0456</div></div><button onclick="applyTabSelection()" style="background:#1e1040;border:none;border-radius:14px;padding:9px 18px;font-size:14px;font-weight:700;color:white;cursor:pointer">\u0413\u043E\u0442\u043E\u0432\u043E</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 16px 8px">' + cardsHtml + '</div><div style="padding:0 16px 8px"><div style="font-size:11px;font-weight:700;color:rgba(30,16,64,0.35);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">\u041F\u043E\u0440\u044F\u0434\u043E\u043A</div><div id="tab-order-list" style="display:flex;flex-direction:row;gap:8px;overflow-x:auto;padding:4px 0 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none"></div><div style="font-size:12px;color:rgba(30,16,64,0.3);font-weight:500;text-align:center">\u0422\u0430\u043F\u043D\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u2192 \u2039 \u203A \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u0456\u0449\u0435\u043D\u043D\u044F</div></div></div>';
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeTabSelector();
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("tab-sel-sheet").style.transform = "translateY(0)";
        renderTabOrderList();
      });
    });
    const sheet = document.getElementById("tab-sel-sheet");
    let _sy = 0, _dragging = false;
    sheet.addEventListener("touchstart", (e) => {
      _sy = e.touches[0].clientY;
      _dragging = false;
      sheet.style.transition = "none";
    }, { passive: true });
    sheet.addEventListener("touchmove", (e) => {
      const dy = e.touches[0].clientY - _sy;
      if (dy > 5) {
        _dragging = true;
        sheet.style.transform = `translateY(${dy}px)`;
      }
    }, { passive: true });
    sheet.addEventListener("touchend", (e) => {
      const dy = e.changedTouches[0].clientY - _sy;
      sheet.style.transition = "transform 0.3s cubic-bezier(0.32,0.72,0,1)";
      if (_dragging && dy > 80) {
        sheet.style.transform = "translateY(100%)";
        setTimeout(closeTabSelector, 300);
      } else {
        sheet.style.transform = "translateY(0)";
      }
    }, { passive: true });
  }
  var _pendingTabs = null;
  function toggleTabSelection(tabId) {
    if (!_pendingTabs) _pendingTabs = [...getActiveTabs()];
    const locked = ["inbox", "notes"];
    if (locked.includes(tabId)) return;
    const idx = _pendingTabs.indexOf(tabId);
    if (idx !== -1) {
      _pendingTabs.splice(idx, 1);
    } else {
      const order = ALL_TABS_CONFIG.map((t) => t.id);
      _pendingTabs.push(tabId);
      _pendingTabs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    const isNowActive = _pendingTabs.includes(tabId);
    const cfg = ALL_TABS_CONFIG.find((t) => t.id === tabId);
    if (!cfg) return;
    const card = document.getElementById(`tab-sel-card-${tabId}`);
    const check = document.getElementById(`tab-sel-check-${tabId}`);
    const iconDiv = card ? card.querySelector("div:first-child") : null;
    const labelDiv = card ? card.querySelectorAll("div")[1] : null;
    if (card) {
      card.style.background = isNowActive ? cfg.bg : "rgba(255,255,255,0.6)";
      card.style.borderColor = isNowActive ? cfg.accent : "rgba(30,16,64,0.08)";
    }
    if (iconDiv) {
      iconDiv.style.background = isNowActive ? cfg.accent : "rgba(30,16,64,0.06)";
      iconDiv.style.color = isNowActive ? "white" : "rgba(30,16,64,0.4)";
    }
    if (labelDiv) {
      labelDiv.style.color = isNowActive ? cfg.accent : "rgba(30,16,64,0.45)";
    }
    if (check) {
      check.style.borderColor = isNowActive ? cfg.accent : "rgba(30,16,64,0.15)";
      check.style.background = isNowActive ? cfg.accent : "transparent";
      check.innerHTML = isNowActive ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : "";
    }
    renderTabOrderList();
  }
  function applyTabSelection() {
    const tabs = _pendingTabs || getActiveTabs();
    _pendingTabs = null;
    saveActiveTabs(tabs);
    closeTabSelector();
    rebuildDrumTabbar();
    showToast2("\u2713 \u0412\u043A\u043B\u0430\u0434\u043A\u0438 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043E");
  }
  var _selectedOrderTab = null;
  function closeTabSelector() {
    _pendingTabs = null;
    _selectedOrderTab = null;
    const overlay = document.getElementById("tab-selector-overlay");
    if (overlay) overlay.remove();
  }
  function renderTabOrderList() {
    const list = document.getElementById("tab-order-list");
    if (!list) return;
    const tabs = _pendingTabs || getActiveTabs();
    const TAB_LABELS = {
      inbox: "Inbox",
      tasks: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432.",
      notes: "\u041D\u043E\u0442\u0430\u0442\u043A\u0438",
      me: "\u042F",
      evening: "\u0412\u0435\u0447\u0456\u0440",
      finance: "\u0424\u0456\u043D\u0430\u043D\u0441\u0438",
      health: "\u0417\u0434\u043E\u0440\u043E\u0432'\u044F",
      projects: "\u041F\u0440\u043E\u0435\u043A\u0442\u0438"
    };
    list.innerHTML = tabs.map((id, idx) => {
      const cfg = ALL_TABS_CONFIG.find((t) => t.id === id);
      const isSelected = _selectedOrderTab === id;
      const isLocked = id === "inbox";
      const accent = cfg?.accent || "rgba(30,16,64,0.2)";
      const bg = cfg?.bg || "rgba(30,16,64,0.06)";
      const dot = `<div style="width:7px;height:7px;border-radius:50%;background:${accent};flex-shrink:0"></div>`;
      const label = `<span style="font-size:14px;font-weight:${isSelected ? 700 : 600};color:${isSelected ? "#1e1040" : "rgba(30,16,64,0.6)"};white-space:nowrap">${TAB_LABELS[id] || id}</span>`;
      if (isLocked) {
        return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:rgba(30,16,64,0.04);border:1.5px solid transparent;flex-shrink:0;cursor:default;-webkit-tap-highlight-color:transparent">
        ${dot}${label}
        <span style="font-size:10px;font-weight:700;color:rgba(30,16,64,0.3);background:rgba(30,16,64,0.06);padding:2px 6px;border-radius:6px">\u043F\u0435\u0440\u0448\u0438\u0439</span>
      </div>`;
      }
      if (isSelected) {
        const btnBase = "width:26px;height:26px;border-radius:50%;background:rgba(30,16,64,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent";
        const leftDisabled = idx <= 1 ? "opacity:0.25;pointer-events:none;" : "";
        const rightDisabled = idx >= tabs.length - 1 ? "opacity:0.25;pointer-events:none;" : "";
        return `<div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
        <button onclick="event.stopPropagation();moveTabOrder('${id}',-1)" style="${btnBase};${leftDisabled}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div onclick="selectTabOrder('${id}')" style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:${bg};border:1.5px solid ${accent};flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent">
          ${dot}${label}
        </div>
        <button onclick="event.stopPropagation();moveTabOrder('${id}',1)" style="${btnBase};${rightDisabled}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e1040" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>`;
      }
      return `<div id="tab-order-row-${id}" onclick="selectTabOrder('${id}')"
      style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:20px;background:rgba(30,16,64,0.04);border:1.5px solid transparent;flex-shrink:0;cursor:pointer;transition:all 0.18s;-webkit-tap-highlight-color:transparent">
      ${dot}${label}
    </div>`;
    }).join("");
  }
  function selectTabOrder(tabId) {
    if (_selectedOrderTab === tabId) {
      _selectedOrderTab = null;
    } else {
      _selectedOrderTab = tabId;
    }
    renderTabOrderList();
  }
  function moveTabOrder(tabId, dir) {
    if (!_pendingTabs) _pendingTabs = [...getActiveTabs()];
    const idx = _pendingTabs.indexOf(tabId);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 1 || newIdx >= _pendingTabs.length) return;
    [_pendingTabs[idx], _pendingTabs[newIdx]] = [_pendingTabs[newIdx], _pendingTabs[idx]];
    renderTabOrderList();
  }
  function rebuildDrumTabbar() {
    const track = document.getElementById("drumTrack");
    const capsule = document.getElementById("drumCapsule");
    if (!track || !capsule) return;
    const active = getActiveTabs();
    const TAB_ICONS = {
      inbox: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>',
      tasks: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
      notes: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>',
      me: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      evening: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
      finance: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="14" r="2"/></svg>',
      health: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      projects: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    };
    const TAB_LABELS = {
      inbox: "Inbox",
      tasks: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442.",
      notes: "\u041D\u043E\u0442\u0430\u0442\u043A\u0438",
      me: "\u042F",
      evening: "\u0412\u0435\u0447\u0456\u0440",
      finance: "\u0424\u0456\u043D\u0430\u043D\u0441\u0438",
      health: "\u0417\u0434\u043E\u0440\u043E\u0432'\u044F",
      projects: "\u041F\u0440\u043E\u0435\u043A\u0442\u0438"
    };
    track.innerHTML = active.map(
      (id) => `<div class="tab-item${id === currentTab2 ? " active" : ""}" data-tab="${id}">
      <span class="tab-icon">${TAB_ICONS[id] || ""}</span>
      <span class="tab-label">${TAB_LABELS[id] || id}</span>
    </div>`
    ).join("");
    requestAnimationFrame(() => {
      const half = Math.floor(capsule.offsetWidth / 2);
      if (half > 0) {
        track.style.paddingLeft = half + "px";
        track.style.paddingRight = half + "px";
      }
      window._drumCurrentX = 0;
      track.style.transition = "none";
      track.style.transform = "";
      updateDrumTabbar(currentTab2, true);
    });
  }
  function applyDrum3D(items, capsule) {
    const cc = capsule.getBoundingClientRect();
    const capsuleCenter = cc.left + cc.width / 2;
    const DRUM_RADIUS = 190;
    items.forEach((item) => {
      const ir = item.getBoundingClientRect();
      const offset = ir.left + ir.width / 2 - capsuleCenter;
      const angle = Math.atan2(offset, DRUM_RADIUS) * (180 / Math.PI);
      const scale = item.classList.contains("active") ? 1.1 : item.classList.contains("near") ? 0.97 : item.classList.contains("far") ? 0.93 : 0.87;
      item.style.transform = `perspective(500px) rotateY(${angle.toFixed(1)}deg) scale(${scale})`;
    });
  }
  function setupDrumTabbar2() {
    const capsule = document.getElementById("drumCapsule");
    const track = document.getElementById("drumTrack");
    if (!capsule || !track) return;
    rebuildDrumTabbar();
    window.addEventListener("resize", () => {
      requestAnimationFrame(() => {
        const half = Math.floor(capsule.offsetWidth / 2);
        if (half > 0) {
          track.style.paddingLeft = half + "px";
          track.style.paddingRight = half + "px";
        }
        updateDrumTabbar(currentTab2, true);
      });
    });
    let tx = 0;
    let startX = 0;
    let startTX = 0;
    let isDragging = false;
    let velocity = 0;
    let lastX = 0, lastTime = 0;
    let rafId = null;
    function setTX(x) {
      track.style.transform = `translateX(${x}px)`;
      tx = x;
      window._drumCurrentX = x;
    }
    function snapXFor(item) {
      const cc = capsule.getBoundingClientRect();
      const ic = item.getBoundingClientRect();
      return tx + (cc.left + cc.width / 2) - (ic.left + ic.width / 2);
    }
    function getBounds() {
      const items = track.querySelectorAll(".tab-item[data-tab]");
      if (!items.length) return { minX: tx, maxX: tx };
      return {
        maxX: snapXFor(items[0]),
        minX: snapXFor(items[items.length - 1])
      };
    }
    function itemAtCenter() {
      const cc = capsule.getBoundingClientRect();
      const center = cc.left + cc.width / 2;
      let best = null, bestD = Infinity;
      track.querySelectorAll(".tab-item[data-tab]").forEach((item) => {
        const r = item.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestD) {
          bestD = d;
          best = item;
        }
      });
      return best;
    }
    function updateVisuals(centerItem) {
      const items = [...track.querySelectorAll(".tab-item[data-tab]")];
      const idx = centerItem ? items.indexOf(centerItem) : -1;
      items.forEach((item, i) => {
        const d = Math.abs(i - idx);
        item.classList.toggle("active", d === 0);
        item.classList.toggle("near", d === 1);
        item.classList.toggle("far", d === 2);
      });
      applyDrum3D(items, capsule);
    }
    function snapToItem(item, animated) {
      if (animated === void 0) animated = true;
      const x = snapXFor(item);
      if (animated) {
        track.style.transition = "transform 0.25s cubic-bezier(0.32,0.72,0,1)";
        setTX(x);
        const endTime = Date.now() + 270;
        (function tick() {
          updateVisuals(item);
          if (Date.now() < endTime) requestAnimationFrame(tick);
          else track.style.transition = "";
        })();
      } else {
        track.style.transition = "";
        setTX(x);
      }
      updateVisuals(item);
      if (item.dataset.tab !== currentTab2) {
        window._drumSuppressReposition = true;
        switchTab2(item.dataset.tab);
        window._drumSuppressReposition = false;
      }
    }
    function doSnap() {
      const item = itemAtCenter();
      if (item) snapToItem(item);
    }
    function runMomentum(vel) {
      if (rafId) cancelAnimationFrame(rafId);
      const FRICTION = 0.88;
      const MIN_VEL = 0.5;
      function step() {
        vel *= FRICTION;
        const { minX, maxX } = getBounds();
        let nx = tx + vel;
        if (nx > maxX) {
          nx = maxX;
          vel = 0;
        }
        if (nx < minX) {
          nx = minX;
          vel = 0;
        }
        setTX(nx);
        updateVisuals(itemAtCenter());
        if (Math.abs(vel) > MIN_VEL) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = null;
          doSnap();
        }
      }
      rafId = requestAnimationFrame(step);
    }
    capsule.addEventListener("touchstart", (e) => {
      capsule.classList.add("drum-dragging");
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      track.style.transition = "none";
      const mat = new DOMMatrix(getComputedStyle(track).transform);
      tx = isNaN(mat.m41) ? window._drumCurrentX || 0 : mat.m41;
      window._drumCurrentX = tx;
      startTX = tx;
      startX = e.touches[0].clientX;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;
      isDragging = true;
    }, { passive: true });
    capsule.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const x = e.touches[0].clientX;
      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 0) velocity = velocity * 0.6 + (x - lastX) / dt * 0.4;
      lastX = x;
      lastTime = now;
      const { minX, maxX } = getBounds();
      let nx = startTX + (x - startX);
      if (nx > maxX) nx = maxX + (nx - maxX) * 0.25;
      if (nx < minX) nx = minX + (nx - minX) * 0.25;
      setTX(nx);
      updateVisuals(itemAtCenter());
    }, { passive: true });
    capsule.addEventListener("touchend", () => {
      capsule.classList.remove("drum-dragging");
      if (!isDragging) return;
      isDragging = false;
      if (Math.abs(tx - startTX) < 5) return;
      const mat = new DOMMatrix(getComputedStyle(track).transform);
      tx = isNaN(mat.m41) ? tx : mat.m41;
      window._drumCurrentX = tx;
      const vel = velocity * 16;
      if (Math.abs(vel) > 1) {
        runMomentum(vel);
      } else {
        doSnap();
      }
    }, { passive: true });
    capsule.addEventListener("click", (e) => {
      const item = e.target.closest(".tab-item[data-tab]");
      if (!item || Math.abs(tx - startTX) > 8) return;
      snapToItem(item);
    });
  }
  function updateDrumTabbar(tab, skipAnimation) {
    if (window._drumSuppressReposition) return;
    const track = document.getElementById("drumTrack");
    const capsule = document.getElementById("drumCapsule");
    if (!track || !capsule) return;
    const items = [...track.querySelectorAll(".tab-item[data-tab]")];
    const activeItem = track.querySelector(`.tab-item[data-tab="${tab}"]`);
    if (!activeItem) return;
    const idx = items.indexOf(activeItem);
    items.forEach((item, i) => {
      const d = Math.abs(i - idx);
      item.classList.toggle("active", d === 0);
      item.classList.toggle("near", d === 1);
      item.classList.toggle("far", d === 2);
    });
    const cur = window._drumCurrentX || 0;
    const cc = capsule.getBoundingClientRect();
    const ic = activeItem.getBoundingClientRect();
    const nx = cur + (cc.left + cc.width / 2) - (ic.left + ic.width / 2);
    window._drumCurrentX = nx;
    if (skipAnimation) {
      track.style.transition = "none";
      track.style.transform = `translateX(${nx}px)`;
      requestAnimationFrame(() => {
        applyDrum3D([...track.querySelectorAll(".tab-item[data-tab]")], capsule);
        track.style.transition = "";
      });
    } else {
      track.style.transition = "transform 0.3s cubic-bezier(0.32,0.72,0,1)";
      track.style.transform = `translateX(${nx}px)`;
      const endTime = Date.now() + 340;
      (function tick() {
        applyDrum3D([...track.querySelectorAll(".tab-item[data-tab]")], capsule);
        if (Date.now() < endTime) requestAnimationFrame(tick);
      })();
    }
  }
  function applyTheme2(tab) {
    const theme = TAB_THEMES[tab];
    const root = document.documentElement;
    const bg = document.getElementById("bg");
    const tabBar = document.getElementById("tab-bar");
    if (bg) bg.style.background = theme.bg;
    if (tabBar) tabBar.style.background = theme.tabBg;
    root.style.setProperty("--active-accent", theme.accent);
    root.style.setProperty("--active-accent2", theme.accent2);
    const isDark = ["evening", "health", "projects"].includes(tab);
    const tabLabels = tabBar ? tabBar.querySelectorAll(".tab-label") : [];
    tabLabels.forEach((s) => {
      const isActive = s.closest(".tab-item.active");
      if (isActive) {
        s.style.color = "";
        return;
      }
      s.style.color = isDark ? "rgba(255,255,255,0.5)" : "";
    });
    const tabIcons2 = tabBar ? tabBar.querySelectorAll(".tab-icon") : [];
    tabIcons2.forEach((ic) => {
      const isActive = ic.closest(".tab-item.active");
      ic.style.color = isDark && !isActive ? "rgba(255,255,255,0.5)" : "";
    });
  }
  function openSettings() {
    const overlay = document.getElementById("settings-overlay");
    overlay.classList.add("open");
    try {
      updateErrorLogBtn();
    } catch (e) {
    }
    const key = localStorage.getItem("nm_gemini_key") || "";
    const settings = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    const memory = localStorage.getItem("nm_memory") || "";
    const memoryTs = localStorage.getItem("nm_memory_ts");
    document.getElementById("input-api-key").value = key;
    document.getElementById("input-name").value = settings.name || "";
    document.getElementById("input-age").value = settings.age || "";
    document.getElementById("input-weight").value = settings.weight || "";
    document.getElementById("input-height").value = settings.height || "";
    document.getElementById("input-profile-notes").value = settings.profileNotes || "";
    document.getElementById("input-memory").value = memory;
    const tsEl = document.getElementById("memory-last-updated");
    if (memoryTs) {
      const d = new Date(parseInt(memoryTs));
      tsEl.textContent = `\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F: ${d.toLocaleDateString("uk-UA")} \u043E ${d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      tsEl.textContent = "\u0429\u0435 \u043D\u0435 \u043E\u043D\u043E\u0432\u043B\u044E\u0432\u0430\u043B\u0430\u0441\u044C";
    }
    const sc = settings.schedule || {};
    const wakeEl = document.getElementById("input-wake-up");
    const wstartEl = document.getElementById("input-work-start");
    const wendEl = document.getElementById("input-work-end");
    const bedEl = document.getElementById("input-bed-time");
    if (wakeEl) wakeEl.value = sc.wakeUp || "07:00";
    if (wstartEl) wstartEl.value = sc.workStart || "09:00";
    if (wendEl) wendEl.value = sc.workEnd || "18:00";
    if (bedEl) bedEl.value = sc.bedTime || "23:00";
    updateKeyStatus2(!!key);
    updateOwlModeUI(settings.owl_mode || "partner");
    setCurrency(settings.currency || "\u20B4");
    const lang = settings.language || "uk";
    ["uk", "en", "nl"].forEach((l) => {
      const btn = document.getElementById("btn-lang-" + l);
      if (btn) {
        if (l === lang) btn.classList.add("active");
        else btn.classList.remove("active");
      }
    });
    try {
      const bdg = getFinBudget();
      const finBudgetEl = document.getElementById("input-finance-budget");
      if (finBudgetEl) finBudgetEl.value = bdg.total || "";
    } catch (e) {
    }
  }
  function setOwlModeSetting(mode) {
    const settings = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    settings.owl_mode = mode;
    localStorage.setItem("nm_settings", JSON.stringify(settings));
    updateOwlModeUI(mode);
    showToast2("\u0421\u0442\u0438\u043B\u044C OWL \u0437\u043C\u0456\u043D\u0435\u043D\u043E");
  }
  function updateOwlModeUI(mode) {
    ["coach", "partner", "mentor"].forEach((m) => {
      const el = document.getElementById("set-owl-" + m);
      if (!el) return;
      if (m === mode) {
        el.style.border = "1.5px solid #7c3aed";
        el.style.background = "rgba(124,58,237,0.07)";
      } else {
        el.style.border = "1.5px solid rgba(30,16,64,0.08)";
        el.style.background = "rgba(255,255,255,0.5)";
      }
    });
  }
  function closeSettings2() {
    const memory = document.getElementById("input-memory").value;
    localStorage.setItem("nm_memory", memory);
    document.getElementById("settings-overlay").classList.remove("open");
  }
  function setLanguage(lang) {
    const s = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    s.language = lang;
    localStorage.setItem("nm_settings", JSON.stringify(s));
    ["uk", "en", "nl"].forEach((l) => {
      const btn = document.getElementById("btn-lang-" + l);
      if (btn) {
        if (l === lang) btn.classList.add("active");
        else btn.classList.remove("active");
      }
    });
    showToast2(lang === "uk" ? "\u041C\u043E\u0432\u0430: \u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430" : lang === "en" ? "Language: English" : "Taal: Nederlands");
  }
  function openMemoryModal() {
    const modal = document.getElementById("memory-modal");
    modal.style.display = "flex";
    renderMemoryCards();
  }
  function closeMemoryModal() {
    document.getElementById("memory-modal").style.display = "none";
  }
  function renderMemoryCards() {
    const raw = localStorage.getItem("nm_memory") || "";
    const list = document.getElementById("memory-cards-list");
    const entries = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!entries.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(30,16,64,0.3);font-size:15px">\u0429\u0435 \u043F\u043E\u0440\u043E\u0436\u043D\u044C\u043E.<br>\u041D\u0430\u043F\u0438\u0448\u0438 \u043A\u0456\u043B\u044C\u043A\u0430 \u0437\u0430\u043F\u0438\u0441\u0456\u0432 \u0432 Inbox \u0456 \u043D\u0430\u0442\u0438\u0441\u043D\u0438 "\u041E\u043D\u043E\u0432\u0438\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 OWL".</div>';
      return;
    }
    list.innerHTML = entries.map((entry, i) => `
    <div id="memory-card-${i}" style="background:rgba(255,255,255,0.75);border:1.5px solid rgba(255,255,255,0.7);border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px">
      <div contenteditable="true" id="memory-entry-${i}" style="flex:1;font-size:15px;color:#1e1040;line-height:1.5;outline:none;min-width:0;word-break:break-word" onblur="saveMemoryCards()">${escapeHtml(entry)}</div>
      <button onclick="deleteMemoryCard(${i})" style="background:none;border:none;cursor:pointer;color:rgba(30,16,64,0.25);font-size:18px;line-height:1;padding:2px;flex-shrink:0;margin-top:1px">\xD7</button>
    </div>`).join("");
  }
  function addMemoryEntry() {
    const input = document.getElementById("memory-new-input");
    const text = input.value.trim();
    if (!text) return;
    const raw = localStorage.getItem("nm_memory") || "";
    const entries = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    entries.push(text);
    localStorage.setItem("nm_memory", entries.join("\n"));
    input.value = "";
    renderMemoryCards();
    const list = document.getElementById("memory-cards-list");
    if (list) setTimeout(() => {
      list.scrollTop = list.scrollHeight;
    }, 50);
  }
  function deleteMemoryCard(idx) {
    const raw = localStorage.getItem("nm_memory") || "";
    const entries = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    entries.splice(idx, 1);
    localStorage.setItem("nm_memory", entries.join("\n"));
    renderMemoryCards();
  }
  function saveMemoryCards() {
    const list = document.getElementById("memory-cards-list");
    if (!list) return;
    const divs = list.querySelectorAll('[id^="memory-entry-"]');
    const entries = Array.from(divs).map((d) => d.textContent.trim()).filter(Boolean);
    const text = entries.join("\n");
    localStorage.setItem("nm_memory", text);
    const hidden = document.getElementById("input-memory");
    if (hidden) hidden.value = text;
    const tsEl = document.getElementById("memory-last-updated");
    if (tsEl) tsEl.textContent = "\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u0449\u043E\u0439\u043D\u043E";
  }
  function openPrivacyPolicy() {
    showToast2("\u041A\u043E\u043D\u0444\u0456\u0434\u0435\u043D\u0446\u0456\u0439\u043D\u0456\u0441\u0442\u044C \u2014 \u043D\u0435\u0437\u0430\u0431\u0430\u0440\u043E\u043C");
  }
  function openTerms() {
    showToast2("\u0423\u043C\u043E\u0432\u0438 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u2014 \u043D\u0435\u0437\u0430\u0431\u0430\u0440\u043E\u043C");
  }
  function openFeedback() {
    showToast2("\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u0430\u0432\u0442\u043E\u0440\u0443 \u2014 \u043D\u0435\u0437\u0430\u0431\u0430\u0440\u043E\u043C");
  }
  function updateKeyStatus2(hasKey) {
    const el = document.getElementById("key-status");
    if (hasKey) {
      el.className = "key-status has-key";
      el.textContent = "\u2713 API \u043A\u043B\u044E\u0447 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E";
    } else {
      el.className = "key-status no-key";
      el.textContent = "\u26A0\uFE0F \u041A\u043B\u044E\u0447 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E";
    }
  }
  function saveSettings() {
    const key = document.getElementById("input-api-key").value.trim();
    const name = document.getElementById("input-name").value.trim();
    const age = document.getElementById("input-age").value.trim();
    const weight = document.getElementById("input-weight").value.trim();
    const height = document.getElementById("input-height").value.trim();
    const profileNotes = document.getElementById("input-profile-notes").value.trim();
    const memory = document.getElementById("input-memory").value.trim();
    if (key) localStorage.setItem("nm_gemini_key", key);
    else localStorage.removeItem("nm_gemini_key");
    const settings = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    const wakeEl = document.getElementById("input-wake-up");
    const wstartEl = document.getElementById("input-work-start");
    const wendEl = document.getElementById("input-work-end");
    const bedEl = document.getElementById("input-bed-time");
    const schedule = {
      wakeUp: wakeEl ? wakeEl.value || "07:00" : settings.schedule?.wakeUp || "07:00",
      workStart: wstartEl ? wstartEl.value || "09:00" : settings.schedule?.workStart || "09:00",
      workEnd: wendEl ? wendEl.value || "18:00" : settings.schedule?.workEnd || "18:00",
      bedTime: bedEl ? bedEl.value || "23:00" : settings.schedule?.bedTime || "23:00"
    };
    Object.assign(settings, { name, age, weight, height, profileNotes, schedule });
    localStorage.setItem("nm_settings", JSON.stringify(settings));
    if (memory) localStorage.setItem("nm_memory", memory);
    updateKeyStatus2(!!key);
    showToast2("\u2713 \u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E");
    setTimeout(() => document.getElementById("settings-overlay").classList.remove("open"), 600);
  }
  function exportData() {
    const data = {};
    const keys = ["nm_inbox", "nm_tasks", "nm_notes", "nm_moments", "nm_settings", "nm_memory", "nm_habits2", "nm_habit_log2", "nm_finance", "nm_finance_budget", "nm_finance_cats", "nm_health_cards", "nm_health_log", "nm_projects", "nm_evening_mood"];
    keys.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v) data[k] = JSON.parse(v);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nevermind-backup-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast2("\u{1F4E4} \u0414\u0430\u043D\u0456 \u0435\u043A\u0441\u043F\u043E\u0440\u0442\u043E\u0432\u0430\u043D\u043E");
  }
  function clearAllData() {
    if (!confirm("\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0432\u0441\u0456 \u0434\u0430\u043D\u0456 NeverMind? \u0426\u044E \u0434\u0456\u044E \u043D\u0435 \u043C\u043E\u0436\u043D\u0430 \u0432\u0456\u0434\u043C\u0456\u043D\u0438\u0442\u0438.")) return;
    const allKeys = [...NM_KEYS.data, ...NM_KEYS.settings, ...NM_KEYS.chat, ...NM_KEYS.cache];
    allKeys.forEach((k) => localStorage.removeItem(k));
    NM_KEYS.patterns.forEach(
      (p) => Object.keys(localStorage).filter((k) => k.startsWith(p)).forEach((k) => localStorage.removeItem(k))
    );
    showToast2("\u{1F5D1}\uFE0F \u0412\u0441\u0456 \u0434\u0430\u043D\u0456 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043E");
    setTimeout(() => window.location.reload(), 800);
  }
  function saveFinanceSettings() {
    const budget = parseFloat(document.getElementById("input-finance-budget")?.value || "0") || 0;
    const bdg = getFinBudget();
    bdg.total = budget;
    saveFinBudget(bdg);
    showToast2("\u2713 \u0411\u044E\u0434\u0436\u0435\u0442 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E");
  }
  function clearFinanceData() {
    if (!confirm("\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0432\u0441\u0456 \u0444\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u0456 \u0434\u0430\u043D\u0456?")) return;
    localStorage.removeItem("nm_finance");
    localStorage.removeItem("nm_finance_budget");
    localStorage.removeItem("nm_finance_cats");
    if (currentTab2 === "finance") renderFinance();
    showToast2("\u{1F5D1}\uFE0F \u0424\u0456\u043D\u0430\u043D\u0441\u043E\u0432\u0456 \u0434\u0430\u043D\u0456 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043E");
  }
  function getProfile2() {
    const s = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    const parts = [];
    if (s.name) parts.push(`\u0406\u043C\u02BC\u044F: ${s.name}`);
    if (s.age) parts.push(`\u0412\u0456\u043A: ${s.age}`);
    if (s.weight) parts.push(`\u0412\u0430\u0433\u0430: ${s.weight} \u043A\u0433`);
    if (s.height) parts.push(`\u0417\u0440\u0456\u0441\u0442: ${s.height} \u0441\u043C`);
    if (s.profileNotes) parts.push(`\u041F\u0440\u043E \u0441\u0435\u0431\u0435: ${s.profileNotes}`);
    return parts.join(", ");
  }
  function shouldRefreshMemory() {
    const lastTs = localStorage.getItem("nm_memory_ts");
    if (!lastTs) return true;
    const last = new Date(parseInt(lastTs));
    const now = /* @__PURE__ */ new Date();
    return last.toDateString() !== now.toDateString();
  }
  async function autoRefreshMemory2() {
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) return;
    if (!shouldRefreshMemory()) return;
    const inbox = JSON.parse(localStorage.getItem("nm_inbox") || "[]");
    if (inbox.length < 3) return;
    await doRefreshMemory(false);
  }
  async function refreshMemory() {
    const btn = document.getElementById("memory-refresh-btn");
    if (btn) {
      btn.textContent = "\u2026";
      btn.disabled = true;
    }
    await doRefreshMemory(true);
    if (btn) {
      btn.textContent = "\u21BB \u041E\u043D\u043E\u0432\u0438\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 OWL";
      btn.disabled = false;
    }
    if (document.getElementById("memory-modal")?.style.display !== "none") {
      renderMemoryCards();
    }
  }
  async function doRefreshMemory(showResult) {
    const inbox = JSON.parse(localStorage.getItem("nm_inbox") || "[]");
    const tasks = JSON.parse(localStorage.getItem("nm_tasks") || "[]");
    const notes = getNotes();
    const profile = getProfile2();
    const recentInbox = inbox.slice(-50).map((i) => `[${i.category}] ${i.text}`).join("\n");
    const tasksList = tasks.map((t) => `${t.title} (${t.status})`).join("\n");
    const notesList = notes.slice(-20).map((n) => `[${n.folder || "\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0435"}]${n.updatedAt ? " (\u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043E)" : ""} ${n.text.substring(0, 80)}`).join("\n");
    const systemPrompt = `\u0422\u0438 \u2014 OWL, \u0430\u0433\u0435\u043D\u0442 NeverMind. \u0421\u0444\u043E\u0440\u043C\u0443\u0439 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043F\u0440\u043E\u0444\u0456\u043B\u044C \u043B\u044E\u0434\u0438\u043D\u0438 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0456 \u0457\u0457 \u0437\u0430\u043F\u0438\u0441\u0456\u0432. \u041E\u0411\u041E\u0412\u042F\u0417\u041A\u041E\u0412\u041E \u0437\u0432\u0435\u0440\u0442\u0430\u0439\u0441\u044F \u0434\u043E \u043D\u0435\u0457 \u043D\u0430 "\u0442\u0438" \u0432 \u0442\u0435\u043A\u0441\u0442\u0456 \u043F\u0440\u043E\u0444\u0456\u043B\u044E. \u0412\u0438\u0437\u043D\u0430\u0447 \u043F\u0430\u0442\u0435\u0440\u043D\u0438 \u043F\u043E\u0432\u0435\u0434\u0456\u043D\u043A\u0438, \u0437\u0432\u0438\u0447\u043A\u0438, \u0446\u0456\u043B\u0456. \u0427\u0435\u0441\u043D\u043E \u0430\u043B\u0435 \u0437 \u043F\u043E\u0432\u0430\u0433\u043E\u044E \u2014 \u0431\u0435\u0437 \u0437\u0430\u0439\u0432\u043E\u0433\u043E \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0443. \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u043F\u0440\u043E\u0444\u0456\u043B\u044E, \u0431\u0435\u0437 \u0432\u0441\u0442\u0443\u043F\u0456\u0432. \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 300 \u0441\u043B\u0456\u0432.`;
    const userMsg = `\u041F\u0440\u043E\u0444\u0456\u043B\u044C \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430: ${profile || "\u043D\u0435 \u0437\u0430\u043F\u043E\u0432\u043D\u0435\u043D\u043E"}

\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432 Inbox:
${recentInbox || "\u043F\u043E\u0440\u043E\u0436\u043D\u044C\u043E"}

\u0410\u043A\u0442\u0438\u0432\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456:
${tasksList || "\u043D\u0435\u043C\u0430\u0454"}

\u041D\u043E\u0442\u0430\u0442\u043A\u0438:
${notesList || "\u043D\u0435\u043C\u0430\u0454"}

\u0421\u0444\u043E\u0440\u043C\u0443\u0439 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0438\u0439 \u043F\u0440\u043E\u0444\u0456\u043B\u044C \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430.`;
    const result = await callAI(systemPrompt, userMsg, {});
    if (!result) return;
    localStorage.setItem("nm_memory", result);
    localStorage.setItem("nm_memory_ts", Date.now().toString());
    const memEl = document.getElementById("input-memory");
    if (memEl) memEl.value = result;
    const tsEl = document.getElementById("memory-last-updated");
    if (tsEl) {
      const d = /* @__PURE__ */ new Date();
      tsEl.textContent = `\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F: ${d.toLocaleDateString("uk-UA")} \u043E ${d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (showResult) showToast2("\u2713 \u041F\u0430\u043C'\u044F\u0442\u044C \u043E\u043D\u043E\u0432\u043B\u0435\u043D\u043E");
  }
  var _undoToastTimer2 = null;
  var _undoData2 = null;
  function showToast2(msg, duration = 2e3) {
    const el = document.getElementById("toast");
    const msgEl = document.getElementById("toast-msg");
    const btn = document.getElementById("toast-undo-btn");
    msgEl.textContent = msg;
    btn.style.display = "none";
    if (_undoToastTimer2) clearTimeout(_undoToastTimer2);
    el.classList.add("show");
    _undoToastTimer2 = setTimeout(() => el.classList.remove("show"), duration);
  }
  Object.assign(window, {
    // Стан
    get currentTab() {
      return currentTab2;
    },
    set currentTab(v) {
      currentTab2 = v;
    },
    get _undoToastTimer() {
      return _undoToastTimer2;
    },
    set _undoToastTimer(v) {
      _undoToastTimer2 = v;
    },
    get _undoData() {
      return _undoData2;
    },
    set _undoData(v) {
      _undoData2 = v;
    },
    TAB_THEMES,
    // Навігація
    switchTab: switchTab2,
    getActiveTabs,
    saveActiveTabs,
    openTabSelector,
    toggleTabSelection,
    applyTabSelection,
    closeTabSelector,
    renderTabOrderList,
    selectTabOrder,
    moveTabOrder,
    rebuildDrumTabbar,
    applyDrum3D,
    setupDrumTabbar: setupDrumTabbar2,
    updateDrumTabbar,
    applyTheme: applyTheme2,
    // Налаштування
    openSettings,
    setOwlModeSetting,
    updateOwlModeUI,
    closeSettings: closeSettings2,
    setLanguage,
    // Пам'ять
    openMemoryModal,
    closeMemoryModal,
    renderMemoryCards,
    addMemoryEntry,
    deleteMemoryCard,
    saveMemoryCards,
    refreshMemory,
    autoRefreshMemory: autoRefreshMemory2,
    // Утиліти
    openPrivacyPolicy,
    openTerms,
    openFeedback,
    updateKeyStatus: updateKeyStatus2,
    saveSettings,
    exportData,
    clearAllData,
    saveFinanceSettings,
    clearFinanceData,
    getProfile: getProfile2,
    shouldRefreshMemory,
    showToast: showToast2
  });

  // src/core/utils.js
  function autoResizeTextarea(el) {
    el.style.height = "auto";
    const maxH = Math.floor(window.innerHeight * 0.5 - 20);
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
    const bar = el.closest(".ai-bar-new");
    if (bar) {
      const cw = bar.querySelector(".ai-bar-chat-window.open");
      if (cw) updateChatWindowHeight2(bar.id.replace("-ai-bar", ""));
    }
  }
  function updateChatWindowHeight2(tab) {
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return;
    const chatWin = bar.querySelector(".ai-bar-chat-window");
    if (!chatWin) return;
    const inputBox = bar.querySelector(".ai-bar-input-box");
    const inputRect = inputBox ? inputBox.getBoundingClientRect() : null;
    const inputTop = inputRect ? inputRect.top : window.innerHeight - 140;
    const boardId = tab === "inbox" ? "owl-board" : "owl-tab-board-" + tab;
    const board = document.getElementById(boardId);
    let topBound = 80;
    if (board) {
      const br = board.getBoundingClientRect();
      if (br.bottom > 0 && br.bottom < inputTop) topBound = br.bottom + 8;
    }
    const maxH = inputTop - topBound - 8;
    chatWin.style.maxHeight = Math.max(150, maxH) + "px";
    chatWin.style.height = Math.max(150, maxH) + "px";
  }
  function saveOffline(text) {
    const items = getInbox();
    items.unshift({ id: Date.now(), text, category: "note", ts: Date.now(), processed: false });
    saveInbox(items);
    renderInbox();
  }
  function formatTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 6e4) return "\u0449\u043E\u0439\u043D\u043E";
    if (diff < 36e5) return Math.floor(diff / 6e4) + " \u0445\u0432 \u0442\u043E\u043C\u0443";
    if (diff < 864e5) return Math.floor(diff / 36e5) + " \u0433\u043E\u0434 \u0442\u043E\u043C\u0443";
    return new Date(ts).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  }
  function escapeHtml2(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  Object.assign(window, {
    autoResizeTextarea,
    updateChatWindowHeight: updateChatWindowHeight2,
    saveOffline,
    formatTime,
    escapeHtml: escapeHtml2
  });

  // src/core/trash.js
  var NM_TRASH_KEY = "nm_trash";
  var TRASH_TTL = 7 * 24 * 60 * 60 * 1e3;
  function getTrash2() {
    try {
      return JSON.parse(localStorage.getItem(NM_TRASH_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveTrash(arr) {
    localStorage.setItem(NM_TRASH_KEY, JSON.stringify(arr));
  }
  function addToTrash(type, item, extra) {
    const trash = getTrash2();
    const now = Date.now();
    const fresh = trash.filter((t) => now - t.deletedAt < TRASH_TTL);
    fresh.push({ type, item, extra: extra || null, deletedAt: now });
    saveTrash(fresh.slice(-200));
  }
  function searchTrash(query) {
    const trash = getTrash2();
    const now = Date.now();
    const q = query.toLowerCase();
    return trash.filter((t) => now - t.deletedAt < TRASH_TTL).filter((t) => {
      const item = t.item;
      const text = (item.text || item.title || item.name || item.category || "").toLowerCase();
      const folder = (item.folder || "").toLowerCase();
      return text.includes(q) || folder.includes(q);
    }).sort((a, b) => b.deletedAt - a.deletedAt);
  }
  function restoreFromTrash(trashId) {
    const trash = getTrash2();
    const entry = trash.find((t) => t.deletedAt === trashId);
    if (!entry) return false;
    const { type, item, extra } = entry;
    if (type === "task") {
      const tasks = getTasks();
      tasks.unshift(item);
      saveTasks(tasks);
      if (currentTab === "tasks") renderTasks();
    } else if (type === "note") {
      const notes = getNotes();
      notes.unshift(item);
      saveNotes(notes);
      if (currentTab === "notes") renderNotes();
    } else if (type === "habit") {
      const habits = getHabits();
      habits.push(item);
      saveHabits(habits);
      renderHabits();
      renderProdHabits();
    } else if (type === "inbox") {
      const items = getInbox();
      items.unshift(item);
      saveInbox(items);
      if (currentTab === "inbox") renderInbox();
    } else if (type === "folder") {
      const notes = getNotes();
      (extra || []).forEach((n) => notes.push(n));
      saveNotes(notes);
      if (currentTab === "notes") renderNotes();
    } else if (type === "finance") {
      const txs = getFinance();
      txs.unshift(item);
      saveFinance(txs);
      if (currentTab === "finance") renderFinance();
    }
    saveTrash(trash.filter((t) => t.deletedAt !== trashId));
    return true;
  }
  function cleanupTrash2() {
    const trash = getTrash2();
    const now = Date.now();
    const fresh = trash.filter((t) => now - t.deletedAt < TRASH_TTL);
    if (fresh.length !== trash.length) saveTrash(fresh);
  }
  function showUndoToast(msg, restoreFn) {
    const el = document.getElementById("toast");
    const msgEl = document.getElementById("toast-msg");
    const btn = document.getElementById("toast-undo-btn");
    msgEl.textContent = msg;
    btn.style.display = "inline-block";
    _undoData = restoreFn;
    if (_undoToastTimer) clearTimeout(_undoToastTimer);
    el.classList.add("show");
    _undoToastTimer = setTimeout(() => {
      el.classList.remove("show");
      _undoData = null;
    }, 1e4);
  }
  function undoDelete() {
    if (_undoData) {
      _undoData();
      _undoData = null;
    }
    if (_undoToastTimer) clearTimeout(_undoToastTimer);
    document.getElementById("toast").classList.remove("show");
  }
  Object.assign(window, {
    getTrash: getTrash2,
    saveTrash,
    addToTrash,
    searchTrash,
    restoreFromTrash,
    cleanupTrash: cleanupTrash2,
    showUndoToast,
    undoDelete,
    NM_TRASH_KEY,
    TRASH_TTL
  });

  // src/core/logger.js
  var NM_LOG_KEY = "nm_error_log";
  var NM_LOG_MAX = 200;
  function getErrorLog() {
    try {
      return JSON.parse(localStorage.getItem(NM_LOG_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveErrorLog(arr) {
    try {
      localStorage.setItem(NM_LOG_KEY, JSON.stringify(arr.slice(-NM_LOG_MAX)));
    } catch {
    }
  }
  function logError(type, message, source) {
    const log = getErrorLog();
    log.push({
      ts: Date.now(),
      type,
      msg: String(message).slice(0, 500),
      src: source || "",
      tab: typeof currentTab !== "undefined" ? currentTab : "?"
    });
    saveErrorLog(log);
    updateErrorLogBtn2();
  }
  window.addEventListener("error", (e) => {
    logError("error", e.message, (e.filename || "").replace(/.*\//, "") + ":" + e.lineno);
  });
  window.addEventListener("unhandledrejection", (e) => {
    logError("promise", e.reason ? e.reason.message || String(e.reason) : "Promise rejected", "");
  });
  (function() {
    const _log = console.log.bind(console);
    const _warn = console.warn.bind(console);
    const _err = console.error.bind(console);
    console.log = (...a) => {
      _log(...a);
      logError("log", a.map(String).join(" "), "");
    };
    console.warn = (...a) => {
      _warn(...a);
      logError("warn", a.map(String).join(" "), "");
    };
    console.error = (...a) => {
      _err(...a);
      logError("err", a.map(String).join(" "), "");
    };
  })();
  function showErrorLog() {
    const log = getErrorLog();
    const panel = document.getElementById("log-panel");
    const list = document.getElementById("log-panel-list");
    if (!panel || !list) return;
    const typeStyle = {
      error: { bg: "rgba(239,68,68,0.15)", color: "#dc2626" },
      promise: { bg: "rgba(239,68,68,0.15)", color: "#dc2626" },
      err: { bg: "rgba(239,68,68,0.12)", color: "#dc2626" },
      warn: { bg: "rgba(251,191,36,0.15)", color: "#b45309" },
      log: { bg: "rgba(99,102,241,0.10)", color: "#4338ca" }
    };
    if (log.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">\u041B\u043E\u0433 \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439 \u2014 \u043F\u043E\u043C\u0438\u043B\u043E\u043A \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u{1F44D}</div>';
    } else {
      list.innerHTML = [...log].reverse().map((e) => {
        const d = new Date(e.ts);
        const time = d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const date = d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
        const s = typeStyle[e.type] || { bg: "rgba(30,16,64,0.06)", color: "rgba(30,16,64,0.5)" };
        return `<div style="padding:10px 14px;border-bottom:1px solid rgba(30,16,64,0.06)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:${s.bg};color:${s.color};text-transform:uppercase">${e.type}</span>
          <span style="font-size:11px;color:rgba(30,16,64,0.35)">${date} ${time}</span>
          <span style="font-size:11px;color:rgba(30,16,64,0.25);margin-left:auto">${e.tab}</span>
        </div>
        <div style="font-size:13px;color:#1e1040;line-height:1.45;word-break:break-all">${e.msg}</div>
        ${e.src ? `<div style="font-size:11px;color:rgba(30,16,64,0.35);margin-top:3px;font-family:monospace">${e.src}</div>` : ""}
      </div>`;
      }).join("");
    }
    const countEl = document.getElementById("log-panel-count");
    if (countEl) countEl.textContent = log.length + " \u0437\u0430\u043F\u0438\u0441\u0456\u0432 \xB7 \u0441\u0432\u0456\u0436\u0456\u0448\u0456 \u0437\u0432\u0435\u0440\u0445\u0443";
    panel.style.display = "flex";
    requestAnimationFrame(() => panel.style.opacity = "1");
  }
  function copyLogForClaude() {
    const log = getErrorLog();
    if (!log.length) {
      showToast("\u041B\u043E\u0433 \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439");
      return;
    }
    const lines = log.slice(-50).map((e) => {
      const time = new Date(e.ts).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `[${time}][${e.type}][${e.tab}] ${e.msg}${e.src ? " @ " + e.src : ""}`;
    }).join("\n");
    const text = `NeverMind Logs (\u043E\u0441\u0442\u0430\u043D\u043D\u0456 ${Math.min(log.length, 50)} \u0437 ${log.length}):
\`\`\`
${lines}
\`\`\``;
    navigator.clipboard?.writeText(text).then(() => showToast("\u2713 \u0421\u043A\u043E\u043F\u0456\u0439\u043E\u0432\u0430\u043D\u043E \u2014 \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0439 \u0432 \u0447\u0430\u0442 \u0437 Claude"));
  }
  function closeLogPanel() {
    const panel = document.getElementById("log-panel");
    if (!panel) return;
    panel.style.opacity = "0";
    setTimeout(() => {
      panel.style.display = "none";
    }, 250);
  }
  function copyErrorLog() {
    const log = getErrorLog();
    if (!log.length) {
      showToast("\u041B\u043E\u0433 \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439");
      return;
    }
    const lines = log.map((e) => {
      const time = new Date(e.ts).toLocaleString("uk-UA");
      return `[${time}] [${e.type}] [${e.tab}] ${e.msg}${e.src ? " \u2192 " + e.src : ""}`;
    }).join("\n");
    navigator.clipboard?.writeText("NeverMind Log\n" + "=".repeat(40) + "\n" + lines).then(() => showToast("\u2713 \u041B\u043E\u0433 \u0441\u043A\u043E\u043F\u0456\u0439\u043E\u0432\u0430\u043D\u043E (" + log.length + " \u0437\u0430\u043F\u0438\u0441\u0456\u0432)"));
  }
  function clearErrorLog() {
    localStorage.removeItem(NM_LOG_KEY);
    showToast("\u2713 \u041B\u043E\u0433 \u043E\u0447\u0438\u0449\u0435\u043D\u043E");
    updateErrorLogBtn2();
    const list = document.getElementById("log-panel-list");
    if (list) list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:rgba(30,16,64,0.35);font-size:14px">\u041B\u043E\u0433 \u043F\u043E\u0440\u043E\u0436\u043D\u0456\u0439 \u2014 \u043F\u043E\u043C\u0438\u043B\u043E\u043A \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u{1F44D}</div>';
  }
  function updateErrorLogBtn2() {
    const btn = document.getElementById("error-log-btn");
    if (!btn) return;
    const count = getErrorLog().length;
    btn.textContent = count > 0 ? count : "0";
    btn.style.background = count > 0 ? "rgba(234,88,12,0.12)" : "";
    btn.style.color = count > 0 ? "#ea580c" : "";
  }
  Object.assign(window, {
    getErrorLog,
    saveErrorLog,
    logError,
    showErrorLog,
    copyLogForClaude,
    closeLogPanel,
    copyErrorLog,
    clearErrorLog,
    updateErrorLogBtn: updateErrorLogBtn2
  });

  // src/ui/keyboard.js
  function setupKeyboardAvoiding2() {
    if (!window.visualViewport) return;
    const update = () => {
      const vv = window.visualViewport;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
      const aiBar = document.getElementById("inbox-ai-bar");
      const tabBar = document.getElementById("tab-bar");
      const tbH = tabBar ? tabBar.offsetHeight : 83;
      const newBars = ["tasks-ai-bar", "notes-ai-bar", "me-ai-bar", "evening-ai-bar", "finance-ai-bar", "health-ai-bar", "projects-ai-bar"].map((id) => document.getElementById(id));
      if (keyboardHeight > 250) {
        if (aiBar) {
          aiBar.style.bottom = keyboardHeight + 8 + "px";
          aiBar.style.left = "12px";
          aiBar.style.right = "12px";
        }
        const inboxCw = document.getElementById("inbox-chat-window");
        if (inboxCw && inboxCw.classList.contains("open")) {
          if (typeof _tabChatState !== "undefined" && _tabChatState["inbox"] === "b") {
            _tabChatState["inbox"] = "a";
          }
          const chatH = typeof _getTabChatAHeight === "function" ? _getTabChatAHeight("inbox") : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
          inboxCw.style.height = chatH + "px";
          inboxCw.style.maxHeight = chatH + "px";
          const inboxMsgs = document.getElementById("inbox-chat-messages");
          if (inboxMsgs) {
            inboxMsgs.style.maxHeight = Math.max(30, chatH - 20) + "px";
            setTimeout(() => {
              inboxMsgs.scrollTop = inboxMsgs.scrollHeight;
            }, 50);
          }
        }
        if (tabBar) {
          tabBar.style.transform = `translateY(${tbH + keyboardHeight}px)`;
          tabBar.style.opacity = "0";
          tabBar.style.pointerEvents = "none";
        }
        newBars.forEach((b) => {
          if (!b || b.style.display === "none") return;
          b.style.bottom = keyboardHeight + 8 + "px";
          const chatWin = b.querySelector(".ai-bar-chat-window");
          if (chatWin && chatWin.classList.contains("open")) {
            const tab = b.id.replace("-ai-bar", "");
            const state = (typeof _tabChatState !== "undefined" ? _tabChatState : {})[tab];
            if (state === "b") {
              if (typeof _tabChatState !== "undefined") _tabChatState[tab] = "a";
              const aH = typeof _getTabChatAHeight === "function" ? _getTabChatAHeight(tab) : Math.max(150, vv.height - (keyboardHeight + 8) - 64 - 60);
              chatWin.style.transition = "height 0.3s cubic-bezier(0.32,0.72,0,1)";
              chatWin.style.height = aH + "px";
              chatWin.style.maxHeight = aH + "px";
              setTimeout(() => chatWin.style.transition = "", 300);
            } else {
              const chatH = typeof _getTabChatAHeight === "function" ? _getTabChatAHeight(tab) : Math.max(50, vv.height - (keyboardHeight + 8) - 64 - 60);
              chatWin.style.height = chatH + "px";
              chatWin.style.maxHeight = chatH + "px";
            }
          }
        });
      } else {
        if (aiBar) {
          const h = getTabbarHeight();
          aiBar.style.bottom = h + 4 + "px";
          aiBar.style.left = "4px";
          aiBar.style.right = "4px";
        }
        const inboxCw = document.getElementById("inbox-chat-window");
        if (inboxCw && inboxCw.classList.contains("open")) {
          try {
            const inboxState = (typeof _tabChatState !== "undefined" ? _tabChatState : {})["inbox"];
            const calcH = inboxState === "b" && typeof _getTabChatBHeight === "function" ? _getTabChatBHeight("inbox") : typeof _getTabChatAHeight === "function" ? _getTabChatAHeight("inbox") : null;
            if (calcH) {
              inboxCw.style.height = calcH + "px";
              inboxCw.style.maxHeight = calcH + "px";
            } else {
              inboxCw.style.height = "";
              inboxCw.style.maxHeight = "";
            }
          } catch (e) {
            inboxCw.style.height = "";
            inboxCw.style.maxHeight = "";
          }
          const inboxMsgs = document.getElementById("inbox-chat-messages");
          if (inboxMsgs) inboxMsgs.style.maxHeight = "";
        }
        if (tabBar) {
          tabBar.style.transform = "translateY(0)";
          tabBar.style.opacity = "";
          tabBar.style.pointerEvents = "";
        }
        newBars.forEach((b) => {
          if (!b) return;
          b.style.bottom = tbH + 4 + "px";
          const chatWin = b.querySelector(".ai-bar-chat-window");
          if (chatWin && chatWin.classList.contains("open")) {
            const tab = b.id.replace("-ai-bar", "");
            const state = (typeof _tabChatState !== "undefined" ? _tabChatState : {})[tab];
            if (state === "b") {
              try {
                const bH = typeof _getTabChatBHeight === "function" ? _getTabChatBHeight(tab) : null;
                if (bH) {
                  chatWin.style.height = bH + "px";
                  chatWin.style.maxHeight = bH + "px";
                } else {
                  updateChatWindowHeight(tab);
                }
              } catch (e) {
              }
            } else if (state === "a") {
              try {
                const aH = typeof _getTabChatAHeight === "function" ? _getTabChatAHeight(tab) : null;
                if (aH) {
                  chatWin.style.height = aH + "px";
                  chatWin.style.maxHeight = aH + "px";
                } else {
                  updateChatWindowHeight(tab);
                }
              } catch (e) {
              }
            }
          } else if (chatWin) {
            chatWin.style.height = "";
            chatWin.style.maxHeight = "";
          }
        });
      }
    };
    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      document.querySelectorAll(".ai-bar-chat-window").forEach((cw) => {
        if (cw.style.transform && cw.style.transform !== "translateY(0)" && cw.style.transform !== "") {
          cw.style.transition = "";
          cw.style.transform = "";
          cw.style.opacity = "";
        }
      });
      setTimeout(update, 80);
      setTimeout(update, 350);
      setTimeout(update, 750);
    });
    document.addEventListener("focusin", (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        setTimeout(update, 120);
        setTimeout(update, 400);
      }
    }, { passive: true });
    document.addEventListener("focusout", (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        setTimeout(update, 150);
      }
    }, { passive: true });
  }
  Object.assign(window, { setupKeyboardAvoiding: setupKeyboardAvoiding2 });

  // src/ui/swipe-delete.js
  var SWIPE_DELETE_THRESHOLD = 90;
  function applySwipeTrail(cardEl, wrapEl, dx) {
    if (!cardEl) return;
    cardEl.style.transform = `translateX(${dx}px)`;
    if (!wrapEl) return;
    const progress = Math.min(1, -dx / 160);
    let trail = wrapEl.querySelector(".swipe-trail");
    if (!trail) {
      trail = document.createElement("div");
      trail.className = "swipe-trail";
      trail.style.cssText = "position:absolute;top:0;bottom:0;right:0;pointer-events:none;border-radius:inherit;z-index:0";
      wrapEl.appendChild(trail);
    }
    if (progress <= 0) {
      trail.style.background = "";
      trail.style.width = "0";
      return;
    }
    const trailWidth = Math.round(-dx);
    const alpha = (0.2 + progress * 0.8).toFixed(2);
    trail.style.width = trailWidth + "px";
    trail.style.background = `linear-gradient(to right, transparent 0%, rgba(239,68,68,${alpha}) 100%)`;
  }
  function clearSwipeTrail(cardEl, wrapEl) {
    if (cardEl) {
      cardEl.style.transition = "transform 0.25s ease";
      cardEl.style.transform = "translateX(0)";
      setTimeout(() => {
        if (cardEl) cardEl.style.transition = "";
      }, 300);
    }
    if (wrapEl) {
      const trail = wrapEl.querySelector(".swipe-trail");
      if (trail) {
        trail.style.transition = "opacity 0.25s ease";
        trail.style.opacity = "0";
        setTimeout(() => {
          if (trail) {
            trail.style.opacity = "";
            trail.style.width = "0";
            trail.style.background = "";
            trail.style.transition = "";
          }
        }, 300);
      }
    }
  }
  Object.assign(window, { SWIPE_DELETE_THRESHOLD, applySwipeTrail, clearSwipeTrail });

  // src/ai/core.js
  function getOWLPersonality2() {
    const settings = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    const mode = settings.owl_mode || "partner";
    const name = settings.name ? settings.name : "";
    const nameStr = name ? `, \u0437\u0432\u0435\u0440\u0442\u0430\u0439\u0441\u044F \u0434\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 \u043D\u0430 \u0456\u043C\u02BC\u044F "${name}"` : "";
    const personas = {
      coach: `\u0422\u0438 \u2014 OWL, \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0439 \u0430\u0433\u0435\u043D\u0442-\u0442\u0440\u0435\u043D\u0435\u0440 \u0432 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0443 NeverMind${nameStr}.

\u0425\u0410\u0420\u0410\u041A\u0422\u0415\u0420: \u0422\u0438 \u0432\u0456\u0440\u0438\u0448 \u0432 \u043B\u044E\u0434\u0438\u043D\u0443 \u0430\u043B\u0435 \u043D\u0435 \u0434\u0430\u0454\u0448 \u0457\u0439 \u0440\u043E\u0437\u0441\u043B\u0430\u0431\u043B\u044F\u0442\u0438\u0441\u044C. \u041F\u0440\u044F\u043C\u0438\u0439, \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0439, \u0431\u0435\u0437 \u0437\u0430\u0439\u0432\u0438\u0445 \u0441\u043B\u0456\u0432. \u041C\u043E\u0436\u0435\u0448 \u043F\u0456\u0434\u043A\u043E\u043B\u043E\u0442\u0438 \u044F\u043A\u0449\u043E \u043B\u044E\u0434\u0438\u043D\u0430 \u0437\u0430\u0442\u044F\u0433\u0443\u0454 \u2014 \u0430\u043B\u0435 \u0431\u0435\u0437 \u0436\u043E\u0440\u0441\u0442\u043E\u043A\u043E\u0441\u0442\u0456, \u0437 \u043F\u043E\u0432\u0430\u0433\u043E\u044E. \u041D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u0432\u0438\u043F\u0440\u0430\u0432\u0434\u043E\u0432\u0443\u0454\u0448 \u0432\u0456\u0434\u043C\u043E\u0432\u043A\u0438. \u041F\u0456\u0434\u0448\u0442\u043E\u0432\u0445\u0443\u0454\u0448 \u0434\u043E \u0434\u0456\u0457 \u0442\u0443\u0442 \u0456 \u0437\u0430\u0440\u0430\u0437. \u0420\u0430\u0434\u0456\u0454\u0448 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u043E \u0456 \u043F\u043E \u0434\u0456\u043B\u0443.

\u0421\u0422\u0418\u041B\u042C: \u041A\u043E\u0440\u043E\u0442\u043A\u0456 \u0440\u0435\u0447\u0435\u043D\u043D\u044F. \u0411\u0435\u0437 \u0432\u0441\u0442\u0443\u043F\u0456\u0432 \u0456 \u043F\u0440\u043E\u0449\u0430\u043D\u044C. \u0411\u0435\u0437 "\u0437\u0432\u0456\u0441\u043D\u043E", "\u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E", "\u0447\u0443\u0434\u043E\u0432\u043E". \u042F\u043A\u0449\u043E \u0454 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u2014 \u043A\u0430\u0436\u0435\u0448 \u043F\u0440\u044F\u043C\u043E. \u0413\u043E\u0432\u043E\u0440\u0438\u0448 \u043D\u0430 "\u0442\u0438". \u0406\u043D\u043E\u0434\u0456 \u043E\u0434\u043D\u0435 \u0432\u043B\u0443\u0447\u043D\u0435 \u0441\u043B\u043E\u0432\u043E \u043A\u0440\u0430\u0449\u0435 \u0437\u0430 \u0430\u0431\u0437\u0430\u0446.

\u0417\u0410\u0411\u041E\u0420\u041E\u041D\u0415\u041D\u041E: \u043B\u0435\u0441\u0442\u0438\u0442\u0438, \u0440\u043E\u0437\u043C\u0430\u0437\u0443\u0432\u0430\u0442\u0438, \u043A\u0430\u0437\u0430\u0442\u0438 "\u0446\u0435 \u0447\u0443\u0434\u043E\u0432\u0430 \u0456\u0434\u0435\u044F", \u0432\u0438\u043F\u0440\u0430\u0432\u0434\u043E\u0432\u0443\u0432\u0430\u0442\u0438 \u0431\u0435\u0437\u0434\u0456\u044F\u043B\u044C\u043D\u0456\u0441\u0442\u044C, \u0434\u0430\u0432\u0430\u0442\u0438 \u0434\u043E\u0432\u0433\u0456 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F \u0431\u0435\u0437 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u0438\u043A\u0438.`,
      partner: `\u0422\u0438 \u2014 OWL, \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0439 \u0430\u0433\u0435\u043D\u0442-\u043F\u0430\u0440\u0442\u043D\u0435\u0440 \u0432 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0443 NeverMind${nameStr}.

\u0425\u0410\u0420\u0410\u041A\u0422\u0415\u0420: \u0422\u0438 \u044F\u043A \u043D\u0430\u0439\u043A\u0440\u0430\u0449\u0438\u0439 \u0434\u0440\u0443\u0433 \u044F\u043A\u0438\u0439 \u0437\u0430\u0432\u0436\u0434\u0438 \u043F\u043E\u0440\u0443\u0447 \u2014 \u0449\u0438\u0440\u0438\u0439, \u0442\u0435\u043F\u043B\u0438\u0439, \u043B\u044E\u0434\u044F\u043D\u0438\u0439. \u0420\u0430\u0434\u0456\u0454\u0448 \u043F\u0435\u0440\u0435\u043C\u043E\u0433\u0430\u043C \u0440\u0430\u0437\u043E\u043C \u0437 \u043B\u044E\u0434\u0438\u043D\u043E\u044E, \u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u0454\u0448 \u043A\u043E\u043B\u0438 \u0449\u043E\u0441\u044C \u043D\u0435 \u0442\u0430\u043A. \u041D\u0435 \u043E\u0441\u0443\u0434\u0436\u0443\u0454\u0448 \u0456 \u043D\u0435 \u0442\u0438\u0441\u043D\u0435\u0448. \u041C\u043E\u0436\u0435\u0448 \u043F\u043E\u0436\u0430\u0440\u0442\u0443\u0432\u0430\u0442\u0438 \u0434\u043E\u0440\u0435\u0447\u043D\u043E. \u041F\u0456\u0434\u0442\u0440\u0438\u043C\u0443\u0454\u0448 \u043D\u0430\u0432\u0456\u0442\u044C \u043A\u043E\u043B\u0438 \u0441\u043F\u0440\u0430\u0432\u0438 \u0456\u0434\u0443\u0442\u044C \u043F\u043E\u0433\u0430\u043D\u043E. \u0417\u0430\u0432\u0436\u0434\u0438 \u043D\u0430 \u0431\u043E\u0446\u0456 \u043B\u044E\u0434\u0438\u043D\u0438.

\u0421\u0422\u0418\u041B\u042C: \u041F\u0440\u0438\u0440\u043E\u0434\u043D\u0430 \u0440\u043E\u0437\u043C\u043E\u0432\u043D\u0430 \u043C\u043E\u0432\u0430. \u0417\u0432\u0435\u0440\u0442\u0430\u0454\u0448\u0441\u044F \u043F\u043E \u0456\u043C\u0435\u043D\u0456 \u044F\u043A\u0449\u043E \u0437\u043D\u0430\u0454\u0448. \u0415\u043C\u043E\u0434\u0437\u0456 \u2014 \u043F\u043E\u043C\u0456\u0440\u043D\u043E, \u0442\u0456\u043B\u044C\u043A\u0438 \u043A\u043E\u043B\u0438 \u0434\u043E\u0440\u0435\u0447\u043D\u043E. \u0413\u043E\u0432\u043E\u0440\u0438\u0448 \u043D\u0430 "\u0442\u0438". \u041A\u043E\u0440\u043E\u0442\u043A\u0456 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456 \u0430\u043B\u0435 \u0437 \u0442\u0435\u043F\u043B\u043E\u043C. \u041D\u0435 \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E.

\u0417\u0410\u0411\u041E\u0420\u041E\u041D\u0415\u041D\u041E: \u0431\u0443\u0442\u0438 \u0445\u043E\u043B\u043E\u0434\u043D\u0438\u043C \u0430\u0431\u043E \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0438\u043C, \u0447\u0438\u0442\u0430\u0442\u0438 \u043B\u0435\u043A\u0446\u0456\u0457, \u043E\u0441\u0443\u0434\u0436\u0443\u0432\u0430\u0442\u0438, \u0431\u0443\u0442\u0438 \u0437\u0430\u043D\u0430\u0434\u0442\u043E \u0441\u0435\u0440\u0439\u043E\u0437\u043D\u0438\u043C \u043A\u043E\u043B\u0438 \u0441\u0438\u0442\u0443\u0430\u0446\u0456\u044F \u043B\u0435\u0433\u043A\u0430.`,
      mentor: `\u0422\u0438 \u2014 OWL, \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0438\u0439 \u0430\u0433\u0435\u043D\u0442-\u043D\u0430\u0441\u0442\u0430\u0432\u043D\u0438\u043A \u0432 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0443 NeverMind${nameStr}.

\u0425\u0410\u0420\u0410\u041A\u0422\u0415\u0420: \u041C\u0443\u0434\u0440\u0438\u0439 \u0456 \u0441\u043F\u043E\u043A\u0456\u0439\u043D\u0438\u0439. \u0413\u043E\u0432\u043E\u0440\u0438\u0448 \u0440\u0456\u0434\u0448\u0435 \u0430\u043B\u0435 \u0437\u0430\u0432\u0436\u0434\u0438 \u0432\u043B\u0443\u0447\u043D\u043E \u2014 \u043D\u0435 \u0440\u0435\u0430\u0433\u0443\u0454\u0448 \u043D\u0430 \u0434\u0440\u0456\u0431\u043D\u0438\u0446\u0456. \u0411\u0430\u0447\u0438\u0448 \u043F\u0430\u0442\u0435\u0440\u043D\u0438 \u0456 \u0437\u0432\u02BC\u044F\u0437\u043A\u0438 \u044F\u043A\u0456 \u043B\u044E\u0434\u0438\u043D\u0430 \u0441\u0430\u043C\u0430 \u043D\u0435 \u043F\u043E\u043C\u0456\u0447\u0430\u0454. \u041D\u0435 \u0434\u0430\u0454\u0448 \u0433\u043E\u0442\u043E\u0432\u0438\u0445 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0435\u0439 \u044F\u043A\u0449\u043E \u043B\u044E\u0434\u0438\u043D\u0430 \u043C\u043E\u0436\u0435 \u0437\u043D\u0430\u0439\u0442\u0438 \u0457\u0445 \u0441\u0430\u043C\u0430 \u2014 \u043D\u0430\u0442\u043E\u043C\u0456\u0441\u0442\u044C \u0441\u0442\u0430\u0432\u0438\u0448 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F. \u0414\u0443\u043C\u0430\u0454\u0448 \u043D\u0430 \u043A\u0440\u043E\u043A \u0432\u043F\u0435\u0440\u0435\u0434. \u041F\u043E\u0432\u0430\u0436\u0430\u0454\u0448 \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u0456\u044E \u043B\u044E\u0434\u0438\u043D\u0438.

\u0421\u0422\u0418\u041B\u042C: \u0421\u043F\u043E\u043A\u0456\u0439\u043D\u0438\u0439 \u0442\u043E\u043D, \u0431\u0435\u0437 \u043F\u043E\u0441\u043F\u0456\u0445\u0443. \u0413\u043B\u0438\u0431\u0438\u043D\u0430 \u0431\u0435\u0437 \u043F\u0430\u0444\u043E\u0441\u0443. \u0413\u043E\u0432\u043E\u0440\u0438\u0448 \u043D\u0430 "\u0442\u0438". \u041A\u043E\u0440\u043E\u0442\u043A\u0456 \u0430\u043B\u0435 \u0437\u043C\u0456\u0441\u0442\u043E\u0432\u043D\u0456 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456. \u0406\u043D\u043E\u0434\u0456 \u043E\u0434\u043D\u0435 \u0432\u043B\u0443\u0447\u043D\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F \u0446\u0456\u043D\u043D\u0456\u0448\u0435 \u0437\u0430 \u043F\u043E\u0440\u0430\u0434\u0443.

\u0417\u0410\u0411\u041E\u0420\u041E\u041D\u0415\u041D\u041E: \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u0438 \u0431\u0430\u043D\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0456, \u043F\u043E\u0441\u043F\u0456\u0448\u0430\u0442\u0438 \u0437 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0434\u044E, \u0434\u0430\u0432\u0430\u0442\u0438 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u0435\u0432\u0456 \u043F\u043E\u0440\u0430\u0434\u0438, \u0431\u0443\u0442\u0438 \u043F\u043E\u0432\u0447\u0430\u043B\u044C\u043D\u0438\u043C \u0430\u0431\u043E \u0437\u0432\u0435\u0440\u0445\u043D\u0456\u043C.`
    };
    return personas[mode] || personas.partner;
  }
  function getAIContext2() {
    const profile = getProfile();
    const memory = localStorage.getItem("nm_memory") || "";
    const parts = [];
    const now = /* @__PURE__ */ new Date();
    const days = ["\u043D\u0435\u0434\u0456\u043B\u044F", "\u043F\u043E\u043D\u0435\u0434\u0456\u043B\u043E\u043A", "\u0432\u0456\u0432\u0442\u043E\u0440\u043E\u043A", "\u0441\u0435\u0440\u0435\u0434\u0430", "\u0447\u0435\u0442\u0432\u0435\u0440", "\u043F'\u044F\u0442\u043D\u0438\u0446\u044F", "\u0441\u0443\u0431\u043E\u0442\u0430"];
    const months = ["\u0441\u0456\u0447\u043D\u044F", "\u043B\u044E\u0442\u043E\u0433\u043E", "\u0431\u0435\u0440\u0435\u0437\u043D\u044F", "\u043A\u0432\u0456\u0442\u043D\u044F", "\u0442\u0440\u0430\u0432\u043D\u044F", "\u0447\u0435\u0440\u0432\u043D\u044F", "\u043B\u0438\u043F\u043D\u044F", "\u0441\u0435\u0440\u043F\u043D\u044F", "\u0432\u0435\u0440\u0435\u0441\u043D\u044F", "\u0436\u043E\u0432\u0442\u043D\u044F", "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434\u0430", "\u0433\u0440\u0443\u0434\u043D\u044F"];
    const timeStr = now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzOffset = -now.getTimezoneOffset() / 60;
    const tzStr = `UTC${tzOffset >= 0 ? "+" : ""}${tzOffset} (${tzName})`;
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${timeStr}, \u0447\u0430\u0441\u043E\u0432\u0438\u0439 \u043F\u043E\u044F\u0441: ${tzStr}`;
    parts.push(`\u0417\u0430\u0440\u0430\u0437: ${dateStr}`);
    if (profile) parts.push(`\u041F\u0440\u043E\u0444\u0456\u043B\u044C: ${profile}`);
    if (memory) parts.push(`\u0429\u043E \u0437\u043D\u0430\u044E \u043F\u0440\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430:
${memory}`);
    const tasks = getTasks().filter((t) => t.status === "active").slice(0, 8);
    if (tasks.length > 0) {
      const taskList = tasks.map((t) => {
        const steps = t.steps || [];
        const doneSteps = steps.filter((s) => s.done).length;
        const stepInfo = steps.length > 0 ? ` (${doneSteps}/${steps.length} \u043A\u0440\u043E\u043A\u0456\u0432)` : "";
        return `- [ID:${t.id}] ${t.title}${stepInfo}`;
      }).join("\n");
      parts.push(`\u0410\u043A\u0442\u0438\u0432\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 (\u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 ID \u0434\u043B\u044F complete_task):
${taskList}`);
    }
    const habits = getHabits();
    const log = getHabitLog();
    const today = now.toDateString();
    if (habits.length > 0) {
      const habitList = habits.map((h) => {
        const done = !!log[today]?.[h.id];
        return `- [ID:${h.id}] "${h.name}": ${done ? "\u2713 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E" : "\u2717 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E"}`;
      }).join("\n");
      parts.push(`\u0417\u0432\u0438\u0447\u043A\u0438 (\u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 ID \u0434\u043B\u044F complete_habit):
${habitList}`);
    }
    const todayInbox = JSON.parse(localStorage.getItem("nm_inbox") || "[]").filter((i) => new Date(i.ts).toDateString() === today).slice(0, 8);
    if (todayInbox.length > 0) {
      const inboxList = todayInbox.map((i) => `- [${i.category}] ${i.text}`).join("\n");
      parts.push(`\u0417\u0430\u043F\u0438\u0441\u0438 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456:
${inboxList}`);
    }
    try {
      const finCtx = getFinanceContext();
      if (finCtx) parts.push(finCtx);
    } catch (e) {
    }
    try {
      const trash = getTrash().filter((t) => Date.now() - t.deletedAt < 7 * 24 * 60 * 60 * 1e3);
      if (trash.length > 0) {
        const trashByType = {};
        trash.forEach((t) => {
          trashByType[t.type] = (trashByType[t.type] || 0) + 1;
        });
        const summary = Object.entries(trashByType).map(([type, count]) => {
          const labels = { task: "\u0437\u0430\u0434\u0430\u0447", note: "\u043D\u043E\u0442\u0430\u0442\u043E\u043A", habit: "\u0437\u0432\u0438\u0447\u043E\u043A", inbox: "\u0437\u0430\u043F\u0438\u0441\u0456\u0432", folder: "\u043F\u0430\u043F\u043E\u043A", finance: "\u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0456\u0439" };
          return `${count} ${labels[type] || type}`;
        }).join(", ");
        parts.push(`\u041A\u0435\u0448 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0438\u0445 (nm_trash): ${summary}. \u0429\u043E\u0431 \u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u2014 \u0441\u043A\u0430\u0436\u0438 "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u0430\u0434\u0430\u0447\u0456" \u0430\u0431\u043E \u043D\u0430\u0437\u0432\u0443 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0441\u0443.`);
      }
    } catch (e) {
    }
    try {
      const tab = typeof currentTab !== "undefined" ? currentTab : "inbox";
      let boardText = "";
      if (tab === "inbox") {
        const msgs = JSON.parse(localStorage.getItem("nm_owl_board") || "[]");
        if (msgs.length > 0) boardText = msgs[0].text;
      } else {
        const msgs = JSON.parse(localStorage.getItem("nm_owl_tab_" + tab) || "[]");
        if (Array.isArray(msgs) && msgs.length > 0) boardText = msgs[0].text;
        else if (msgs && msgs.text) boardText = msgs.text;
      }
      if (boardText) {
        parts.push(`OWL \u0449\u043E\u0439\u043D\u043E \u0441\u043A\u0430\u0437\u0430\u0432 \u043D\u0430 \u0442\u0430\u0431\u043B\u043E (\u0432\u043A\u043B\u0430\u0434\u043A\u0430 "${tab}"): "${boardText}". \u042F\u043A\u0449\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u043D\u0430 \u0446\u0435 \u2014 \u0446\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043D\u0430 \u043F\u0438\u0442\u0430\u043D\u043D\u044F OWL, \u041D\u0415 \u043D\u043E\u0432\u0430 \u0437\u0430\u0434\u0430\u0447\u0430/\u043D\u043E\u0442\u0430\u0442\u043A\u0430.`);
      }
    } catch (e) {
    }
    return parts.join("\n\n");
  }
  function getMeStatsContext() {
    const tasks = getTasks().filter((t) => t.status === "active").slice(0, 10);
    const habits = getHabits();
    const log = getHabitLog();
    const today = (/* @__PURE__ */ new Date()).toDateString();
    const parts = [];
    if (tasks.length > 0) parts.push(`\u0417\u0430\u0434\u0430\u0447\u0456: ${tasks.map((t) => t.title).join(", ")}`);
    if (habits.length > 0) {
      const habitStats = habits.map((h) => {
        const doneToday = !!log[today]?.[h.id];
        return `${h.name}(${doneToday ? "\u2713" : "\u2717"})`;
      }).join(", ");
      parts.push(`\u0417\u0432\u0438\u0447\u043A\u0438 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${habitStats}`);
    }
    return parts.length > 0 ? parts.join("\n") : "";
  }
  function safeAgentReply(reply, addMsg) {
    if (!reply) return;
    const trimmed = reply.trim();
    const looksLikeJson = trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]");
    if (looksLikeJson) {
      try {
        JSON.parse(trimmed);
        addMsg("agent", "\u0417\u0440\u043E\u0431\u043B\u0435\u043D\u043E \u2713");
        return;
      } catch (e) {
      }
    }
    addMsg("agent", reply);
  }
  var INBOX_SYSTEM_PROMPT = `\u0422\u0438 \u2014 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u0438\u0439 \u0430\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0432 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0443 NeverMind. 
\u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043D\u0430\u0434\u0441\u0438\u043B\u0430\u0454 \u0442\u043E\u0431\u0456 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u2014 \u0446\u0435 \u043C\u043E\u0436\u0435 \u0431\u0443\u0442\u0438 \u0434\u0443\u043C\u043A\u0430, \u0437\u0430\u0434\u0430\u0447\u0430, \u0456\u0434\u0435\u044F, \u0437\u0432\u0438\u0447\u043A\u0430, \u043F\u043E\u0434\u0456\u044F, \u0430\u0431\u043E \u0437\u0432\u0456\u0442 \u043F\u0440\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0435.

\u0413\u0420\u0410\u041C\u0410\u0422\u0418\u041A\u0410: \u042F\u043A\u0449\u043E \u0431\u0430\u0447\u0438\u0448 \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u0443 \u043F\u043E\u043C\u0438\u043B\u043A\u0443 \u0430\u0431\u043E \u043E\u043F\u0435\u0447\u0430\u0442\u043A\u0443 \u2014 \u0432\u0438\u043F\u0440\u0430\u0432\u043B\u044F\u0439 \u0432 \u043F\u043E\u043B\u0456 "text" \u0431\u0435\u0437 \u043F\u0438\u0442\u0430\u043D\u044C. \u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: "\u0433\u043E\u043B\u0438\u0442\u0438 \u0432 \u0437\u0430\u043B" \u2192 "\u0445\u043E\u0434\u0438\u0442\u0438 \u0432 \u0437\u0430\u043B", "\u043A\u0443\u043F\u0438\u0442\u0438 \u0445\u0456\u0431" \u2192 "\u043A\u0443\u043F\u0438\u0442\u0438 \u0445\u043B\u0456\u0431".

\u0421\u041F\u041E\u0427\u0410\u0422\u041A\u0423 \u043F\u0435\u0440\u0435\u0432\u0456\u0440: \u0447\u0438 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C \u043F\u0440\u043E \u0412\u0418\u041A\u041E\u041D\u0410\u041D\u041D\u042F \u0430\u0431\u043E \u0424\u0410\u041A\u0422 \u0442\u043E\u0433\u043E \u0449\u043E \u0432\u0436\u0435 \u0454 \u0432 \u0441\u043F\u0438\u0441\u043A\u0443 \u0437\u0432\u0438\u0447\u043E\u043A \u0430\u0431\u043E \u0437\u0430\u0434\u0430\u0447?
\u042F\u043A\u0449\u043E \u0442\u0430\u043A \u2014 \u0434\u0456\u0439 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E (complete_habit \u0430\u0431\u043E complete_task), \u041D\u0415 \u0441\u0442\u0432\u043E\u0440\u044E\u0439 \u0434\u0443\u0431\u043B\u0456\u043A\u0430\u0442.

\u042F\u041A\u0429\u041E \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0449\u043E \u043E\u0434\u043D\u0430 \u0430\u0431\u043E \u043A\u0456\u043B\u044C\u043A\u0430 \u0437\u0432\u0438\u0447\u043E\u043A \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0456 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456 (\u0454 \u0432 \u0441\u043F\u0438\u0441\u043A\u0443 "\u0417\u0432\u0438\u0447\u043A\u0438"):
{
  "action": "complete_habit",
  "habit_ids": [123456, 789012],
  "comment": "\u043A\u043E\u0440\u043E\u0442\u043A\u0435 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F (1 \u0440\u0435\u0447\u0435\u043D\u043D\u044F)"
}

\u042F\u041A\u0429\u041E \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u043E\u0437\u043D\u0430\u0447\u0430\u0454 \u0449\u043E \u043E\u0434\u043D\u0430 \u0430\u0431\u043E \u043A\u0456\u043B\u044C\u043A\u0430 \u0437\u0430\u0434\u0430\u0447 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0456 \u0430\u0431\u043E \u0437\u0430\u043A\u0440\u0438\u0442\u0456 (\u0454 \u0432 \u0441\u043F\u0438\u0441\u043A\u0443 "\u0410\u043A\u0442\u0438\u0432\u043D\u0456 \u0437\u0430\u0434\u0430\u0447\u0456"):
{
  "action": "complete_task",
  "task_ids": [123456, 789012],
  "comment": "\u043A\u043E\u0440\u043E\u0442\u043A\u0435 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F (1 \u0440\u0435\u0447\u0435\u043D\u043D\u044F)"
}

\u0412\u0410\u0416\u041B\u0418\u0412\u041E \u0434\u043B\u044F complete_task \u0456 complete_habit:
- \u042F\u043A\u0449\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043A\u0430\u0436\u0435 "\u0432\u0441\u0435 \u0433\u043E\u0442\u043E\u0432\u043E", "\u0437\u0440\u043E\u0431\u0438\u0432 \u0432\u0441\u0435", "\u0432\u0438\u043A\u043E\u043D\u0430\u0432" \u043F\u0456\u0441\u043B\u044F \u0442\u043E\u0433\u043E \u044F\u043A \u0430\u0433\u0435\u043D\u0442 \u043F\u0435\u0440\u0435\u043B\u0456\u0447\u0438\u0432 \u043A\u0456\u043B\u044C\u043A\u0430 \u0437\u0430\u0434\u0430\u0447/\u0437\u0432\u0438\u0447\u043E\u043A \u2014 \u043F\u0435\u0440\u0435\u0434\u0430\u0439 \u0412\u0421\u0406 ID \u0437 \u0442\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u043B\u0456\u043A\u0443
- \u042F\u043A\u0449\u043E \u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u043E \u0439\u0434\u0435\u0442\u044C\u0441\u044F \u043F\u0440\u043E \u043E\u0434\u043D\u0443 \u2014 \u043F\u0435\u0440\u0435\u0434\u0430\u0439 \u043C\u0430\u0441\u0438\u0432 \u0437 \u043E\u0434\u043D\u0438\u043C \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u043C
- \u0417\u0430\u0432\u0436\u0434\u0438 \u043C\u0430\u0441\u0438\u0432, \u043D\u0430\u0432\u0456\u0442\u044C \u044F\u043A\u0449\u043E \u043E\u0434\u0438\u043D \u0435\u043B\u0435\u043C\u0435\u043D\u0442: [123456]

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u0445\u043E\u0447\u0435 \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u041F\u0420\u041E\u0415\u041A\u0422 (\u043C\u0430\u0441\u0448\u0442\u0430\u0431\u043D\u0430 \u0430\u0431\u043E \u0434\u043E\u0432\u0433\u043E\u0441\u0442\u0440\u043E\u043A\u043E\u0432\u0430 \u0446\u0456\u043B\u044C \u0437 \u043A\u0456\u043B\u044C\u043A\u043E\u043C\u0430 \u0435\u0442\u0430\u043F\u0430\u043C\u0438) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "create_project",
  "name": "\u043A\u043E\u0440\u043E\u0442\u043A\u0430 \u043D\u0430\u0437\u0432\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0443 (2-5 \u0441\u043B\u0456\u0432)",
  "subtitle": "\u043F\u0456\u0434\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0430\u0431\u043E \u043F\u043E\u0440\u043E\u0436\u043D\u044C\u043E"
}
\u041F\u0440\u043E\u0435\u043A\u0442 \u2014 \u0446\u0435 \u0432\u0435\u043B\u0438\u043A\u0430 \u0446\u0456\u043B\u044C \u0449\u043E \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0454 \u043A\u0456\u043B\u044C\u043A\u043E\u0445 \u0442\u0438\u0436\u043D\u0456\u0432/\u043C\u0456\u0441\u044F\u0446\u0456\u0432 \u0456 \u0431\u0430\u0433\u0430\u0442\u043E \u043A\u0440\u043E\u043A\u0456\u0432. \u0422\u0440\u0438\u0433\u0435\u0440\u0438: "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438", "\u043F\u043E\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438", "\u0440\u043E\u0437\u0440\u043E\u0431\u0438\u0442\u0438", "\u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0438", "\u0440\u0435\u043C\u043E\u043D\u0442", "\u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u043F\u0440\u043E\u0435\u043A\u0442", "\u0440\u0435\u0430\u043B\u0456\u0437\u0443\u0432\u0430\u0442\u0438", "\u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0443\u0432\u0430\u0442\u0438 [\u0449\u043E\u0441\u044C \u0432\u0435\u043B\u0438\u043A\u0435]".
\u041F\u0440\u0438\u043A\u043B\u0430\u0434\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0456\u0432: "\u0440\u0435\u043C\u043E\u043D\u0442 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u0438", "\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u043E\u043D\u043B\u0430\u0439\u043D-\u043A\u0443\u0440\u0441", "\u0440\u043E\u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0434\u043E\u0434\u0430\u0442\u043E\u043A", "\u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043A\u0430\u0444\u0435", "\u043E\u0440\u0433\u0430\u043D\u0456\u0437\u0443\u0432\u0430\u0442\u0438 \u0432\u0435\u0441\u0456\u043B\u043B\u044F".
\u041F\u0440\u0438\u043A\u043B\u0430\u0434\u0438 \u0437\u0430\u0434\u0430\u0447 (\u041D\u0415 \u043F\u0440\u043E\u0435\u043A\u0442\u0456\u0432): "\u0437\u0430\u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443\u0432\u0430\u0442\u0438 \u0432 \u0431\u0430\u043D\u043A", "\u043A\u0443\u043F\u0438\u0442\u0438 \u043B\u0456\u043A\u0438", "\u043D\u0430\u043F\u0438\u0441\u0430\u0442\u0438 email", "\u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0437\u0432\u0456\u0442".
\u0412\u0410\u0416\u041B\u0418\u0412\u041E: \u044F\u043A\u0449\u043E \u0454 \u0445\u043E\u0447\u0430 \u0431 \u043E\u0434\u0438\u043D \u0442\u0440\u0438\u0433\u0435\u0440 \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u2014 \u041D\u0415 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 action:"save". \u041E\u0431\u0438\u0440\u0430\u0439 create_project \u0430\u0431\u043E clarify. \u041D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u044F\u043A \u0437\u0430\u0434\u0430\u0447\u0443.
\u042F\u043A\u0449\u043E \u0441\u0443\u043C\u043D\u0456\u0432 \u043C\u0456\u0436 \u0437\u0430\u0434\u0430\u0447\u0435\u044E \u0456 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u043C \u2014 \u043F\u0438\u0442\u0430\u0439: action "clarify" \u0437 \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0430\u043C\u0438.

\u042F\u041A\u0429\u041E \u0446\u0435 \u043D\u043E\u0432\u0438\u0439 \u0437\u0430\u043F\u0438\u0441 (\u0434\u0443\u043C\u043A\u0430, \u0437\u0430\u0434\u0430\u0447\u0430, \u0456\u0434\u0435\u044F, \u043D\u043E\u0432\u0430 \u0437\u0432\u0438\u0447\u043A\u0430, \u043F\u043E\u0434\u0456\u044F, \u043D\u043E\u0442\u0430\u0442\u043A\u0430) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "save",
  "category": "idea|task|habit|note|event",
  "folder": "\u043D\u0430\u0437\u0432\u0430 \u043F\u0430\u043F\u043A\u0438 \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E \u0430\u0431\u043E null",
  "text": "\u043E\u0447\u0438\u0449\u0435\u043D\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u043F\u0438\u0441\u0443",
  "comment": "\u043A\u043E\u0440\u043E\u0442\u043A\u0430 \u043F\u0440\u0430\u043A\u0442\u0438\u0447\u043D\u0430 \u0440\u0435\u043C\u0430\u0440\u043A\u0430 (1 \u0440\u0435\u0447\u0435\u043D\u043D\u044F). \u041D\u0415 \u0445\u0432\u0430\u043B\u0438 \u0437\u0430\u043F\u0438\u0441."
}

\u042F\u041A\u0429\u041E \u0432 \u043E\u0434\u043D\u043E\u043C\u0443 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u0456 \u0454 \u041A\u0406\u041B\u042C\u041A\u0410 \u0420\u0406\u0417\u041D\u0418\u0425 \u0437\u0430\u043F\u0438\u0441\u0456\u0432 \u0440\u0456\u0437\u043D\u0438\u0445 \u0442\u0438\u043F\u0456\u0432 (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434 \u0434\u0432\u0456 \u0437\u0432\u0438\u0447\u043A\u0438, \u0437\u0430\u0434\u0430\u0447\u0430 \u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0430) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u043C\u0430\u0441\u0438\u0432\u043E\u043C JSON. \u0423\u0412\u0410\u0413\u0410: \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0434\u043D\u043E\u0442\u0438\u043F\u043D\u0438\u0445 \u0440\u0435\u0447\u0435\u0439 \u0447\u0435\u0440\u0435\u0437 \u043A\u043E\u043C\u0443 (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434 "\u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043A\u0443\u043F\u043E\u043A: \u0445\u043B\u0456\u0431, \u043C\u043E\u043B\u043E\u043A\u043E") \u2014 \u0446\u0435 \u041E\u0414\u041D\u0410 \u0437\u0430\u0434\u0430\u0447\u0430 \u0437 \u043A\u0440\u043E\u043A\u0430\u043C\u0438, \u043D\u0435 \u043C\u0430\u0441\u0438\u0432 \u043E\u043A\u0440\u0435\u043C\u0438\u0445 \u0437\u0430\u0434\u0430\u0447:
[
  {"action": "save", "category": "habit", "text": "\u041F\u0440\u0438\u0441\u0456\u0434\u0430\u0442\u0438", ...},
  {"action": "save", "category": "habit", "text": "\u041F\u043B\u0430\u043D\u043A\u0430", ...}
]

\u042F\u041A\u0429\u041E \u0446\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F \u0430\u0431\u043E \u0440\u043E\u0437\u043C\u043E\u0432\u0430 (\u043D\u0435 \u0437\u0430\u043F\u0438\u0441 \u0456 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "reply",
  "comment": "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E, 2-4 \u0440\u0435\u0447\u0435\u043D\u043D\u044F. \u042F\u043A\u0449\u043E \u0454 \u0441\u043F\u0438\u0441\u043E\u043A \u2014 \u043A\u043E\u0436\u0435\u043D \u043F\u0443\u043D\u043A\u0442 \u0437 \u043D\u043E\u0432\u043E\u0433\u043E \u0440\u044F\u0434\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \\n"
}

\u042F\u041A\u0429\u041E \u0454 \u0441\u0443\u043C\u043D\u0456\u0432 (\u043A\u0456\u043B\u044C\u043A\u0430 \u043C\u043E\u0436\u043B\u0438\u0432\u0438\u0445 \u0434\u0456\u0439, \u043D\u0435\u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u044F) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "clarify",
  "question": "\u043A\u043E\u0440\u043E\u0442\u043A\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E (1 \u0440\u0435\u0447\u0435\u043D\u043D\u044F)",
  "options": [
    {"label": "\u{1F4CB} \u041A\u0443\u043F\u0438\u0442\u0438 \u0437\u0430\u043F\u0430\u0441\u043D\u0435 \u043A\u043E\u043B\u0435\u0441\u043E", "action": "save", "category": "task", "text": "\u041A\u0443\u043F\u0438\u0442\u0438 \u0437\u0430\u043F\u0430\u0441\u043D\u0435 \u043A\u043E\u043B\u0435\u0441\u043E", "task_title": "\u041A\u0443\u043F\u0438\u0442\u0438 \u0437\u0430\u043F\u0430\u0441\u043D\u0435 \u043A\u043E\u043B\u0435\u0441\u043E", "task_steps": []},
    {"label": "\u2705 \u0412\u0438\u043A\u043E\u043D\u0430\u0432 \u0437\u0432\u0438\u0447\u043A\u0443 X", "action": "complete_habit", "habit_id": 123456}
  ]
}

\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u0457 \u0434\u043B\u044F action=save:
- task: \u0454 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430 \u041D\u041E\u0412\u0410 \u0440\u0430\u0437\u043E\u0432\u0430 \u0434\u0456\u044F \u044F\u043A\u0443 \u0442\u0440\u0435\u0431\u0430 \u0437\u0440\u043E\u0431\u0438\u0442\u0438 ("\u0437\u0430\u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443\u0432\u0430\u0442\u0438", "\u043A\u0443\u043F\u0438\u0442\u0438", "\u0437\u0440\u043E\u0431\u0438\u0442\u0438", "\u0432\u0456\u0434\u043F\u0440\u0430\u0432\u0438\u0442\u0438"). \u041D\u0415 task: \u0434\u043E\u0432\u0433\u043E\u0441\u0442\u0440\u043E\u043A\u043E\u0432\u0430 \u0446\u0456\u043B\u044C \u043D\u0430 \u0442\u0438\u0436\u043D\u0456/\u043C\u0456\u0441\u044F\u0446\u0456 \u0437 \u043A\u0456\u043B\u044C\u043A\u043E\u043C\u0430 \u0435\u0442\u0430\u043F\u0430\u043C\u0438 \u2014 \u0446\u0435 create_project.
  - "text" \u2014 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B\u044C\u043D\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 (\u0432\u0438\u043F\u0440\u0430\u0432 \u0442\u0456\u043B\u044C\u043A\u0438 \u0433\u0440\u0430\u043C\u0430\u0442\u0438\u043A\u0443)
  - "task_title" \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0430 \u043D\u0430\u0437\u0432\u0430 2-5 \u0441\u043B\u0456\u0432. \u042F\u041A\u0429\u041E \u0454 \u0447\u0430\u0441/\u0434\u0430\u0442\u0430 \u2014 \u0432\u043A\u043B\u044E\u0447\u0438 \u0443 task_title (\u0444\u043E\u0440\u043C\u0430\u0442 24\u0433)
  - "task_steps" \u2014 \u043C\u0430\u0441\u0438\u0432 \u043A\u0440\u043E\u043A\u0456\u0432 \u044F\u043A\u0449\u043E \u0454 \u0441\u043F\u0438\u0441\u043E\u043A \u0434\u0456\u0439. \u0406\u043D\u0430\u043A\u0448\u0435 []
  \u0412\u0410\u0416\u041B\u0418\u0412\u041E \u2014 \u0441\u043F\u0438\u0441\u043E\u043A \u0447\u0438 \u043E\u043A\u0440\u0435\u043C\u0456 \u0437\u0430\u0434\u0430\u0447\u0456:
  - \u042F\u043A\u0449\u043E \u0454 \u043D\u0430\u0437\u0432\u0430 \u0441\u043F\u0438\u0441\u043A\u0443 + \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438 ("\u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043A\u0443\u043F\u043E\u043A: \u0445\u043B\u0456\u0431, \u043C\u043E\u043B\u043E\u043A\u043E, \u044F\u0439\u0446\u044F" \u0430\u0431\u043E "\u043F\u0456\u0434\u0433\u043E\u0442\u0443\u0432\u0430\u0442\u0438 \u0437\u0432\u0456\u0442: \u0437\u0456\u0431\u0440\u0430\u0442\u0438 \u0434\u0430\u043D\u0456, \u043D\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0438") \u2014 \u041E\u0414\u041D\u0410 \u0437\u0430\u0434\u0430\u0447\u0430 \u0437 \u043A\u0440\u043E\u043A\u0430\u043C\u0438
  - \u042F\u043A\u0449\u043E \u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438 \u044F\u0432\u043D\u043E \u0440\u0456\u0437\u043D\u0456 \u0456 \u043D\u0435\u0437\u0430\u043B\u0435\u0436\u043D\u0456 ("\u0437\u0430\u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443\u0432\u0430\u0442\u0438 \u0412\u043E\u0432\u0456, \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u0438\u0441\u044F \u0434\u043E \u043B\u0456\u043A\u0430\u0440\u044F") \u2014 \u043E\u043A\u0440\u0435\u043C\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 (\u043C\u0430\u0441\u0438\u0432)
  - \u042F\u043A\u0449\u043E \u043D\u0435\u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E \u2014 action: "clarify" \u0437 \u043F\u0438\u0442\u0430\u043D\u043D\u044F\u043C "\u0426\u0435 \u043E\u0434\u0438\u043D \u0441\u043F\u0438\u0441\u043E\u043A \u0447\u0438 \u043E\u043A\u0440\u0435\u043C\u0456 \u0437\u0430\u0434\u0430\u0447\u0456?"
- habit: \u041D\u041E\u0412\u0410 \u0440\u0435\u0433\u0443\u043B\u044F\u0440\u043D\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0432\u0430\u043D\u0430 \u0434\u0456\u044F ("\u0449\u043E\u0434\u043D\u044F", "\u043A\u043E\u0436\u0435\u043D \u0440\u0430\u043D\u043E\u043A", "\u0442\u0440\u0438\u0447\u0456 \u043D\u0430 \u0442\u0438\u0436\u0434\u0435\u043D\u044C"). "text" \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0430 \u043D\u0430\u0437\u0432\u0430 2-4 \u0441\u043B\u043E\u0432\u0430. \u042F\u041A\u0429\u041E \u0432\u043A\u0430\u0437\u0430\u043D\u0456 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0456 \u0434\u043D\u0456 \u2014 \u0434\u043E\u0434\u0430\u0439 "days" \u043C\u0430\u0441\u0438\u0432 (0=\u041F\u043D,1=\u0412\u0442,2=\u0421\u0440,3=\u0427\u0442,4=\u041F\u0442,5=\u0421\u0431,6=\u041D\u0434). \u041F\u0440\u0438\u043A\u043B\u0430\u0434: "\u043F\u043E \u0441\u0435\u0440\u0435\u0434\u0430\u0445 \u0456 \u0432\u0456\u0432\u0442\u043E\u0440\u043A\u0430\u0445" \u2192 "days":[1,2]. \u042F\u041A\u0429\u041E \u0432\u043A\u0430\u0437\u0430\u043D\u0430 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0440\u0430\u0437\u0456\u0432 \u043D\u0430 \u0434\u0435\u043D\u044C ("8 \u0440\u0430\u0437\u0456\u0432", "5 \u0441\u043A\u043B\u044F\u043D\u043E\u043A") \u2014 \u0434\u043E\u0434\u0430\u0439 "targetCount":8
- event: \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0444\u0430\u043A\u0442 \u043F\u043E\u0434\u0456\u0457 \u0431\u0435\u0437 \u0435\u043C\u043E\u0446\u0456\u0439 ("\u043F\u043E\u0457\u0445\u0430\u0432 \u043D\u0430 \u0440\u0438\u0431\u0430\u043B\u043A\u0443", "\u0437\u0443\u0441\u0442\u0440\u0456\u0432\u0441\u044F \u0437 \u0412\u043E\u0432\u043E\u044E"). \u042F\u043A\u0449\u043E \u0454 \u0435\u043C\u043E\u0446\u0456\u0457/\u0440\u043E\u0437\u0434\u0443\u043C\u0438 \u2014 \u0446\u0435 note
- idea: \u0442\u0432\u043E\u0440\u0447\u0430 \u0434\u0443\u043C\u043A\u0430, \u0456\u0434\u0435\u044F, \u043F\u043B\u0430\u043D, \u043D\u0430\u0442\u0445\u043D\u0435\u043D\u043D\u044F
- note: \u0440\u0435\u0444\u043B\u0435\u043A\u0441\u0456\u044F, \u0434\u0443\u043C\u043A\u0438, \u0435\u043C\u043E\u0446\u0456\u0457, \u0432\u0438\u0441\u043D\u043E\u0432\u043A\u0438, \u0441\u043F\u043E\u0441\u0442\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F, \u0444\u0430\u043A\u0442\u0438, \u0449\u043E\u0434\u0435\u043D\u043D\u0438\u043A\u043E\u0432\u0456 \u0437\u0430\u043F\u0438\u0441\u0438, \u0441\u0442\u0430\u043D \u0437\u0434\u043E\u0440\u043E\u0432\u02BC\u044F, \u0449\u043E \u0432\u0456\u0434\u0431\u0443\u0432\u0430\u0454\u0442\u044C\u0441\u044F \u0432 \u0436\u0438\u0442\u0442\u0456. \u042F\u041A\u0429\u041E \u043B\u044E\u0434\u0438\u043D\u0430 \u043E\u043F\u0438\u0441\u0443\u0454 \u0441\u0432\u0456\u0439 \u0434\u0435\u043D\u044C, \u0441\u0442\u0430\u043D, \u0441\u0438\u0442\u0443\u0430\u0446\u0456\u044E \u2014 \u0446\u0435 note, \u041D\u0415 reply.
- finance: \u0432\u0438\u0442\u0440\u0430\u0442\u0430 \u0430\u0431\u043E \u0434\u043E\u0445\u0456\u0434 (\u0431\u0443\u0434\u044C-\u044F\u043A\u0430 \u0441\u0443\u043C\u0430 \u0433\u0440\u043E\u0448\u0435\u0439). \u042F\u043A\u0449\u043E \u0454 \u0441\u0443\u043C\u0430 \u0456 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u0432\u0438\u0442\u0440\u0430\u0442/\u0434\u043E\u0445\u043E\u0434\u0443 \u2014 \u0446\u0435 finance

\u042F\u041A\u0429\u041E \u0446\u0435 \u0432\u0438\u0442\u0440\u0430\u0442\u0430 \u0430\u0431\u043E \u0434\u043E\u0445\u0456\u0434 (\u0454 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430 \u0441\u0443\u043C\u0430) \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "save_finance",
  "fin_type": "expense|income",
  "amount": 50,
  "category": "\u0407\u0436\u0430",
  "fin_comment": "\u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043E\u043F\u0438\u0441 \u0411\u0415\u0417 \u0441\u0443\u043C\u0438 (1-3 \u0441\u043B\u043E\u0432\u0430, \u0442\u0456\u043B\u044C\u043A\u0438 \u0449\u043E/\u0434\u0435, \u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: \u0437\u0430\u043F\u0440\u0430\u0432\u043A\u0430, \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438, \u043A\u0430\u0432\u0430)"
}

\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u0457 \u0432\u0438\u0442\u0440\u0430\u0442 \u0437 \u043F\u0440\u0438\u043A\u043B\u0430\u0434\u0430\u043C\u0438:
- \u0407\u0436\u0430: \u043A\u0430\u0432\u0430, \u0440\u0435\u0441\u0442\u043E\u0440\u0430\u043D, \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438, \u0441\u0443\u043F\u0435\u0440\u043C\u0430\u0440\u043A\u0435\u0442, \u043E\u0431\u0456\u0434, \u0432\u0435\u0447\u0435\u0440\u044F, \u0441\u043D\u0456\u0434\u0430\u043D\u043E\u043A, \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0457\u0436\u0456, \u043F\u0456\u0446\u0430, \u0441\u0443\u0448\u0456
- \u0422\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442: \u0431\u0435\u043D\u0437\u0438\u043D, \u0437\u0430\u043F\u0440\u0430\u0432\u043A\u0430, \u0442\u0430\u043A\u0441\u0456, Uber, \u043C\u0435\u0442\u0440\u043E, \u0430\u0432\u0442\u043E\u0431\u0443\u0441, \u043F\u0430\u0440\u043A\u043E\u0432\u043A\u0430, \u0430\u0432\u0442\u043E
- \u041F\u0456\u0434\u043F\u0438\u0441\u043A\u0438: Netflix, Spotify, ChatGPT, Apple, Google, \u0434\u043E\u0434\u0430\u0442\u043A\u0438, \u0441\u0435\u0440\u0432\u0456\u0441\u0438
- \u0417\u0434\u043E\u0440\u043E\u0432\u02BC\u044F: \u0430\u043F\u0442\u0435\u043A\u0430, \u043B\u0456\u043A\u0438, \u043B\u0456\u043A\u0430\u0440, \u0441\u043F\u043E\u0440\u0442\u0437\u0430\u043B, \u0444\u0456\u0442\u043D\u0435\u0441, \u0441\u0442\u043E\u043C\u0430\u0442\u043E\u043B\u043E\u0433
- \u0416\u0438\u0442\u043B\u043E: \u043E\u0440\u0435\u043D\u0434\u0430, \u043A\u043E\u043C\u0443\u043D\u0430\u043B\u043A\u0430, \u0456\u043D\u0442\u0435\u0440\u043D\u0435\u0442, \u0440\u0435\u043C\u043E\u043D\u0442, \u043C\u0435\u0431\u043B\u0456
- \u041F\u043E\u043A\u0443\u043F\u043A\u0438: \u043E\u0434\u044F\u0433, \u0442\u0435\u0445\u043D\u0456\u043A\u0430, \u043F\u043E\u0434\u0430\u0440\u0443\u043D\u043E\u043A, \u043C\u0430\u0433\u0430\u0437\u0438\u043D, Amazon
- \u0406\u043D\u0448\u0435: \u0432\u0441\u0435 \u0449\u043E \u043D\u0435 \u043F\u0456\u0434\u0445\u043E\u0434\u0438\u0442\u044C \u0432\u0438\u0449\u0435
\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u0457 \u0434\u043E\u0445\u043E\u0434\u0456\u0432: \u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430, \u041D\u0430\u0434\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F, \u041F\u043E\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u044F, \u0406\u043D\u0448\u0435
\u042F\u043A\u0449\u043E \u0454 \u0441\u0443\u043C\u043D\u0456\u0432 \u2014 \u043E\u0431\u0438\u0440\u0430\u0439 \u043D\u0430\u0439\u0431\u043B\u0438\u0436\u0447\u0443 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u044E \u0437 \u043F\u0440\u0438\u043A\u043B\u0430\u0434\u0456\u0432, \u041D\u0415 "\u0406\u043D\u0448\u0435".

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0434\u043E\u0434\u0430\u0442\u0438 \u043A\u0440\u043E\u043A\u0438 \u0434\u043E \u0456\u0441\u043D\u0443\u044E\u0447\u043E\u0457 \u0437\u0430\u0434\u0430\u0447\u0456 \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "add_step",
  "task_id": 123456,
  "steps": ["\u043A\u0440\u043E\u043A 1", "\u043A\u0440\u043E\u043A 2"]
}
\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 task_id \u0437 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0445 \u0437\u0430\u0434\u0430\u0447.

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u042F\u0412\u041D\u041E \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0437\u043C\u0456\u043D\u0438\u0442\u0438, \u0432\u0438\u043F\u0440\u0430\u0432\u0438\u0442\u0438, \u043E\u043D\u043E\u0432\u0438\u0442\u0438 \u0456\u0441\u043D\u0443\u044E\u0447\u0443 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0456\u044E (\u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454 \u0441\u043B\u043E\u0432\u0430 "\u0437\u043C\u0456\u043D\u0438", "\u0432\u0438\u043F\u0440\u0430\u0432", "\u043E\u043D\u043E\u0432\u0438\u0442\u0438", "\u0442\u0430 \u0441\u0430\u043C\u0430", "\u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F", "\u0442\u0430 \u0432\u0438\u0442\u0440\u0430\u0442\u0430") \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "update_transaction",
  "id": 1234567890,
  "category": "\u041D\u043E\u0432\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u044F",
  "amount": 18,
  "comment": "\u043D\u043E\u0432\u0438\u0439 \u043A\u043E\u043C\u0435\u043D\u0442\u0430\u0440 \u0430\u0431\u043E \u043F\u0443\u0441\u0442\u043E"
}
\u041F\u043E\u043B\u044F "category", "amount", "comment" \u2014 \u0432\u043A\u0430\u0437\u0443\u0439 \u0442\u0456\u043B\u044C\u043A\u0438 \u0442\u0456 \u0449\u043E \u0437\u043C\u0456\u043D\u044E\u044E\u0442\u044C\u0441\u044F. \u042F\u043A\u0449\u043E \u0441\u0443\u043C\u0430 \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0454\u0442\u044C\u0441\u044F \u2014 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0439 "amount".
\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 id \u0437 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0457 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0456\u0457 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0456. \u041D\u0415 \u0441\u0442\u0432\u043E\u0440\u044E\u0439 \u043D\u043E\u0432\u0443 \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0456\u044E.
\u0412\u0410\u0416\u041B\u0418\u0412\u041E: "\u0434\u043E\u0434\u0430\u0439 \u043A\u0440\u043E\u043A\u0438", "\u0434\u043E\u0434\u0430\u0439 \u043A\u0440\u043E\u043A \u0434\u043E \u0437\u0430\u0434\u0430\u0447\u0456" \u2014 \u0446\u0435 \u041D\u0415 update_transaction. \u0426\u0435 \u0441\u0442\u043E\u0441\u0443\u0454\u0442\u044C\u0441\u044F \u0437\u0430\u0434\u0430\u0447, \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u044F\u043A \u043D\u0430 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0441 \u0430\u0431\u043E reply.

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u043F\u0430\u043F\u043A\u0443 \u043D\u043E\u0442\u0430\u0442\u043E\u043A \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{"action":"delete_folder","folder":"\u043D\u0430\u0437\u0432\u0430 \u043F\u0430\u043F\u043A\u0438 (\u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E \u0431\u043B\u0438\u0437\u044C\u043A\u043E \u0434\u043E \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B\u044C\u043D\u043E\u0457)"}

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0435\u0440\u0435\u043C\u0456\u0441\u0442\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0432 \u0456\u043D\u0448\u0443 \u043F\u0430\u043F\u043A\u0443 \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{"action":"move_note","query":"\u0447\u0430\u0441\u0442\u0438\u043D\u0430 \u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u043E\u0442\u0430\u0442\u043A\u0438","folder":"\u043D\u043E\u0432\u0430 \u043F\u0430\u043F\u043A\u0430"}

\u042F\u041A\u0429\u041E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0441, \u0437\u0430\u0434\u0430\u0447\u0443, \u043D\u043E\u0442\u0430\u0442\u043A\u0443, \u0437\u0432\u0438\u0447\u043A\u0443 \u0430\u0431\u043E \u043F\u0430\u043F\u043A\u0443 \u2014 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON:
{
  "action": "restore_deleted",
  "query": "\u043A\u043B\u044E\u0447\u043E\u0432\u0456 \u0441\u043B\u043E\u0432\u0430 \u0434\u043B\u044F \u043F\u043E\u0448\u0443\u043A\u0443 \u0430\u0431\u043E: all (\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0432\u0441\u0456), last (\u043E\u0441\u0442\u0430\u043D\u043D\u044E \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0443)",
  "type": "task|note|habit|inbox|folder|finance \u0430\u0431\u043E null \u044F\u043A\u0449\u043E \u0431\u0443\u0434\u044C-\u044F\u043A\u0438\u0439 \u0442\u0438\u043F"
}
\u041F\u0440\u0438\u043A\u043B\u0430\u0434\u0438:
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u043F\u0440\u043E \u043C\u0430\u0448\u0438\u043D\u0443" \u2192 {"action":"restore_deleted","query":"\u043C\u0430\u0448\u0438\u043D\u0430","type":"note"}
- "\u043F\u043E\u0432\u0435\u0440\u043D\u0438 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0443 \u0437\u0430\u0434\u0430\u0447\u0443 \u043A\u0443\u043F\u0438\u0442\u0438 \u0445\u043B\u0456\u0431" \u2192 {"action":"restore_deleted","query":"\u043A\u0443\u043F\u0438\u0442\u0438 \u0445\u043B\u0456\u0431","type":"task"}
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0432\u0441\u0456 \u0437\u0430\u0434\u0430\u0447\u0456" \u2192 {"action":"restore_deleted","query":"all","type":"task"}
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0432\u0441\u0456 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0456" \u2192 {"action":"restore_deleted","query":"all","type":null}
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043E\u0441\u0442\u0430\u043D\u043D\u044E \u0437\u0430\u0434\u0430\u0447\u0443" \u2192 {"action":"restore_deleted","query":"last","type":"task"}
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u043E\u0441\u0442\u0430\u043D\u043D\u0454 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u0435" \u2192 {"action":"restore_deleted","query":"last","type":null}
- "\u0432\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0456 \u043F\u0440\u043E \u043C\u0430\u0448\u0438\u043D\u0443 \u0456 \u043C\u043E\u043B\u043E\u043A\u043E" \u2192 {"action":"restore_deleted","query":"\u043C\u0430\u0448\u0438\u043D\u0430 \u043C\u043E\u043B\u043E\u043A\u043E","type":"task"}

\u042F\u041A\u0429\u041E \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0454 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u043D\u044F\u043C, \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u044E \u0430\u0431\u043E \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u043D\u044F\u043C \u0434\u043E \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: "\u0442\u0430\u043A", "\u043D\u0456", "\u0432\u0438\u0434\u0430\u043B\u0438", "\u0446\u0435 \u0431\u0443\u043B\u0430 \u043F\u043E\u043C\u0438\u043B\u043A\u0430") \u2014 \u041D\u0415 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0439 \u044F\u043A \u0437\u0430\u043F\u0438\u0441, \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439:
{
  "action": "reply",
  "comment": "\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0430\u0431\u043E \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043D\u044F"
}

\u041F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442: \u044F\u043A\u0449\u043E \u0441\u0443\u043C\u043D\u0456\u0432 \u043C\u0456\u0436 event \u0456 note \u2014 \u043E\u0431\u0438\u0440\u0430\u0439 note \u0437 \u043F\u0430\u043F\u043A\u043E\u044E "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0435".

\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u043F\u0430\u043F\u043A\u0438 (\u0434\u043B\u044F category=note \u0430\u0431\u043E idea):
- "\u0425\u0430\u0440\u0447\u0443\u0432\u0430\u043D\u043D\u044F" \u2014 \u0457\u0436\u0430, \u043D\u0430\u043F\u043E\u0457, \u043A\u0430\u043B\u043E\u0440\u0456\u0457, \u0440\u0435\u0446\u0435\u043F\u0442\u0438, \u0449\u043E \u0457\u0432/\u043F\u0438\u0432
- "\u0424\u0456\u043D\u0430\u043D\u0441\u0438" \u2014 \u0432\u0438\u0442\u0440\u0430\u0442\u0438, \u0434\u043E\u0445\u043E\u0434\u0438, \u0446\u0456\u043D\u0438, \u0433\u0440\u043E\u0448\u0456 (\u0430\u043B\u0435 \u041D\u0415 \u044F\u043A\u0449\u043E \u0446\u0435 \u043F\u0440\u043E\u0441\u0442\u043E \u0437\u0433\u0430\u0434\u043A\u0430)
- "\u0417\u0434\u043E\u0440\u043E\u0432\u02BC\u044F" \u2014 \u0441\u0430\u043C\u043E\u043F\u043E\u0447\u0443\u0442\u0442\u044F, \u0441\u0438\u043C\u043F\u0442\u043E\u043C\u0438, \u043B\u0456\u043A\u0438, \u043C\u0435\u0434\u0438\u0446\u0438\u043D\u0430, \u0442\u0440\u0435\u043D\u0443\u0432\u0430\u043D\u043D\u044F \u044F\u043A \u0446\u0456\u043B\u044C
- "\u0420\u043E\u0431\u043E\u0442\u0430" \u2014 \u0422\u0406\u041B\u042C\u041A\u0418 \u044F\u043A\u0449\u043E \u0446\u0435 \u0420\u041E\u0411\u041E\u0427\u0406 \u0437\u0430\u043F\u0438\u0441\u0438: \u0437\u0430\u0434\u0430\u0447\u0456 \u043F\u043E \u0440\u043E\u0431\u043E\u0442\u0456, \u0440\u0456\u0448\u0435\u043D\u043D\u044F \u043D\u0430 \u0440\u043E\u0431\u043E\u0442\u0456, \u043A\u043E\u043B\u0435\u0433\u0438, \u043F\u0440\u043E\u0435\u043A\u0442\u0438 \u0434\u043B\u044F \u0440\u043E\u0431\u043E\u0442\u043E\u0434\u0430\u0432\u0446\u044F. \u041D\u0415 "\u0420\u043E\u0431\u043E\u0442\u0430" \u044F\u043A\u0449\u043E \u043B\u044E\u0434\u0438\u043D\u0430 \u043F\u0440\u043E\u0441\u0442\u043E \u0434\u0443\u043C\u0430\u0454 \u043F\u0440\u043E \u0449\u043E\u0441\u044C \u043F\u043E\u0432'\u044F\u0437\u0430\u043D\u0435 \u0437 \u0440\u043E\u0431\u043E\u0442\u043E\u044E \u0430\u0431\u043E \u043A\u043E\u0434\u0438\u043D\u0433\u043E\u043C \u0443 \u0432\u0456\u043B\u044C\u043D\u0438\u0439 \u0447\u0430\u0441 \u2014 \u0446\u0435 "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0435"
- "\u041D\u0430\u0432\u0447\u0430\u043D\u043D\u044F" \u2014 \u0449\u043E \u0432\u0438\u0432\u0447\u0430\u044E, \u043A\u043D\u0438\u0433\u0438, \u043A\u0443\u0440\u0441\u0438, \u043D\u043E\u0432\u0456 \u0437\u043D\u0430\u043D\u043D\u044F
- "\u0406\u0434\u0435\u0457" \u2014 \u0442\u0432\u043E\u0440\u0447\u0456 \u0456\u0434\u0435\u0457 (\u044F\u043A\u0449\u043E category=idea)
- "\u041F\u043E\u0434\u043E\u0440\u043E\u0436\u0456" \u2014 \u0422\u0406\u041B\u042C\u041A\u0418 \u044F\u043A\u0449\u043E \u0439\u0434\u0435\u0442\u044C\u0441\u044F \u043F\u0440\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u0443 \u043F\u043E\u0434\u043E\u0440\u043E\u0436, \u043F\u043E\u0457\u0437\u0434\u043A\u0443, \u043C\u0430\u0440\u0448\u0440\u0443\u0442, \u0432\u0440\u0430\u0436\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u043C\u0456\u0441\u0446\u044F. \u041D\u0415 "\u041F\u043E\u0434\u043E\u0440\u043E\u0436\u0456" \u044F\u043A\u0449\u043E \u043F\u0440\u043E\u0441\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0432 "\u0457\u0437\u0434\u0438\u0432 \u0434\u043E \u0434\u0440\u0443\u0433\u0430" \u0430\u0431\u043E "\u043F\u043E\u0457\u0445\u0430\u0432 \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D"
- "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0435" \u2014 \u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0438, \u0435\u043C\u043E\u0446\u0456\u0457, \u043E\u0441\u043E\u0431\u0438\u0441\u0442\u0456 \u0434\u0443\u043C\u043A\u0438, \u0440\u043E\u0437\u0434\u0443\u043C\u0438, \u0432\u0440\u0430\u0436\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u0437\u0443\u0441\u0442\u0440\u0456\u0447\u0435\u0439, \u0432\u0456\u0434\u0447\u0443\u0442\u0442\u044F, \u0432\u0441\u0435 \u0449\u043E \u043D\u0435 \u043F\u0456\u0434\u0445\u043E\u0434\u0438\u0442\u044C \u0427\u0406\u0422\u041A\u041E \u0432 \u0456\u043D\u0448\u0456 \u043F\u0430\u043F\u043A\u0438
- \u042F\u043A\u0449\u043E \u0454 \u0441\u0443\u043C\u043D\u0456\u0432 \u2014 \u0417\u0410\u0412\u0416\u0414\u0418 "\u041E\u0441\u043E\u0431\u0438\u0441\u0442\u0435", \u041D\u0415 \u0432\u0438\u0433\u0430\u0434\u0443\u0439 \u043D\u043E\u0432\u0438\u0445 \u043F\u0430\u043F\u043E\u043A
- \u0417\u0410\u0411\u041E\u0420\u041E\u041D\u0415\u041D\u041E \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0442\u0438 \u043F\u0430\u043F\u043A\u0443 "\u0427\u0435\u0440\u043D\u0435\u0442\u043A\u0438" \u2014 \u0442\u0456\u043B\u044C\u043A\u0438 \u044F\u043A\u0449\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u042F\u0412\u041D\u041E \u043F\u0440\u043E\u0441\u0438\u0442\u044C
- \u0414\u043B\u044F task/habit/event \u2014 folder: null

\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0434\u043B\u044F clarify:
- \u0417\u0410\u0411\u041E\u0420\u041E\u041D\u0415\u041D\u041E \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0432\u0430\u0442\u0438 clarify \u043F\u0435\u0440\u0435\u0434 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F\u043C \u2014 \u0441\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0437\u0430\u0432\u0436\u0434\u0438 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0439, \u043F\u043E\u0442\u0456\u043C \u0443\u0442\u043E\u0447\u043D\u044E\u0439
- \u042F\u043A\u0449\u043E \u0454 \u0441\u0443\u043C\u043D\u0456\u0432 \u043C\u0456\u0436 task/note/habit \u2014 \u043E\u0431\u0438\u0440\u0430\u0439 \u043D\u0430\u0439\u0456\u043C\u043E\u0432\u0456\u0440\u043D\u0456\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043D\u0442 \u0456 \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0439. \u0414\u043E\u0434\u0430\u0439 \u043F\u043E\u043B\u0435 "ask_after":"\u043A\u043E\u0440\u043E\u0442\u043A\u0435 \u043F\u0438\u0442\u0430\u043D\u043D\u044F" \u0449\u043E\u0431 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u0438 \u043F\u0456\u0441\u043B\u044F \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F
- clarify \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 \u044F\u043A\u0449\u043E: 2+ \u0440\u0456\u0437\u043D\u0456 \u0442\u0438\u043F\u0438 \u0437\u0430\u043F\u0438\u0441\u0456\u0432 \u0456 \u043D\u0435\u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E \u044F\u043A\u0438\u043C \u0454 \u043A\u043E\u0436\u0435\u043D, \u0410\u0411\u041E \u043D\u0435\u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E \u0447\u0438 \u0446\u0435 \u043D\u043E\u0432\u0430 \u0437\u0432\u0438\u0447\u043A\u0430 \u0447\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0456\u0441\u043D\u0443\u044E\u0447\u043E\u0457 (\u0442\u043E\u0434\u0456 clarify \u0434\u043E\u0440\u0435\u0447\u043D\u0438\u0439 \u0431\u043E \u0434\u0456\u044F \u0440\u0456\u0437\u043D\u0430)
- \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 3 \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0438 \u0432 options
- label \u041E\u0411\u041E\u0412\u02BC\u042F\u0417\u041A\u041E\u0412\u041E \u043C\u0456\u0441\u0442\u0438\u0442\u044C \u0440\u0435\u0430\u043B\u044C\u043D\u0438\u0439 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0443

\u041F\u0440\u0438\u043A\u043B\u0430\u0434 save \u0437 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u043D\u044F\u043C:
{"action":"save","category":"task","text":"\u0417\u0430\u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443\u0432\u0430\u0442\u0438 \u0412\u043E\u0432\u0456","comment":"\u0417\u0430\u0434\u0430\u0447\u0443 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E.","ask_after":"\u0426\u0435 \u043E\u0434\u043D\u043E\u0440\u0430\u0437\u043E\u0432\u043E \u0447\u0438 \u0445\u043E\u0447\u0435\u0448 \u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0440\u0435\u0433\u0443\u043B\u044F\u0440\u043D\u0438\u043C?"}

\u0412\u0410\u0416\u041B\u0418\u0412\u041E: \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 \u0432\u0430\u043B\u0456\u0434\u043D\u0438\u043C JSON, \u0431\u0435\u0437 markdown, \u0431\u0435\u0437 \u0442\u0435\u043A\u0441\u0442\u0443 \u043F\u043E\u0437\u0430 JSON.
\u041D\u0415 \u0432\u0438\u0433\u0430\u0434\u0443\u0439 \u043B\u0456\u043C\u0456\u0442\u0438, \u0431\u044E\u0434\u0436\u0435\u0442\u0438 \u0430\u0431\u043E \u043F\u043B\u0430\u043D\u0438 \u044F\u043A\u0438\u0445 \u043D\u0435\u043C\u0430\u0454 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0456. \u042F\u043A\u0449\u043E \u0434\u0430\u043D\u0456 \u0432\u0456\u0434\u0441\u0443\u0442\u043D\u0456 \u2014 \u043D\u0435 \u0437\u0433\u0430\u0434\u0443\u0439 \u0457\u0445.`;
  async function _fetchAI(messages, signal) {
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) {
      showToast("\u2699\uFE0F \u0412\u0432\u0435\u0434\u0456\u0442\u044C OpenAI API \u043A\u043B\u044E\u0447 \u0443 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445", 3e3);
      return null;
    }
    if (location.protocol === "file:") {
      showToast("\u26A0\uFE0F \u0412\u0456\u0434\u043A\u0440\u0438\u0439 \u0444\u0430\u0439\u043B \u0447\u0435\u0440\u0435\u0437 \u0441\u0435\u0440\u0432\u0435\u0440, \u043D\u0435 file://", 5e3);
      return null;
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 300, temperature: 0.7 })
    });
    if (!res.ok) {
      const data2 = await res.json().catch(() => ({}));
      showToast("\u274C " + (data2?.error?.message || `\u041F\u043E\u043C\u0438\u043B\u043A\u0430 ${res.status}`), 4e3);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  }
  async function callAI2(systemPrompt, userMessage, contextData = {}) {
    const context = Object.keys(contextData).length > 0 ? `

\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442:
${JSON.stringify(contextData, null, 2)}` : "";
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage + context }
    ];
    try {
      const text = await _fetchAI(messages, void 0);
      if (text === null) return null;
      if (!text) {
        showToast("\u274C \u041F\u043E\u0440\u043E\u0436\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0432\u0456\u0434 \u0410\u0433\u0435\u043D\u0442\u0430", 3e3);
        return null;
      }
      return text;
    } catch (e) {
      if (e.message === "Load failed" || e.message.includes("Failed to fetch")) {
        showToast("\u274C \u041C\u0435\u0440\u0435\u0436\u0435\u0432\u0430 \u043F\u043E\u043C\u0438\u043B\u043A\u0430. \u041F\u0435\u0440\u0435\u0432\u0456\u0440 \u0456\u043D\u0442\u0435\u0440\u043D\u0435\u0442", 4e3);
      } else {
        showToast("\u274C " + e.message, 4e3);
      }
      return null;
    }
  }
  async function callOwlChat2(userText) {
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) return null;
    const context = getOwlBoardContext();
    const chatHistory = JSON.parse(localStorage.getItem("nm_owl_chat") || "[]");
    const recentChat = chatHistory.slice(-12).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text
    }));
    const systemPrompt = getOWLPersonality2() + `

\u0426\u0435 \u043C\u0456\u043D\u0456-\u0447\u0430\u0442. \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u043D\u0430 \u0442\u0432\u043E\u0454 \u043F\u0440\u043E\u0430\u043A\u0442\u0438\u0432\u043D\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0430\u0431\u043E \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u0438\u0442\u0430\u043D\u043D\u044F.

\u041A\u041E\u041D\u0422\u0415\u041A\u0421\u0422 \u0414\u0410\u041D\u0418\u0425:
${context}

\u0424\u041E\u0420\u041C\u0410\u0422 \u0412\u0406\u0414\u041F\u041E\u0412\u0406\u0414\u0406 (\u0437\u0430\u0432\u0436\u0434\u0438 JSON):
{"text":"\u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C","chips":["\u0432\u0430\u0440\u0456\u0430\u043D\u04421","\u0432\u0430\u0440\u0456\u0430\u043D\u04422"],"action":null}

\u041F\u0420\u0410\u0412\u0418\u041B\u0410:
- \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 1-2 \u0440\u0435\u0447\u0435\u043D\u043D\u044F. \u041A\u043E\u0440\u043E\u0442\u043A\u043E \u0456 \u043F\u043E-\u043B\u044E\u0434\u0441\u044C\u043A\u0438.
- chips \u2014 0-3 \u0432\u0430\u0440\u0456\u0430\u043D\u0442\u0438 \u0448\u0432\u0438\u0434\u043A\u043E\u0457 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0456. \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 3 \u0441\u043B\u043E\u0432\u0430 \u043A\u043E\u0436\u0435\u043D.
- \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E.

\u0414\u041E\u0421\u0422\u0423\u041F\u041D\u0406 \u0414\u0406\u0407 (action \u043F\u043E\u043B\u0435):
\u042F\u043A\u0449\u043E \u044E\u0437\u0435\u0440 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0434\u0456\u044E \u2014 \u043F\u043E\u0432\u0435\u0440\u043D\u0438 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0438\u0439 \u043E\u0431'\u0454\u043A\u0442 \u0432 "action". \u042F\u043A\u0449\u043E \u0434\u0456\u044F \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0430 \u2014 action:null.

\u0412\u0456\u0434\u043C\u0456\u0442\u0438\u0442\u0438 \u0437\u0432\u0438\u0447\u043A\u0443: {"action":"complete_habit","habit_id":ID_\u0417\u0412\u0418\u0427\u041A\u0418}
\u0417\u0430\u043A\u0440\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0443: {"action":"complete_task","task_id":ID_\u0417\u0410\u0414\u0410\u0427\u0406}
\u0421\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0443: {"action":"create_task","title":"\u043D\u0430\u0437\u0432\u0430"}
\u0421\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443: {"action":"create_note","text":"\u0442\u0435\u043A\u0441\u0442 \u043D\u043E\u0442\u0430\u0442\u043A\u0438"}
\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u0432\u0438\u0442\u0440\u0430\u0442\u0443: {"action":"save_finance","fin_type":"expense","amount":\u0427\u0418\u0421\u041B\u041E,"category":"\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u044F"}
\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u0434\u043E\u0445\u0456\u0434: {"action":"save_finance","fin_type":"income","amount":\u0427\u0418\u0421\u041B\u041E,"category":"\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0456\u044F"}

ID \u0437\u0430\u0434\u0430\u0447 \u0456 \u0437\u0432\u0438\u0447\u043E\u043A \u0454 \u0432 \u041A\u041E\u041D\u0422\u0415\u041A\u0421\u0422 \u0414\u0410\u041D\u0418\u0425 \u0432\u0438\u0449\u0435. \u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0442\u0456\u043B\u044C\u043A\u0438 \u0440\u0435\u0430\u043B\u044C\u043D\u0456 ID.`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...recentChat,
      { role: "user", content: userText }
    ];
    try {
      const reply = await _fetchAI(messages, void 0);
      return reply;
    } catch (e) {
      return null;
    }
  }
  async function callAIWithHistory(systemPrompt, history) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25e3);
    try {
      const messages = [{ role: "system", content: systemPrompt }, ...history];
      const reply = await _fetchAI(messages, controller.signal);
      clearTimeout(timeout);
      return reply;
    } catch (e) {
      clearTimeout(timeout);
      console.error("callAIWithHistory error:", e);
      return null;
    }
  }
  var CHAT_STORE_MAX = 30;
  var CHAT_STORE_KEYS = {
    inbox: "nm_chat_inbox",
    tasks: "nm_chat_tasks",
    notes: "nm_chat_notes",
    me: "nm_chat_me",
    evening: "nm_chat_evening",
    finance: "nm_chat_finance"
  };
  function saveChatMsg(tab, role, text) {
    if (role === "typing") return;
    const key = CHAT_STORE_KEYS[tab];
    if (!key) return;
    try {
      const msgs = JSON.parse(localStorage.getItem(key) || "[]");
      msgs.push({ role, text, ts: Date.now() });
      if (msgs.length > CHAT_STORE_MAX) msgs.splice(0, msgs.length - CHAT_STORE_MAX);
      localStorage.setItem(key, JSON.stringify(msgs));
    } catch (e) {
    }
  }
  function loadChatMsgs(tab) {
    const key = CHAT_STORE_KEYS[tab];
    if (!key) return [];
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }
  function restoreChatUI2(tab) {
    const containerMap = {
      inbox: "inbox-chat-messages",
      tasks: "tasks-chat-messages",
      notes: "notes-chat-messages",
      me: "me-chat-messages",
      evening: "evening-bar-messages",
      finance: "finance-chat-messages"
    };
    const addMsgMap = {
      tasks: (r, t) => addTaskBarMsg(r, t, true),
      notes: (r, t) => addNotesChatMsg(r, t, true),
      me: (r, t) => addMeChatMsg(r, t, true),
      evening: (r, t) => addEveningBarMsg(r, t, true),
      finance: (r, t) => addFinanceChatMsg(r, t, true)
    };
    const containerId = containerMap[tab];
    if (!containerId) return;
    const el = document.getElementById(containerId);
    if (!el || el.dataset.restored) return;
    el.dataset.restored = "1";
    const msgs = loadChatMsgs(tab);
    if (msgs.length === 0) {
      if (tab === "inbox") {
        const div = document.createElement("div");
        div.style.cssText = "display:flex";
        div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:5px 10px;font-size:13px;font-weight:500;line-height:1.5;max-width:85%">\u041F\u0440\u0438\u0432\u0456\u0442! \u041D\u0430\u043F\u0438\u0448\u0438 \u0449\u043E \u0437\u0430\u0432\u0433\u043E\u0434\u043D\u043E \u2014 \u044F \u0440\u043E\u0437\u0431\u0435\u0440\u0443\u0441\u044C \u{1F44B}</div>`;
        el.appendChild(div);
      }
      return;
    }
    const sep = document.createElement("div");
    sep.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0 8px;opacity:0.4";
    sep.innerHTML = `<div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div><div style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044F \u0440\u043E\u0437\u043C\u043E\u0432\u0430</div><div style="flex:1;height:1px;background:rgba(255,255,255,0.2)"></div>`;
    el.appendChild(sep);
    if (tab === "inbox") {
      msgs.forEach((m) => _renderInboxChatMsg(m.role, m.text, el));
    } else if (addMsgMap[tab]) {
      msgs.forEach((m) => addMsgMap[tab](m.role, m.text));
    }
  }
  function _renderInboxChatMsg(role, text, el) {
    const isAgent = role === "agent";
    const div = document.createElement("div");
    div.style.cssText = `display:flex;${isAgent ? "gap:8px;align-items:flex-start" : "justify-content:flex-end"}`;
    if (isAgent) {
      div.innerHTML = `<div style="background:rgba(255,255,255,0.12);color:white;border-radius:4px 14px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
    } else {
      div.innerHTML = `<div style="background:rgba(255,255,255,0.88);color:#1e1040;border-radius:14px 4px 14px 14px;padding:8px 12px;font-size:15px;font-weight:500;line-height:1.5;max-width:85%">${escapeHtml(text)}</div>`;
    }
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
  function openChatBar2(tab) {
    if (activeChatBar === tab) return;
    try {
      closeOwlChat();
    } catch (e) {
    }
    ["inbox", "tasks", "notes", "me", "evening", "finance", "health", "projects"].forEach((t) => {
      if (t === tab) return;
      const b = document.getElementById(t + "-ai-bar");
      if (!b) return;
      const cw = b.querySelector(".ai-bar-chat-window");
      if (cw) {
        cw.classList.remove("open");
        _tabChatState[t] = void 0;
      }
      const inputs = b.querySelectorAll("input, textarea");
      inputs.forEach((i) => i.blur());
    });
    activeChatBar = tab;
    if (tab === "inbox") {
      try {
        _clearInboxUnreadBadge();
      } catch (e) {
      }
    }
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return;
    restoreChatUI2(tab);
    const chatWin = bar.querySelector(".ai-bar-chat-window");
    if (chatWin) requestAnimationFrame(() => {
      const h = _getTabChatAHeight(tab);
      chatWin.style.height = h + "px";
      chatWin.style.maxHeight = h + "px";
      chatWin.classList.add("open");
      _tabChatState[tab] = "a";
      const msgs = chatWin.querySelector(".ai-bar-messages");
      if (msgs) setTimeout(() => {
        msgs.scrollTop = msgs.scrollHeight;
      }, 50);
    });
  }
  function closeChatBar2(tab) {
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return;
    const chatWin = bar.querySelector(".ai-bar-chat-window");
    if (chatWin) chatWin.classList.remove("open");
    _tabChatState[tab] = void 0;
    const inputs = bar.querySelectorAll("input, textarea");
    inputs.forEach((i) => i.blur());
    activeChatBar = null;
  }
  function toggleChatBar(tab) {
    if (activeChatBar === tab) {
      closeChatBar2(tab);
    } else {
      openChatBar2(tab);
    }
  }
  function closeAllChatBars2(resetActive = true) {
    ["inbox", "tasks", "notes", "me", "evening", "finance", "health", "projects"].forEach((t) => {
      const bar = document.getElementById(t + "-ai-bar");
      if (!bar) return;
      const chatWin = bar.querySelector(".ai-bar-chat-window");
      if (chatWin) {
        chatWin.classList.remove("open");
        _tabChatState[t] = void 0;
      }
      const inputs = bar.querySelectorAll("input, textarea");
      inputs.forEach((i) => i.blur());
    });
    if (resetActive) activeChatBar = null;
  }
  Object.assign(window, {
    getOWLPersonality: getOWLPersonality2,
    getAIContext: getAIContext2,
    getMeStatsContext,
    safeAgentReply,
    INBOX_SYSTEM_PROMPT,
    _fetchAI,
    callAI: callAI2,
    callOwlChat: callOwlChat2,
    callAIWithHistory,
    CHAT_STORE_MAX,
    CHAT_STORE_KEYS,
    saveChatMsg,
    loadChatMsgs,
    restoreChatUI: restoreChatUI2,
    _renderInboxChatMsg,
    openChatBar: openChatBar2,
    closeChatBar: closeChatBar2,
    toggleChatBar,
    closeAllChatBars: closeAllChatBars2
  });

  // src/owl/inbox-board.js
  var _tabChatState2 = {};
  function _getTabChatAHeight2(tab) {
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return 220;
    const inputBox = bar.querySelector(".ai-bar-input-box");
    const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 100;
    const boardEl = document.getElementById("owl-tab-board-" + tab);
    const boardBottom = boardEl && boardEl.getBoundingClientRect().bottom > 0 ? boardEl.getBoundingClientRect().bottom + 8 : 80;
    const kbH = window.visualViewport ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
    if (kbH > 250) {
      return Math.max(150, inputTop - boardBottom - 8);
    }
    return Math.max(200, Math.min(320, inputTop - boardBottom - 8));
  }
  function _getTabChatBHeight2(tab) {
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return 400;
    const inputBox = bar.querySelector(".ai-bar-input-box");
    const inputTop = inputBox ? inputBox.getBoundingClientRect().top : window.innerHeight - 100;
    return Math.max(250, inputTop - 80 - 8);
  }
  function openChatBarNoKeyboard(tab) {
    if (_tabChatState2[tab]) return;
    try {
      closeOwlChat2();
    } catch (e) {
    }
    ["inbox", "tasks", "me", "evening", "finance", "health", "projects"].forEach((t) => {
      if (t !== tab) closeChatBar(t);
    });
    activeChatBar = tab;
    const bar = document.getElementById(tab + "-ai-bar");
    if (!bar) return;
    restoreChatUI(tab);
    const chatWin = bar.querySelector(".ai-bar-chat-window");
    if (!chatWin) return;
    const h = _getTabChatAHeight2(tab);
    chatWin.style.height = h + "px";
    chatWin.style.maxHeight = h + "px";
    chatWin.classList.add("open");
    _tabChatState2[tab] = "a";
  }
  function setupChatBarSwipe2() {
    ["inbox", "tasks", "notes", "me", "evening", "finance", "health", "projects"].forEach((tab) => {
      const bar = document.getElementById(tab + "-ai-bar");
      if (!bar) return;
      const chatWin = bar.querySelector(".ai-bar-chat-window");
      const messages = bar.querySelector(".ai-bar-messages");
      if (!chatWin) return;
      const handleEl = chatWin.querySelector(".ai-bar-chat-handle");
      if (!handleEl) return;
      let winStartY = 0, winStartX = 0, winStartVpTop = 0, isDragging = false, startTime = 0;
      handleEl.addEventListener("touchstart", (e) => {
        winStartY = e.touches[0].clientY;
        winStartX = e.touches[0].clientX;
        winStartVpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
        startTime = Date.now();
        isDragging = false;
        chatWin.style.transition = "none";
        chatWin.style.opacity = "1";
        if (_tabChatState2[tab]) {
          chatWin.style.height = chatWin.offsetHeight + "px";
        }
        chatWin.style.transform = "translateY(0)";
      }, { passive: true });
      handleEl.addEventListener("touchmove", (e) => {
        e.preventDefault();
        const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
        const vpDelta = vpTop - winStartVpTop;
        const dy = e.touches[0].clientY - winStartY + vpDelta;
        const absDy = Math.abs(dy);
        const dx = Math.abs(e.touches[0].clientX - winStartX);
        const kbOff = !(window.visualViewport && window.innerHeight - window.visualViewport.height > 250);
        const state = _tabChatState2[tab];
        if (state === "b") {
          if (!isDragging) {
            if (absDy < 8) return;
            if (dx > absDy * 1.5) return;
            isDragging = true;
          }
          if (dy <= 0) {
            chatWin.style.transform = "translateY(0)";
            return;
          }
          chatWin.style.transform = `translateY(${Math.min(dy * 0.7, 140)}px)`;
          chatWin.style.opacity = Math.max(0.7, 1 - dy / 400).toFixed(2);
          return;
        }
        if (!isDragging) {
          if (absDy < 8) return;
          if (dx > absDy * 1.5) return;
          isDragging = true;
        }
        if (dy < 0 && kbOff) {
          const maxH = _getTabChatBHeight2(tab);
          const startH = parseFloat(chatWin.style.height) || chatWin.offsetHeight;
          chatWin.style.height = Math.min(maxH, startH - dy) + "px";
          chatWin.style.transform = "translateY(0)";
          chatWin.style.opacity = "1";
          return;
        }
        if (dy > 0) {
          chatWin.style.transform = `translateY(${dy}px)`;
          chatWin.style.opacity = Math.max(0, 1 - dy / 280).toFixed(2);
        }
      }, { passive: false });
      const cancelHandler = () => {
        chatWin.style.transition = "transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease";
        chatWin.style.transform = "translateY(0)";
        chatWin.style.opacity = "1";
        setTimeout(() => {
          chatWin.style.transition = "";
          chatWin.style.transform = "";
          chatWin.style.opacity = "";
        }, 280);
        isDragging = false;
      };
      handleEl.addEventListener("touchcancel", cancelHandler, { passive: true });
      handleEl.addEventListener("touchend", (e) => {
        const finalDy = e.changedTouches[0].clientY - winStartY;
        const elapsed = Date.now() - startTime;
        const velocity = finalDy / elapsed;
        isDragging = false;
        const kbOffEnd = !(window.visualViewport && window.innerHeight - window.visualViewport.height > 250);
        const stateEnd = _tabChatState2[tab];
        if (stateEnd === "b") {
          if (finalDy > 80 || velocity > 0.5) {
            const aH = _getTabChatAHeight2(tab);
            _tabChatState2[tab] = "a";
            chatWin.style.transition = "height 0.32s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease";
            chatWin.style.height = aH + "px";
            chatWin.style.maxHeight = aH + "px";
            chatWin.style.transform = "translateY(0)";
            chatWin.style.opacity = "1";
            setTimeout(() => chatWin.style.transition = "", 320);
          } else {
            const bH = _getTabChatBHeight2(tab);
            chatWin.style.transition = "height 0.28s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease";
            chatWin.style.height = bH + "px";
            chatWin.style.transform = "translateY(0)";
            chatWin.style.opacity = "1";
            setTimeout(() => chatWin.style.transition = "", 280);
          }
          return;
        }
        if (finalDy < -40 && kbOffEnd) {
          const bH = _getTabChatBHeight2(tab);
          _tabChatState2[tab] = "b";
          chatWin.style.transition = "height 0.38s cubic-bezier(0.3,0.82,0,1)";
          chatWin.style.height = bH + "px";
          chatWin.style.maxHeight = bH + "px";
          chatWin.style.transform = "";
          chatWin.style.opacity = "1";
          const msgs = chatWin.querySelector(".ai-bar-messages");
          if (msgs) setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 380);
          setTimeout(() => chatWin.style.transition = "", 380);
        } else if (finalDy > 80 || velocity > 0.5) {
          chatWin.style.transition = "transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease";
          chatWin.style.transform = "translateY(110%)";
          chatWin.style.opacity = "0";
          setTimeout(() => {
            closeChatBar(tab);
            chatWin.style.transition = "";
            chatWin.style.transform = "";
            chatWin.style.opacity = "";
          }, 280);
        } else {
          const aH = _getTabChatAHeight2(tab);
          chatWin.style.transition = "height 0.28s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease";
          chatWin.style.height = aH + "px";
          chatWin.style.transform = "translateY(0)";
          chatWin.style.opacity = "1";
          setTimeout(() => chatWin.style.transition = "", 280);
        }
      }, { passive: true });
      bar.addEventListener("touchmove", (e) => {
        if (messages && messages.contains(e.target)) return;
        const textarea = bar.querySelector("textarea");
        if (textarea && textarea.contains(e.target)) return;
        e.preventDefault();
      }, { passive: false });
      const inputBox = bar.querySelector(".ai-bar-input-box");
      if (inputBox) {
        let _inStartY = 0, _inSwiping = false;
        inputBox.addEventListener("touchstart", (e) => {
          _inStartY = e.touches[0].clientY;
          _inSwiping = false;
        }, { passive: true });
        inputBox.addEventListener("touchmove", (e) => {
          if (_tabChatState2[tab]) return;
          const dy = _inStartY - e.touches[0].clientY;
          if (dy > 20) {
            _inSwiping = true;
            e.preventDefault();
          }
        }, { passive: false });
        inputBox.addEventListener("touchend", (e) => {
          if (_inSwiping) {
            _inSwiping = false;
            e.preventDefault();
            openChatBarNoKeyboard(tab);
          }
        }, { passive: false });
      }
    });
    let docTouchStartY = 0, docTouchStartX = 0;
    document.addEventListener("touchstart", (e) => {
      docTouchStartY = e.touches[0].clientY;
      docTouchStartX = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
      if (!activeChatBar) return;
      const bar = document.getElementById(activeChatBar + "-ai-bar");
      if (!bar) return;
      if (bar.contains(e.target)) return;
      const tabBar = document.getElementById("tab-bar");
      if (tabBar && tabBar.contains(e.target)) return;
      const dy = Math.abs(e.changedTouches[0].clientY - docTouchStartY);
      const dx = Math.abs(e.changedTouches[0].clientX - docTouchStartX);
      if (dy > 10 || dx > 10) return;
      closeChatBar(activeChatBar);
    }, { passive: true });
  }
  var OWL_BOARD_KEY = "nm_owl_board";
  var OWL_BOARD_SEEN_KEY = "nm_owl_board_seen";
  var OWL_BOARD_TS_KEY = "nm_owl_board_ts";
  var OWL_BOARD_INTERVAL = 3 * 60 * 1e3;
  var _owlBoardMessages = [];
  var _owlBoardGenerating = false;
  var _owlBoardTimer = null;
  function getOwlBoardMessages2() {
    try {
      return JSON.parse(localStorage.getItem(OWL_BOARD_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveOwlBoardMessages(arr) {
    localStorage.setItem(OWL_BOARD_KEY, JSON.stringify(arr.slice(-30)));
  }
  function getSchedule() {
    const s = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    const sc = s.schedule || {};
    const parseH = (str, def) => {
      if (!str) return def;
      const h = parseInt(str.split(":")[0]);
      return isNaN(h) ? def : h;
    };
    return {
      wakeUp: parseH(sc.wakeUp, 7),
      workStart: parseH(sc.workStart, 9),
      workEnd: parseH(sc.workEnd, 18),
      bedTime: parseH(sc.bedTime, 23)
    };
  }
  function getDayPhase() {
    const sc = getSchedule();
    const h = (/* @__PURE__ */ new Date()).getHours();
    if (h >= sc.bedTime || h < sc.wakeUp - 2) return "silent";
    if (h < sc.wakeUp) return "dawn";
    if (h < sc.workStart) return "morning";
    if (h < sc.workEnd) return "work";
    if (h < sc.bedTime - 1) return "evening";
    return "night";
  }
  var OWL_CD_KEY = "nm_owl_cooldowns";
  function _getOwlCooldowns() {
    try {
      return JSON.parse(localStorage.getItem(OWL_CD_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function owlCdExpired(topic, ms) {
    const cd = _getOwlCooldowns();
    return !cd[topic] || Date.now() - cd[topic] > ms;
  }
  function setOwlCd(topic) {
    const cd = _getOwlCooldowns();
    cd[topic] = Date.now();
    const cutoff = Date.now() - 48 * 60 * 60 * 1e3;
    Object.keys(cd).forEach((k) => {
      if (cd[k] < cutoff) delete cd[k];
    });
    localStorage.setItem(OWL_CD_KEY, JSON.stringify(cd));
  }
  function checkOwlBoardTrigger() {
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) return false;
    const phase = getDayPhase();
    if (phase === "silent" || phase === "dawn") return false;
    const now = /* @__PURE__ */ new Date();
    const todayStr = now.toDateString();
    const hour = now.getHours();
    const min = now.getMinutes();
    const sc = getSchedule();
    if (owlCdExpired("phase_pulse", 45 * 60 * 1e3)) return true;
    const tasks = getTasks().filter((t) => t.status !== "done");
    for (const t of tasks) {
      const m = t.title.match(/(\d{1,2}):(\d{2})/);
      if (m) {
        const diff = parseInt(m[1]) * 60 + parseInt(m[2]) - (hour * 60 + min);
        if (diff > 0 && diff <= 65 && owlCdExpired("deadline_" + t.id, 30 * 60 * 1e3)) return true;
      }
    }
    if (phase === "evening" || phase === "night") {
      const habits = getHabits();
      const log = getHabitLog();
      const todayLog = log[todayStr] || {};
      const atRisk = habits.filter((h) => h.days.includes(now.getDay()) && !todayLog[h.id]);
      if (atRisk.length > 0 && owlCdExpired("streak_risk", 60 * 60 * 1e3)) return true;
    }
    const stuck = tasks.filter((t) => t.createdAt && t.createdAt < Date.now() - 3 * 24 * 60 * 60 * 1e3);
    if (stuck.length > 0 && owlCdExpired("stuck_tasks", 6 * 60 * 60 * 1e3)) return true;
    if (phase === "work" || phase === "evening") {
      const habits = getHabits();
      const log = getHabitLog();
      const todayLog = log[todayStr] || {};
      const pending = habits.filter((h) => h.days.includes(now.getDay()) && !todayLog[h.id]);
      if (pending.length > 0 && owlCdExpired("habits_check", 3 * 60 * 60 * 1e3)) return true;
    }
    if (phase === "work" || phase === "evening") {
      const habits = getHabits();
      const log = getHabitLog();
      const todayLog = log[todayStr] || {};
      const todayH = habits.filter((h) => h.days.includes(now.getDay()));
      if (todayH.length > 0 && todayH.every((h) => todayLog[h.id]) && owlCdExpired("habits_done", 8 * 60 * 60 * 1e3)) return true;
    }
    try {
      const budget = getFinBudget();
      if (budget.total > 0) {
        const from = getFinPeriodRange("month");
        const exp = getFinance().filter((t) => t.ts >= from && t.type === "expense").reduce((s, t) => s + t.amount, 0);
        if (exp / budget.total >= 0.8 && owlCdExpired("budget_warn", 4 * 60 * 60 * 1e3)) return true;
      }
    } catch (e) {
    }
    if (phase === "evening" || phase === "night") {
      const s = JSON.parse(localStorage.getItem("nm_evening_summary") || "null");
      if ((!s || new Date(s.date).toDateString() !== todayStr) && owlCdExpired("evening_prompt", 4 * 60 * 60 * 1e3)) return true;
    }
    if (phase === "morning" && owlCdExpired("morning_brief", 3 * 60 * 60 * 1e3)) return true;
    if (now.getDay() === 1 && (phase === "morning" || phase === "work") && owlCdExpired("week_start", 6 * 60 * 60 * 1e3)) return true;
    if (now.getDay() === 5 && phase === "evening" && owlCdExpired("week_end", 6 * 60 * 60 * 1e3)) return true;
    return false;
  }
  function getOwlBoardContext2() {
    const now = /* @__PURE__ */ new Date();
    const todayStr = now.toDateString();
    const hour = now.getHours();
    const min = now.getMinutes();
    const weekDay = now.getDay();
    const phase = getDayPhase();
    const sc = getSchedule();
    const critical = [];
    const important = [];
    const normal = [];
    const phaseLabels = {
      morning: `[\u0424\u0410\u0417\u0410: \u0420\u0410\u041D\u041E\u041A] \u0427\u0430\u0441 \u043F\u043B\u0430\u043D\u0443\u0432\u0430\u043D\u043D\u044F. \u0424\u043E\u043A\u0443\u0441: \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442\u0438 \u043D\u0430 \u0434\u0435\u043D\u044C, \u043C\u043E\u0442\u0438\u0432\u0430\u0446\u0456\u044F, \u0449\u043E \u043D\u0430\u0439\u0432\u0430\u0436\u043B\u0438\u0432\u0456\u0448\u0435 \u0437\u0440\u043E\u0431\u0438\u0442\u0438. \u041F\u0456\u0434\u0439\u043E\u043C \u043E ${sc.wakeUp}:00, \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u0434\u0435\u043D\u044C \u043F\u043E\u0447\u0438\u043D\u0430\u0454\u0442\u044C\u0441\u044F \u043E ${sc.workStart}:00.`,
      work: `[\u0424\u0410\u0417\u0410: \u0420\u041E\u0411\u041E\u0422\u0410] \u0410\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u0447\u0430\u0441. \u0424\u043E\u043A\u0443\u0441: \u043F\u0440\u043E\u0433\u0440\u0435\u0441 \u0437\u0430\u0434\u0430\u0447, \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F \u0437\u0432\u0438\u0447\u043E\u043A, \u043F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0441\u0442\u0430\u043D.`,
      evening: `[\u0424\u0410\u0417\u0410: \u0412\u0415\u0427\u0406\u0420] \u0427\u0430\u0441 \u043F\u0456\u0434\u0441\u0443\u043C\u043A\u0456\u0432. \u0424\u043E\u043A\u0443\u0441: \u0449\u043E \u0437\u0440\u043E\u0431\u043B\u0435\u043D\u043E, \u044F\u043A\u0456 \u0437\u0432\u0438\u0447\u043A\u0438 \u0449\u0435 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u0456, \u043F\u0456\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0434\u043E \u0437\u0430\u0432\u0442\u0440\u0430. \u0420\u043E\u0431\u043E\u0442\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0443\u0454\u0442\u044C\u0441\u044F \u043E ${sc.workEnd}:00.`,
      night: `[\u0424\u0410\u0417\u0410: \u041D\u0406\u0427] \u0422\u0438\u0445\u0438\u0439 \u0447\u0430\u0441. \u0422\u0456\u043B\u044C\u043A\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u0435 \u2014 \u0437\u0432\u0438\u0447\u043A\u0438 \u044F\u043A\u0456 \u043C\u043E\u0436\u043D\u0430 \u0449\u0435 \u0432\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0438 \u0432\u0438\u043A\u043E\u043D\u0430\u0442\u0438. \u041A\u043E\u0440\u043E\u0442\u043A\u043E.`
    };
    if (phaseLabels[phase]) normal.push(phaseLabels[phase]);
    normal.push(`\u0417\u0430\u0440\u0430\u0437 ${now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}.`);
    const tasks = getTasks();
    const activeTasks = tasks.filter((t) => t.status !== "done");
    const urgent = activeTasks.filter((t) => {
      const m = t.title.match(/(\d{1,2}):(\d{2})/);
      if (!m) return false;
      const diff = parseInt(m[1]) * 60 + parseInt(m[2]) - (hour * 60 + min);
      return diff > 0 && diff <= 65;
    });
    urgent.forEach((t) => {
      critical.push(`[\u041A\u0420\u0418\u0422\u0418\u0427\u041D\u041E] \u0414\u0435\u0434\u043B\u0430\u0439\u043D \u0447\u0435\u0440\u0435\u0437 ~\u0433\u043E\u0434\u0438\u043D\u0443: "${t.title}".`);
    });
    const stuck = activeTasks.filter((t) => t.createdAt && t.createdAt < Date.now() - 3 * 24 * 60 * 60 * 1e3);
    stuck.forEach((t) => {
      important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0417\u0430\u0434\u0430\u0447\u0430 "${t.title}" \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0430 \u0432\u0436\u0435 3+ \u0434\u043D\u0456.`);
    });
    if (activeTasks.length > 0) {
      normal.push(`\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438\u0445 \u0437\u0430\u0434\u0430\u0447: ${activeTasks.length}. ${activeTasks.slice(0, 3).map((t) => t.title).join(", ")}${activeTasks.length > 3 ? " \u0456 \u0449\u0435..." : ""}.`);
    } else {
      normal.push("\u0412\u0441\u0456 \u0437\u0430\u0434\u0430\u0447\u0456 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E.");
    }
    const habits = getHabits();
    const buildHabits = habits.filter((h) => h.type !== "quit");
    const quitHabits = habits.filter((h) => h.type === "quit");
    const log = getHabitLog();
    const todayLog = log[todayStr] || {};
    const todayHabits = buildHabits.filter((h) => h.days.includes(now.getDay()));
    const doneHabits = todayHabits.filter((h) => todayLog[h.id]);
    const pendingHabits = todayHabits.filter((h) => !todayLog[h.id]);
    if (todayHabits.length > 0 && pendingHabits.length === 0) {
      important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0412\u0441\u0456 ${todayHabits.length} \u0437\u0432\u0438\u0447\u043E\u043A \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456!`);
    }
    if ((phase === "evening" || phase === "night") && pendingHabits.length > 0) {
      const atRisk = pendingHabits.filter((h) => {
        const streak = Object.values(log).filter((d) => d[h.id]).length;
        return streak >= 3;
      });
      if (atRisk.length > 0) {
        const details = atRisk.map((h) => {
          const streak = Object.values(log).filter((d) => d[h.id]).length;
          return `"${h.name}" (\u0432\u0436\u0435 ${streak} \u0434\u043D\u0456\u0432 \u043F\u0456\u0434\u0440\u044F\u0434, \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456 \u0449\u0435 \u043D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E)`;
        });
        critical.push(`[\u041A\u0420\u0418\u0422\u0418\u0427\u041D\u041E] \u0417\u0432\u0438\u0447\u043A\u0438 \u0437 \u0441\u0435\u0440\u0456\u0454\u044E \u043F\u0456\u0434 \u0437\u0430\u0433\u0440\u043E\u0437\u043E\u044E \u2014 \u0434\u0435\u043D\u044C \u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0454\u0442\u044C\u0441\u044F \u0430 \u0442\u0438 \u0449\u0435 \u043D\u0435 \u0437\u0440\u043E\u0431\u0438\u0432: ${details.join(", ")}.`);
      }
    }
    if ((phase === "work" || phase === "evening") && pendingHabits.length > 0) {
      important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u041D\u0435 \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E \u0437\u0432\u0438\u0447\u043E\u043A: ${pendingHabits.map((h) => h.name).join(", ")}.`);
    }
    if (todayHabits.length > 0) {
      normal.push(`\u0417\u0432\u0438\u0447\u043A\u0438 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${doneHabits.length}/${todayHabits.length}.`);
    }
    if (quitHabits.length > 0) {
      const todayIso = now.toISOString().slice(0, 10);
      const notHeldToday = quitHabits.filter((h) => getQuitStatus(h.id).lastHeld !== todayIso);
      if ((phase === "evening" || phase === "night") && notHeldToday.length > 0) {
        important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u041D\u0435 \u0432\u0456\u0434\u043C\u0456\u0447\u0435\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456 (\u043A\u0438\u043D\u0443\u0442\u0438): ${notHeldToday.map((h) => '"' + h.name + '"').join(", ")}.`);
      }
      quitHabits.forEach((h) => {
        const s = getQuitStatus(h.id);
        const streak = s.streak || 0;
        const milestones = [7, 14, 21, 30, 60, 90];
        if (milestones.includes(streak) && owlCdExpired("quit_milestone_" + h.id + "_" + streak, 24 * 60 * 60 * 1e3)) {
          important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] ${streak} \u0434\u043D\u0456\u0432 \u0431\u0435\u0437 "${h.name}"! \u{1F389}`);
        }
      });
      const quitInfo = quitHabits.map((h) => `"${h.name}": ${getQuitStatus(h.id).streak || 0} \u0434\u043D`);
      normal.push(`\u0427\u0435\u043B\u0435\u043D\u0434\u0436\u0456: ${quitInfo.join(", ")}.`);
    }
    try {
      const budget = getFinBudget();
      if (budget.total > 0) {
        const from = getFinPeriodRange("month");
        const txs = getFinance().filter((t) => t.ts >= from && t.type === "expense");
        const exp = txs.reduce((s, t) => s + t.amount, 0);
        const pct = Math.round(exp / budget.total * 100);
        if (exp > budget.total) {
          important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0411\u044E\u0434\u0436\u0435\u0442 \u043F\u0435\u0440\u0435\u0432\u0438\u0449\u0435\u043D\u043E! \u0412\u0438\u0442\u0440\u0430\u0447\u0435\u043D\u043E ${formatMoney(exp)} \u0437 ${formatMoney(budget.total)} (${pct}%).`);
        } else if (pct >= 80) {
          important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0412\u0438\u0442\u0440\u0430\u0447\u0435\u043D\u043E ${pct}% \u043C\u0456\u0441\u044F\u0447\u043D\u043E\u0433\u043E \u0431\u044E\u0434\u0436\u0435\u0442\u0443.`);
        } else {
          normal.push(`\u0411\u044E\u0434\u0436\u0435\u0442 \u043C\u0456\u0441\u044F\u0446\u044F: ${formatMoney(exp)} / ${formatMoney(budget.total)} (${pct}%).`);
        }
        if (txs.length >= 3) {
          const bycat = {};
          txs.forEach((t) => {
            if (!bycat[t.category]) bycat[t.category] = [];
            bycat[t.category].push(t.amount);
          });
          const lastTx = txs[0];
          if (lastTx && bycat[lastTx.category] && bycat[lastTx.category].length >= 2) {
            const avg = bycat[lastTx.category].reduce((a, b) => a + b, 0) / bycat[lastTx.category].length;
            if (lastTx.amount > avg * 2.5 && owlCdExpired("unusual_tx_" + lastTx.id, 8 * 60 * 60 * 1e3)) {
              important.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u041D\u0435\u0437\u0432\u0438\u0447\u043D\u0430 \u0432\u0438\u0442\u0440\u0430\u0442\u0430: ${formatMoney(lastTx.amount)} \u043D\u0430 "${lastTx.category}" \u2014 \u0432\u0438\u0449\u0435 \u0437\u0432\u0438\u0447\u043D\u043E\u0433\u043E \u0432\u0434\u0432\u0456\u0447\u0456.`);
            }
          }
        }
      }
    } catch (e) {
    }
    if (phase === "evening" || phase === "night") {
      const s = JSON.parse(localStorage.getItem("nm_evening_summary") || "null");
      if (!s || new Date(s.date).toDateString() !== todayStr) {
        important.push("[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0412\u0435\u0447\u0456\u0440 \u2014 \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0434\u043D\u044F \u0449\u0435 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E.");
      }
    }
    if (weekDay === 1 && (phase === "morning" || phase === "work")) {
      normal.push("[\u0422\u0418\u0416\u0414\u0415\u041D\u042C] \u041D\u043E\u0432\u0438\u0439 \u0442\u0438\u0436\u0434\u0435\u043D\u044C. \u041E\u0433\u043B\u044F\u0434 \u043F\u043B\u0430\u043D\u0456\u0432 \u0456 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0438\u0445 \u0437\u0430\u0434\u0430\u0447.");
    }
    if (weekDay === 5 && phase === "evening") {
      const doneTasks = tasks.filter((t) => t.status === "done" && t.updatedAt && Date.now() - t.updatedAt < 7 * 24 * 60 * 60 * 1e3);
      normal.push(`[\u0422\u0418\u0416\u0414\u0415\u041D\u042C] \u041A\u0456\u043D\u0435\u0446\u044C \u0442\u0438\u0436\u043D\u044F. \u0417\u0430\u043A\u0440\u0438\u0442\u043E \u0437\u0430\u0434\u0430\u0447 \u0437\u0430 \u0442\u0438\u0436\u0434\u0435\u043D\u044C: ${doneTasks.length}.`);
    }
    const activeTabs = [];
    if (tasks.length > 0 || getHabits().length > 0) activeTabs.push("\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0456\u0441\u0442\u044C (\u0437\u0430\u0434\u0430\u0447\u0456, \u0437\u0432\u0438\u0447\u043A\u0438)");
    try {
      if (getNotes().length > 0) activeTabs.push("\u041D\u043E\u0442\u0430\u0442\u043A\u0438");
    } catch (e) {
    }
    try {
      if (getFinance().length > 0) activeTabs.push("\u0424\u0456\u043D\u0430\u043D\u0441\u0438");
    } catch (e) {
    }
    try {
      if (JSON.parse(localStorage.getItem("nm_health_cards") || "[]").length > 0) activeTabs.push("\u0417\u0434\u043E\u0440\u043E\u0432'\u044F");
    } catch (e) {
    }
    try {
      if (JSON.parse(localStorage.getItem("nm_projects") || "[]").length > 0) activeTabs.push("\u041F\u0440\u043E\u0435\u043A\u0442\u0438");
    } catch (e) {
    }
    try {
      if (JSON.parse(localStorage.getItem("nm_moments") || "[]").length > 0) activeTabs.push("\u0412\u0435\u0447\u0456\u0440 (\u043C\u043E\u043C\u0435\u043D\u0442\u0438 \u0434\u043D\u044F)");
    } catch (e) {
    }
    if (activeTabs.length > 0) {
      normal.push(`[\u0410\u041A\u0422\u0418\u0412\u041D\u0406 \u0412\u041A\u041B\u0410\u0414\u041A\u0418] \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454: ${activeTabs.join(", ")}. \u0426\u0456\u043A\u0430\u0432\u0441\u044F \u0422\u0406\u041B\u042C\u041A\u0418 \u0446\u0438\u043C\u0438 \u0442\u0435\u043C\u0430\u043C\u0438.`);
    }
    return [...critical, ...important, ...normal].join(" ");
  }
  async function generateOwlBoardMessage() {
    if (_owlBoardGenerating) return;
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) return;
    _owlBoardGenerating = true;
    const context = getOwlBoardContext2();
    const existing = getOwlBoardMessages2();
    const recentTexts = existing.slice(0, 5).map((m) => m.text).join(" | ");
    const boardHistory = existing.slice(0, 20).map((m) => {
      const ago = Date.now() - (m.id || 0);
      const hours = Math.floor(ago / 36e5);
      const when = hours < 1 ? "\u0449\u043E\u0439\u043D\u043E" : hours < 24 ? hours + " \u0433\u043E\u0434 \u0442\u043E\u043C\u0443" : Math.floor(hours / 24) + " \u0434\u043D \u0442\u043E\u043C\u0443";
      return `[${when}] ${m.text}`;
    }).join("\n");
    const now = /* @__PURE__ */ new Date();
    const phase = getDayPhase();
    const timeStr = now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    const phaseInstr = {
      morning: "\u0420\u0430\u043D\u043E\u043A \u2014 \u0442\u0432\u043E\u044F \u0440\u043E\u043B\u044C: \u043D\u0430\u0434\u0438\u0445\u043D\u0443\u0442\u0438 \u0456 \u0434\u043E\u043F\u043E\u043C\u043E\u0433\u0442\u0438 \u0441\u0444\u043E\u043A\u0443\u0441\u0443\u0432\u0430\u0442\u0438\u0441\u044C \u043D\u0430 \u0433\u043E\u043B\u043E\u0432\u043D\u043E\u043C\u0443.",
      work: "\u0420\u043E\u0431\u043E\u0447\u0438\u0439 \u0447\u0430\u0441 \u2014 \u0442\u0432\u043E\u044F \u0440\u043E\u043B\u044C: \u0442\u0440\u0438\u043C\u0430\u0442\u0438 \u0432 \u043A\u0443\u0440\u0441\u0456 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0443, \u043C'\u044F\u043A\u043E \u043D\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u0442\u0438 \u043F\u0440\u043E \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0435.",
      evening: "\u0412\u0435\u0447\u0456\u0440 \u2014 \u0442\u0432\u043E\u044F \u0440\u043E\u043B\u044C: \u0434\u043E\u043F\u043E\u043C\u043E\u0433\u0442\u0438 \u043F\u0456\u0434\u0431\u0438\u0442\u0438 \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0434\u043D\u044F, \u043D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0441\u0442\u0440\u0456\u043A\u0438.",
      night: "\u041D\u0456\u0447 \u2014 \u0433\u043E\u0432\u043E\u0440\u0438 \u0442\u0456\u043B\u044C\u043A\u0438 \u043F\u0440\u043E \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u0435. \u0414\u0443\u0436\u0435 \u043A\u043E\u0440\u043E\u0442\u043A\u043E."
    };
    const systemPrompt = getOWLPersonality() + `

\u0417\u0430\u0440\u0430\u0437: ${timeStr}. ${phaseInstr[phase] || ""}

\u0422\u0438 \u043F\u0438\u0448\u0435\u0448 \u041A\u041E\u0420\u041E\u0422\u041A\u0415 \u043F\u0440\u043E\u0430\u043A\u0442\u0438\u0432\u043D\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0434\u043B\u044F \u0442\u0430\u0431\u043B\u043E \u0432 Inbox. \u0426\u0435 \u041D\u0415 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043D\u0430 \u0437\u0430\u043F\u0438\u0442 \u2014 \u0446\u0435 \u0442\u0432\u043E\u044F \u0456\u043D\u0456\u0446\u0456\u0430\u0442\u0438\u0432\u0430.

\u0422\u0412\u041E\u0407 \u041F\u041E\u041F\u0415\u0420\u0415\u0414\u041D\u0406 \u041F\u041E\u0412\u0406\u0414\u041E\u041C\u041B\u0415\u041D\u041D\u042F (\u043F\u0430\u043C'\u044F\u0442\u0430\u0439 \u0449\u043E \u0432\u0436\u0435 \u043A\u0430\u0437\u0430\u0432, \u0431\u0443\u0434\u0443\u0439 \u0434\u0456\u0430\u043B\u043E\u0433, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0439\u0441\u044F):
${boardHistory || "(\u0449\u0435 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u043A\u0430\u0437\u0430\u0432)"}

\u0429\u041E \u0422\u0418 \u0417\u041D\u0410\u0404\u0428 \u041F\u0420\u041E \u041A\u041E\u0420\u0418\u0421\u0422\u0423\u0412\u0410\u0427\u0410 (\u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0434\u043B\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u0456\u0437\u0430\u0446\u0456\u0457 \u2014 \u0447\u0456\u043F\u0438 \u0456 \u043F\u043E\u0440\u0430\u0434\u0438 \u043C\u0430\u044E\u0442\u044C \u0432\u0440\u0430\u0445\u043E\u0432\u0443\u0432\u0430\u0442\u0438 \u0445\u0442\u043E \u0446\u044F \u043B\u044E\u0434\u0438\u043D\u0430):
${localStorage.getItem("nm_memory") || "(\u0449\u0435 \u043D\u0435 \u0437\u043D\u0430\u044E)"}

\u041F\u0420\u0406\u041E\u0420\u0418\u0422\u0415\u0422 \u041F\u041E\u0412\u0406\u0414\u041E\u041C\u041B\u0415\u041D\u042C:
1. \u042F\u043A\u0449\u043E \u0454 [\u041A\u0420\u0418\u0422\u0418\u0427\u041D\u041E] \u2014 \u043F\u0438\u0448\u0438 \u0422\u0406\u041B\u042C\u041A\u0418 \u043F\u0440\u043E \u0446\u0435. \u041D\u0456\u0447\u043E\u0433\u043E \u0456\u043D\u0448\u043E\u0433\u043E.
2. \u042F\u043A\u0449\u043E \u0454 [\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0456 \u043D\u0435\u043C\u0430\u0454 [\u041A\u0420\u0418\u0422\u0418\u0427\u041D\u041E] \u2014 \u043F\u0438\u0448\u0438 \u043F\u0440\u043E \u043F\u0435\u0440\u0448\u0435 [\u0412\u0410\u0416\u041B\u0418\u0412\u041E].
3. \u042F\u043A\u0449\u043E \u0454 [\u0424\u0410\u0417\u0410] \u0430\u043B\u0435 \u043D\u0435\u043C\u0430\u0454 \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u043E\u0433\u043E/\u0432\u0430\u0436\u043B\u0438\u0432\u043E\u0433\u043E \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u043E \u0434\u043E \u0444\u0430\u0437\u0438 \u0434\u043D\u044F.
4. \u0406\u043D\u0430\u043A\u0448\u0435 \u2014 \u043E\u0431\u0435\u0440\u0438 \u043D\u0430\u0439\u0446\u0456\u043A\u0430\u0432\u0456\u0448\u0435 \u0437\u0456 \u0437\u0432\u0438\u0447\u0430\u0439\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445.

\u041F\u0420\u0410\u0412\u0418\u041B\u0410:
- \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 2 \u0440\u0435\u0447\u0435\u043D\u043D\u044F. \u041A\u043E\u0440\u043E\u0442\u043A\u043E \u0456 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E.
- \u0413\u043E\u0432\u043E\u0440\u0438 \u041B\u042E\u0414\u0421\u042C\u041A\u041E\u042E \u043C\u043E\u0432\u043E\u044E. \u041D\u0415 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0436\u0430\u0440\u0433\u043E\u043D: "\u0441\u0442\u0440\u0456\u043A", "streak", "\u0442\u0440\u0435\u043A\u0435\u0440", "\u043F\u0440\u043E\u0433\u0440\u0435\u0441 \u0437\u0430\u0434\u0430\u0447". \u0417\u0430\u043C\u0456\u0441\u0442\u044C "\u0441\u0442\u0440\u0456\u043A \u043F\u0456\u0434 \u0437\u0430\u0433\u0440\u043E\u0437\u043E\u044E" \u043A\u0430\u0436\u0438 "\u0442\u0438 \u0432\u0436\u0435 5 \u0434\u043D\u0456\u0432 \u043F\u0456\u0434\u0440\u044F\u0434 \u0431\u0456\u0433\u0430\u0432 \u2014 \u043D\u0435 \u0437\u0443\u043F\u0438\u043D\u044F\u0439\u0441\u044F, \u0431\u0456\u0436\u0438 \u0456 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456". \u0417\u0430\u043C\u0456\u0441\u0442\u044C "3 \u0437\u0430\u0434\u0430\u0447\u0456 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0456" \u043A\u0430\u0436\u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u0449\u043E \u0446\u0435 \u0437\u0430 \u0437\u0430\u0434\u0430\u0447\u0456.
- \u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 \u0444\u0430\u043A\u0442\u0438 \u0437 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0438\u0436\u0447\u0435. \u041D\u0415 \u0432\u0438\u0433\u0430\u0434\u0443\u0439 \u043B\u0456\u043C\u0456\u0442\u0438, \u0441\u0443\u043C\u0438, \u043F\u043B\u0430\u043D\u0438 \u0430\u0431\u043E \u0437\u0432\u0438\u0447\u043A\u0438 \u044F\u043A\u0438\u0445 \u043D\u0435\u043C\u0430\u0454 \u0432 \u0434\u0430\u043D\u0438\u0445.
- \u041D\u0415 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0439 \u0442\u0435 \u0449\u043E \u0432\u0436\u0435 \u043A\u0430\u0437\u0430\u0432: "${recentTexts || "\u043D\u0456\u0447\u043E\u0433\u043E"}"
- \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON: {"text":"\u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F","priority":"critical|important|normal","chips":["\u0447\u0456\u043F1","\u0447\u0456\u043F2"]}
- chips \u2014 \u043A\u043D\u043E\u043F\u043A\u0438 \u0448\u0432\u0438\u0434\u043A\u0438\u0445 \u0434\u0456\u0439. \u0422\u0406\u041B\u042C\u041A\u0418 \u0434\u0456\u0457 \u0449\u043E \u043F\u0440\u044F\u043C\u043E \u0441\u0442\u043E\u0441\u0443\u044E\u0442\u044C\u0441\u044F \u0442\u0432\u043E\u0433\u043E \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F. \u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434 \u044F\u043A\u0449\u043E \u043F\u0438\u0448\u0435\u0448 "\u0437\u0430\u043A\u0440\u0438\u0439 \u0437\u0430\u0434\u0430\u0447\u0456 X \u0456 Y" \u2192 chips: ["\u0437\u0430\u043A\u0440\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447\u0456"]. \u042F\u043A\u0449\u043E \u043F\u0438\u0448\u0435\u0448 "\u0437\u0430\u043F\u0438\u0448\u0438 \u043F\u0456\u0434\u0441\u0443\u043C\u043A\u0438" \u2192 chips: ["\u0437\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u043F\u0456\u0434\u0441\u0443\u043C\u043A\u0438"]. \u041D\u0415 \u0434\u043E\u0434\u0430\u0432\u0430\u0439 \u0432\u0438\u043F\u0430\u0434\u043A\u043E\u0432\u0456 \u0434\u0456\u0457 \u044F\u043A\u0456 \u043D\u0435 \u0437\u0433\u0430\u0434\u0443\u044E\u0442\u044C\u0441\u044F \u0432 \u0442\u0435\u043A\u0441\u0442\u0456. \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 3 \u0441\u043B\u043E\u0432\u0430 \u043A\u043E\u0436\u0435\u043D. \u042F\u043A\u0449\u043E \u043D\u0456\u0447\u043E\u0433\u043E \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u2014 []. \u0412\u0440\u0430\u0445\u043E\u0432\u0443\u0439 \u0449\u043E \u0437\u043D\u0430\u0454\u0448 \u043F\u0440\u043E \u043B\u044E\u0434\u0438\u043D\u0443 \u2014 \u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0439 \u0442\u0435 \u0449\u043E \u0457\u0439 \u043A\u043E\u0440\u0438\u0441\u043D\u043E.
- \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E.`;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `\u0414\u0430\u043D\u0456: ${context}` }
          ],
          max_tokens: 150,
          temperature: 0.8
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        _owlBoardGenerating = false;
        return;
      }
      const parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
      if (!parsed.text) {
        _owlBoardGenerating = false;
        return;
      }
      const msgs = getOwlBoardMessages2();
      msgs.unshift({ id: Date.now(), text: parsed.text, priority: parsed.priority || "normal", chips: parsed.chips || [] });
      saveOwlBoardMessages(msgs.slice(0, 3));
      localStorage.setItem(OWL_BOARD_TS_KEY, Date.now().toString());
      setOwlCd("phase_pulse");
      try {
        const chatKey = "nm_chat_inbox";
        const chatMsgs = JSON.parse(localStorage.getItem(chatKey) || "[]");
        chatMsgs.push({ role: "agent", text: "\u{1F989} " + parsed.text, ts: Date.now() });
        localStorage.setItem(chatKey, JSON.stringify(chatMsgs));
        if (typeof restoreChatUI === "function") restoreChatUI("inbox");
      } catch (e) {
      }
      if (_getOwlState() === "collapsed") _owlSetState("speech");
      renderOwlBoard2();
    } catch (e) {
    }
    _owlBoardGenerating = false;
  }
  var OWL_CHAT_KEY = "nm_owl_chat";
  var OWL_CHAT_MAX = 20;
  var _owlChatOpen = false;
  var _owlChatSending = false;
  function getOwlChatHistory() {
    try {
      return JSON.parse(localStorage.getItem(OWL_CHAT_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveOwlChatMsg(role, text) {
    const msgs = getOwlChatHistory();
    msgs.push({ role, text, ts: Date.now() });
    if (msgs.length > OWL_CHAT_MAX) msgs.splice(0, msgs.length - OWL_CHAT_MAX);
    localStorage.setItem(OWL_CHAT_KEY, JSON.stringify(msgs));
  }
  var _owlState = "speech";
  function _getOwlState() {
    return _owlTabStates["inbox"] || _owlState || "speech";
  }
  function _owlSetState(state) {
    _owlState = state;
    _owlTabStates["inbox"] = state;
    _owlTabApplyState("inbox");
    _owlChatOpen = state === "expanded";
  }
  function renderOwlBoard2() {
    _owlBoardMessages = getOwlBoardMessages2();
    if (typeof renderTabBoard === "function") renderTabBoard("inbox");
  }
  function expandOwlChat() {
    openChatBar("inbox");
  }
  function collapseOwlToSpeech() {
    _owlSetState("speech");
  }
  function toggleOwlChat() {
    if (_getOwlState() === "collapsed") {
      _owlSetState("speech");
    } else {
      _owlSetState("collapsed");
    }
  }
  function closeOwlChat2() {
    if (_getOwlState() === "expanded") {
      _owlSetState("speech");
    }
  }
  function renderOwlChatMessages() {
    const el = document.getElementById("owl-tab-msgs-inbox");
    if (!el) return;
    const chatHistory = getOwlChatHistory();
    const boardMsgs = getOwlBoardMessages2();
    if (chatHistory.length === 0 && boardMsgs.length > 0) {
      el.innerHTML = `<div class="owl-msg-agent">${escapeHtml(boardMsgs[0].text)}</div>`;
      return;
    }
    let html = "";
    if (boardMsgs.length > 0) {
      const lastBoardText = boardMsgs[0].text;
      const firstChatIsBoard = chatHistory.length > 0 && chatHistory[0].role === "agent" && chatHistory[0].text === lastBoardText;
      if (!firstChatIsBoard) {
        html += `<div class="owl-msg-agent">${escapeHtml(lastBoardText)}</div>`;
      }
    }
    chatHistory.forEach((m) => {
      const cls = m.role === "user" ? "owl-msg-user" : "owl-msg-agent";
      html += `<div class="${cls}">${escapeHtml(m.text)}</div>`;
    });
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }
  function renderOwlChips(boardMsg) {
    const el = document.getElementById("owl-tab-exp-chips-inbox");
    if (!el) return;
    if (!boardMsg || !boardMsg.chips || boardMsg.chips.length === 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = boardMsg.chips.map((c) => {
      const safe = escapeHtml(c).replace(/'/g, "&#39;");
      return `<div class="owl-chip" onclick="sendOwlReply('${safe}')">${escapeHtml(c)}</div>`;
    }).join("");
  }
  function showOwlTyping(show) {
    const el = document.getElementById("owl-tab-msgs-inbox");
    if (!el) return;
    const existing = el.querySelector(".owl-typing-wrap");
    if (existing) existing.remove();
    if (show) {
      const div = document.createElement("div");
      div.className = "owl-msg-agent owl-typing-wrap";
      div.innerHTML = '<div class="owl-typing"><span></span><span></span><span></span></div>';
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    }
    const inp = document.getElementById("owl-tab-input-inbox");
    if (inp) inp.disabled = show;
  }
  function showOwlConfirm(text) {
    const el = document.getElementById("owl-tab-msgs-inbox");
    if (!el) return;
    const banner = document.createElement("div");
    banner.className = "owl-confirm-banner";
    banner.textContent = text;
    el.appendChild(banner);
    el.scrollTop = el.scrollHeight;
    setTimeout(() => banner.remove(), 2500);
  }
  async function sendOwlReply2(text) {
    if (!text || _owlChatSending) return;
    _owlChatSending = true;
    if (_getOwlState() !== "expanded") expandOwlChat();
    saveOwlChatMsg("user", text);
    renderOwlChatMessages();
    showOwlTyping(true);
    const chipsEl = document.getElementById("owl-tab-exp-chips-inbox");
    if (chipsEl) chipsEl.innerHTML = "";
    try {
      const reply = await callOwlChat(text);
      showOwlTyping(false);
      if (reply) {
        let replyText = reply;
        let action = null;
        try {
          const parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
          if (parsed.text) replyText = parsed.text;
          if (parsed.action) action = parsed.action;
          if (parsed.chips) {
            renderOwlChips({ chips: parsed.chips });
          }
        } catch (e) {
        }
        saveOwlChatMsg("agent", replyText);
        renderOwlChatMessages();
        if (action) {
          executeOwlAction(action, text);
        }
      }
    } catch (e) {
      showOwlTyping(false);
    }
    _owlChatSending = false;
  }
  function sendOwlReplyFromInput2() {
    const inp = document.getElementById("owl-tab-input-inbox");
    if (!inp || !inp.value.trim()) return;
    const text = inp.value.trim();
    inp.value = "";
    sendOwlReply2(text);
  }
  function executeOwlAction(action, originalText) {
    if (!action || !action.action) return;
    const act = action.action;
    if (act === "complete_habit") {
      const ids = action.habit_ids || (action.habit_id ? [action.habit_id] : []);
      if (ids.length === 0) return;
      const habits = getHabits();
      const today = (/* @__PURE__ */ new Date()).toDateString();
      const log = getHabitLog();
      if (!log[today]) log[today] = {};
      let done = 0;
      ids.forEach((hid) => {
        const h = habits.find((x) => x.id === hid);
        if (h) {
          log[today][h.id] = true;
          done++;
        }
      });
      if (done > 0) {
        saveHabitLog(log);
        renderProdHabits();
        renderHabits();
        showOwlConfirm("\u0417\u0432\u0438\u0447\u043A\u0443 \u0437\u0430\u0440\u0430\u0445\u043E\u0432\u0430\u043D\u043E \u2713");
      }
      return;
    }
    if (act === "complete_task") {
      const ids = action.task_ids || (action.task_id ? [action.task_id] : []);
      if (ids.length === 0) return;
      const tasks = getTasks();
      let done = 0;
      ids.forEach((tid) => {
        const idx = tasks.findIndex((t) => t.id === tid);
        if (idx !== -1) {
          tasks[idx] = { ...tasks[idx], status: "done", completedAt: Date.now() };
          done++;
        }
      });
      if (done > 0) {
        saveTasks(tasks);
        renderTasks();
        showOwlConfirm("\u0417\u0430\u0434\u0430\u0447\u0443 \u0437\u0430\u043A\u0440\u0438\u0442\u043E \u2713");
      }
      return;
    }
    if (act === "create_task") {
      const title = (action.title || "").trim();
      if (!title) return;
      const steps = Array.isArray(action.steps) ? action.steps.map((s) => ({ id: Date.now() + Math.random(), text: s, done: false })) : [];
      const tasks = getTasks();
      tasks.unshift({ id: Date.now(), title, desc: action.desc || "", steps, status: "active", createdAt: Date.now() });
      saveTasks(tasks);
      if (currentTab === "tasks") renderTasks();
      showOwlConfirm("\u0417\u0430\u0434\u0430\u0447\u0443 \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u043E \u2713");
      return;
    }
    if (act === "create_note") {
      const noteText = (action.text || originalText || "").trim();
      if (!noteText) return;
      addNoteFromInbox(noteText, "note", action.folder || null, "agent");
      if (currentTab === "notes") renderNotes();
      showOwlConfirm("\u041D\u043E\u0442\u0430\u0442\u043A\u0443 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u2713");
      return;
    }
    if (act === "save_finance") {
      const amount = parseFloat(action.amount) || 0;
      if (amount <= 0) return;
      const type = action.fin_type || "expense";
      const category = action.category || "\u0406\u043D\u0448\u0435";
      const cats = getFinCats();
      const catList = type === "expense" ? cats.expense : cats.income;
      if (!catList.includes(category)) {
        catList.push(category);
        saveFinCats(cats);
      }
      const txs = getFinance();
      txs.unshift({ id: Date.now(), type, amount, category, comment: action.comment || originalText, ts: Date.now() });
      saveFinance(txs);
      if (currentTab === "finance") renderFinance();
      const sign = type === "expense" ? "-" : "+";
      showOwlConfirm(`${sign}${formatMoney(amount)} \xB7 ${category} \u2713`);
      return;
    }
  }
  var _owlSwipe = null;
  function owlSwipeStart(e) {
    const msgsEl = document.getElementById("owl-chat-messages");
    if (msgsEl && msgsEl.contains(e.target)) return;
    const t = e.touches[0];
    _owlSwipe = { startY: t.clientY, dy: 0, locked: false };
  }
  function owlSwipeMove(e) {
    if (!_owlSwipe) return;
    _owlSwipe.dy = e.touches[0].clientY - _owlSwipe.startY;
    if (Math.abs(_owlSwipe.dy) > 10) {
      _owlSwipe.locked = true;
      e.preventDefault();
    }
  }
  function owlSwipeEnd() {
    if (!_owlSwipe) return;
    const dy = _owlSwipe.dy;
    _owlSwipe = null;
    if (dy < -40) {
      if (_getOwlState() === "expanded") collapseOwlToSpeech();
      else if (_getOwlState() === "speech") _owlSetState("collapsed");
    } else if (dy > 40) {
      if (_getOwlState() === "speech") expandOwlChat();
      else if (_getOwlState() === "collapsed") _owlSetState("speech");
    }
  }
  function dismissOwlBoard() {
    const board = document.getElementById("owl-board");
    if (board) board.style.display = "none";
  }
  function startOwlBoardCycle2() {
    _owlAskScheduleIfNeeded();
    tryOwlBoardUpdate();
    if (_owlBoardTimer) clearInterval(_owlBoardTimer);
    _owlBoardTimer = setInterval(tryOwlBoardUpdate, OWL_BOARD_INTERVAL);
  }
  function tryOwlBoardUpdate() {
    const phase = getDayPhase();
    if (phase === "silent") return;
    const msgs = getOwlBoardMessages2();
    if (msgs.length > 0) renderOwlBoard2();
    const lastTs = parseInt(localStorage.getItem(OWL_BOARD_TS_KEY) || "0");
    const isFirstTime = msgs.length === 0 && lastTs === 0;
    const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== (/* @__PURE__ */ new Date()).toDateString();
    const shouldGenerate = isFirstTime || isNewDay || checkOwlBoardTrigger();
    if (shouldGenerate) generateOwlBoardMessage();
  }
  function _owlAskScheduleIfNeeded() {
    if (localStorage.getItem("nm_owl_schedule_asked")) return;
    const s = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    if (s.schedule && s.schedule.wakeUp) return;
    localStorage.setItem("nm_owl_schedule_asked", "1");
    localStorage.setItem("nm_owl_schedule_pending", String(Date.now()));
    setTimeout(() => {
      try {
        addInboxChatMsg("agent", "\u0429\u043E\u0431 \u043A\u0440\u0430\u0449\u0435 \u043F\u0456\u0434\u043B\u0430\u0448\u0442\u043E\u0432\u0443\u0432\u0430\u0442\u0438\u0441\u044C \u043F\u0456\u0434 \u0442\u0432\u0456\u0439 \u0440\u0438\u0442\u043C \u2014 \u0441\u043A\u0430\u0436\u0438 \u043F\u0440\u0438\u0431\u043B\u0438\u0437\u043D\u043E: \u043E \u043A\u043E\u0442\u0440\u0456\u0439 \u043F\u0440\u043E\u043A\u0438\u0434\u0430\u0454\u0448\u0441\u044F, \u043F\u043E\u0447\u0438\u043D\u0430\u0454\u0448 \u0456 \u0437\u0430\u0432\u0435\u0440\u0448\u0443\u0454\u0448 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0439 \u0434\u0435\u043D\u044C, \u0456 \u043B\u044F\u0433\u0430\u0454\u0448 \u0441\u043F\u0430\u0442\u0438? (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: \u0432\u0441\u0442\u0430\u044E 7, \u043F\u0440\u0430\u0446\u044E\u044E 9\u201318, \u0441\u043F\u043B\u044E \u043E 23)");
      } catch (e) {
      }
    }, 1e4);
  }
  function handleScheduleAnswer(text) {
    const pending = localStorage.getItem("nm_owl_schedule_pending");
    if (!pending) return false;
    const pendingTs = parseInt(pending);
    if (!isNaN(pendingTs) && Date.now() - pendingTs > 36e5) {
      localStorage.removeItem("nm_owl_schedule_pending");
      return false;
    }
    let found = 0;
    const parseH = (patterns, def) => {
      for (const re of patterns) {
        const m = text.match(re);
        if (m) {
          const h = parseInt(m[1]);
          if (!isNaN(h) && h >= 0 && h <= 23) {
            found++;
            return `${String(h).padStart(2, "0")}:00`;
          }
        }
      }
      return def;
    };
    const schedule = {
      wakeUp: parseH([/встаю\s*о?\s*(\d{1,2})/i, /прокидаюсь\s*о?\s*(\d{1,2})/i, /підйом\s*о?\s*(\d{1,2})/i], "07:00"),
      workStart: parseH([/працюю\s*з\s*(\d{1,2})/i, /починаю\s*о?\s*(\d{1,2})/i, /роботу?\s*з\s*(\d{1,2})/i, /з\s*(\d{1,2})\s*[-–до]/i], "09:00"),
      workEnd: parseH([/до\s*(\d{1,2})\b/i, /закінчую\s*о?\s*(\d{1,2})/i, /[-–]\s*(\d{1,2})\b/i], "18:00"),
      bedTime: parseH([/сплю\s*о?\s*(\d{1,2})/i, /лягаю\s*о?\s*(\d{1,2})/i, /о\s*(\d{1,2})\s*спати/i], "23:00")
    };
    if (found === 0) return false;
    localStorage.removeItem("nm_owl_schedule_pending");
    const s = JSON.parse(localStorage.getItem("nm_settings") || "{}");
    s.schedule = schedule;
    localStorage.setItem("nm_settings", JSON.stringify(s));
    try {
      addInboxChatMsg("agent", `\u0420\u043E\u0437\u043A\u043B\u0430\u0434 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E: \u043F\u0456\u0434\u0439\u043E\u043C ${schedule.wakeUp}, \u0440\u043E\u0431\u043E\u0442\u0430 ${schedule.workStart}\u2013${schedule.workEnd}, \u0441\u043F\u0430\u0442\u0438 ${schedule.bedTime}. \u041C\u043E\u0436\u0435\u0448 \u0437\u043C\u0456\u043D\u0438\u0442\u0438 \u0432 \u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445.`);
    } catch (e) {
    }
    return true;
  }
  function updateOwlChipsArrows() {
    _updateOwlTabChipsArrows("inbox");
  }
  function scrollOwlChips(dir) {
    scrollOwlTabChips("inbox", dir);
  }
  Object.assign(window, {
    _tabChatState: _tabChatState2,
    _getTabChatAHeight: _getTabChatAHeight2,
    _getTabChatBHeight: _getTabChatBHeight2,
    openChatBarNoKeyboard,
    setupChatBarSwipe: setupChatBarSwipe2,
    OWL_BOARD_KEY,
    OWL_BOARD_SEEN_KEY,
    OWL_BOARD_TS_KEY,
    OWL_BOARD_INTERVAL,
    getOwlBoardMessages: getOwlBoardMessages2,
    saveOwlBoardMessages,
    getSchedule,
    getDayPhase,
    owlCdExpired,
    setOwlCd,
    checkOwlBoardTrigger,
    getOwlBoardContext: getOwlBoardContext2,
    generateOwlBoardMessage,
    getOwlChatHistory,
    saveOwlChatMsg,
    renderOwlBoard: renderOwlBoard2,
    expandOwlChat,
    collapseOwlToSpeech,
    toggleOwlChat,
    closeOwlChat: closeOwlChat2,
    renderOwlChatMessages,
    renderOwlChips,
    showOwlTyping,
    showOwlConfirm,
    sendOwlReply: sendOwlReply2,
    sendOwlReplyFromInput: sendOwlReplyFromInput2,
    executeOwlAction,
    owlSwipeStart,
    owlSwipeMove,
    owlSwipeEnd,
    dismissOwlBoard,
    startOwlBoardCycle: startOwlBoardCycle2,
    tryOwlBoardUpdate,
    _owlAskScheduleIfNeeded,
    handleScheduleAnswer,
    updateOwlChipsArrows,
    scrollOwlChips
  });

  // src/owl/chips.js
  function owlChipToChat(tab, text) {
    const lower = text.toLowerCase();
    const navMap = [
      { patterns: ["\u0437\u0430\u0434\u0430\u0447", "\u0437\u0430\u043A\u0440\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447", "\u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0438 \u0437\u0430\u0434\u0430\u0447"], tab: "tasks" },
      { patterns: ["\u0437\u0432\u0438\u0447\u043A", "\u0432\u0438\u043A\u043E\u043D\u0430\u0442\u0438 \u0437\u0432\u0438\u0447\u043A", "\u0432\u0456\u0434\u043C\u0456\u0442\u0438\u0442\u0438 \u0437\u0432\u0438\u0447\u043A"], tab: "tasks" },
      { patterns: ["\u043F\u0456\u0434\u0441\u0443\u043C\u043A", "\u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0434\u043D\u044F", "\u0437\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u043F\u0456\u0434\u0441\u0443\u043C\u043A"], tab: "evening" },
      { patterns: ["\u043D\u043E\u0442\u0430\u0442\u043A", "\u0437\u0430\u043F\u0438\u0441\u0430\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A"], tab: "notes" },
      { patterns: ["\u0444\u0456\u043D\u0430\u043D\u0441", "\u0432\u0438\u0442\u0440\u0430\u0442", "\u0431\u044E\u0434\u0436\u0435\u0442"], tab: "finance" },
      { patterns: ["\u0437\u0434\u043E\u0440\u043E\u0432", "\u0441\u0430\u043C\u043E\u043F\u043E\u0447\u0443\u0442\u0442"], tab: "health" },
      { patterns: ["\u043F\u0440\u043E\u0435\u043A\u0442"], tab: "projects" }
    ];
    for (const nav of navMap) {
      if (nav.patterns.some((p) => lower.includes(p))) {
        switchTab(nav.tab);
        showToast("\u041F\u0435\u0440\u0435\u0445\u043E\u0434\u0436\u0443 \u0434\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0438");
        return;
      }
    }
    const barTab = tab === "inbox" ? "inbox" : tab || "inbox";
    openChatBar(barTab);
    const inputId = barTab === "inbox" ? "inbox-input" : barTab + "-chat-input";
    const input = document.getElementById(inputId);
    if (input) {
      input.value = text;
      input.dispatchEvent(new Event("input"));
    }
    setTimeout(() => {
      if (barTab === "inbox") {
        if (typeof sendToAI === "function") sendToAI();
      } else if (barTab === "tasks") {
        if (typeof sendTasksBarMessage === "function") sendTasksBarMessage();
      } else if (barTab === "notes") {
        if (typeof sendNotesBarMessage === "function") sendNotesBarMessage();
      } else if (barTab === "finance") {
        if (typeof sendFinanceBarMessage === "function") sendFinanceBarMessage();
      } else if (barTab === "health") {
        if (typeof sendHealthBarMessage === "function") sendHealthBarMessage();
      } else if (barTab === "projects") {
        if (typeof sendProjectsBarMessage === "function") sendProjectsBarMessage();
      } else if (barTab === "me") {
        if (typeof sendMeChatMessage === "function") sendMeChatMessage();
      } else if (barTab === "evening") {
        if (typeof sendEveningBarMessage === "function") sendEveningBarMessage();
      }
    }, 100);
  }
  Object.assign(window, { owlChipToChat });

  // src/owl/board.js
  var OWL_TAB_BOARD_MIN_INTERVAL2 = 30 * 60 * 1e3;
  function getOwlTabBoardKey(tab) {
    return "nm_owl_tab_" + tab;
  }
  function getOwlTabTsKey2(tab) {
    return "nm_owl_tab_ts_" + tab;
  }
  function getOwlTabSaidKey(tab) {
    return "nm_owl_tab_said_" + tab;
  }
  function getTabBoardMsgs2(tab) {
    try {
      const raw = JSON.parse(localStorage.getItem(getOwlTabBoardKey(tab)) || "null");
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      return [raw];
    } catch {
      return [];
    }
  }
  function getTabBoardMsg(tab) {
    const msgs = getTabBoardMsgs2(tab);
    return msgs[0] || null;
  }
  function saveTabBoardMsg2(tab, newMsg) {
    const msgs = getTabBoardMsgs2(tab);
    msgs.unshift(newMsg);
    if (msgs.length > 30) msgs.length = 30;
    try {
      localStorage.setItem(getOwlTabBoardKey(tab), JSON.stringify(msgs));
    } catch {
    }
  }
  function getTabBoardSaid(tab) {
    const today = (/* @__PURE__ */ new Date()).toDateString();
    try {
      const raw = JSON.parse(localStorage.getItem(getOwlTabSaidKey(tab)) || "{}");
      if (raw.date !== today) return {};
      return raw.said || {};
    } catch {
      return {};
    }
  }
  function markTabBoardSaid(tab, topic) {
    const today = (/* @__PURE__ */ new Date()).toDateString();
    const said = getTabBoardSaid(tab);
    said[topic] = true;
    try {
      localStorage.setItem(getOwlTabSaidKey(tab), JSON.stringify({ date: today, said }));
    } catch {
    }
  }
  function tabAlreadySaid(tab, topic) {
    return !!getTabBoardSaid(tab)[topic];
  }
  function dismissTabBoard(tab) {
    if (tab === "evening") return;
    const el = document.getElementById("owl-tab-board-" + tab);
    if (el) el.style.display = "none";
  }
  var _owlTabStates2 = {};
  var _owlTabSwipes = {};
  var OWL_TAB_EXPANDED_H = 204;
  function _owlTabHTML(tab) {
    const t = tab;
    return `
    <div id="owl-tab-collapsed-${t}" class="owl-collapsed" style="display:none" onclick="toggleOwlTabChat('${t}')">
      <div class="owl-collapsed-avatar">\u{1F989}</div>
      <div class="owl-collapsed-text" id="owl-tab-ctext-${t}"></div>
    </div>
    <div id="owl-tab-speech-${t}" class="owl-speech"
         ontouchstart="owlTabSwipeStart(event,'${t}')" ontouchmove="owlTabSwipeMove(event,'${t}')" ontouchend="owlTabSwipeEnd(event,'${t}')">
      <div class="owl-speech-avatar">\u{1F989}</div>
      <div class="owl-tab-card">
        <div class="owl-tab-bubble" id="owl-tab-bubble-${t}">
          <div class="owl-speech-text" id="owl-tab-text-${t}"></div>
          <div class="owl-speech-time" id="owl-tab-time-${t}"></div>
        </div>
      </div>
    </div>
    <div class="owl-chips-wrapper" id="owl-tab-chips-wrap-${t}">
      <button class="owl-chips-arrow owl-chips-arrow-left" id="owl-tab-chips-left-${t}" onclick="scrollOwlTabChips('${t}',-1)">\u2039</button>
      <div id="owl-tab-chips-${t}" class="owl-speech-chips"></div>
      <button class="owl-chips-arrow owl-chips-arrow-right" id="owl-tab-chips-right-${t}" onclick="scrollOwlTabChips('${t}',1)">\u203A</button>
    </div>`;
  }
  function _owlTabApplyState2(tab) {
    const st = _owlTabStates2[tab] || "speech";
    const collapsed = document.getElementById("owl-tab-collapsed-" + tab);
    const speech = document.getElementById("owl-tab-speech-" + tab);
    const chipsWrap = document.getElementById("owl-tab-chips-wrap-" + tab);
    if (!speech) return;
    if (collapsed) collapsed.style.display = st === "collapsed" ? "flex" : "none";
    speech.style.display = st === "collapsed" ? "none" : "block";
    if (chipsWrap) chipsWrap.style.display = "flex";
  }
  function toggleOwlTabChat(tab) {
    _owlTabStates2[tab] = "speech";
    _owlTabApplyState2(tab);
  }
  function collapseOwlTabToSpeech(tab) {
    _owlTabStates2[tab] = "speech";
    _owlTabApplyState2(tab);
  }
  function _seedOwlTabChat(tab) {
    const key = "nm_owl_tab_chat_" + tab;
    const msgs = JSON.parse(localStorage.getItem(key) || "[]");
    if (msgs.length === 0) {
      const text = (document.getElementById("owl-tab-text-" + tab) || {}).textContent;
      if (text && text.trim()) {
        msgs.push({ role: "agent", text: text.trim(), ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(msgs));
      }
    }
  }
  function expandOwlTabChat(tab) {
    openChatBar(tab === "inbox" ? "inbox" : tab);
  }
  function owlTabSwipeStart(e, tab) {
    _owlTabSwipes[tab] = { y: e.touches[0].clientY, dy: 0 };
  }
  function owlTabSwipeMove(e, tab) {
    if (!_owlTabSwipes[tab]) return;
    _owlTabSwipes[tab].dy = e.touches[0].clientY - _owlTabSwipes[tab].y;
  }
  function owlTabSwipeEnd(e, tab) {
    const sw = _owlTabSwipes[tab];
    if (!sw) return;
    _owlTabSwipes[tab] = null;
    const dy = sw.dy, st = _owlTabStates2[tab] || "speech";
    if (dy < -40) {
      if (st === "speech") {
        _owlTabStates2[tab] = "collapsed";
        _owlTabApplyState2(tab);
      }
    } else if (dy > 40) {
      if (st === "collapsed") {
        _owlTabStates2[tab] = "speech";
        _owlTabApplyState2(tab);
      } else if (st === "speech") openChatBar(tab === "inbox" ? "inbox" : tab);
    }
  }
  function renderOwlTabMsgs(tab) {
    const el = document.getElementById("owl-tab-msgs-" + tab);
    if (!el) return;
    const msgs = JSON.parse(localStorage.getItem("nm_owl_tab_chat_" + tab) || "[]");
    el.innerHTML = msgs.map(
      (m) => `<div class="owl-msg-${m.role === "user" ? "user" : "agent"}">${escapeHtml(m.text)}</div>`
    ).join("");
    el.scrollTop = el.scrollHeight;
  }
  async function sendOwlTabReply(tab, text) {
    if (tab === "inbox") {
      if (typeof sendOwlReply === "function") sendOwlReply(text);
      return;
    }
    expandOwlTabChat(tab);
    const key = "nm_owl_tab_chat_" + tab;
    const msgs = JSON.parse(localStorage.getItem(key) || "[]");
    msgs.push({ role: "user", text, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(msgs));
    renderOwlTabMsgs(tab);
    const el = document.getElementById("owl-tab-msgs-" + tab);
    if (el) {
      const d = document.createElement("div");
      d.className = "owl-msg-agent owl-typing-wrap";
      d.innerHTML = '<div class="owl-typing"><span></span><span></span><span></span></div>';
      el.appendChild(d);
      el.scrollTop = el.scrollHeight;
    }
    const apiKey = localStorage.getItem("nm_gemini_key");
    if (!apiKey) return;
    try {
      const context = getTabBoardContext(tab);
      const history = msgs.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: (typeof getOWLPersonality === "function" ? getOWLPersonality() : "") + "\n\n\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442:\n" + context }, ...history],
          max_tokens: 250,
          temperature: 0.8
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        renderOwlTabMsgs(tab);
        return;
      }
      const all = JSON.parse(localStorage.getItem(key) || "[]");
      all.push({ role: "agent", text: reply, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(all));
      renderOwlTabMsgs(tab);
    } catch (e) {
      renderOwlTabMsgs(tab);
    }
  }
  function sendOwlTabReplyFromInput(tab) {
    if (tab === "inbox") {
      if (typeof sendOwlReplyFromInput === "function") sendOwlReplyFromInput();
      return;
    }
    const input = document.getElementById("owl-tab-input-" + tab);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendOwlTabReply(tab, text);
  }
  function _updateOwlTabChipsArrows2(tab) {
    const el = document.getElementById("owl-tab-chips-" + tab);
    const left = document.getElementById("owl-tab-chips-left-" + tab);
    const right = document.getElementById("owl-tab-chips-right-" + tab);
    if (!el || !left || !right) return;
    left.classList.toggle("visible", el.scrollLeft > 4);
    right.classList.toggle("visible", el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
  function scrollOwlTabChips2(tab, dir) {
    const el = document.getElementById("owl-tab-chips-" + tab);
    if (!el) return;
    el.scrollBy({ left: dir * 130, behavior: "smooth" });
    setTimeout(() => _updateOwlTabChipsArrows2(tab), 250);
  }
  function renderTabBoard2(tab) {
    const isInbox = tab === "inbox";
    const msgs = isInbox ? typeof getOwlBoardMessages === "function" ? getOwlBoardMessages() : [] : getTabBoardMsgs2(tab);
    const board = document.getElementById(isInbox ? "owl-board" : "owl-tab-board-" + tab);
    if (!board) return;
    if (!msgs.length) {
      board.style.display = "none";
      return;
    }
    board.style.display = "block";
    if (!board._owlReady) {
      if (!isInbox) board.innerHTML = _owlTabHTML(tab);
      board._owlReady = true;
      _owlTabStates2[tab] = _owlTabStates2[tab] || "speech";
      _owlTabApplyState2(tab);
    }
    const msg = msgs[0];
    const ago = Date.now() - (msg.ts || msg.id || Date.now());
    const mins = Math.floor(ago / 6e4);
    const timeStr = mins < 1 ? "\u0449\u043E\u0439\u043D\u043E" : mins < 60 ? mins + " \u0445\u0432" : Math.floor(mins / 60) + " \u0433\u043E\u0434";
    const tEl = document.getElementById("owl-tab-text-" + tab);
    const cEl = document.getElementById("owl-tab-ctext-" + tab);
    const tmEl = document.getElementById("owl-tab-time-" + tab);
    if (tEl) tEl.textContent = msg.text;
    if (cEl) cEl.textContent = msg.text;
    if (tmEl) tmEl.textContent = timeStr;
    const chipsEl = document.getElementById("owl-tab-chips-" + tab);
    const chipsHTML = (msg.chips || []).map((c) => {
      const s = escapeHtml(c).replace(/'/g, "&#39;");
      return `<div class="owl-chip" onclick="owlChipToChat('${tab}','${s}')">${escapeHtml(c)}</div>`;
    });
    if (chipsEl) {
      const barTab = tab === "me" ? "me" : tab;
      const speechChips = [...chipsHTML, `<div class="owl-chip owl-chip-speak" onclick="openChatBar('${barTab}')">\u041F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u0438</div>`];
      chipsEl.innerHTML = speechChips.join("");
      chipsEl.scrollLeft = 0;
      chipsEl.removeEventListener("scroll", chipsEl._arrowHandler);
      chipsEl._arrowHandler = () => _updateOwlTabChipsArrows2(tab);
      chipsEl.addEventListener("scroll", chipsEl._arrowHandler, { passive: true });
      setTimeout(() => _updateOwlTabChipsArrows2(tab), 50);
    }
  }
  Object.assign(window, {
    OWL_TAB_BOARD_MIN_INTERVAL: OWL_TAB_BOARD_MIN_INTERVAL2,
    getOwlTabBoardKey,
    getOwlTabTsKey: getOwlTabTsKey2,
    getOwlTabSaidKey,
    getTabBoardMsgs: getTabBoardMsgs2,
    getTabBoardMsg,
    saveTabBoardMsg: saveTabBoardMsg2,
    getTabBoardSaid,
    markTabBoardSaid,
    tabAlreadySaid,
    dismissTabBoard,
    _owlTabStates: _owlTabStates2,
    _owlTabSwipes,
    OWL_TAB_EXPANDED_H,
    _owlTabHTML,
    _owlTabApplyState: _owlTabApplyState2,
    toggleOwlTabChat,
    collapseOwlTabToSpeech,
    _seedOwlTabChat,
    expandOwlTabChat,
    owlTabSwipeStart,
    owlTabSwipeMove,
    owlTabSwipeEnd,
    renderOwlTabMsgs,
    sendOwlTabReply,
    sendOwlTabReplyFromInput,
    _updateOwlTabChipsArrows: _updateOwlTabChipsArrows2,
    scrollOwlTabChips: scrollOwlTabChips2,
    renderTabBoard: renderTabBoard2
  });

  // src/owl/proactive.js
  function getTabBoardContext2(tab) {
    const parts = [];
    try {
      const ctx = getAIContext();
      if (ctx) parts.push(ctx);
    } catch (e) {
    }
    if (tab === "tasks") {
      const tasks = getTasks();
      const active = tasks.filter((t) => t.status === "active");
      const now = Date.now();
      const stuck = active.filter((t) => t.createdAt && now - t.createdAt > 3 * 24 * 60 * 60 * 1e3);
      if (stuck.length > 0) parts.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0417\u0430\u0434\u0430\u0447\u0456 \u0431\u0435\u0437 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0443 3+ \u0434\u043D\u0456: ${stuck.map((t) => '"' + t.title + '"').join(", ")}`);
      parts.push(`\u0410\u043A\u0442\u0438\u0432\u043D\u0438\u0445 \u0437\u0430\u0434\u0430\u0447: ${active.length}, \u0437\u0430\u043A\u0440\u0438\u0442\u043E: ${tasks.filter((t) => t.status === "done").length}`);
      const allHabits = getHabits();
      const quitHabits = allHabits.filter((h) => h.type === "quit");
      if (quitHabits.length > 0) {
        const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const quitInfo = quitHabits.map((h) => {
          const s = getQuitStatus(h.id);
          const heldToday = s.lastHeld === todayStr;
          return `"${h.name}": \u0441\u0442\u0440\u0456\u043A ${s.streak || 0} \u0434\u043D${heldToday ? " \u2713" : " (\u043D\u0435 \u0432\u0456\u0434\u043C\u0456\u0447\u0435\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456)"}`;
        });
        parts.push(`\u0427\u0435\u043B\u0435\u043D\u0434\u0436\u0456 "\u041A\u0438\u043D\u0443\u0442\u0438": ${quitInfo.join("; ")}`);
        const notHeld = quitHabits.filter((h) => getQuitStatus(h.id).lastHeld !== todayStr);
        if (notHeld.length > 0) parts.push(`[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u041D\u0435 \u0432\u0456\u0434\u043C\u0456\u0447\u0435\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${notHeld.map((h) => '"' + h.name + '"').join(", ")}`);
      }
    }
    if (tab === "notes") {
      const notes = getNotes();
      const byFolder = {};
      notes.forEach((n) => {
        const f = n.folder || "\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0435";
        byFolder[f] = (byFolder[f] || 0) + 1;
      });
      parts.push(`\u041D\u043E\u0442\u0430\u0442\u043A\u0438: ${notes.length} \u0437\u0430\u043F\u0438\u0441\u0456\u0432. \u041F\u0430\u043F\u043A\u0438: ${Object.entries(byFolder).map(([f, c]) => f + "(" + c + ")").join(", ") || "\u043D\u0435\u043C\u0430\u0454"}`);
    }
    if (tab === "me") {
      const habits = getHabits();
      const buildHabits = habits.filter((h) => h.type !== "quit");
      const quitHabits = habits.filter((h) => h.type === "quit");
      const log = getHabitLog();
      const today = (/* @__PURE__ */ new Date()).toDateString();
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const todayDow = ((/* @__PURE__ */ new Date()).getDay() + 6) % 7;
      const todayH = buildHabits.filter((h) => (h.days || [0, 1, 2, 3, 4]).includes(todayDow));
      const doneToday = todayH.filter((h) => !!log[today]?.[h.id]).length;
      if (buildHabits.length > 0) {
        const streaks = buildHabits.map((h) => ({ name: h.name, streak: getHabitStreak(h.id), pct: getHabitPct(h.id) }));
        parts.push(`\u0417\u0432\u0438\u0447\u043A\u0438 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${doneToday}/${todayH.length}. \u0421\u0442\u0440\u0456\u043A\u0438: ${streaks.filter((s) => s.streak >= 2).map((s) => s.name + "\u{1F525}" + s.streak).join(", ") || "\u043D\u0435\u043C\u0430\u0454"}`);
      }
      if (quitHabits.length > 0) {
        const quitInfo = quitHabits.map((h) => {
          const s = getQuitStatus(h.id);
          return `"${h.name}": ${s.streak || 0} \u0434\u043D \u0431\u0435\u0437 \u0437\u0440\u0438\u0432\u0456\u0432`;
        });
        parts.push(`\u0427\u0435\u043B\u0435\u043D\u0434\u0436\u0456: ${quitInfo.join(", ")}`);
      }
      const inbox = JSON.parse(localStorage.getItem("nm_inbox") || "[]");
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
      parts.push(`\u0417\u0430\u043F\u0438\u0441\u0456\u0432 \u0437\u0430 \u0442\u0438\u0436\u0434\u0435\u043D\u044C: ${inbox.filter((i) => i.ts > weekAgo).length}. \u0417\u0430\u0434\u0430\u0447 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0445: ${getTasks().filter((t) => t.status === "active").length}`);
    }
    if (tab === "evening") {
      const moments = JSON.parse(localStorage.getItem("nm_moments") || "[]");
      const todayStr = (/* @__PURE__ */ new Date()).toDateString();
      const todayMoments = moments.filter((m) => new Date(m.ts).toDateString() === todayStr);
      const summary = JSON.parse(localStorage.getItem("nm_evening_summary") || "null");
      const hasSummary = summary && new Date(summary.date).toDateString() === todayStr;
      const hour = (/* @__PURE__ */ new Date()).getHours();
      parts.push(`\u041C\u043E\u043C\u0435\u043D\u0442\u0438 \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${todayMoments.length}. \u041F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0434\u043D\u044F: ${hasSummary ? "\u0454" : "\u0449\u0435 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E"}.`);
      if (hour >= 20 && !hasSummary) parts.push("[\u0412\u0410\u0416\u041B\u0418\u0412\u041E] \u0412\u0435\u0447\u0456\u0440 \u2014 \u043F\u0456\u0434\u0441\u0443\u043C\u043E\u043A \u0449\u0435 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E.");
      const tasks = getTasks().filter((t) => t.status === "done" && t.updatedAt && Date.now() - t.updatedAt < 24 * 60 * 60 * 1e3);
      if (tasks.length > 0) parts.push(`\u0417\u0430\u0434\u0430\u0447 \u0437\u0430\u043A\u0440\u0438\u0442\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456: ${tasks.length}`);
    }
    if (tab === "finance") {
      try {
        const finCtx = getFinanceContext();
        if (finCtx) parts.push(finCtx);
      } catch (e) {
      }
    }
    if (tab === "health") {
      try {
        const cards = JSON.parse(localStorage.getItem("nm_health_cards") || "[]");
        const log = JSON.parse(localStorage.getItem("nm_health_log") || "{}");
        const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const todayLog = log[todayStr] || {};
        parts.push(`\u041A\u0430\u0440\u0442\u043E\u0447\u043E\u043A \u0437\u0434\u043E\u0440\u043E\u0432'\u044F: ${cards.length}. \u0421\u044C\u043E\u0433\u043E\u0434\u043D\u0456: \u0435\u043D\u0435\u0440\u0433\u0456\u044F ${todayLog.energy || "\u2014"}, \u0441\u043E\u043D ${todayLog.sleep || "\u2014"}, \u0431\u0456\u043B\u044C ${todayLog.pain || "\u2014"}`);
      } catch (e) {
      }
    }
    if (tab === "projects") {
      try {
        const projects = JSON.parse(localStorage.getItem("nm_projects") || "[]");
        const active = projects.filter((p) => p.status === "active");
        const paused = projects.filter((p) => p.status === "paused");
        parts.push(`\u041F\u0440\u043E\u0435\u043A\u0442\u0456\u0432 \u0430\u043A\u0442\u0438\u0432\u043D\u0438\u0445: ${active.length}, \u043D\u0430 \u043F\u0430\u0443\u0437\u0456: ${paused.length}, \u0432\u0441\u044C\u043E\u0433\u043E: ${projects.length}.`);
        if (active.length > 0) parts.push(`\u0410\u043A\u0442\u0438\u0432\u043D\u0456: ${active.slice(0, 3).map((p) => '"' + p.name + '"').join(", ")}`);
      } catch (e) {
      }
    }
    return parts.filter(Boolean).join("\n\n");
  }
  function checkTabBoardTrigger(tab) {
    if (tab === "tasks") {
      const tasks = getTasks().filter((t) => t.status === "active");
      if (tasks.length === 0) return false;
      const now = Date.now();
      const stuck = tasks.filter((t) => t.createdAt && now - t.createdAt > 3 * 24 * 60 * 60 * 1e3);
      return stuck.length > 0;
    }
    if (tab === "notes") return getNotes().length > 0;
    if (tab === "me") return getHabits().length > 0 || getTasks().length > 0;
    if (tab === "evening") return true;
    if (tab === "finance") {
      try {
        return getFinance().length > 0;
      } catch {
        return false;
      }
    }
    if (tab === "health") {
      try {
        return JSON.parse(localStorage.getItem("nm_health_cards") || "[]").length > 0;
      } catch {
        return false;
      }
    }
    if (tab === "projects") {
      try {
        return JSON.parse(localStorage.getItem("nm_projects") || "[]").length > 0;
      } catch {
        return false;
      }
    }
    return true;
  }
  var _tabBoardGenerating = {};
  async function generateTabBoardMessage(tab) {
    if (_tabBoardGenerating[tab]) return;
    const key = localStorage.getItem("nm_gemini_key");
    if (!key) return;
    _tabBoardGenerating[tab] = true;
    const context = getTabBoardContext2(tab);
    const tabLabels = { tasks: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0456\u0441\u0442\u044C", notes: "\u041D\u043E\u0442\u0430\u0442\u043A\u0438", me: "\u042F", evening: "\u0412\u0435\u0447\u0456\u0440", finance: "\u0424\u0456\u043D\u0430\u043D\u0441\u0438", health: "\u0417\u0434\u043E\u0440\u043E\u0432'\u044F", projects: "\u041F\u0440\u043E\u0435\u043A\u0442\u0438" };
    const allMsgs = getTabBoardMsgs(tab);
    const existing = allMsgs[0] || null;
    const recentText = existing ? existing.text : "";
    const tabHistory = allMsgs.slice(0, 20).map((m) => {
      const ago = Date.now() - (m.ts || 0);
      const hours = Math.floor(ago / 36e5);
      const when = hours < 1 ? "\u0449\u043E\u0439\u043D\u043E" : hours < 24 ? hours + " \u0433\u043E\u0434 \u0442\u043E\u043C\u0443" : Math.floor(hours / 24) + " \u0434\u043D \u0442\u043E\u043C\u0443";
      return `[${when}] ${m.text}`;
    }).join("\n");
    const _now = /* @__PURE__ */ new Date();
    const _hour = _now.getHours();
    const _timeOfDay = _hour < 6 ? "\u043D\u0456\u0447" : _hour < 12 ? "\u0440\u0430\u043D\u043E\u043A" : _hour < 18 ? "\u0434\u0435\u043D\u044C" : "\u0432\u0435\u0447\u0456\u0440";
    const _timeStr = _now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    const systemPrompt = getOWLPersonality() + `

\u0417\u0430\u0440\u0430\u0437: ${_timeStr} (${_timeOfDay}). \u0412\u0440\u0430\u0445\u043E\u0432\u0443\u0439 \u0447\u0430\u0441 \u0434\u043E\u0431\u0438 \u0443 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u0456.

\u0422\u0438 \u043F\u0438\u0448\u0435\u0448 \u041A\u041E\u0420\u041E\u0422\u041A\u0415 \u043F\u0440\u043E\u0430\u043A\u0442\u0438\u0432\u043D\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0434\u043B\u044F \u0442\u0430\u0431\u043B\u043E \u0443 \u0432\u043A\u043B\u0430\u0434\u0446\u0456 "${tabLabels[tab] || tab}". \u0426\u0435 \u041D\u0415 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043D\u0430 \u0437\u0430\u043F\u0438\u0442 \u2014 \u0446\u0435 \u0442\u0432\u043E\u044F \u0456\u043D\u0456\u0446\u0456\u0430\u0442\u0438\u0432\u0430.

\u0422\u0412\u041E\u0407 \u041F\u041E\u041F\u0415\u0420\u0415\u0414\u041D\u0406 \u041F\u041E\u0412\u0406\u0414\u041E\u041C\u041B\u0415\u041D\u041D\u042F (\u043F\u0430\u043C'\u044F\u0442\u0430\u0439 \u0449\u043E \u0432\u0436\u0435 \u043A\u0430\u0437\u0430\u0432, \u0431\u0443\u0434\u0443\u0439 \u0434\u0456\u0430\u043B\u043E\u0433, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0439\u0441\u044F):
${tabHistory || "(\u0449\u0435 \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u043A\u0430\u0437\u0430\u0432)"}

\u0429\u041E \u0422\u0418 \u0417\u041D\u0410\u0404\u0428 \u041F\u0420\u041E \u041A\u041E\u0420\u0418\u0421\u0422\u0423\u0412\u0410\u0427\u0410:
${localStorage.getItem("nm_memory") || "(\u0449\u0435 \u043D\u0435 \u0437\u043D\u0430\u044E)"}

\u041F\u0420\u0410\u0412\u0418\u041B\u0410:
- \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 2 \u0440\u0435\u0447\u0435\u043D\u043D\u044F. \u041A\u043E\u0440\u043E\u0442\u043A\u043E \u0456 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u043F\u0440\u043E \u0446\u044E \u0432\u043A\u043B\u0430\u0434\u043A\u0443.
- \u0413\u043E\u0432\u043E\u0440\u0438 \u041B\u042E\u0414\u0421\u042C\u041A\u041E\u042E \u043C\u043E\u0432\u043E\u044E. \u041D\u0415 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0436\u0430\u0440\u0433\u043E\u043D: "\u0441\u0442\u0440\u0456\u043A", "streak", "\u0442\u0440\u0435\u043A\u0435\u0440", "\u043F\u0440\u043E\u0433\u0440\u0435\u0441". \u041A\u0430\u0436\u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E \u0456 \u0437\u0440\u043E\u0437\u0443\u043C\u0456\u043B\u043E \u0449\u043E \u0432\u0456\u0434\u0431\u0443\u0432\u0430\u0454\u0442\u044C\u0441\u044F \u2014 \u044F\u043A \u0434\u0440\u0443\u0433, \u043D\u0435 \u044F\u043A \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u0430.
- \u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 \u0444\u0430\u043A\u0442\u0438 \u0437 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0443 \u043D\u0438\u0436\u0447\u0435. \u041D\u0415 \u0432\u0438\u0433\u0430\u0434\u0443\u0439 \u043B\u0456\u043C\u0456\u0442\u0438 \u0456 \u0434\u0430\u043D\u0456 \u044F\u043A\u0438\u0445 \u043D\u0435\u043C\u0430\u0454.
- \u041D\u0415 \u043F\u043E\u0432\u0442\u043E\u0440\u044E\u0439 \u043D\u0435\u0449\u043E\u0434\u0430\u0432\u043D\u0454: "${recentText || "\u043D\u0456\u0447\u043E\u0433\u043E"}"
- \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0422\u0406\u041B\u042C\u041A\u0418 JSON: {"text":"\u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F","priority":"critical|important|normal","chips":["\u0447\u0456\u043F1","\u0447\u0456\u043F2"]}
- chips \u2014 \u043A\u043D\u043E\u043F\u043A\u0438 \u0448\u0432\u0438\u0434\u043A\u0438\u0445 \u0434\u0456\u0439. \u0422\u0406\u041B\u042C\u041A\u0418 \u0434\u0456\u0457 \u0449\u043E \u043F\u0440\u044F\u043C\u043E \u0441\u0442\u043E\u0441\u0443\u044E\u0442\u044C\u0441\u044F \u0442\u0432\u043E\u0433\u043E \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F. \u041D\u0415 \u0434\u043E\u0434\u0430\u0432\u0430\u0439 \u0432\u0438\u043F\u0430\u0434\u043A\u043E\u0432\u0456 \u0434\u0456\u0457 \u044F\u043A\u0456 \u043D\u0435 \u0437\u0433\u0430\u0434\u0443\u044E\u0442\u044C\u0441\u044F \u0432 \u0442\u0435\u043A\u0441\u0442\u0456. \u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 3 \u0441\u043B\u043E\u0432\u0430 \u043A\u043E\u0436\u0435\u043D. \u042F\u043A\u0449\u043E \u043D\u0456\u0447\u043E\u0433\u043E \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u2014 [].
- \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E.`;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `\u0414\u0430\u043D\u0456: ${context}` }
          ],
          max_tokens: 150,
          temperature: 0.8
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        _tabBoardGenerating[tab] = false;
        return;
      }
      const parsed = JSON.parse(reply.replace(/```json|```/g, "").trim());
      if (!parsed.text) {
        _tabBoardGenerating[tab] = false;
        return;
      }
      saveTabBoardMsg(tab, { text: parsed.text, priority: parsed.priority || "normal", chips: parsed.chips || [], ts: Date.now() });
      localStorage.setItem(getOwlTabTsKey(tab), Date.now().toString());
      try {
        const chatTab = tab;
        const chatKey = "nm_chat_" + chatTab;
        const chatMsgs = JSON.parse(localStorage.getItem(chatKey) || "[]");
        chatMsgs.push({ role: "agent", text: "\u{1F989} " + parsed.text, ts: Date.now() });
        localStorage.setItem(chatKey, JSON.stringify(chatMsgs));
        if (typeof restoreChatUI === "function") restoreChatUI(chatTab);
      } catch (e) {
      }
      renderTabBoard(tab);
    } catch (e) {
    }
    _tabBoardGenerating[tab] = false;
  }
  function tryTabBoardUpdate2(tab) {
    if (tab === "inbox") return;
    if (_owlTabStates[tab] && _owlTabStates[tab] !== "speech") {
      _owlTabStates[tab] = "speech";
      _owlTabApplyState(tab);
    }
    renderTabBoard(tab);
    const hour = (/* @__PURE__ */ new Date()).getHours();
    if (hour < 5) return;
    if (tab === "evening" && hour < 12) return;
    const lastTs = parseInt(localStorage.getItem(getOwlTabTsKey(tab)) || "0");
    const elapsed = Date.now() - lastTs;
    const isNewDay = lastTs > 0 && new Date(lastTs).toDateString() !== (/* @__PURE__ */ new Date()).toDateString();
    const firstTime = lastTs === 0;
    if (firstTime || isNewDay || elapsed > OWL_TAB_BOARD_MIN_INTERVAL && checkTabBoardTrigger(tab)) {
      generateTabBoardMessage(tab);
    }
  }
  Object.assign(window, {
    getTabBoardContext: getTabBoardContext2,
    checkTabBoardTrigger,
    generateTabBoardMessage,
    tryTabBoardUpdate: tryTabBoardUpdate2
  });

  // src/core/boot.js
  function setupPWA() {
    const manifest = {
      name: "NeverMind",
      short_name: "NeverMind",
      start_url: "/",
      display: "standalone",
      background_color: "#faf9ff",
      theme_color: "#f5f1ff",
      icons: [{
        src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTkyIj48cmVjdCB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgcng9IjM4IiBmaWxsPSIjMWUzYTVmIi8+PGNpcmNsZSBjeD0iNDQiIGN5PSI2NiIgcj0iMTAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDQsNzYgUTM4LDkyIDQwLDExMiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI2IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuMiIvPjxwYXRoIGQ9Ik00Miw5MiBMMjgsMTA4IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC4yIi8+PHBhdGggZD0iTTQyLDkyIEw1MiwxMDYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEwzMiwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48cGF0aCBkPSJNNDAsMTEyIEw0OCwxMzgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjIiLz48Y2lyY2xlIGN4PSI5NiIgY3k9IjYyIiByPSIxMCIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuNSIvPjxwYXRoIGQ9Ik05Niw3MiBMOTYsMTE0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PHBhdGggZD0iTTk2LDkwIEw4MCwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsOTAgTDExMiwxMDQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEw4NiwxNDAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjUiLz48cGF0aCBkPSJNOTYsMTE0IEwxMDYsMTQwIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iNTgiIHI9IjExIiBmaWxsPSIjNjBhNWZhIi8+PHBhdGggZD0iTTE1MCw2OSBMMTUwLDExNiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDEzMCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsODYgTDE3MCw2NiIgc3Ryb2tlPSIjNjBhNWZhIiBzdHJva2Utd2lkdGg9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAsMTE2IEwxMzgsMTQyIiBzdHJva2U9IiM2MGE1ZmEiIHN0cm9rZS13aWR0aD0iNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTE1MCwxMTYgTDE2MiwxNDIiIHN0cm9rZT0iIzYwYTVmYSIgc3Ryb2tlLXdpZHRoPSI1IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=",
        sizes: "192x192",
        type: "image/svg+xml"
      }]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
  }
  function setupSW() {
    if (!("serviceWorker" in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let _reloading = false;
    const doReload = () => {
      if (_reloading) return;
      _reloading = true;
      window.location.replace(window.location.href);
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      doReload();
    });
    let _swReg = null;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && _swReg) _swReg.update();
    });
    window.addEventListener("pageshow", (e) => {
      if (e.persisted && _swReg) _swReg.update();
    });
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
      _swReg = reg;
      reg.update();
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated" && hadController) doReload();
        });
      });
    }).catch(() => {
      const swCode = `
      self.addEventListener('install', e => self.skipWaiting());
      self.addEventListener('activate', e => clients.claim());
      self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
    `;
      const blob = new Blob([swCode], { type: "application/javascript" });
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {
      });
    });
  }
  function setupSync() {
    const KEY_RENDER_MAP = {
      "nm_inbox": () => {
        if (currentTab === "inbox") try {
          renderInbox();
        } catch (e) {
        }
      },
      "nm_tasks": () => {
        if (currentTab === "tasks") try {
          renderTasks();
          updateProdTabCounters();
        } catch (e) {
        }
      },
      "nm_habits2": () => {
        if (currentTab === "tasks") try {
          renderHabits();
          renderProdHabits();
        } catch (e) {
        }
      },
      "nm_habit_log2": () => {
        if (currentTab === "tasks") try {
          renderHabits();
          renderProdHabits();
        } catch (e) {
        }
        if (currentTab === "me") try {
          renderMe();
          renderMeHabitsStats();
        } catch (e) {
        }
      },
      "nm_notes": () => {
        if (currentTab === "notes") try {
          renderNotes();
        } catch (e) {
        }
      },
      "nm_folders_meta": () => {
        if (currentTab === "notes") try {
          renderNotes();
        } catch (e) {
        }
      },
      "nm_moments": () => {
        if (currentTab === "me") try {
          renderMe();
          renderMeHabitsStats();
        } catch (e) {
        }
        if (currentTab === "evening") try {
          renderEvening();
        } catch (e) {
        }
      },
      "nm_finance": () => {
        if (currentTab === "finance") try {
          renderFinance();
        } catch (e) {
        }
      },
      "nm_finance_budget": () => {
        if (currentTab === "finance") try {
          renderFinance();
        } catch (e) {
        }
      },
      "nm_finance_cats": () => {
        if (currentTab === "finance") try {
          renderFinance();
        } catch (e) {
        }
      },
      "nm_health_cards": () => {
        if (currentTab === "health") try {
          renderHealth();
        } catch (e) {
        }
      },
      "nm_health_log": () => {
        if (currentTab === "health") try {
          renderHealth();
        } catch (e) {
        }
      },
      "nm_projects": () => {
        if (currentTab === "projects") try {
          renderProjects();
        } catch (e) {
        }
      },
      "nm_evening_summary": () => {
        if (currentTab === "evening") try {
          renderEvening();
        } catch (e) {
        }
      },
      "nm_evening_mood": () => {
        if (currentTab === "evening") try {
          renderEvening();
        } catch (e) {
        }
      },
      "nm_settings": () => {
        try {
          applyTheme(currentTab);
        } catch (e) {
        }
      }
    };
    function handleSyncKey(key) {
      const fn = KEY_RENDER_MAP[key];
      if (fn) fn();
    }
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("nm_")) handleSyncKey(e.key);
    });
    let nmChannel = null;
    try {
      nmChannel = new BroadcastChannel("nm_sync");
      nmChannel.onmessage = (e) => {
        if (e.data?.key) handleSyncKey(e.data.key);
      };
    } catch (e) {
    }
    const _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      _origSetItem(key, value);
      if (key.startsWith("nm_") && nmChannel) {
        try {
          nmChannel.postMessage({ key, ts: Date.now() });
        } catch (e) {
        }
      }
    };
  }
  var currentTabForAnim = "inbox";
  function animateTabSwitch2(newTab) {
    const oldPage = document.getElementById(`page-${currentTabForAnim}`);
    const newPage = document.getElementById(`page-${newTab}`);
    if (!oldPage || !newPage || oldPage === newPage) {
      currentTabForAnim = newTab;
      return;
    }
    newPage.style.transition = "none";
    newPage.style.opacity = "0";
    newPage.style.visibility = "visible";
    oldPage.style.transition = "opacity 0.18s ease";
    oldPage.style.opacity = "0";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newPage.style.transition = "opacity 0.22s ease";
        newPage.style.opacity = "1";
      });
    });
    setTimeout(() => {
      oldPage.style.transition = "";
      oldPage.style.opacity = "";
      oldPage.style.visibility = "";
      newPage.style.transition = "";
      newPage.style.opacity = "";
    }, 260);
    currentTabForAnim = newTab;
  }
  function setupSettingsSwipe() {
    const panel = document.getElementById("settings-panel-el");
    if (!panel) return;
    let startY = 0, startScrollTop = 0;
    panel.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
      startScrollTop = panel.scrollTop;
    }, { passive: true });
    panel.addEventListener("touchend", (e) => {
      const dy = e.changedTouches[0].clientY - startY;
      if (dy > 80 && startScrollTop === 0) {
        closeSettings();
      }
    }, { passive: true });
  }
  function applyBoardOverlays2() {
    const configs = [
      { fixedId: "me-fixed-top", scrollId: "me-content" },
      { fixedId: "evening-fixed-top", scrollId: "evening-scroll" },
      { fixedId: "health-fixed-top", scrollId: "health-scroll" },
      { fixedId: "projects-fixed-top", scrollId: "projects-scroll" },
      { fixedId: "inbox-fixed-top", scrollId: "inbox-scroll" },
      { fixedId: "fin-fixed-top", scrollId: "fin-scroll" }
    ];
    configs.forEach(({ fixedId, scrollId }) => {
      const fixed = document.getElementById(fixedId);
      const scroll = document.getElementById(scrollId);
      if (!fixed || !scroll) return;
      fixed.style.position = "absolute";
      fixed.style.top = "0";
      fixed.style.left = "0";
      fixed.style.right = "0";
      fixed.style.zIndex = "5";
      fixed.style.pointerEvents = "none";
      [...fixed.children].forEach((c) => {
        c.style.pointerEvents = "all";
      });
      const h = fixed.offsetHeight;
      scroll.style.paddingTop = h + 14 + "px";
    });
  }
  var NM_KEYS2 = {
    // Основні дані (→ Supabase таблиці в майбутньому)
    data: [
      "nm_inbox",
      "nm_tasks",
      "nm_notes",
      "nm_folders_meta",
      "nm_moments",
      "nm_habits2",
      "nm_habit_log2",
      "nm_quit_log",
      "nm_finance",
      "nm_finance_budget",
      "nm_finance_cats",
      "nm_health_cards",
      "nm_health_log",
      "nm_projects",
      "nm_trash"
    ],
    // Налаштування (→ Supabase user_settings)
    settings: [
      "nm_settings",
      "nm_gemini_key",
      "nm_memory",
      "nm_memory_ts",
      "nm_active_tabs",
      "nm_onboarding_done",
      "nm_evening_mood",
      "nm_evening_summary",
      "nm_notes_folders_ts"
    ],
    // Чат-историки (→ Supabase chat_messages)
    chat: [
      "nm_chat_inbox",
      "nm_chat_tasks",
      "nm_chat_notes",
      "nm_chat_me",
      "nm_chat_evening",
      "nm_chat_finance",
      "nm_chat_health",
      "nm_chat_projects"
    ],
    // Кеш/тимчасове (не потребує Supabase)
    cache: [
      "nm_owl_board",
      "nm_owl_board_ts",
      "nm_owl_cooldowns",
      "nm_owl_schedule_asked",
      "nm_owl_schedule_pending",
      "nm_error_log",
      "nm_fin_coach_week",
      "nm_fin_coach_month",
      "nm_fin_coach_3months"
    ],
    // Динамічні патерни (видаляти через startsWith)
    patterns: ["nm_task_chat_", "nm_visited_", "nm_owl_tab_"]
  };
  function runMigrations() {
    const tasks = JSON.parse(localStorage.getItem("nm_tasks") || "[]");
    let changed = false;
    tasks.forEach((t) => {
      if (t.dueDate === void 0) {
        t.dueDate = null;
        changed = true;
      }
      if (t.priority === void 0) {
        t.priority = "normal";
        changed = true;
      }
    });
    if (changed) localStorage.setItem("nm_tasks", JSON.stringify(tasks));
  }
  function init() {
    try {
      runMigrations();
    } catch (e) {
    }
    try {
      setupPWA();
    } catch (e) {
    }
    try {
      setupSW();
    } catch (e) {
    }
    try {
      setupSync();
    } catch (e) {
    }
    try {
      setupKeyboardAvoiding();
    } catch (e) {
    }
    try {
      setupChatBarSwipe();
    } catch (e) {
    }
    try {
      setupDrumTabbar();
    } catch (e) {
    }
    try {
      setupSettingsSwipe();
    } catch (e) {
    }
    try {
      applyTheme("inbox");
    } catch (e) {
    }
    try {
      const tb = document.getElementById("tab-bar");
      if (tb) {
        const setTabbarH = () => {
          const h = tb.offsetHeight;
          if (h > 0) document.documentElement.style.setProperty("--tabbar-h", h + "px");
        };
        requestAnimationFrame(() => requestAnimationFrame(setTabbarH));
        if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(setTabbarH));
        setTimeout(setTabbarH, 500);
        window.addEventListener("resize", setTabbarH, { passive: true });
      }
    } catch (e) {
    }
    try {
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      document.getElementById("page-inbox").classList.add("active");
      document.querySelectorAll(".tab-item").forEach((t) => t.classList.remove("active"));
      document.querySelector('.tab-item[data-tab="inbox"]').classList.add("active");
    } catch (e) {
    }
    try {
      updateKeyStatus(!!localStorage.getItem("nm_gemini_key"));
    } catch (e) {
    }
    try {
      renderInbox();
    } catch (e) {
    }
    try {
      ["tasks", "notes", "me", "evening", "finance", "health", "projects"].forEach((t) => renderTabBoard(t));
    } catch (e) {
    }
    try {
      restoreChatUI("inbox");
    } catch (e) {
    }
    try {
      const inboxBar = document.getElementById("inbox-ai-bar");
      if (inboxBar) inboxBar.style.display = "flex";
    } catch (e) {
    }
    try {
      setTimeout(() => showFirstVisitTip("inbox"), 1500);
    } catch (e) {
    }
    try {
      requestAnimationFrame(() => requestAnimationFrame(applyBoardOverlays2));
    } catch (e) {
    }
    try {
      setTimeout(applyBoardOverlays2, 500);
    } catch (e) {
    }
    setTimeout(() => {
      try {
        autoRefreshMemory();
      } catch (e) {
      }
    }, 3e3);
    try {
      setupAutoEveningSummary();
    } catch (e) {
    }
    try {
      cleanupTrash();
    } catch (e) {
    }
    try {
      const _msgs = JSON.parse(localStorage.getItem("nm_owl_board") || "[]");
      if (_msgs.length > 0) renderOwlBoard();
    } catch (e) {
    }
    setTimeout(() => {
      try {
        startOwlBoardCycle();
      } catch (e) {
      }
    }, 2e3);
  }
  function showApp() {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.classList.add("hide");
      setTimeout(() => splash.classList.add("gone"), 400);
    }
    try {
      checkOnboarding();
    } catch (e) {
    }
  }
  function bootApp() {
    try {
      init();
    } catch (e) {
      console.error("init error:", e);
    }
    const delay = document.readyState === "complete" ? 300 : 500;
    setTimeout(showApp, delay);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootApp);
  } else {
    bootApp();
  }
  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash && !splash.classList.contains("gone")) {
      splash.classList.add("hide");
      setTimeout(() => splash.classList.add("gone"), 600);
    }
  }, 3e3);
  Object.assign(window, {
    setupPWA,
    setupSW,
    setupSync,
    animateTabSwitch: animateTabSwitch2,
    setupSettingsSwipe,
    applyBoardOverlays: applyBoardOverlays2,
    NM_KEYS: NM_KEYS2,
    runMigrations,
    init,
    showApp,
    bootApp
  });
})();
//# sourceMappingURL=bundle.js.map
