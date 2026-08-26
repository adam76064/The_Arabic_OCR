/*
 * preprocessing/index.js — Preprocessing Studio Main Orchestrator.
 */
(function (global) {
  class PreprocessingStudio {
    constructor() {
      this.canvas = null;
      this.sidebar = null;
      this.toolbar = null;
      this.batchModal = null;
    }

    async init() {
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get('id');
      const initialPage = parseInt(urlParams.get('page') || '0', 10);
      const initialStage = urlParams.get('stage') || 'orientation';

      if (!projectId) {
        alert(global.AppI18n ? global.AppI18n.t('error.noProject') : 'No project ID specified.');
        window.location.href = 'index.html';
        return;
      }

      try {
        window.__appDataPath = await window.pywebview.api.get_app_data_path();
        window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');
      } catch (e) {
        window.__appDataPath = '';
      }

      global.PreprocessingState.set({
        projectId,
        currentPageIndex: initialPage,
        activeStage: initialStage
      });

      // Initialize Sub-components
      const containerEl = document.getElementById('canvas-container');
      const wrapperEl = document.getElementById('canvas-wrapper');
      const imgEl = document.getElementById('preview-image');
      const canvasEl = document.getElementById('interactive-canvas');

      this.canvas = new global.PreprocessingCanvas(containerEl, wrapperEl, imgEl, canvasEl);

      // Register Overlays for all 6 stages
      this.canvas.registerOverlay('orientation', new global.OrientationOverlay());
      this.canvas.registerOverlay('split', new global.SplitOverlay());
      this.canvas.registerOverlay('deskew', new global.DeskewOverlay());
      this.canvas.registerOverlay('content', new global.ContentOverlay());
      this.canvas.registerOverlay('layout', new global.LayoutOverlay());
      this.canvas.registerOverlay('output', new global.OutputOverlay());

      const sidebarEl = document.getElementById('preprocessing-sidebar');
      this.sidebar = new global.PreprocessingSidebar(sidebarEl);

      const headerEl = document.getElementById('preprocessing-header');
      const navEl = document.getElementById('stages-nav');
      const zoomEl = document.getElementById('canvas-floating-controls');
      this.toolbar = new global.PreprocessingToolbar(headerEl, navEl, zoomEl);

      const batchModalEl = document.getElementById('batch-processing-modal');
      this.batchModal = new global.BatchModal(batchModalEl);

      // Subscribe to state updates
      global.PreprocessingState.subscribe(() => {
        this.sidebar?.updateUI();
        this.toolbar?.updateUI();
      });

      await this.refreshProject();
      await this.loadStagePreview();

      // Keyboard navigation shortcuts
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight') {
          const isRtl = document.documentElement.dir === 'rtl';
          isRtl ? this.prevPage() : this.nextPage();
        } else if (e.key === 'ArrowLeft') {
          const isRtl = document.documentElement.dir === 'rtl';
          isRtl ? this.nextPage() : this.prevPage();
        } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.applyCurrentStageToPage();
        }
      });
    }

    async refreshProject() {
      const state = global.PreprocessingState;
      try {
        const proj = await global.PreprocessingApi.getProject(state.projectId);
        state.set({ project: proj });
        this.sidebar?.updateUI();
        this.toolbar?.updateUI();
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    }

    async loadStagePreview(fromOriginal = false) {
      const state = global.PreprocessingState;
      const imgEl = document.getElementById('preview-image');

      // Immediately clear stale overlay and set loading state
      this.canvas?.clear();
      this.canvas?.setLoading(true);
      state.set({ isLoading: true });

      try {
        const res = await global.PreprocessingApi.previewStage(
          state.projectId,
          state.currentPageIndex,
          state.activeStage,
          state.stagesParams,
          Boolean(fromOriginal)
        );

        if (res && res.success) {
          state.stageMetadata[state.activeStage] = res.metadata || {};
          state.set({
            fullWidth: res.full_width || res.width,
            fullHeight: res.full_height || res.height
          });

          if (state.activeStage === 'output' && res.original_image) {
            state.set({ originalDataUrl: res.original_image });
            this.canvas?.overlays?.output?.setOriginalImage(res.original_image);
          }

          // Preload into an offscreen image to prevent double-firing onload and visual jumping
          const preloadedImg = new Image();
          preloadedImg.onload = () => {
            imgEl.src = res.image;
            const w = preloadedImg.naturalWidth;
            const h = preloadedImg.naturalHeight;
            if (w > 0 && h > 0) {
              this.canvas?.resizeCanvas(w, h);
            }
            this.canvas?.fitToScreen();
            this.canvas?.setLoading(false);
            this.canvas?.render();
          };
          preloadedImg.onerror = () => {
            this.canvas?.setLoading(false);
          };
          preloadedImg.src = res.image;
        } else {
          this.canvas?.setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
        this.canvas?.setLoading(false);
      } finally {
        state.set({ isLoading: false });
      }
    }

    renderCanvas() {
      this.canvas?.render();
    }

    switchStage(stageName) {
      const state = global.PreprocessingState;
      if (state.activeStage === stageName) return;
      this.canvas?.clear();
      state.set({ activeStage: stageName });
      this.sidebar?.updateUI();
      this.toolbar?.updateUI();
      this.loadStagePreview(false);
    }

    navigateToPage(pageIndex) {
      const state = global.PreprocessingState;
      const maxPages = state.project?.pages?.length || 1;
      const clamped = Math.max(0, Math.min(maxPages - 1, pageIndex));

      this.canvas?.clear();
      // Reset page-specific coordinates cleanly without jumping pan to (0,0)
      state.resetForNewPage();
      state.set({ currentPageIndex: clamped });
      this.toolbar?.updateUI();
      this.loadStagePreview(false);
    }

    prevPage() {
      const state = global.PreprocessingState;
      if (state.currentPageIndex > 0) this.navigateToPage(state.currentPageIndex - 1);
    }

    nextPage() {
      const state = global.PreprocessingState;
      const maxPages = state.project?.pages?.length || 1;
      if (state.currentPageIndex < maxPages - 1) this.navigateToPage(state.currentPageIndex + 1);
    }

    async applyCurrentStageToPage() {
      const state = global.PreprocessingState;
      const stageName = state.activeStage;
      let stageParams = state.stagesParams[stageName] || {};

      if (stageName === 'content') {
        const overlayRect = this.canvas?.overlays?.content?.getContentRect();
        const imgEl = document.getElementById('preview-image');
        const refW = imgEl?.naturalWidth || state.imageWidth || 1000;
        const refH = imgEl?.naturalHeight || state.imageHeight || 1000;
        if (overlayRect) {
          stageParams = {
            ...stageParams,
            content_rect: {
              ...overlayRect,
              ref_width: refW,
              ref_height: refH
            }
          };
        }
      }

      const applyBtn = document.getElementById('btn-apply-stage-page');

      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.dataset.origText = applyBtn.textContent;
        applyBtn.textContent = global.AppI18n ? (global.AppI18n.t('preprocessing.applying') || 'جاري التطبيق... ⏳') : 'جاري التطبيق... ⏳';
      }

      try {
        const res = await global.PreprocessingApi.applyStageToPage(
          state.projectId,
          state.currentPageIndex,
          stageName,
          stageParams
        );

        if (res && res.success) {
          const stageLabel = global.AppI18n ? global.AppI18n.t(`stage.${stageName}`) : stageName;
          const msg = global.AppI18n
            ? global.AppI18n.t('preprocessing.stageAppliedPage', { stage: stageLabel })
            : `Stage '${stageLabel}' applied successfully to this page.`;

          if (global.showNotif) {
            global.showNotif(msg, 'success');
          }

          if (res.project) {
            state.set({ project: res.project });
          } else {
            await this.refreshProject();
          }

          // Clear page-specific overrides and reload preview of the active cropped page
          state.resetForNewPage();
          await this.loadStagePreview(false);
        } else {
          alert(res?.error || 'Failed to apply stage.');
        }
      } catch (err) {
        alert(err.message || 'Failed to apply stage.');
      } finally {
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = applyBtn.dataset.origText || (global.AppI18n ? global.AppI18n.t('preprocessing.applyStagePage') : 'تطبيق هذه المرحلة على الصفحة الحالية');
        }
      }
    }

    applyCurrentStageToAllPages() {
      const state = global.PreprocessingState;
      this.batchModal?.open(state.activeStage);
    }

    async applyCurrentPage() {
      const state = global.PreprocessingState;
      const splitSpread = Boolean(state.stagesParams.split?.layout_type === 'two_pages');
      const applyBtn = document.getElementById('btn-apply-page');

      if (this.canvas?.overlays?.content) {
        const overlayRect = this.canvas.overlays.content.getContentRect();
        const imgEl = document.getElementById('preview-image');
        const refW = imgEl?.naturalWidth || state.imageWidth || 1000;
        const refH = imgEl?.naturalHeight || state.imageHeight || 1000;
        if (overlayRect) {
          state.stagesParams.content = {
            ...(state.stagesParams.content || {}),
            content_rect: {
              ...overlayRect,
              ref_width: refW,
              ref_height: refH
            }
          };
        }
      }

      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.dataset.origText = applyBtn.textContent;
        applyBtn.textContent = global.AppI18n ? (global.AppI18n.t('preprocessing.applying') || 'جاري التطبيق... ⏳') : 'جاري التطبيق... ⏳';
      }

      try {
        const res = await global.PreprocessingApi.applyToPage(
          state.projectId,
          state.currentPageIndex,
          state.stagesParams,
          null,
          splitSpread,
          true
        );

        if (res && res.success) {
          const msg = global.AppI18n
            ? global.AppI18n.t('preprocessing.pageApplied')
            : 'Pre-processing applied successfully to this page.';
          if (global.showNotif) {
            global.showNotif(msg, 'success');
          }

          if (res.project) {
            state.set({ project: res.project });
          } else {
            await this.refreshProject();
          }

          state.resetForNewPage();
          await this.loadStagePreview(false);
        } else {
          alert(res?.error || 'Failed to apply preprocessing.');
        }
      } catch (err) {
        alert(err.message || 'Failed to apply preprocessing.');
      } finally {
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = applyBtn.dataset.origText || (global.AppI18n ? global.AppI18n.t('preprocessing.applyFullPipeline') : 'تطبيق كل المراحل');
        }
      }
    }

    async resetCurrentPage() {
      const state = global.PreprocessingState;
      const confirmMsg = global.AppI18n
        ? global.AppI18n.t('preprocessing.confirmReset')
        : 'Are you sure you want to revert this page to the original unedited scan?';
      if (!confirm(confirmMsg)) return;

      try {
        const res = await global.PreprocessingApi.resetPage(state.projectId, state.currentPageIndex);
        if (res && res.ok) {
          state.stagesParams = global.PreprocessingState.getDefaults();
          state.resetForNewPage();
          await this.refreshProject();
          await this.loadStagePreview(false);
          if (global.showNotif) {
            global.showNotif(global.AppI18n ? global.AppI18n.t('preprocessing.pageReset') : 'Page reverted to original.', 'info');
          }
        }
      } catch (err) {
        alert(err.message || 'Failed to reset page.');
      }
    }
  }

  global.PreprocessingStudio = new PreprocessingStudio();

  document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview && window.pywebview.api) {
      global.PreprocessingStudio.init();
    } else {
      window.addEventListener('pywebviewready', () => {
        global.PreprocessingStudio.init();
      });
    }
  });
})(window);
