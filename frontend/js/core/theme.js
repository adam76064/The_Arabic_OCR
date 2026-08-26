/**
 * js/core/theme.js — Unified Theme Engine (Calm Light & Deep Charcoal Dark Studio)
 * Supports instant switching, localStorage persistence, system sync, and zero-flash startup.
 */
(function (global) {
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem('app_theme');
      if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored;
      if (window.__appSettings?.darkMode || window.__appSettings?.nightMode) return 'dark';
    } catch (e) {}
    return 'auto';
  }

  function resolveEffectiveTheme(themeSetting) {
    if (themeSetting === 'dark') return 'dark';
    if (themeSetting === 'light') return 'light';
    // Auto / System preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(themeSetting) {
    const effective = resolveEffectiveTheme(themeSetting);
    const isDark = effective === 'dark';

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('night-mode', isDark);
    document.documentElement.classList.toggle('dark-mode', isDark);
    
    if (document.body) {
      document.body.classList.toggle('night-mode', isDark);
      document.body.classList.toggle('dark-mode', isDark);
    }

    try {
      localStorage.setItem('app_theme', themeSetting);
      if (window.__appSettings) {
        window.__appSettings.theme = themeSetting;
        window.__appSettings.darkMode = isDark;
        window.__appSettings.nightMode = isDark;
      }
    } catch (e) {}

    updateToggleButtons(isDark);

    // Dispatch global event for components needing redraws (e.g., canvas overlays)
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: effective, isDark, setting: themeSetting } }));
  }

  function updateToggleButtons(isDark) {
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
    getTheme() {
      return getStoredTheme();
    },
    getEffectiveTheme() {
      return resolveEffectiveTheme(getStoredTheme());
    },
    isDark() {
      return this.getEffectiveTheme() === 'dark';
    },
    setTheme(theme) {
      applyTheme(theme);
    },
    toggle() {
      const currentEffective = this.getEffectiveTheme();
      const next = currentEffective === 'dark' ? 'light' : 'dark';
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

      // System media query listener
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (getStoredTheme() === 'auto') {
            applyTheme('auto');
          }
        });
      }
    }
  };

  // Immediate early execution to prevent UI flicker
  const earlySetting = getStoredTheme();
  const earlyEffective = resolveEffectiveTheme(earlySetting);
  document.documentElement.setAttribute('data-theme', earlyEffective);
  document.documentElement.classList.toggle('night-mode', earlyEffective === 'dark');

  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
  window.addEventListener('appSettingsLoaded', () => {
    if (window.__appSettings?.theme) {
      applyTheme(window.__appSettings.theme);
    } else if (window.__appSettings?.darkMode !== undefined) {
      applyTheme(window.__appSettings.darkMode ? 'dark' : 'light');
    }
  });

  // Global Keyboard Shortcut: Ctrl+Shift+D or Ctrl+Alt+T
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      ThemeManager.toggle();
    }
  });

  global.ThemeManager = ThemeManager;
})(window);
