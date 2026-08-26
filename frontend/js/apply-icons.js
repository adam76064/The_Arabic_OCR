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
        let shouldApply = false;
        for (const m of mutations) {
          if (m.addedNodes.length > 0) {
            shouldApply = true;
            break;
          }
        }
        if (shouldApply) {
          applyMarkers();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

  window.addEventListener('pywebviewready', () => applyMarkers());
  global.AppApplyIcons = applyMarkers;
})(window);
