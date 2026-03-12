// install-prompt.js — Progressive Web App install prompt handler
//
// Captures the browser's beforeinstallprompt event (Chrome Android)
// and shows a custom bottom-sheet install dialog instead of
// the browser's default mini-bar.

let deferredPrompt = null;

/**
 * Initialize the install prompt handler.
 * Call once at app startup.
 */
export function initInstall() {
  const sheet    = document.getElementById('install-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const acceptBtn = document.getElementById('install-accept-btn');
  const dismissBtn = document.getElementById('install-dismiss-btn');

  if (!sheet) return;

  // Check if already installed (running in standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) {
    // Already installed — no need to show prompt
    return;
  }

  // Check if user previously dismissed (for this session)
  if (sessionStorage.getItem('install-dismissed')) return;

  // Capture the install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    // Show our custom sheet after a 3s delay (don't interrupt first impression)
    setTimeout(() => showSheet(sheet, backdrop), 3000);
  });

  // User accepted install
  acceptBtn?.addEventListener('click', async () => {
    hideSheet(sheet, backdrop);
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[Install] User choice:', outcome);
    deferredPrompt = null;
  });

  // User dismissed — don't show again this session
  dismissBtn?.addEventListener('click', () => {
    hideSheet(sheet, backdrop);
    sessionStorage.setItem('install-dismissed', '1');
  });

  backdrop?.addEventListener('click', () => {
    hideSheet(sheet, backdrop);
    sessionStorage.setItem('install-dismissed', '1');
  });

  // When app is successfully installed
  window.addEventListener('appinstalled', () => {
    hideSheet(sheet, backdrop);
    deferredPrompt = null;
    window.__colabShowToast?.('Colab Mobile installed successfully!');
  });
}

function showSheet(sheet, backdrop) {
  if (!sheet) return;
  sheet.removeAttribute('hidden');
  backdrop?.removeAttribute('hidden');
  // Force layout before adding class (transition requires initial state)
  sheet.offsetHeight;
  backdrop?.offsetHeight;
  sheet.classList.add('is-open');
  backdrop?.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
}

function hideSheet(sheet, backdrop) {
  if (!sheet) return;
  sheet.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  // Remove from DOM after transition
  sheet.addEventListener('transitionend', () => {
    sheet.setAttribute('hidden', '');
    backdrop?.setAttribute('hidden', '');
  }, { once: true });
}

/** Returns true if the app can be installed (prompt is available). */
export function canInstall() {
  return deferredPrompt !== null;
}

/** Programmatically trigger the install prompt. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}
