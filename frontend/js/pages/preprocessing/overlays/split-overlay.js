/*
 * preprocessing/overlays/split-overlay.js — Stage 2: Page Split interactive overlay.
 * Features zoom-independent draggable handles (top, bottom, line) and single/spread page awareness.
 */
(function (global) {
  class SplitOverlay {
    constructor() {
      this.dragTarget = null; // 'top', 'bottom', 'line', or null
      this.dragOffset = { x: 0, y: 0 };
    }

    getSplitLine(width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;
      const paramLine = state.stagesParams.split?.split_line;
      const metaLine = state.stageMetadata.split?.split_line;

      // 1. If explicit user paramLine exists
      if (paramLine && Array.isArray(paramLine) && paramLine.length >= 2) {
        const refW = state.stagesParams.split?.ref_width || paramLine.ref_width || (paramLine[0][0] > w * 1.2 ? state.fullWidth : w);
        const refH = state.stagesParams.split?.ref_height || paramLine.ref_height || (paramLine[1][1] > h * 1.2 ? state.fullHeight : h);
        const sX = refW > 0 ? (w / refW) : 1.0;
        const sY = refH > 0 ? (h / refH) : 1.0;
        return [
          { x: Number(paramLine[0][0]) * sX, y: Number(paramLine[0][1]) * sY },
          { x: Number(paramLine[1][0]) * sX, y: Number(paramLine[1][1]) * sY }
        ];
      }

      // 2. If computed metadata from backend exists (computed on full resolution image)
      if (metaLine && Array.isArray(metaLine) && metaLine.length >= 2) {
        const fullW = state.stageMetadata.split?.width || state.fullWidth || w;
        const fullH = state.stageMetadata.split?.height || state.fullHeight || h;
        const sX = fullW > 0 ? (w / fullW) : 1.0;
        const sY = fullH > 0 ? (h / fullH) : 1.0;
        return [
          { x: Number(metaLine[0][0]) * sX, y: Number(metaLine[0][1]) * sY },
          { x: Number(metaLine[1][0]) * sX, y: Number(metaLine[1][1]) * sY }
        ];
      }

      const mid = w / 2;
      return [
        { x: mid, y: 0 },
        { x: mid, y: h }
      ];
    }

    setSplitLine(p1, p2) {
      const state = global.PreprocessingState;
      const w = state.imageWidth || 1000;
      const h = state.imageHeight || 1000;
      state.updateStageParams('split', {
        layout_type: 'two_pages',
        split_line: [
          [Math.round(p1.x), Math.round(p1.y)],
          [Math.round(p2.x), Math.round(p2.y)]
        ],
        ref_width: Math.round(w),
        ref_height: Math.round(h)
      });
    }

    isTwoPages(width, height) {
      const state = global.PreprocessingState;
      const mode = state.stagesParams.split?.layout_type || 'auto';
      if (mode === 'two_pages') return true;
      if (mode === 'single_page') return false;
      if (state.stageMetadata.split?.is_two_pages !== undefined) {
        return Boolean(state.stageMetadata.split.is_two_pages);
      }
      return width >= height * 1.05;
    }

    isNearPoint(px, py, targetX, targetY) {
      const state = global.PreprocessingState;
      const zoom = state.zoom || 1.0;
      const tol = Math.max(14, 20 / zoom);
      const dx = px - targetX;
      const dy = py - targetY;
      return Math.sqrt(dx * dx + dy * dy) <= tol;
    }

    isNearLine(px, py, p1, p2) {
      if (!p1 || !p2) return false;
      const state = global.PreprocessingState;
      const zoom = state.zoom || 1.0;
      const tol = Math.max(10, 16 / zoom);

      const l2 = (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
      if (l2 === 0) return this.isNearPoint(px, py, p1.x, p1.y);
      let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = p1.x + t * (p2.x - p1.x);
      const projY = p1.y + t * (p2.y - p1.y);
      const dx = px - projX;
      const dy = py - projY;
      return Math.sqrt(dx * dx + dy * dy) <= tol;
    }

    render(ctx, width, height) {
      const state = global.PreprocessingState;
      const isTwo = this.isTwoPages(width, height);
      const isRTL = (state.stagesParams.split?.split_direction || 'rtl') === 'rtl';
      const zoom = state.zoom || 1.0;

      ctx.save();

      // If this is detected as a Single Page and not forced into two_pages, show single page badge
      if (!isTwo) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;

        const badgeText = global.AppI18n
          ? global.AppI18n.t('split.singlePageBadge') || 'صفحة مفردة (لا تحتاج تقسيم)'
          : 'Single Page (No Split Needed)';
        
        ctx.font = 'bold 13px system-ui, sans-serif';
        const textW = ctx.measureText(badgeText).width + 24;
        const bx = (width - textW) / 2;
        const by = 25;

        ctx.beginPath();
        ctx.roundRect(bx, by, textW, 30, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, width / 2, by + 15);

        ctx.restore();
        return;
      }

      // Two-Page Spread Cutter Line & Subpage Tint
      const line = this.getSplitLine(width, height);
      const [p1, p2] = line;
      const midX = (p1.x + p2.x) / 2;

      // Subpage Tints
      ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
      ctx.fillRect(0, 0, midX, height);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.fillRect(midX, 0, width - midX, height);

      // Subpage Labels
      const tagRTL_1 = isRTL ? 'صفحة 1 (يمين)' : 'Page 2 (Right)';
      const tagRTL_2 = isRTL ? 'صفحة 2 (يسار)' : 'Page 1 (Left)';

      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
      ctx.fillText(tagRTL_1, (midX + width) / 2, 40);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.95)';
      ctx.fillText(tagRTL_2, midX / 2, 40);

      // Cutter Line
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, 3 / zoom);
      ctx.setLineDash([8 / zoom, 6 / zoom]);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // End-point Control Handles (scaled to maintain constant screen size)
      const handleR = Math.max(8, Math.min(30, 12 / zoom));

      [p1, p2].forEach((pt, idx) => {
        const isTop = idx === 0;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, 2.5 / zoom);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, handleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(3, 4 / zoom), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${Math.max(10, 11 / zoom)}px monospace`;
        ctx.fillText(isTop ? 'T' : 'B', pt.x, isTop ? pt.y + handleR + 14 : pt.y - handleR - 6);
      });

      ctx.restore();
    }

    onMouseDown(imgX, imgY, e, width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;
      if (!this.isTwoPages(w, h)) return false;

      const line = this.getSplitLine(w, h);
      const [p1, p2] = line;

      if (this.isNearPoint(imgX, imgY, p1.x, p1.y)) {
        this.dragTarget = 'top';
        return true;
      }
      if (this.isNearPoint(imgX, imgY, p2.x, p2.y)) {
        this.dragTarget = 'bottom';
        return true;
      }
      if (this.isNearLine(imgX, imgY, p1, p2)) {
        this.dragTarget = 'line';
        this.dragOffset = { x: imgX - (p1.x + p2.x) / 2, y: 0 };
        return true;
      }

      return false;
    }

    onMouseMove(imgX, imgY, e, width, height) {
      const state = global.PreprocessingState;
      const w = width || state.imageWidth || 1000;
      const h = height || state.imageHeight || 1000;
      if (!this.isTwoPages(w, h)) return null;

      if (!this.dragTarget) {
        const line = this.getSplitLine(w, h);
        const [p1, p2] = line;
        if (this.isNearPoint(imgX, imgY, p1.x, p1.y) || this.isNearPoint(imgX, imgY, p2.x, p2.y)) {
          return 'ew-resize';
        }
        if (this.isNearLine(imgX, imgY, p1, p2)) {
          return 'move';
        }
        return 'default';
      }

      const line = this.getSplitLine(w, h);
      let [p1, p2] = line;

      const clampedX = Math.max(10, Math.min(w - 10, imgX));

      if (this.dragTarget === 'top') {
        p1 = { x: clampedX, y: 0 };
      } else if (this.dragTarget === 'bottom') {
        p2 = { x: clampedX, y: h };
      } else if (this.dragTarget === 'line') {
        const targetMidX = clampedX - this.dragOffset.x;
        const currentMidX = (p1.x + p2.x) / 2;
        const dx = targetMidX - currentMidX;
        p1 = { x: Math.max(10, Math.min(w - 10, p1.x + dx)), y: 0 };
        p2 = { x: Math.max(10, Math.min(w - 10, p2.x + dx)), y: h };
      }

      this.setSplitLine(p1, p2);
      return 'ew-resize';
    }

    onMouseUp() {
      this.dragTarget = null;
    }
  }

  global.SplitOverlay = SplitOverlay;
})(window);
