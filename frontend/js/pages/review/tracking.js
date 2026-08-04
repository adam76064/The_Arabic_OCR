/**
 * pages/review/tracking.js - word/line/cell tracking abstraction
 */
(function(global) {
  const defaultTrackingConfig = { cells: true, words: false, lines: false, block: false };
  try {
    const saved = localStorage.getItem('trackingConfig');
    global.__trackingConfig = saved ? JSON.parse(saved) : defaultTrackingConfig;
  } catch(e) {
    global.__trackingConfig = defaultTrackingConfig;
  }

  function updateTrackingHighlight(contentEl, element) {
    if (!window.TextTrackingEngine) return;
    const highlight = window.TextTrackingEngine.getHighlightBBox(contentEl, element, window.__trackingConfig);
    if (typeof global.setTrackingHighlight === 'function') global.setTrackingHighlight(highlight);
    if (highlight?.bbox && typeof global.panCropViewTo === 'function') {
      global.panCropViewTo(highlight.bbox);
    }
  }

  const debounced = (global.AppUtils?.debounce || function(fn, ms){
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  })(updateTrackingHighlight, 120);

  global.ReviewTracking = {
    update: updateTrackingHighlight,
    debounced,
    config: global.__trackingConfig
  };
})(window);
