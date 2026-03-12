// app.js — Main Colab Mobile PWA application logic
//
// Responsibilities:
//   - Handles launch buttons → opens Colab in Chrome Custom Tab (window.open)
//   - Manages recent notebooks list (localStorage-backed)
//   - Coordinates session manager (wake lock + heartbeat)
//   - Binds bottom navigation tabs
//   - Exposes global toast function used by other modules

import { SessionManager } from './session.js';
import { initTheme }      from './theme.js';
import { initInstall }    from './install-prompt.js';
import { renderBookmarklet } from './bookmarklet.js';

// ── State ──────────────────────────────────────────────────────

const session = new SessionManager(onSessionUpdate);
const RECENTS_KEY = 'colab-recent-notebooks';
const PREFS_KEY   = 'colab-prefs';
const MAX_RECENTS = 10;

// ── Init ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Expose toast globally so other modules (bookmarklet.js, theme.js) can use it
  window.__colabShowToast = showToast;

  initTheme();
  initInstall();
  renderBookmarklet('mobile');
  session.setupVisibilityHandler();

  renderRecentList();
  restorePreferences();
  bindUI();
  handleUrlParams();
});

// ── URL param routing ──────────────────────────────────────────

function handleUrlParams() {
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  const tab    = params.get('tab');

  if (action === 'new') {
    openColab('https://colab.research.google.com/#create=true');
  }
  if (tab === 'recent') {
    document.querySelector('[data-tab="recent"]')?.click();
  }
}

// ── UI Bindings ────────────────────────────────────────────────

function bindUI() {
  // Launch buttons — open Colab in Chrome Custom Tab
  document.querySelectorAll('[data-url]').forEach(btn => {
    btn.addEventListener('click', () => openColab(btn.dataset.url));
  });

  // Wake Lock toggle
  const wakeLockToggle = document.getElementById('wake-lock-toggle');
  wakeLockToggle?.addEventListener('change', async () => {
    if (wakeLockToggle.checked) {
      const ok = await session.requestWakeLock();
      if (!ok) {
        wakeLockToggle.checked = false;
        showToast('Wake Lock not available on this device');
        return;
      }
      // Show tip about Chrome Memory Saver
      document.getElementById('wake-lock-hint')?.removeAttribute('hidden');
    } else {
      await session.releaseWakeLock();
      document.getElementById('wake-lock-hint')?.setAttribute('hidden', '');
    }
    savePreferences();
  });

  // Heartbeat toggle
  const heartbeatToggle = document.getElementById('heartbeat-toggle');
  heartbeatToggle?.addEventListener('change', () => {
    if (heartbeatToggle.checked) {
      session.startHeartbeat();
      document.getElementById('session-elapsed')?.removeAttribute('hidden');
    } else {
      session.stopHeartbeat();
      document.getElementById('session-elapsed')?.setAttribute('hidden', '');
    }
    savePreferences();
  });

  // Session heartbeat events → update UI
  document.addEventListener('colab:heartbeat', () => {
    updateSessionBanner(session.isActive, session.hasWakeLock);
  });

  // Add notebook button
  document.getElementById('add-notebook-btn')?.addEventListener('click', () => {
    showAddDialog();
  });

  // Add notebook dialog
  document.getElementById('add-dialog-save')?.addEventListener('click', saveNotebookFromDialog);
  document.getElementById('add-dialog-cancel')?.addEventListener('click', hideAddDialog);
  document.getElementById('notebook-url-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNotebookFromDialog();
    if (e.key === 'Escape') hideAddDialog();
  });

  // Bottom navigation tabs
  const tabs = document.querySelectorAll('.nav-item[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('nav-item--active');
        t.removeAttribute('aria-current');
      });
      tab.classList.add('nav-item--active');
      tab.setAttribute('aria-current', 'page');

      // Scroll to relevant section
      const targetMap = {
        home:     null,     // scroll to top
        recent:   'recent-section',
        css:      'bookmarklet-heading',
        settings: 'session-heading',
      };
      const targetId = targetMap[tab.dataset.tab];
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Variant chips for bookmarklet
  document.querySelectorAll('.chip[data-variant]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-variant]').forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      renderBookmarklet(chip.dataset.variant);
    });
  });
}

// ── Colab Launcher ─────────────────────────────────────────────

/**
 * Open a Colab URL.
 * On Android PWA, window.open triggers Chrome Custom Tab — not a new WebView.
 * This gives the user the full Chrome experience (cookies, extensions, saved passwords).
 */
function openColab(url) {
  if (!url) return;

  // Open in Chrome Custom Tab
  window.open(url, '_blank', 'noopener');

  // Update session state
  updateSessionBanner(true, session.hasWakeLock, 'Session opened');

  // Persist for heartbeat re-use
  try {
    localStorage.setItem('colab-last-url', url);
    localStorage.setItem('colab-last-opened', String(Date.now()));
  } catch (_) {}

  // Track in recents if it's a notebook URL
  if (url.includes('colab.research.google.com/drive/') ||
      url.includes('colab.research.google.com/github/') ||
      url.includes('colab.research.google.com/gist/')) {
    addToRecents({ url, name: urlToName(url), opened: Date.now() });
  }
}

function urlToName(url) {
  try {
    const u = new URL(url);
    // Extract meaningful segment from path
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last).replace(/_/g, ' ').replace(/\.ipynb$/, '') : 'Colab Notebook';
  } catch (_) {
    return 'Colab Notebook';
  }
}

// ── Session Banner ─────────────────────────────────────────────

function onSessionUpdate({ isActive, hasWakeLock }) {
  updateSessionBanner(isActive, hasWakeLock);
}

function updateSessionBanner(isActive, hasWakeLock, label = null) {
  const dot   = document.getElementById('session-dot');
  const lbl   = document.getElementById('session-label');
  if (!dot || !lbl) return;

  dot.className = 'session-dot';

  if (label) {
    dot.classList.add('session-dot--active');
    lbl.textContent = label;
  } else if (isActive) {
    dot.classList.add('session-dot--active');
    lbl.textContent = hasWakeLock
      ? 'Session active · Wake lock ON'
      : 'Session active · Wake lock OFF';
  } else {
    lbl.textContent = 'No active session';
  }
}

// ── Recent Notebooks ───────────────────────────────────────────

function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch (_) { return []; }
}

function saveRecents(list) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch (_) {}
}

function addToRecents(notebook) {
  let list = getRecents().filter(n => n.url !== notebook.url);
  list.unshift(notebook);
  list = list.slice(0, MAX_RECENTS);
  saveRecents(list);
  renderRecentList();
}

function removeFromRecents(url) {
  saveRecents(getRecents().filter(n => n.url !== url));
  renderRecentList();
}

function renderRecentList() {
  const list  = document.getElementById('recent-list');
  const empty = document.getElementById('recent-empty');
  if (!list) return;

  const recents = getRecents();

  // Remove existing items (but not the empty state element)
  list.querySelectorAll('.notebook-item').forEach(el => el.remove());

  if (recents.length === 0) {
    empty?.removeAttribute('hidden');
    return;
  }

  empty?.setAttribute('hidden', '');

  recents.forEach(nb => {
    const item = document.createElement('button');
    item.className = 'notebook-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-label', `Open ${nb.name}`);

    const timeAgo = formatTimeAgo(nb.opened);
    item.innerHTML = `
      <span class="notebook-item__icon" aria-hidden="true">📓</span>
      <span class="notebook-item__info">
        <span class="notebook-item__name">${escapeHtml(nb.name)}</span>
        <span class="notebook-item__meta">${timeAgo}</span>
      </span>
      <button class="notebook-item__delete" data-url="${escapeHtml(nb.url)}"
              aria-label="Remove ${escapeHtml(nb.name)}" title="Remove">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Click on item → open
    item.addEventListener('click', e => {
      if (!e.target.closest('.notebook-item__delete')) {
        openColab(nb.url);
      }
    });

    // Click delete button
    item.querySelector('.notebook-item__delete')?.addEventListener('click', e => {
      e.stopPropagation();
      removeFromRecents(nb.url);
    });

    list.appendChild(item);
  });
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min < 1)   return 'Just now';
  if (min < 60)  return `${min} min ago`;
  if (hr < 24)   return `${hr}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Add Notebook Dialog ────────────────────────────────────────

function showAddDialog() {
  const dialog = document.getElementById('add-notebook-dialog');
  if (!dialog) return;
  dialog.removeAttribute('hidden');
  dialog.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('notebook-url-input')?.focus(), 50);
}

function hideAddDialog() {
  const dialog = document.getElementById('add-notebook-dialog');
  if (!dialog) return;
  dialog.setAttribute('hidden', '');
  dialog.setAttribute('aria-hidden', 'true');
  // Clear inputs
  const urlInput  = document.getElementById('notebook-url-input');
  const nameInput = document.getElementById('notebook-name-input');
  if (urlInput)  urlInput.value  = '';
  if (nameInput) nameInput.value = '';
}

function saveNotebookFromDialog() {
  const urlInput  = document.getElementById('notebook-url-input');
  const nameInput = document.getElementById('notebook-name-input');
  const url  = urlInput?.value.trim();
  const name = nameInput?.value.trim() || urlToName(url);

  if (!url || !url.startsWith('http')) {
    urlInput?.focus();
    showToast('Please enter a valid Colab URL');
    return;
  }

  addToRecents({ url, name, opened: Date.now() });
  hideAddDialog();
  showToast(`"${name}" added to recents`);
}

// ── Preferences ────────────────────────────────────────────────

function restorePreferences() {
  const prefs = loadPreferences();

  const wakeLockToggle  = document.getElementById('wake-lock-toggle');
  const heartbeatToggle = document.getElementById('heartbeat-toggle');

  if (prefs.wakeLock && wakeLockToggle) {
    wakeLockToggle.checked = true;
    // Auto-request wake lock (may fail if page not focused yet — that's fine)
    session.requestWakeLock().then(ok => {
      if (!ok) wakeLockToggle.checked = false;
    });
  }

  if (prefs.heartbeat && heartbeatToggle) {
    heartbeatToggle.checked = true;
    session.startHeartbeat();
  }
}

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch (_) { return {}; }
}

function savePreferences() {
  const prefs = {
    wakeLock:  document.getElementById('wake-lock-toggle')?.checked ?? false,
    heartbeat: document.getElementById('heartbeat-toggle')?.checked ?? false,
    theme:     document.documentElement.dataset.theme ?? 'dark',
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

// ── Toast ──────────────────────────────────────────────────────

/**
 * Show a brief notification toast.
 * @param {string} message
 * @param {number} [duration=3000]
 */
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}
