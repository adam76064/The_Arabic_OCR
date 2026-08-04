/**
 * components/toolbar.js - formatting toolbar injection
 * Keeps original behavior but modularized.
 */
(function(global) {
  // Original toolbar HTML is injected via text-formatting.js
  // This file now just ensures toolbar initialization after DOM
  function injectToolbar(targetId, isMain) {
    if (typeof global.injectToolbar === 'function') {
      // original injectToolbar from text-formatting.js may exist globally
      // call it if available, otherwise do nothing
      try { return global.injectToolbar(targetId, isMain); } catch(e) {}
    }
    // fallback minimal toolbar if old function not present
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = `
      <div class="formatting-toolbar-group">
        <button data-align="right" title="محاذاة يمين">≡≡/ Right</button>
        <button data-align="center" title="توسيط">≡ Center</button>
        <button data-align="left" title="محاذاة يسار">Left /≡≡</button>
        <button data-align="justify" title="ضبط">Justify</button>
        <span class="toolbar-sep"></span>
        <button data-dir="rtl" title="اتجاه من اليمين">RTL</button>
        <button data-dir="ltr" title="اتجاه من اليسار">LTR</button>
      </div>
    `;
  }

  global.AppToolbar = { injectToolbar };
})(window);
