/*
 * preprocessing/canvas.js — High-performance Pan/Zoom & Overlay Rendering Engine.
 */
(function (global) {
  class PreprocessingCanvas {
    constructor(containerEl, wrapperEl, imgEl, canvasEl) {
      this.container = containerEl;
      this.wrapper = wrapperEl;
      this.img = imgEl;
      this.canvas = canvasEl;
      this.ctx = canvasEl.getContext('2d');

      this.isPanning = false;
      this.panStartX = 0;
      this.panStartY = 0;
      this.draggedHandle = null;

      this.overlays = {};
      this._bindEvents();
    }

    registerOverlay(stageName, overlayInstance) {
      this.overlays[stageName] = overlayInstance;
    }

    getActiveOverlay() {
      const state = global.PreprocessingState;
      return this.overlays[state.activeStage] || null;
    }

    setLoading(isLoading) {
      if (this.container) {
        this.container.classList.toggle('is-loading', Boolean(isLoading));
      }
    }

    clear() {
      if (this.canvas && this.canvas.width && this.canvas.height) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    _bindEvents() {
      // Auto resize / center when container dimensions change (e.g. window resize or sidebar toggle)
      if ('ResizeObserver' in window && this.container) {
        this._resizeObserver = new ResizeObserver(() => {
          const state = global.PreprocessingState;
          if (state.imageWidth && state.imageHeight && !this.isPanning) {
            this.fitToScreen();
          }
        });
        this._resizeObserver.observe(this.container);
      }

      // Mouse Wheel Zoom centered at cursor
      this.container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const state = global.PreprocessingState;
        const rect = this.container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.min(Math.max(state.zoom * zoomFactor, 0.1), 8.0);

        // Adjust pan to keep cursor position fixed
        const newPanX = cursorX - (cursorX - state.panX) * (newZoom / state.zoom);
        const newPanY = cursorY - (cursorY - state.panY) * (newZoom / state.zoom);

        state.set({ zoom: newZoom, panX: newPanX, panY: newPanY });
        this.updateTransform();
      }, { passive: false });

      // Mouse Down
      this.canvas.addEventListener('mousedown', (e) => {
        const overlay = this.getActiveOverlay();
        const imgCoords = this.screenToImage(e.clientX, e.clientY);

        // Check if middle click or space-drag for pan
        if (e.button === 1 || e.button === 2 || e.altKey) {
          this.isPanning = true;
          this.panStartX = e.clientX - global.PreprocessingState.panX;
          this.panStartY = e.clientY - global.PreprocessingState.panY;
          this.container.classList.add('panning');
          return;
        }

        // Forward to active overlay
        const state = global.PreprocessingState;
        if (overlay && typeof overlay.onMouseDown === 'function') {
          const handled = overlay.onMouseDown(imgCoords.x, imgCoords.y, e, state.imageWidth, state.imageHeight);
          if (handled) {
            this.render();
            return;
          }
        }

        // Fallback default: Pan
        this.isPanning = true;
        this.panStartX = e.clientX - state.panX;
        this.panStartY = e.clientY - state.panY;
        this.container.classList.add('panning');
      });

      // Mouse Move
      window.addEventListener('mousemove', (e) => {
        const state = global.PreprocessingState;
        if (this.isPanning) {
          state.set({
            panX: e.clientX - this.panStartX,
            panY: e.clientY - this.panStartY
          });
          this.updateTransform();
          return;
        }

        const overlay = this.getActiveOverlay();
        const imgCoords = this.screenToImage(e.clientX, e.clientY);

        if (overlay && typeof overlay.onMouseMove === 'function') {
          const cursor = overlay.onMouseMove(imgCoords.x, imgCoords.y, e, state.imageWidth, state.imageHeight);
          if (cursor) {
            this.canvas.style.cursor = cursor;
          } else {
            this.canvas.style.cursor = 'default';
          }
          this.render();
        }
      });

      // Mouse Up
      window.addEventListener('mouseup', (e) => {
        const state = global.PreprocessingState;
        if (this.isPanning) {
          this.isPanning = false;
          this.container.classList.remove('panning');
        }
        const overlay = this.getActiveOverlay();
        const imgCoords = this.screenToImage(e.clientX, e.clientY);
        if (overlay && typeof overlay.onMouseUp === 'function') {
          overlay.onMouseUp(imgCoords.x, imgCoords.y, e, state.imageWidth, state.imageHeight);
          this.render();
        }
      });

      // Prevent Context Menu on canvas to allow right-click pan
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    screenToImage(screenX, screenY) {
      const state = global.PreprocessingState;
      const rect = this.wrapper.getBoundingClientRect();
      const relX = (screenX - rect.left) / state.zoom;
      const relY = (screenY - rect.top) / state.zoom;
      return {
        x: Math.max(0, Math.min(relX, state.imageWidth)),
        y: Math.max(0, Math.min(relY, state.imageHeight))
      };
    }

    imageToScreen(imgX, imgY) {
      const state = global.PreprocessingState;
      return {
        x: (imgX * state.zoom) + state.panX,
        y: (imgY * state.zoom) + state.panY
      };
    }

    updateTransform() {
      const state = global.PreprocessingState;
      this.wrapper.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`;
    }

    fitToScreen() {
      const state = global.PreprocessingState;
      if (!state.imageWidth || !state.imageHeight) return;

      const cRect = this.container.getBoundingClientRect();
      if (!cRect.width || !cRect.height) return;

      const padding = 36;
      const availW = Math.max(80, cRect.width - padding * 2);
      const availH = Math.max(80, cRect.height - padding * 2);

      const scaleX = availW / state.imageWidth;
      const scaleY = availH / state.imageHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1.5);

      const centerPanX = Math.round((cRect.width - state.imageWidth * fitZoom) / 2);
      const centerPanY = Math.round((cRect.height - state.imageHeight * fitZoom) / 2);

      state.set({ zoom: fitZoom, panX: centerPanX, panY: centerPanY });
      this.updateTransform();
      this.render();
    }

    resizeCanvas(width, height) {
      const state = global.PreprocessingState;
      state.imageWidth = width;
      state.imageHeight = height;

      this.canvas.width = width;
      this.canvas.height = height;
      this.wrapper.style.width = `${width}px`;
      this.wrapper.style.height = `${height}px`;

      this.render();
    }

    render() {
      const state = global.PreprocessingState;
      if (!this.canvas.width || !this.canvas.height) return;

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const overlay = this.getActiveOverlay();
      if (overlay && typeof overlay.render === 'function') {
        overlay.render(this.ctx, state.imageWidth, state.imageHeight);
      }
    }
  }

  global.PreprocessingCanvas = PreprocessingCanvas;
})(window);

