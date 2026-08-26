/* Runs in <head> before styles are requested to prevent RTL/LTR and theme flash. */
(function () {
  var fallback = 'ar';
  var ltr = { en: true, de: true };
  try { fallback = localStorage.getItem('interfaceLanguage') || fallback; } catch (_) {}
  document.documentElement.lang = fallback;
  document.documentElement.dir = ltr[fallback] ? 'ltr' : 'rtl';
  document.documentElement.dataset.interfaceLanguage = fallback;
  document.documentElement.dataset.interfaceDirection = ltr[fallback] ? 'ltr' : 'rtl';

  // Instant zero-flash dark mode
  try {
    var storedTheme = localStorage.getItem('app_theme');
    var isDark = false;
    if (storedTheme === 'dark') {
      isDark = true;
    } else if (storedTheme === 'light') {
      isDark = false;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      isDark = true;
    }
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('night-mode', 'dark-mode');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('night-mode', 'dark-mode');
    }
  } catch (_) {}

  // Do not reveal untranslated fallback text before AppI18n applies the locale.
  document.write('<style>html:not(.i18n-ready) body{visibility:hidden}</style>');
}());
