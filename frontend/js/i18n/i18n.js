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
      name: locale.meta.name,
      nativeName: locale.meta.nativeName,
      direction: locale.meta.direction
    }));
  }

  function isSupported(language) {
    return Boolean(global.AppLocales && global.AppLocales[language]);
  }

  function getLanguage() {
    const configured = global.__appSettings && global.__appSettings.interfaceLanguage;
    if (isSupported(configured)) return configured;
    try {
      const cached = localStorage.getItem('interfaceLanguage');
      if (isSupported(cached)) return cached;
    } catch (_) {}
    return FALLBACK_LANGUAGE;
  }

  function t(key, replacements = {}) {
    const locale = global.AppLocales[getLanguage()] || global.AppLocales[FALLBACK_LANGUAGE];
    const fallback = global.AppLocales[FALLBACK_LANGUAGE];
    let value = locale.messages[key] || fallback.messages[key] || key;
    Object.entries(replacements).forEach(([name, replacement]) => {
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
    return value;
  }

  function applyDocumentLanguage() {
    const language = getLanguage();
    const locale = global.AppLocales[language];
    document.documentElement.lang = language;
    document.documentElement.dir = locale.meta.direction;
    document.body?.setAttribute('dir', locale.meta.direction);
    document.documentElement.dataset.interfaceLanguage = language;
    document.documentElement.dataset.interfaceDirection = locale.meta.direction;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-document-title]').forEach((element) => {
      document.title = t(element.dataset.i18nDocumentTitle);
    });
    global.dispatchEvent(new CustomEvent('languageChanged', { detail: { language, direction: locale.meta.direction } }));
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
    try { localStorage.setItem('interfaceLanguage', getLanguage()); } catch (_) {}
    applyDocumentLanguage();
  });
})(window);
