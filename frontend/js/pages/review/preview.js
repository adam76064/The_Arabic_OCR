/**
 * pages/review/preview.js - text preview overlay logic
 * Currently delegates to original setup in review.js; this module
 * provides hook for future refactoring.
 */
(function(global) {
  function openPreview() {
    document.getElementById('text-preview-overlay')?.classList.remove('hidden');
  }
  function closePreview() {
    document.getElementById('text-preview-overlay')?.classList.add('hidden');
  }
  global.ReviewPreview = { openPreview, closePreview };
})(window);
