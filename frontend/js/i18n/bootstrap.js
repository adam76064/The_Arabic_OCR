/* Runs in <head> before styles are requested to prevent an RTL/LTR flash. */
(function () {
  var fallback = 'ar';
  var ltr = { en: true, de: true };
  try { fallback = localStorage.getItem('interfaceLanguage') || fallback; } catch (_) {}
  document.documentElement.lang = fallback;
  document.documentElement.dir = ltr[fallback] ? 'ltr' : 'rtl';
}());
