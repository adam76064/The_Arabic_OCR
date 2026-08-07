/**
 * js/apply-icons.js — applies AppIcons to any element marked with
 * data-icon or data-icon-label, once the DOM is ready.
 *
 * data-icon="name"        → replaces the element's content with icon + label
 * data-icon-label="name"  → prepends icon before existing content (keeps
 *                            any nested markup, useful for headers)
 *
 * Load this AFTER js/icons.js and AFTER the page's own markup/scripts so
 * dynamically-injected buttons (e.g. from project-creator.js) are also
 * covered by re-running AppIcons.applyMarkers() if needed.
 */
(function (global) {
  function applyMarkers(root) {
    if (!global.AppIcons) return;
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconApplied) return;
      const label = el.textContent.trim();
      el.innerHTML = global.AppIcons.get(el.dataset.icon) + (label ? `<span>${label}</span>` : '');
      el.dataset.iconApplied = '1';
    });
    (root || document).querySelectorAll('[data-icon-label]').forEach(el => {
      if (el.dataset.iconApplied) return;
      const label = el.textContent.trim();
      el.innerHTML = global.AppIcons.get(el.dataset.iconLabel) + ' ' + `<span>${label}</span>`;
      el.dataset.iconApplied = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', () => applyMarkers());
  global.AppApplyIcons = applyMarkers;
})(window);
