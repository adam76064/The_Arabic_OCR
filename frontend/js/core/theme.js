/**
 * core/theme.js - global application theme manager.
 *
 * Theme is persisted alongside the existing global app settings and cached in
 * localStorage so each static HTML entry point can render in the selected
 * theme before pywebview has finished exposing its API.
 */
(function (global) {
  const LIGHT_THEME = 'light';
  const DARK_THEME = 'dark';
  const STORAGE_KEY = 'appTheme';
  let persistedSettingsLoaded = false;

  function normalizeTheme(theme) {
    return theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  }

  function getCachedTheme() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached === DARK_THEME || cached === LIGHT_THEME ? cached : null;
    } catch (_) {
      return null;
    }
  }

  function getTheme() {
    // Before the backend settings arrive, the cache prevents a light-theme
    // flash caused by the synchronous default settings object.
    const cached = getCachedTheme();
    if (!persistedSettingsLoaded && cached) return cached;

    const configured = global.__appSettings && global.__appSettings.theme;
    if (configured === DARK_THEME || configured === LIGHT_THEME) {
      return configured;
    }
    return cached || LIGHT_THEME;
  }

  function applyTheme(theme) {
    const normalizedTheme = normalizeTheme(theme);
    const root = document.documentElement;
    root.dataset.theme = normalizedTheme;
    root.style.colorScheme = normalizedTheme;

    if (document.body) {
      document.body.classList.toggle('night-mode', normalizedTheme === DARK_THEME);
    }

    global.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: normalizedTheme }
    }));
    return normalizedTheme;
  }

  async function setTheme(theme, { persist = true } = {}) {
    const normalizedTheme = normalizeTheme(theme);
    global.__appSettings = global.__appSettings || {};
    global.__appSettings.theme = normalizedTheme;

    try {
      localStorage.setItem(STORAGE_KEY, normalizedTheme);
    } catch (_) {}

    applyTheme(normalizedTheme);
    if (persist && typeof global.saveAppSettings === 'function') {
      await global.saveAppSettings();
    }
    return normalizedTheme;
  }

  global.AppTheme = {
    LIGHT_THEME,
    DARK_THEME,
    getTheme,
    applyTheme,
    setTheme
  };

  document.addEventListener('DOMContentLoaded', () => applyTheme(getTheme()));
  global.addEventListener('appSettingsLoaded', () => {
    persistedSettingsLoaded = true;
    const theme = applyTheme(getTheme());
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  });
}(window));
