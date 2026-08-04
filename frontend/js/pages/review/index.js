/**
 * pages/review/index.js - orchestrator for new modular review page
 * This file runs after legacy review.js has initialized.
 * It ensures new core modules are wired and logs healthy init.
 */
(function() {
  function initNewReviewShell() {
    console.log('[Review] New modular shell init: state, canvas, panels, editor, tracking, category, preview loaded');

    // Ensure core store has app settings
    if (window.AppStore && window.__appSettings) {
      window.AppStore.setSettings(window.__appSettings);
    }

    // If legacy initApp not called yet, trigger via core/api ready
    if (window.AppApi && typeof window.AppApi.ready === 'function') {
      window.AppApi.ready().then(() => {
        // If review.js initApp already ran, we just sync panels
        if (window.ReviewPanels && typeof window.ReviewPanels.setupPanels === 'function') {
          try { window.ReviewPanels.setupPanels(); } catch(e) {}
        }
      });
    }

    // Example: hook notifications on save
    if (window.showNotif) {
      const origSave = window.saveBlockSilently;
      if (typeof origSave === 'function' && !origSave._wrapped) {
        window.saveBlockSilently = async function() {
          const res = await origSave.apply(this, arguments);
          return res;
        };
        window.saveBlockSilently._wrapped = true;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initNewReviewShell);
  window.addEventListener('pywebviewready', initNewReviewShell);
})();
