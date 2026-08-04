/**
 * pages/review/editor.js - block list rendering & sync helpers
 */
(function(global) {
  function syncElementFromContent(el, contentEl) {
    if (typeof global.syncElementFromContent === 'function') {
      return global.syncElementFromContent(el, contentEl);
    }
    // fallback minimal
    if (!el || !contentEl) return false;
    const newHtml = contentEl.innerHTML;
    const changed = newHtml !== el.text;
    el.text = newHtml;
    return changed;
  }

  function refreshIndicators(wrapperEl, element) {
    if (typeof global.refreshIndicatorsFor === 'function') {
      return global.refreshIndicatorsFor(wrapperEl, element);
    }
    if (wrapperEl) wrapperEl.classList.toggle('block-reviewed', !!element.reviewed);
  }

  // Re-export for review.js
  global.ReviewEditor = { syncElementFromContent, refreshIndicators };
})(window);
