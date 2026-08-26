/*
 * preprocessing/state.js — Reactive state container for Pre-Processing Studio.
 */
(function (global) {
  const STAGES = [
    'orientation',
    'split',
    'deskew',
    'content',
    'layout',
    'output'
  ];

  const DEFAULT_PARAMS = {
    orientation: { rotation: 0, auto_detect: false },
    split: { layout_type: 'auto', split_line: null, split_direction: 'rtl' },
    deskew: { angle: null, auto_detect: true, manual: false },
    content: { content_rect: null, auto_detect: true, padding: 10 },
    layout: {
      margins: { top: 10.0, bottom: 10.0, left: 15.0, right: 15.0, unit: 'mm' },
      alignment: { horizontal: 'CENTER', vertical: 'CENTER' },
      match_size: false
    },
    output: {
      mode: 'bw',
      binarization: 'none',
      threshold_adjustment: 0,
      sauvola_k: 0.34,
      sauvola_window: 51,
      wolf_k: 0.30,
      wolf_window: 51,
      zigzag_detail: 30,
      zigzag_intensity: 0,
      zigzag_weight: 90.0,
      normalize_illumination: true,
      despeckle: 1.0,
      morphological_smoothing: false,
      savitzky_golay_smoothing: false,
      fill_margins: true
    }
  };

  const PreprocessingState = {
    projectId: null,
    project: null,
    currentPageIndex: 0,
    activeStage: 'orientation', // 'orientation'|'split'|'deskew'|'content'|'layout'|'output'
    
    // Parameters per stage for the current page
    stagesParams: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
    
    // Computed stage metadata from preview engine (detected angles, cutter lines, content rects)
    stageMetadata: {},

    // Canvas view transform
    zoom: 1.0,
    panX: 0,
    panY: 0,
    imageWidth: 0,
    imageHeight: 0,
    naturalWidth: 0,
    naturalHeight: 0,

    // Stage 6 split curtain slider position (0.0 to 1.0)
    splitCurtainPos: 0.5,

    // Status flags
    isLoading: false,
    isDirty: false,
    previewDataUrl: '',
    originalDataUrl: '',

    // Listeners
    _listeners: new Set(),

    getStages() {
      return STAGES;
    },

    getDefaults() {
      return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    },

    resetForNewPage() {
      // Clear page-specific geometry so new page automatically auto-detects
      if (this.stagesParams.split) this.stagesParams.split.split_line = null;
      if (this.stagesParams.content) this.stagesParams.content.content_rect = null;
      if (this.stagesParams.deskew) {
        this.stagesParams.deskew.angle = null;
        this.stagesParams.deskew.manual = false;
        this.stagesParams.deskew.auto_detect = true;
      }
      this.stageMetadata = {};
      this.isDirty = false;
      this.notify();
    },

    set(partial) {
      Object.assign(this, partial);
      this.notify();
    },

    updateStageParams(stageName, partial) {
      if (!this.stagesParams[stageName]) {
        this.stagesParams[stageName] = {};
      }
      Object.assign(this.stagesParams[stageName], partial);
      this.isDirty = true;
      this.notify();
    },

    subscribe(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    },

    notify() {
      this._listeners.forEach((fn) => {
        try { fn(this); } catch (e) { console.error('State subscriber error:', e); }
      });
    }
  };

  global.PreprocessingState = PreprocessingState;
})(window);
