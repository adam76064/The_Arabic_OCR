/*
 * preprocessing/batch-modal.js — Flexible batch execution wizard with stage selection and progress tracking.
 */
(function (global) {
  const STAGES_ORDER = ['orientation', 'split', 'deskew', 'content', 'layout', 'output'];

  class BatchModal {
    constructor(modalEl) {
      this.modal = modalEl;
      this.isRunning = false;
      this._bindElements();
      this._listenProgressEvents();
    }

    _bindElements() {
      const startBtn = this.modal.querySelector('#btn-start-batch');
      const cancelBtn = this.modal.querySelector('#btn-cancel-batch');
      const closeBtn = this.modal.querySelector('#btn-close-batch-modal');

      if (startBtn) {
        startBtn.addEventListener('click', () => this.startBatch());
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancelBatch());
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      // Presets
      const presetAll = this.modal.querySelector('#btn-batch-preset-all');
      const presetFromCurr = this.modal.querySelector('#btn-batch-preset-from-curr');
      const presetOnlyCurr = this.modal.querySelector('#btn-batch-preset-only-curr');

      if (presetAll) {
        presetAll.addEventListener('click', () => {
          this.modal.querySelectorAll('.batch-stage-check').forEach((cb) => (cb.checked = true));
        });
      }

      if (presetFromCurr) {
        presetFromCurr.addEventListener('click', () => {
          const curStage = global.PreprocessingState?.activeStage || 'orientation';
          const curIdx = STAGES_ORDER.indexOf(curStage);
          this.modal.querySelectorAll('.batch-stage-check').forEach((cb) => {
            const idx = STAGES_ORDER.indexOf(cb.value);
            cb.checked = idx >= curIdx;
          });
        });
      }

      if (presetOnlyCurr) {
        presetOnlyCurr.addEventListener('click', () => {
          const curStage = global.PreprocessingState?.activeStage || 'orientation';
          this.modal.querySelectorAll('.batch-stage-check').forEach((cb) => {
            cb.checked = cb.value === curStage;
          });
        });
      }
    }

    _listenProgressEvents() {
      // Global PyWebView event hook
      window.onPreprocessingProgress = (payload) => {
        this.handleProgressUpdate(payload);
      };
    }

    open(customStage = null) {
      const state = global.PreprocessingState;
      const totalPages = state.project?.pages?.length || 1;
      const rangeInput = this.modal.querySelector('#batch-range-input');
      const customScopeRadio = this.modal.querySelector('input[name="batch-scope"][value="custom"]');
      const allScopeRadio = this.modal.querySelector('input[name="batch-scope"][value="all"]');

      const urlParams = new URLSearchParams(window.location.search);
      const urlPages = urlParams.get('pages');
      if (urlPages) {
        const displayPages = urlPages.split(',').map(s => parseInt(s.trim(), 10) + 1).filter(n => !isNaN(n)).join(', ');
        if (rangeInput) rangeInput.value = displayPages;
        if (customScopeRadio) customScopeRadio.click();
      } else {
        if (rangeInput) rangeInput.value = `1-${totalPages}`;
        if (allScopeRadio) allScopeRadio.click();
      }

      if (customStage) {
        this.modal.querySelectorAll('.batch-stage-check').forEach((cb) => {
          cb.checked = cb.value === customStage;
        });
      }

      this.resetProgressUI();
      this.modal.classList.remove('hidden');
    }

    close() {
      if (this.isRunning) return;
      this.modal.classList.add('hidden');
    }

    resetProgressUI() {
      const formSection = this.modal.querySelector('#batch-form-section');
      const progressSection = this.modal.querySelector('#batch-progress-section');
      const startBtn = this.modal.querySelector('#btn-start-batch');
      const cancelBtn = this.modal.querySelector('#btn-cancel-batch');
      const fill = this.modal.querySelector('#batch-progress-fill');
      const statusText = this.modal.querySelector('#batch-status-text');

      if (formSection) formSection.style.display = 'block';
      if (progressSection) progressSection.style.display = 'none';
      if (startBtn) startBtn.style.display = 'inline-flex';
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (fill) fill.style.width = '0%';
      if (statusText) statusText.textContent = '';
      this.isRunning = false;
    }

    async startBatch() {
      const state = global.PreprocessingState;
      const scopeType = this.modal.querySelector('input[name="batch-scope"]:checked')?.value || 'all';
      const rangeInput = this.modal.querySelector('#batch-range-input')?.value || '';
      const fromOriginal = Boolean(this.modal.querySelector('#batch-from-original')?.checked);

      // Selected stages
      const stagesToRun = [];
      this.modal.querySelectorAll('.batch-stage-check:checked').forEach((cb) => {
        stagesToRun.push(cb.value);
      });

      if (!stagesToRun.length) {
        alert(global.AppI18n ? global.AppI18n.t('batch.noStagesSelected') : 'Please select at least one stage to execute.');
        return;
      }

      const totalPages = state.project?.pages?.length || 0;
      let targetIndices = [];

      if (scopeType === 'current') {
        targetIndices = [state.currentPageIndex];
      } else if (scopeType === 'range' && rangeInput) {
        const parts = rangeInput.split(',');
        parts.forEach((part) => {
          const trimmed = part.trim();
          if (trimmed.includes('-')) {
            const [s, e] = trimmed.split('-').map((v) => parseInt(v.trim(), 10) - 1);
            if (!isNaN(s) && !isNaN(e)) {
              for (let i = s; i <= e; i++) {
                if (i >= 0 && i < totalPages && !targetIndices.includes(i)) targetIndices.push(i);
              }
            }
          } else {
            const p = parseInt(trimmed, 10) - 1;
            if (!isNaN(p) && p >= 0 && p < totalPages && !targetIndices.includes(p)) targetIndices.push(p);
          }
        });
      } else {
        targetIndices = Array.from({ length: totalPages }, (_, i) => i);
      }

      if (!targetIndices.length) {
        alert(global.AppI18n ? global.AppI18n.t('batch.noPagesSelected') : 'Please select valid pages.');
        return;
      }

      // Switch to progress UI
      const formSection = this.modal.querySelector('#batch-form-section');
      const progressSection = this.modal.querySelector('#batch-progress-section');
      const startBtn = this.modal.querySelector('#btn-start-batch');
      const cancelBtn = this.modal.querySelector('#btn-cancel-batch');

      if (formSection) formSection.style.display = 'none';
      if (progressSection) progressSection.style.display = 'flex';
      if (startBtn) startBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';

      this.isRunning = true;

      try {
        await global.PreprocessingApi.batchProcess(
          state.projectId,
          targetIndices,
          state.stagesParams,
          {
            stages_to_run: stagesToRun,
            from_original: fromOriginal,
            split_spread: stagesToRun.includes('split')
          }
        );
      } catch (err) {
        alert(err.message || 'Batch process failed');
        this.resetProgressUI();
      }
    }

    async cancelBatch() {
      try {
        await global.PreprocessingApi.cancelBatch();
        this.isRunning = false;
      } catch (err) {
        console.error('Cancel batch error:', err);
      }
    }

    handleProgressUpdate(payload) {
      if (!payload) return;
      const statusText = this.modal.querySelector('#batch-status-text');
      const fill = this.modal.querySelector('#batch-progress-fill');
      const cancelBtn = this.modal.querySelector('#btn-cancel-batch');
      const closeBtn = this.modal.querySelector('#btn-close-batch-modal');

      if (payload.status === 'processing') {
        const pct = payload.percentage || 0;
        if (fill) fill.style.width = `${pct}%`;
        if (statusText) {
          statusText.textContent = global.AppI18n
            ? global.AppI18n.t('batch.processingPage', { current: payload.current, total: payload.total, pct })
            : `Processing page ${payload.current} / ${payload.total} (${pct}%)`;
        }
      } else if (payload.status === 'completed' || payload.status === 'cancelled') {
        this.isRunning = false;
        if (fill) fill.style.width = payload.status === 'completed' ? '100%' : fill.style.width;
        if (statusText) {
          statusText.textContent = payload.status === 'completed'
            ? (global.AppI18n ? global.AppI18n.t('batch.completedMsg', { count: payload.processed_count, seconds: payload.elapsed_seconds }) : `Done! Processed ${payload.processed_count} pages in ${payload.elapsed_seconds}s`)
            : (global.AppI18n ? global.AppI18n.t('batch.cancelledMsg') : 'Processing stopped.');
        }
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (closeBtn) closeBtn.focus();

        // Refresh project data and active preview
        if (global.PreprocessingStudio) {
          global.PreprocessingStudio.refreshProject();
          global.PreprocessingStudio.loadStagePreview();
        }
      }
    }
  }

  global.BatchModal = BatchModal;
})(window);
