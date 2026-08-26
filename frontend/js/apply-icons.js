/**
 * js/apply-icons.js — applies AppIcons to any element marked with
 * data-icon or data-icon-label, once the DOM is ready.
 *
 * data-icon="name"        → prepends icon before existing content
 * data-icon-label="name"  → prepends icon before existing content
 */
(function (global) {
  function applyMarkers(root) {
    if (!global.AppIcons) return;
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconApplied) return;
      const iconSvg = global.AppIcons.get(el.dataset.icon);
      if (!el.querySelector('svg')) {
        el.insertAdjacentHTML('afterbegin', iconSvg + ' ');
      }
      el.dataset.iconApplied = '1';
    });
    (root || document).querySelectorAll('[data-icon-label]').forEach(el => {
      if (el.dataset.iconApplied) return;
      const iconSvg = global.AppIcons.get(el.dataset.iconLabel);
      if (!el.querySelector('svg')) {
        el.insertAdjacentHTML('afterbegin', iconSvg + ' ');
      }
      el.dataset.iconApplied = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', () => applyMarkers());
  global.AppApplyIcons = applyMarkers;
})(window);
