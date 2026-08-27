/*
 * i18n/i18n.js
 * Small framework-free localization service. Locale metadata controls both
 * document language and writing direction, so adding a locale never requires
 * direction checks throughout page code.
 */
(function (global) {
  const FALLBACK_LANGUAGE = 'ar';

  function supportedLanguages() {
    return Object.entries(global.AppLocales || {}).map(([code, locale]) => ({
      code,
      name: (locale && locale.meta && locale.meta.name) || code,
      nativeName: (locale && locale.meta && locale.meta.nativeName) || code,
      direction: (locale && locale.meta && locale.meta.direction) || (code === 'ar' ? 'rtl' : 'ltr')
    }));
  }

  function isSupported(language) {
    return Boolean(global.AppLocales && global.AppLocales[language]);
  }

  function getLanguage() {
    // The local cache is available before pywebview settings load and must win
    // during startup to avoid briefly rendering the Arabic default.
    try {
      const cached = localStorage.getItem('interfaceLanguage');
      if (isSupported(cached)) return cached;
    } catch (_) {}
    const configured = global.__appSettings && global.__appSettings.interfaceLanguage;
    return isSupported(configured) ? configured : FALLBACK_LANGUAGE;
  }

  function t(key, replacements = {}) {
    if (!key) return '';
    const currentLang = getLanguage();
    const locales = global.AppLocales || {};
    const locale = locales[currentLang] || locales[FALLBACK_LANGUAGE];
    const fallback = locales[FALLBACK_LANGUAGE];

    const getMsg = (loc, k) => {
      if (!loc) return null;
      if (loc.messages && typeof loc.messages[k] !== 'undefined') return loc.messages[k];
      if (typeof loc[k] !== 'undefined') return loc[k];
      return null;
    };

    let value = getMsg(locale, key);
    if (value === null || typeof value === 'undefined') {
      value = getMsg(fallback, key);
    }
    if (value === null || typeof value === 'undefined') {
      value = key;
    }

    if (typeof value === 'string') {
      Object.entries(replacements).forEach(([name, replacement]) => {
        value = value.replaceAll(`{${name}}`, String(replacement));
      });
    }
    return value;
  }

  function applyDocumentLanguage() {
    const language = getLanguage();
    const locales = global.AppLocales || {};
    const locale = locales[language] || locales[FALLBACK_LANGUAGE];
    const direction = (locale && locale.meta && locale.meta.direction) || (language === 'ar' ? 'rtl' : 'ltr');

    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body?.setAttribute('dir', direction);
    document.documentElement.dataset.interfaceLanguage = language;
    document.documentElement.dataset.interfaceDirection = direction;

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      if (key) {
        element.textContent = t(key);
        if (element.hasAttribute('data-icon') || element.hasAttribute('data-icon-label')) {
          element.removeAttribute('data-icon-applied');
        }
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      if (key) element.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const key = element.dataset.i18nTitle;
      if (key) element.title = t(key);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const key = element.dataset.i18nAriaLabel;
      if (key) element.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-document-title]').forEach((element) => {
      const key = element.dataset.i18nDocumentTitle;
      if (key) document.title = t(key);
    });
    if (global.AppIcons && typeof global.AppIcons.applyAll === 'function') {
      global.AppIcons.applyAll(document);
    }
    document.documentElement.classList.add('i18n-ready');
    if (global.dispatchEvent && typeof global.dispatchEvent === 'function') {
      try {
        global.dispatchEvent(new CustomEvent('languageChanged', { detail: { language, direction } }));
      } catch (_) {}
    }
  }

  async function setLanguage(language, { persist = true } = {}) {
    if (!isSupported(language)) throw new Error(`Unsupported interface language: ${language}`);
    global.__appSettings = global.__appSettings || {};
    global.__appSettings.interfaceLanguage = language;
    try { localStorage.setItem('interfaceLanguage', language); } catch (_) {}
    applyDocumentLanguage();
    if (persist && typeof global.saveAppSettings === 'function') await global.saveAppSettings();
  }

  function categoryLabel(category) { return t(`category.${category}`) === `category.${category}` ? category : t(`category.${category}`); }

  global.AppI18n = { FALLBACK_LANGUAGE, supportedLanguages, getLanguage, setLanguage, t, categoryLabel, applyDocumentLanguage };
  document.addEventListener('DOMContentLoaded', applyDocumentLanguage);
  global.addEventListener('appSettingsLoaded', () => {
    // Persisted settings are authoritative once the backend is available.
    const persisted = global.__appSettings && global.__appSettings.interfaceLanguage;
    if (isSupported(persisted)) {
      try { localStorage.setItem('interfaceLanguage', persisted); } catch (_) {}
    }
    applyDocumentLanguage();
  });
})(window);
