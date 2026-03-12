// theme.js — Dark / AMOLED / Light theme toggle
//
// Three themes:
//   dark  — Dark grey (default, avoids AMOLED halo around bright text)
//   amoled — True black (#000000) — AMOLED pixels physically off
//   light — Light theme
//
// The theme button cycles: dark → amoled → light → dark

const THEMES = ['dark', 'amoled', 'light'];
const STORAGE_KEY = 'colab-theme';

/** Moon icon for dark/amoled, Sun icon for light */
const ICONS = {
  dark: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  amoled: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.75" fill="currentColor" fill-opacity=".2"/>
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.636 5.636l1.414 1.414M16.95 16.95l1.414 1.414M5.636 18.364l1.414-1.414M16.95 7.05l1.414-1.414" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  </svg>`,
  light: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.75"/>
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  </svg>`,
};

const LABELS = {
  dark:   'Switch to AMOLED true-black',
  amoled: 'Switch to light mode',
  light:  'Switch to dark mode',
};

/**
 * Initialize theme from localStorage, apply it, and bind the toggle button.
 */
export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const root = document.documentElement;

  // Restore saved theme, or auto-detect
  let current = localStorage.getItem(STORAGE_KEY);
  if (!current || !THEMES.includes(current)) {
    current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  applyTheme(current, root, btn);

  if (btn) {
    btn.addEventListener('click', () => {
      const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
      current = THEMES[nextIndex];
      applyTheme(current, root, btn);
      try { localStorage.setItem(STORAGE_KEY, current); } catch (_) {}
      window.__colabShowToast?.(`Theme: ${current.charAt(0).toUpperCase() + current.slice(1)}`);
    });
  }

  // React to OS theme changes (e.g. scheduled dark mode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      current = e.matches ? 'dark' : 'light';
      applyTheme(current, root, btn);
    }
  });
}

function applyTheme(theme, root, btn) {
  root.dataset.theme = theme;

  if (btn) {
    btn.innerHTML = ICONS[theme];
    btn.setAttribute('aria-label', LABELS[theme]);
    btn.setAttribute('title', LABELS[theme]);
  }

  // Update theme-color meta for the browser chrome
  const metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  const metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  if (theme === 'light') {
    metaDark?.setAttribute('content', '#ffffff');
    metaLight?.setAttribute('content', '#ffffff');
  } else {
    metaDark?.setAttribute('content', '#000000');
    metaLight?.setAttribute('content', theme === 'amoled' ? '#000000' : '#ffffff');
  }
}

/** @returns {string} Current theme name */
export function getTheme() {
  return document.documentElement.dataset.theme ?? 'dark';
}
