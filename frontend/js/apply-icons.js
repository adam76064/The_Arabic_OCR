/**
 * js/apply-icons.js — automatically applies AppIcons to any element marked with
 * data-icon or data-icon-label, both on load and dynamically via MutationObserver.
 */
(function (global) {
  function applyMarkers(root) {
    if (global.AppIcons && typeof global.AppIcons.applyAll === 'function') {
      global.AppIcons.applyAll(root || document);
    }
  }

  // Initial load
  document.addEventListener('DOMContentLoaded', () => {
    applyMarkers();

    // Observe dynamic elements added to DOM
    if (window.MutationObserver && document.body) {
      const observer = new MutationObserver((mutations) => {
        let hasUnapplied = false;
        for (const m of mutations) {
          for (let i = 0; i < m.addedNodes.length; i++) {
            const node = m.addedNodes[i];
            if (node.nodeType === 1) { // Only inspect Element nodes
              if ((node.hasAttribute && node.hasAttribute('data-icon') && !node.hasAttribute('data-icon-applied')) ||
                  (node.hasAttribute && node.hasAttribute('data-icon-label') && !node.hasAttribute('data-icon-applied')) ||
                  (node.querySelector && node.querySelector('[data-icon]:not([data-icon-applied]), [data-icon-label]:not([data-icon-applied])'))) {
                hasUnapplied = true;
                break;
              }
            }
          }
          if (hasUnapplied) break;
        }
        // Only re-apply if genuinely un-rendered icon placeholders were introduced
        if (hasUnapplied) {
          applyMarkers();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

  window.addEventListener('pywebviewready', () => applyMarkers());
  global.AppApplyIcons = applyMarkers;
})(window);
