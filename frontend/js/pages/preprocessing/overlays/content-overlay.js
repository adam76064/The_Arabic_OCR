/*
 * preprocessing/overlays/content-overlay.js — Stage 4: Select Content 8-handle interactive box overlay.
 * Features zoom-independent handle sizing and easy dragging.
 */
(function (global) {
  class ContentOverlay {
    constructor() {
      this.dragHandle = null; // 'tl','t','tr','r','br','b','bl','l','box'
      this.dragStart = { x: 0, y: 0 };
      this.startRect = { x: 0, y: 0, width: 0, height: 0 };
    }

    getContentRect(width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;
      const paramRect = state.stagesParams.content?.content_rect;
      const metaRect = state.stageMetadata.content?.content_rect;

      if (paramRect && typeof paramRect === 'object' && paramRect.width > 0 && paramRect.height > 0) {
        const refW = paramRect.ref_width || w;
        const refH = paramRect.ref_height || h;
        const sX = w / refW;
        const sY = h / refH;
        return {
          x: Math.round(Number(paramRect.x || 0) * sX),
          y: Math.round(Number(paramRect.y || 0) * sY),
          width: Math.round(Number(paramRect.width || w) * sX),
          height: Math.round(Number(paramRect.height || h) * sY)
        };
      }
      if (metaRect && typeof metaRect === 'object' && metaRect.width > 0 && metaRect.height > 0) {
        const fullW = state.stageMetadata.content?.page_rect?.width || state.fullWidth || w;
        const fullH = state.stageMetadata.content?.page_rect?.height || state.fullHeight || h;
        const sX = w / fullW;
        const sY = h / fullH;
        return {
          x: Math.round(Number(metaRect.x || 0) * sX),
          y: Math.round(Number(metaRect.y || 0) * sY),
          width: Math.round(Number(metaRect.width || fullW) * sX),
          height: Math.round(Number(metaRect.height || fullH) * sY)
        };
      }

      // Default: 5% inset
      return {
        x: Math.round(w * 0.05),
        y: Math.round(h * 0.05),
        width: Math.round(w * 0.9),
        height: Math.round(h * 0.9)
      };
    }

    setContentRect(rect) {
      const state = global.PreprocessingState;
      const w = state.imageWidth || 1000;
      const h = state.imageHeight || 1000;
      state.updateStageParams('content', {
        content_rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          ref_width: Math.round(w),
          ref_height: Math.round(h)
        }
      });
    }

    getHandles(rect) {
      const { x, y, width: w, height: h } = rect;
      return {
        tl: { x: x, y: y, cursor: 'nwse-resize' },
        t:  { x: x + w / 2, y: y, cursor: 'ns-resize' },
        tr: { x: x + w, y: y, cursor: 'nesw-resize' },
        r:  { x: x + w, y: y + h / 2, cursor: 'ew-resize' },
        br: { x: x + w, y: y + h, cursor: 'nwse-resize' },
        b:  { x: x + w / 2, y: y + h, cursor: 'ns-resize' },
        bl: { x: x, y: y + h, cursor: 'nesw-resize' },
        l:  { x: x, y: y + h / 2, cursor: 'ew-resize' }
      };
    }

    isNear(px, py, hx, hy) {
      const state = global.PreprocessingState;
      const zoom = state.zoom || 1.0;
      const tol = Math.max(12, 16 / zoom);
      return Math.abs(px - hx) <= tol && Math.abs(py - hy) <= tol;
    }

    render(ctx, width, height) {
      const state = global.PreprocessingState;
      const zoom = state.zoom || 1.0;
      const rect = this.getContentRect(width, height);
      const { x, y, width: w, height: h } = rect;

      ctx.save();

      // 1. Dimmed outer mask
      ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
      ctx.beginPath();
      // Outer rect (clockwise)
      ctx.rect(0, 0, width, height);
      // Inner rect (counter-clockwise)
      ctx.rect(x + w, y, -w, h);
      ctx.fill();

      // 2. Content Box Boundary
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = Math.max(2, 2.5 / zoom);
      ctx.strokeRect(x, y, w, h);

      // Dimension Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      const tagText = `${Math.round(w)} × ${Math.round(h)} px`;
      ctx.font = `bold ${Math.max(10, 11 / zoom)}px system-ui, sans-serif`;
      const textW = ctx.measureText(tagText).width + 12 / zoom;
      const tagH = 20 / zoom;
      const tagX = x + 8 / zoom;
      const tagY = y > tagH + 4 ? y - tagH - 4 : y + 6 / zoom;

      ctx.beginPath();
      ctx.roundRect(tagX, tagY, textW, tagH, 4 / zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagX + 6 / zoom, tagY + tagH / 2);

      // 3. 8 Draggable Corner & Edge Handles (scaled for constant screen size)
      const handleR = Math.max(6, Math.min(22, 8 / zoom));
      const handles = this.getHandles(rect);

      Object.entries(handles).forEach(([hKey, pos]) => {
        ctx.fillStyle = this.dragHandle === hKey ? '#2563eb' : '#ffffff';
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = Math.max(1.5, 2 / zoom);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, handleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }

    onMouseDown(imgX, imgY, e, width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;
      const rect = this.getContentRect(w, h);
      const handles = this.getHandles(rect);

      // Check handles first
      for (const [key, pos] of Object.entries(handles)) {
        if (this.isNear(imgX, imgY, pos.x, pos.y)) {
          this.dragHandle = key;
          this.dragStart = { x: imgX, y: imgY };
          this.startRect = { ...rect };
          return true;
        }
      }

      // Check inside rect (move entire box)
      if (imgX >= rect.x && imgX <= rect.x + rect.width && imgY >= rect.y && imgY <= rect.y + rect.height) {
        this.dragHandle = 'box';
        this.dragStart = { x: imgX, y: imgY };
        this.startRect = { ...rect };
        return true;
      }

      return false;
    }

    onMouseMove(imgX, imgY, e, width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;

      if (!this.dragHandle) {
        // Cursor hover check
        const rect = this.getContentRect(w, h);
        const handles = this.getHandles(rect);
        for (const pos of Object.values(handles)) {
          if (this.isNear(imgX, imgY, pos.x, pos.y)) {
            return pos.cursor;
          }
        }
        if (imgX >= rect.x && imgX <= rect.x + rect.width && imgY >= rect.y && imgY <= rect.y + rect.height) {
          return 'move';
        }
        return 'default';
      }

      const dx = imgX - this.dragStart.x;
      const dy = imgY - this.dragStart.y;
      const s = this.startRect;
      let newRect = { ...s };

      switch (this.dragHandle) {
        case 'box':
          newRect.x = Math.max(0, Math.min(w - s.width, s.x + dx));
          newRect.y = Math.max(0, Math.min(h - s.height, s.y + dy));
          break;
        case 'tl':
          newRect.x = Math.min(s.x + s.width - 20, Math.max(0, s.x + dx));
          newRect.y = Math.min(s.y + s.height - 20, Math.max(0, s.y + dy));
          newRect.width = s.x + s.width - newRect.x;
          newRect.height = s.y + s.height - newRect.y;
          break;
        case 't':
          newRect.y = Math.min(s.y + s.height - 20, Math.max(0, s.y + dy));
          newRect.height = s.y + s.height - newRect.y;
          break;
        case 'tr':
          newRect.y = Math.min(s.y + s.height - 20, Math.max(0, s.y + dy));
          newRect.width = Math.max(20, Math.min(w - s.x, s.width + dx));
          newRect.height = s.y + s.height - newRect.y;
          break;
        case 'r':
          newRect.width = Math.max(20, Math.min(w - s.x, s.width + dx));
          break;
        case 'br':
          newRect.width = Math.max(20, Math.min(w - s.x, s.width + dx));
          newRect.height = Math.max(20, Math.min(h - s.y, s.height + dy));
          break;
        case 'b':
          newRect.height = Math.max(20, Math.min(h - s.y, s.height + dy));
          break;
        case 'bl':
          newRect.x = Math.min(s.x + s.width - 20, Math.max(0, s.x + dx));
          newRect.width = s.x + s.width - newRect.x;
          newRect.height = Math.max(20, Math.min(h - s.y, s.height + dy));
          break;
        case 'l':
          newRect.x = Math.min(s.x + s.width - 20, Math.max(0, s.x + dx));
          newRect.width = s.x + s.width - newRect.x;
          break;
      }

      this.setContentRect(newRect);
      return null;
    }

    onMouseUp() {
      this.dragHandle = null;
    }
  }

  global.ContentOverlay = ContentOverlay;
})(window);
