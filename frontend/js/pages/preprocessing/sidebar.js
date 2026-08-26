/*
 * preprocessing/sidebar.js — Stage parameter controls and live slider bindings.
 */
(function (global) {
  class PreprocessingSidebar {
    constructor(sidebarEl) {
      this.sidebar = sidebarEl;
      this.debounceTimer = null;
      this._bindElements();
    }

    _bindElements() {
      const state = global.PreprocessingState;

      // ── Stage 1: Orientation ──
      const rotBtns = this.sidebar.querySelectorAll('.rotation-btn');
      rotBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const rot = parseInt(btn.dataset.rot, 10);
          state.updateStageParams('orientation', { rotation: rot });
          this.updateUI();
          this.triggerLivePreview();
        });
      });

      // ── Stage 2: Split ──
      const splitType = this.sidebar.querySelector('#split-layout-type');
      if (splitType) {
        splitType.addEventListener('change', (e) => {
          state.updateStageParams('split', { layout_type: e.target.value });
          this.triggerLivePreview();
        });
      }

      const splitDir = this.sidebar.querySelector('#split-direction');
      if (splitDir) {
        splitDir.addEventListener('change', (e) => {
          state.updateStageParams('split', { split_direction: e.target.value });
          global.PreprocessingStudio?.renderCanvas();
        });
      }

      const autoSplitBtn = this.sidebar.querySelector('#btn-auto-split');
      if (autoSplitBtn) {
        autoSplitBtn.addEventListener('click', () => {
          state.updateStageParams('split', { split_line: null });
          this.triggerLivePreview();
        });
      }

      // ── Stage 3: Deskew ──
      const deskewSlider = this.sidebar.querySelector('#deskew-angle-slider');
      const deskewVal = this.sidebar.querySelector('#deskew-angle-val');
      if (deskewSlider) {
        deskewSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (deskewVal) deskewVal.textContent = `${val.toFixed(2)}°`;
          state.updateStageParams('deskew', { angle: val, manual: true, auto_detect: false });
          this.triggerDebouncedPreview();
        });
      }

      const autoDeskewBtn = this.sidebar.querySelector('#btn-auto-deskew');
      if (autoDeskewBtn) {
        autoDeskewBtn.addEventListener('click', () => {
          state.updateStageParams('deskew', { angle: null, manual: false, auto_detect: true });
          this.triggerLivePreview();
        });
      }

      const resetDeskewBtn = this.sidebar.querySelector('#btn-reset-deskew');
      if (resetDeskewBtn) {
        resetDeskewBtn.addEventListener('click', () => {
          state.updateStageParams('deskew', { angle: 0.0, manual: true, auto_detect: false });
          if (deskewSlider) deskewSlider.value = 0;
          if (deskewVal) deskewVal.textContent = '0.00°';
          this.triggerLivePreview();
        });
      }

      // ── Stage 4: Content ──
      const autoContentBtn = this.sidebar.querySelector('#btn-auto-content');
      if (autoContentBtn) {
        autoContentBtn.addEventListener('click', () => {
          state.updateStageParams('content', { content_rect: null, auto_detect: true });
          this.triggerLivePreview();
          if (global.showNotif) global.showNotif('جاري كشف صندوق المحتوى تلقائياً...', 'info');
        });
      }

      const resetContentBtn = this.sidebar.querySelector('#btn-reset-content');
      if (resetContentBtn) {
        resetContentBtn.addEventListener('click', () => {
          state.updateStageParams('content', {
            content_rect: { x: 0, y: 0, width: state.imageWidth, height: state.imageHeight }
          });
          global.PreprocessingStudio?.renderCanvas();
          if (global.showNotif) global.showNotif('تم تحديد كامل مساحة الصفحة', 'info');
        });
      }

      // ── Stage 5: Layout & Margins ──
      ['top', 'bottom', 'left', 'right'].forEach((side) => {
        const input = this.sidebar.querySelector(`#margin-${side}`);
        if (input) {
          input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            const cur = state.stagesParams.layout?.margins || {};
            state.updateStageParams('layout', {
              margins: { ...cur, [side]: val }
            });
            this.triggerDebouncedPreview();
          });
        }
      });

      const alignH = this.sidebar.querySelector('#align-horizontal');
      const alignV = this.sidebar.querySelector('#align-vertical');
      if (alignH) {
        alignH.addEventListener('change', (e) => {
          const cur = state.stagesParams.layout?.alignment || {};
          state.updateStageParams('layout', { alignment: { ...cur, horizontal: e.target.value } });
          this.triggerLivePreview();
        });
      }
      if (alignV) {
        alignV.addEventListener('change', (e) => {
          const cur = state.stagesParams.layout?.alignment || {};
          state.updateStageParams('layout', { alignment: { ...cur, vertical: e.target.value } });
          this.triggerLivePreview();
        });
      }

      const matchOther = this.sidebar.querySelector('#match-other-pages');
      if (matchOther) {
        matchOther.addEventListener('change', (e) => {
          state.updateStageParams('layout', { match_size: e.target.checked });
          this.triggerLivePreview();
        });
      }

      // ── Stage 6: Output / Binarization ──
      const binarEngine = this.sidebar.querySelector('#binarization-engine');
      if (binarEngine) {
        binarEngine.addEventListener('change', (e) => {
          state.updateStageParams('output', { binarization: e.target.value });
          this.updateOutputEngineControls();
          this.triggerLivePreview();
        });
      }

      const threshSlider = this.sidebar.querySelector('#threshold-adj-slider');
      const threshVal = this.sidebar.querySelector('#threshold-adj-val');
      if (threshSlider) {
        threshSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          if (threshVal) threshVal.textContent = val > 0 ? `+${val}` : `${val}`;
          state.updateStageParams('output', { threshold_adjustment: val });
          this.triggerDebouncedPreview();
        });
      }

      const despeckleSlider = this.sidebar.querySelector('#despeckle-slider');
      const despeckleVal = this.sidebar.querySelector('#despeckle-val');
      if (despeckleSlider) {
        despeckleSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (despeckleVal) despeckleVal.textContent = val.toFixed(1);
          state.updateStageParams('output', { despeckle: val });
          this.triggerDebouncedPreview();
        });
      }

      const normIllum = this.sidebar.querySelector('#normalize-illumination');
      if (normIllum) {
        normIllum.addEventListener('change', (e) => {
          state.updateStageParams('output', { normalize_illumination: e.target.checked });
          this.triggerLivePreview();
        });
      }

      const fillMargins = this.sidebar.querySelector('#fill-margins');
      if (fillMargins) {
        fillMargins.addEventListener('change', (e) => {
          state.updateStageParams('output', { fill_margins: e.target.checked });
          this.triggerLivePreview();
        });
      }

      // ── ZigZag Controls ──
      const zigzagDetailSlider = this.sidebar.querySelector('#zigzag-detail-slider');
      const zigzagDetailVal = this.sidebar.querySelector('#zigzag-detail-val');
      if (zigzagDetailSlider) {
        zigzagDetailSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          if (zigzagDetailVal) zigzagDetailVal.textContent = val;
          state.updateStageParams('output', { zigzag_detail: val });
          this.triggerDebouncedPreview();
        });
      }

      const zigzagIntensitySlider = this.sidebar.querySelector('#zigzag-intensity-slider');
      const zigzagIntensityVal = this.sidebar.querySelector('#zigzag-intensity-val');
      if (zigzagIntensitySlider) {
        zigzagIntensitySlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          if (zigzagIntensityVal) zigzagIntensityVal.textContent = val > 0 ? `+${val}` : `${val}`;
          state.updateStageParams('output', { zigzag_intensity: val });
          this.triggerDebouncedPreview();
        });
      }

      const zigzagWeightSlider = this.sidebar.querySelector('#zigzag-weight-slider');
      const zigzagWeightVal = this.sidebar.querySelector('#zigzag-weight-val');
      if (zigzagWeightSlider) {
        zigzagWeightSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (zigzagWeightVal) zigzagWeightVal.textContent = `${Math.round(val)}%`;
          state.updateStageParams('output', { zigzag_weight: val });
          this.triggerDebouncedPreview();
        });
      }

      // ── Phase-by-Phase Actions Footer ──
      const applyStagePageBtn = this.sidebar.querySelector('#btn-apply-stage-page');
      if (applyStagePageBtn) {
        applyStagePageBtn.addEventListener('click', async () => {
          await global.PreprocessingStudio?.applyCurrentStageToPage();
        });
      }

      const applyStageAllBtn = this.sidebar.querySelector('#btn-apply-stage-all');
      if (applyStageAllBtn) {
        applyStageAllBtn.addEventListener('click', async () => {
          await global.PreprocessingStudio?.applyCurrentStageToAllPages();
        });
      }

      const applyFullBtn = this.sidebar.querySelector('#btn-apply-page');
      if (applyFullBtn) {
        applyFullBtn.addEventListener('click', async () => {
          await global.PreprocessingStudio?.applyCurrentPage();
        });
      }

      const resetBtn = this.sidebar.querySelector('#btn-reset-original');
      if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
          await global.PreprocessingStudio?.resetCurrentPage();
        });
      }
    }

    updateOutputEngineControls() {
      const state = global.PreprocessingState;
      const engine = state.stagesParams.output?.binarization || 'none';
      const sauvolaControls = this.sidebar.querySelector('#sauvola-parameters');
      const wolfControls = this.sidebar.querySelector('#wolf-parameters');
      const zigzagControls = this.sidebar.querySelector('#zigzag-parameters');
      const generalThresh = this.sidebar.querySelector('#general-threshold-group');
      const engineSelect = this.sidebar.querySelector('#binarization-engine');

      if (engineSelect && document.activeElement !== engineSelect) {
        engineSelect.value = engine;
      }

      if (sauvolaControls) sauvolaControls.style.display = engine === 'sauvola' ? 'flex' : 'none';
      if (wolfControls) wolfControls.style.display = engine === 'wolf' ? 'flex' : 'none';
      if (zigzagControls) zigzagControls.style.display = engine === 'zigzag' ? 'flex' : 'none';
      if (generalThresh) generalThresh.style.display = (engine === 'otsu' || engine === 'sauvola' || engine === 'wolf') ? 'flex' : 'none';
    }

    triggerDebouncedPreview() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.triggerLivePreview();
      }, 250);
    }

    triggerLivePreview() {
      if (global.PreprocessingStudio) {
        global.PreprocessingStudio.loadStagePreview();
      }
    }

    updateUI() {
      const state = global.PreprocessingState;

      // Show/Hide active stage panel
      this.sidebar.querySelectorAll('.stage-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `panel-${state.activeStage}`);
      });

      // Update active stage title
      const stageTitleEl = this.sidebar.querySelector('#current-stage-title');
      if (stageTitleEl && global.AppI18n) {
        stageTitleEl.textContent = global.AppI18n.t(`stage.${state.activeStage}`);
      }

      // Update orientation buttons
      const curRot = state.stagesParams.orientation?.rotation || 0;
      this.sidebar.querySelectorAll('.rotation-btn').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.rot, 10) === curRot);
      });

      // Update Deskew slider
      const deskewSlider = this.sidebar.querySelector('#deskew-angle-slider');
      const deskewVal = this.sidebar.querySelector('#deskew-angle-val');
      const curAngle = state.stagesParams.deskew?.angle !== null && state.stagesParams.deskew?.angle !== undefined
        ? state.stagesParams.deskew.angle
        : (state.stageMetadata.deskew?.angle ?? 0.0);

      if (deskewSlider && document.activeElement !== deskewSlider) {
        deskewSlider.value = curAngle;
      }
      if (deskewVal) {
        deskewVal.textContent = `${Number(curAngle).toFixed(2)}°`;
      }

      // Update Layout inputs
      const margins = state.stagesParams.layout?.margins || {};
      ['top', 'bottom', 'left', 'right'].forEach((side) => {
        const input = this.sidebar.querySelector(`#margin-${side}`);
        if (input && document.activeElement !== input) {
          input.value = margins[side] || (side === 'left' || side === 'right' ? 15 : 10);
        }
      });

      // Update ZigZag inputs
      const zzDetailSlider = this.sidebar.querySelector('#zigzag-detail-slider');
      const zzDetailVal = this.sidebar.querySelector('#zigzag-detail-val');
      const curDetail = state.stagesParams.output?.zigzag_detail || 30;
      if (zzDetailSlider && document.activeElement !== zzDetailSlider) zzDetailSlider.value = curDetail;
      if (zzDetailVal) zzDetailVal.textContent = curDetail;

      const zzIntensitySlider = this.sidebar.querySelector('#zigzag-intensity-slider');
      const zzIntensityVal = this.sidebar.querySelector('#zigzag-intensity-val');
      const curIntensity = state.stagesParams.output?.zigzag_intensity ?? 0;
      if (zzIntensitySlider && document.activeElement !== zzIntensitySlider) zzIntensitySlider.value = curIntensity;
      if (zzIntensityVal) zzIntensityVal.textContent = curIntensity > 0 ? `+${curIntensity}` : `${curIntensity}`;

      const zzWeightSlider = this.sidebar.querySelector('#zigzag-weight-slider');
      const zzWeightVal = this.sidebar.querySelector('#zigzag-weight-val');
      const curWeight = state.stagesParams.output?.zigzag_weight || 90;
      if (zzWeightSlider && document.activeElement !== zzWeightSlider) zzWeightSlider.value = curWeight;
      if (zzWeightVal) zzWeightVal.textContent = `${Math.round(curWeight)}%`;

      this.updateOutputEngineControls();
    }
  }

  global.PreprocessingSidebar = PreprocessingSidebar;
})(window);
