/*
 * preprocessing/overlays/output-overlay.js — Stage 6: Output & Binarization comparative split slider.
 */
(function (global) {
  class OutputOverlay {
    constructor() {
      this.isDragging = false;
      this.origImg = new Image();
      this.origImgLoaded = false;
      this.origImg.onload = () => {
        this.origImgLoaded = true;
        if (global.PreprocessingStudio?.canvas) {
          global.PreprocessingStudio.canvas.render();
        }
      };
    }

    setOriginalImage(dataUrl) {
      if (!dataUrl) {
        this.origImgLoaded = false;
        return;
      }
      this.origImgLoaded = false;
      this.origImg.src = dataUrl;
    }

    render(ctx, width, height) {
      const state = global.PreprocessingState;
      if (state.activeStage !== 'output') return;

      const curtainX = width * (state.splitCurtainPos || 0.5);

      ctx.save();

      // 1. Draw original unbinarized image on the LEFT side of the curtain
      if (this.origImgLoaded && this.origImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, curtainX, height);
        ctx.clip();
        ctx.drawImage(this.origImg, 0, 0, width, height);
        ctx.restore();
      }

      // 2. Draw vertical divider line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(curtainX, 0);
      ctx.lineTo(curtainX, height);
      ctx.stroke();

      // 3. Divider Handle Circle in center
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;

      const r = 16;
      ctx.beginPath();
      ctx.arc(curtainX, height / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⇆', curtainX, height / 2);

      // 4. Labels on top
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(curtainX - 85, 20, 80, 24);
      ctx.fillRect(curtainX + 5, 20, 80, 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(global.AppI18n ? global.AppI18n.t('output.original') : 'الأصل', curtainX - 45, 32);
      ctx.fillText(global.AppI18n ? global.AppI18n.t('output.binarized') : 'المعالج', curtainX + 45, 32);

      ctx.restore();
    }

    onMouseDown(imgX, imgY, e) {
      const state = global.PreprocessingState;
      const curtainX = state.imageWidth * (state.splitCurtainPos || 0.5);

      if (Math.abs(imgX - curtainX) <= 25) {
        this.isDragging = true;
        return true;
      }
      return false;
    }

    onMouseMove(imgX, imgY, e) {
      const state = global.PreprocessingState;
      const curtainX = state.imageWidth * (state.splitCurtainPos || 0.5);

      if (this.isDragging) {
        const newPos = Math.max(0.02, Math.min(imgX / state.imageWidth, 0.98));
        state.set({ splitCurtainPos: newPos });
        return 'ew-resize';
      }

      if (Math.abs(imgX - curtainX) <= 25) {
        return 'ew-resize';
      }
      return null;
    }

    onMouseUp() {
      this.isDragging = false;
    }
  }

  global.OutputOverlay = OutputOverlay;
})(window);
