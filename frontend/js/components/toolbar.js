/**
 * components/toolbar.js - formatting toolbar injection
 * Keeps original behavior but modularized.
 */
(function(global) {
  const toolbarText = (key) => global.AppI18n?.t(key) || key;

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
        <button data-align="right" title="${toolbarText('format.right')}">≡≡/ Right</button>
        <button data-align="center" title="${toolbarText('format.center')}">≡ Center</button>
        <button data-align="left" title="${toolbarText('format.left')}">Left /≡≡</button>
        <button data-align="justify" title="${toolbarText('format.justifyShort')}">Justify</button>
        <span class="toolbar-sep"></span>
        <button data-dir="rtl" title="${toolbarText('format.rtlShort')}">RTL</button>
        <button data-dir="ltr" title="${toolbarText('format.ltrShort')}">LTR</button>
      </div>
    `;
  }

  global.AppToolbar = { injectToolbar };
})(window);
