/*
 * preprocessing/toolbar.js — Top bar, stage tabs, zoom controls, and bottom filmstrip.
 */
(function (global) {
  class PreprocessingToolbar {
    constructor(headerEl, navEl, zoomControlsEl) {
      this.header = headerEl;
      this.nav = navEl;
      this.zoomControls = zoomControlsEl;
      this._bindElements();
    }

    _bindElements() {
      const state = global.PreprocessingState;

      // ── Back Button ──
      const backBtn = this.header.querySelector('#btn-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (state.projectId) {
            window.location.href = `project-dashboard.html?id=${state.projectId}`;
          } else {
            window.history.back();
          }
        });
      }

      // ── Page Navigation ──
      const prevBtn = this.header.querySelector('#btn-prev-page');
      const nextBtn = this.header.querySelector('#btn-next-page');
      const pageInput = this.header.querySelector('#page-num-input');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (state.currentPageIndex > 0) {
            global.PreprocessingStudio?.navigateToPage(state.currentPageIndex - 1);
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const maxPages = state.project?.pages?.length || 1;
          if (state.currentPageIndex < maxPages - 1) {
            global.PreprocessingStudio?.navigateToPage(state.currentPageIndex + 1);
          }
        });
      }

      if (pageInput) {
        pageInput.addEventListener('change', (e) => {
          const val = parseInt(e.target.value, 10) - 1;
          const maxPages = state.project?.pages?.length || 1;
          if (val >= 0 && val < maxPages) {
            global.PreprocessingStudio?.navigateToPage(val);
          } else {
            e.target.value = state.currentPageIndex + 1;
          }
        });
      }

      // ── Stage Tabs ──
      const tabs = this.nav.querySelectorAll('.stage-tab');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const stageName = tab.dataset.stage;
          if (stageName && state.activeStage !== stageName) {
            global.PreprocessingStudio?.switchStage(stageName);
          }
        });
      });

      // ── Floating Next Stage Button ──
      const nextStageBtn = document.getElementById('btn-next-stage-floating');
      if (nextStageBtn) {
        nextStageBtn.addEventListener('click', () => {
          const stages = state.getStages();
          const curIdx = stages.indexOf(state.activeStage);
          if (curIdx >= 0 && curIdx < stages.length - 1) {
            global.PreprocessingStudio?.switchStage(stages[curIdx + 1]);
          } else if (curIdx === stages.length - 1) {
            // Reached stage 6: prompt or navigate to review/dashboard
            window.location.href = `project-dashboard.html?id=${state.projectId}`;
          }
        });
      }

      // ── Zoom Floating Controls ──
      const zoomIn = this.zoomControls?.querySelector('#btn-zoom-in');
      const zoomOut = this.zoomControls?.querySelector('#btn-zoom-out');
      const zoomFit = this.zoomControls?.querySelector('#btn-zoom-fit');
      const zoomReset = this.zoomControls?.querySelector('#btn-zoom-reset');

      if (zoomIn) {
        zoomIn.addEventListener('click', () => {
          state.set({ zoom: Math.min(state.zoom * 1.25, 8.0) });
          global.PreprocessingStudio?.canvas?.updateTransform();
          this.updateZoomDisplay();
        });
      }

      if (zoomOut) {
        zoomOut.addEventListener('click', () => {
          state.set({ zoom: Math.max(state.zoom / 1.25, 0.1) });
          global.PreprocessingStudio?.canvas?.updateTransform();
          this.updateZoomDisplay();
        });
      }

      if (zoomFit) {
        zoomFit.addEventListener('click', () => {
          global.PreprocessingStudio?.canvas?.fitToScreen();
          this.updateZoomDisplay();
        });
      }

      if (zoomReset) {
        zoomReset.addEventListener('click', () => {
          state.set({ zoom: 1.0 });
          global.PreprocessingStudio?.canvas?.updateTransform();
          this.updateZoomDisplay();
        });
      }

      // ── Batch Process Button ──
      const batchBtn = this.header.querySelector('#btn-open-batch');
      if (batchBtn) {
        batchBtn.addEventListener('click', () => {
          global.PreprocessingStudio?.batchModal?.open();
        });
      }
    }

    updateZoomDisplay() {
      const state = global.PreprocessingState;
      const zoomText = this.zoomControls?.querySelector('#zoom-level-text');
      if (zoomText) {
        zoomText.textContent = `${Math.round(state.zoom * 100)}%`;
      }
    }

    renderFilmstrip() {
      const state = global.PreprocessingState;
      const filmstrip = document.getElementById('preprocessing-filmstrip');
      if (!filmstrip || !state.project?.pages) return;

      const pages = state.project.pages;
      const existingThumbs = filmstrip.querySelectorAll('.filmstrip-thumb');

      // If already rendered with matching count, just update the active class and auto-scroll!
      if (filmstrip.dataset.projectId === state.projectId && existingThumbs.length === pages.length) {
        existingThumbs.forEach((thumb, idx) => {
          const isActive = idx === state.currentPageIndex;
          thumb.classList.toggle('active', isActive);
        });

        const activeThumb = filmstrip.querySelector('.filmstrip-thumb.active');
        if (activeThumb) {
          activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }

      // Rebuild filmstrip
      if (this._filmstripObserver) {
        this._filmstripObserver.disconnect();
        this._filmstripObserver = null;
      }

      filmstrip.dataset.projectId = state.projectId;
      filmstrip.innerHTML = '';

      const appData = (window.__appDataPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      const base = appData ? `file:///${appData}/projects/${state.projectId}` : `projects/${state.projectId}`;
      const placeholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='60'><rect width='40' height='60' fill='%23f1f5f9'/><text x='50%' y='50%' text-anchor='middle' fill='%23999' font-size='10'>...</text></svg>`;

      const hasObserver = 'IntersectionObserver' in window;
      if (hasObserver) {
        this._filmstripObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target.querySelector('img[data-src]');
              if (img && img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
              }
              this._filmstripObserver.unobserve(entry.target);
            }
          });
        }, { root: filmstrip, rootMargin: '150px' });
      }

      pages.forEach((p, idx) => {
        const thumbName = p.image_path || `page_${idx}.jpg`;
        const thumbUrl = `${base}/thumbs/${thumbName}`;
        const fullUrl = `${base}/images/${thumbName}`;
        const pagePlaceholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='60'><rect width='40' height='60' fill='%23f1f5f9'/><text x='50%' y='50%' text-anchor='middle' fill='%23999' font-size='10'>${idx+1}</text></svg>`;

        const thumb = document.createElement('div');
        thumb.className = `filmstrip-thumb ${idx === state.currentPageIndex ? 'active' : ''}`;
        thumb.title = global.AppI18n ? global.AppI18n.t('preprocessing.goToPage', { page: idx + 1 }) : `انتقل إلى صفحة ${idx + 1}`;

        if (hasObserver) {
          thumb.innerHTML = `
            <img src="${placeholder}" data-src="${thumbUrl}" alt="P${idx+1}"
                 onerror="this.onerror=null; this.src='${fullUrl}'; this.onerror=function(){this.src='${pagePlaceholder}';};">
            <span class="filmstrip-num">${idx + 1}</span>
          `;
          this._filmstripObserver.observe(thumb);
        } else {
          thumb.innerHTML = `
            <img src="${thumbUrl}" alt="P${idx+1}" loading="lazy"
                 onerror="this.onerror=null; this.src='${fullUrl}'; this.onerror=function(){this.src='${pagePlaceholder}';};">
            <span class="filmstrip-num">${idx + 1}</span>
          `;
        }

        thumb.addEventListener('click', () => {
          global.PreprocessingStudio?.navigateToPage(idx);
        });
        filmstrip.appendChild(thumb);
      });

      // Auto-scroll active thumbnail into view
      setTimeout(() => {
        const activeThumb = filmstrip.querySelector('.filmstrip-thumb.active');
        if (activeThumb) {
          activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 50);
    }

    updateUI() {
      const state = global.PreprocessingState;
      const totalPages = state.project?.pages?.length || 1;

      // Update page stepper
      const pageInput = this.header.querySelector('#page-num-input');
      const pageTotal = this.header.querySelector('#page-total-count');
      const prevBtn = this.header.querySelector('#btn-prev-page');
      const nextBtn = this.header.querySelector('#btn-next-page');

      if (pageInput) pageInput.value = state.currentPageIndex + 1;
      if (pageTotal) pageTotal.textContent = totalPages;
      if (prevBtn) prevBtn.disabled = state.currentPageIndex <= 0;
      if (nextBtn) nextBtn.disabled = state.currentPageIndex >= totalPages - 1;

      // Update stage tabs active class
      const tabs = this.nav.querySelectorAll('.stage-tab');
      tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.stage === state.activeStage);
      });

      // Update next stage button text
      const nextBtnFloating = document.getElementById('btn-next-stage-floating');
      if (nextBtnFloating) {
        const stages = state.getStages();
        const curIdx = stages.indexOf(state.activeStage);
        const isRtl = document.documentElement.dir === 'rtl' || !document.documentElement.dir;
        const arrow = isRtl ? '⟵' : '➔';
        if (curIdx === stages.length - 1) {
          const finishText = window.AppI18n ? (window.AppI18n.t('preprocessing.finishPreprocessing') || 'إنهاء المعالجة والعودة للوحة') : 'إنهاء المعالجة والعودة للوحة';
          nextBtnFloating.innerHTML = `<span>${finishText}</span> ${arrow}`;
        } else {
          const nextText = window.AppI18n ? (window.AppI18n.t('preprocessing.nextStage') || 'المرحلة التالية') : 'المرحلة التالية';
          nextBtnFloating.innerHTML = `<span>${nextText}</span> ${arrow}`;
        }
      }

      this.updateZoomDisplay();
      this.renderFilmstrip();
    }
  }

  global.PreprocessingToolbar = PreprocessingToolbar;
})(window);
