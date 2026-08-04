/**
 * pages/review/state.js - centralized state for review page
 * Replaces scattered globals in review.js with structured store.
 */
(function(global) {
  // Reuse existing globals if already defined by legacy review.js
  // Otherwise initialize clean state.

  const ReviewState = {
    project: null,
    pageIndex: 0,
    selectedBlock: -1,
    multiSelected: new Set(),
    activeEditing: -1,
    cropZoom: 1.0,
    scaleRatioX: 1,
    scaleRatioY: 1,
  };

  // Sync with legacy globals if they exist
  function syncFromLegacy() {
    if (typeof global.currentProject !== 'undefined') ReviewState.project = global.currentProject;
    if (typeof global.currentPageIndex !== 'undefined') ReviewState.pageIndex = global.currentPageIndex;
    if (typeof global.selectedBlockIndex !== 'undefined') ReviewState.selectedBlock = global.selectedBlockIndex;
  }
  function syncToLegacy() {
    // expose for legacy code
    global.currentProject = ReviewState.project;
    global.currentPageIndex = ReviewState.pageIndex;
    global.selectedBlockIndex = ReviewState.selectedBlock;
    global.multiSelectedBlocks = ReviewState.multiSelected;
    global.activeEditingIndex = ReviewState.activeEditing;
    global.cropZoom = ReviewState.cropZoom;
    global.scaleRatioX = ReviewState.scaleRatioX;
    global.scaleRatioY = ReviewState.scaleRatioY;
  }

  // periodic sync (legacy globals may update)
  setInterval(syncFromLegacy, 500);

  global.ReviewState = ReviewState;
  global.ReviewStateSync = { syncFromLegacy, syncToLegacy };
})(window);
