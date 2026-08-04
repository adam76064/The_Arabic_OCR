/**
 * pages/review/category.js - category picker facade
 */
(function(global) {
  function openPicker(e, blockIndex) {
    if (typeof global.openCategoryPicker === 'function') return global.openCategoryPicker(e, blockIndex);
  }
  global.ReviewCategory = { openPicker };
})(window);
