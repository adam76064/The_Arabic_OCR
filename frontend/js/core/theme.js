/**
 * js/core/theme.js — Unified Theme Engine (Calm Light & Deep Charcoal Dark Studio)
 * Supports instant switching, localStorage persistence, system sync, and zero-flash startup.
 */
(function (global) {
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem('app_theme');
      if (stored === 'dark' || stored === 'light') return stored;
      if (window.__appSettings?.darkMode || window.__appSettings?.nightMode) return 'dark';
    } catch (e) {}
    return 'light';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('night-mode', isDark);
    document.documentElement.classList.toggle('dark-mode', isDark);
    
    if (document.body) {
      document.body.classList.toggle('night-mode', isDark);
      document.body.classList.toggle('dark-mode', isDark);
    }

    try {
      localStorage.setItem('app_theme', theme);
      if (window.__appSettings) {
        window.__appSettings.darkMode = isDark;
        window.__appSettings.nightMode = isDark;
      }
    } catch (e) {}

    updateToggleButtons(theme);

    // Dispatch global event for components needing redraws (e.g., canvas overlays)
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme, isDark } }));
  }

  function updateToggleButtons(theme) {
    const isDark = theme === 'dark';
    const iconName = isDark ? 'sun' : 'moon';
    const labelKey = isDark ? 'theme.lightMode' : 'theme.darkMode';
    const labelText = window.AppI18n ? window.AppI18n.t(labelKey) : (isDark ? 'الوضع النهاري' : 'الوضع الليلي');
    const svgIcon = window.AppIcons ? window.AppIcons.get(iconName) : '';

    document.querySelectorAll('.theme-toggle-btn, #theme-toggle-btn, #btn-toggle-theme').forEach(btn => {
      btn.title = labelText;
      btn.setAttribute('aria-label', labelText);
      const labelSpan = btn.querySelector('.theme-label, span');
      if (labelSpan) {
        labelSpan.textContent = labelText;
      }
      const iconContainer = btn.querySelector('.theme-icon-slot') || btn;
      if (btn.classList.contains('btn-icon')) {
        btn.innerHTML = svgIcon;
      } else {
        const svg = btn.querySelector('svg');
        if (svg) svg.outerHTML = svgIcon;
        else if (!btn.querySelector('svg')) btn.insertAdjacentHTML('afterbegin', svgIcon + ' ');
      }
    });
  }

  const ThemeManager = {
    get() {
      return document.documentElement.getAttribute('data-theme') || getStoredTheme();
    },
    isDark() {
      return this.get() === 'dark';
    },
    set(theme) {
      applyTheme(theme === 'dark' ? 'dark' : 'light');
    },
    toggle() {
      const current = this.get();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    },
    init() {
      const initial = getStoredTheme();
      applyTheme(initial);

      // Bind all existing toggle buttons in DOM
      document.querySelectorAll('.theme-toggle-btn, #theme-toggle-btn, #btn-toggle-theme').forEach(btn => {
        if (!btn._themeBound) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            ThemeManager.toggle();
          });
          btn._themeBound = true;
        }
      });
    }
  };

  // Immediate early execution to prevent UI flicker
  const earlyTheme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', earlyTheme);
  document.documentElement.classList.toggle('night-mode', earlyTheme === 'dark');

  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
  window.addEventListener('appSettingsLoaded', () => {
    if (window.__appSettings?.darkMode !== undefined) {
      const target = window.__appSettings.darkMode ? 'dark' : 'light';
      if (target !== ThemeManager.get()) applyTheme(target);
    }
  });

  // Shortcut Ctrl+Shift+D to toggle theme
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      ThemeManager.toggle();
    }
  });

  global.ThemeManager = ThemeManager;
})(window);
