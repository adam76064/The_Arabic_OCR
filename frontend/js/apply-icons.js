/**
 * js/apply-icons.js — automatically applies AppIcons to any element marked with
 * data-icon or data-icon-label, both on load and dynamically.
 */
(function (global) {
  function applyMarkers(root) {
    if (global.AppIcons && typeof global.AppIcons.applyAll === 'function') {
      global.AppIcons.applyAll(root || document);
    }
  }

  document.addEventListener('DOMContentLoaded', () => applyMarkers());
  window.addEventListener('pywebviewready', () => applyMarkers());
  global.AppApplyIcons = applyMarkers;
})(window);
