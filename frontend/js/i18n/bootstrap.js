/* Runs in <head> before styles are requested to prevent an RTL/LTR flash. */
(function () {
  var fallback = 'ar';
  var ltr = { en: true, de: true };
  try { fallback = localStorage.getItem('interfaceLanguage') || fallback; } catch (_) {}
  document.documentElement.lang = fallback;
  document.documentElement.dir = ltr[fallback] ? 'ltr' : 'rtl';
  document.documentElement.dataset.interfaceLanguage = fallback;
  document.documentElement.dataset.interfaceDirection = ltr[fallback] ? 'ltr' : 'rtl';
  // Do not reveal untranslated fallback text before AppI18n applies the locale.
  document.write('<style>html:not(.i18n-ready) body{visibility:hidden}</style>');
}());
