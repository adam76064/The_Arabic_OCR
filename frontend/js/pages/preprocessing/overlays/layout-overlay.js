/*
 * preprocessing/overlays/layout-overlay.js — Stage 5: Page Layout & Outer Margins Overlay.
 */
(function (global) {
  class LayoutOverlay {
    render(ctx, width, height) {
      const state = global.PreprocessingState;
      const margins = state.stagesParams.layout?.margins || { top: 10, bottom: 10, left: 15, right: 15, unit: 'mm' };
      const meta = state.stageMetadata.layout || {};
      const zoom = state.zoom || 1.0;

      const fullW = state.fullWidth || width;
      const fullH = state.fullHeight || height;
      const sX = width / fullW;
      const sY = height / fullH;

      let cx, cy, cw, ch;
      if (meta.content_placement && meta.content_placement.width > 0) {
        cx = Number(meta.content_placement.x) * sX;
        cy = Number(meta.content_placement.y) * sY;
        cw = Number(meta.content_placement.width) * sX;
        ch = Number(meta.content_placement.height) * sY;
      } else {
        const isMm = margins.unit === 'mm';
        const scale = isMm ? (width / 210.0) : 1.0;
        const mTop = Math.min(height * 0.3, (margins.top || 10) * scale);
        const mBottom = Math.min(height * 0.3, (margins.bottom || 10) * scale);
        const mLeft = Math.min(width * 0.3, (margins.left || 15) * scale);
        const mRight = Math.min(width * 0.3, (margins.right || 15) * scale);
        cx = mLeft;
        cy = mTop;
        cw = Math.max(10, width - mLeft - mRight);
        ch = Math.max(10, height - mTop - mBottom);
      }

      ctx.save();

      // 1. Content Boundary (Clean dashed border surrounding the content)
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(1.5, 2.0 / zoom);
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.setLineDash([]);

      // 2. Corner Guides on Content Area
      const cornerSize = Math.max(8, 12 / zoom);
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = Math.max(2, 2.5 / zoom);

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(cx, cy + cornerSize); ctx.lineTo(cx, cy); ctx.lineTo(cx + cornerSize, cy);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(cx + cw - cornerSize, cy); ctx.lineTo(cx + cw, cy); ctx.lineTo(cx + cw, cy + cornerSize);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(cx, cy + ch - cornerSize); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + cornerSize, cy + ch);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(cx + cw - cornerSize, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx + cw, cy + ch - cornerSize);
      ctx.stroke();

      // 3. Margin Dimension Indicators (Positioned strictly in the outer margin space)
      ctx.fillStyle = '#1e293b';
      ctx.font = `bold ${Math.max(11, 12 / zoom)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const unit = margins.unit || 'mm';
      // Top margin label
      if (cy > 12) ctx.fillText(`↑ ${margins.top} ${unit}`, width / 2, cy / 2);
      // Bottom margin label
      if (height - (cy + ch) > 12) ctx.fillText(`↓ ${margins.bottom} ${unit}`, width / 2, cy + ch + (height - cy - ch) / 2);
      // Left margin label
      if (cx > 12) ctx.fillText(`← ${margins.left} ${unit}`, cx / 2, height / 2);
      // Right margin label
      if (width - (cx + cw) > 12) ctx.fillText(`→ ${margins.right} ${unit}`, cx + cw + (width - cx - cw) / 2, height / 2);

      // Content Box Pill Badge
      const badgeText = global.AppI18n ? global.AppI18n.t('content.labelInside') || 'المحتوى' : 'Content';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
      ctx.font = `bold ${Math.max(10, 11 / zoom)}px system-ui, sans-serif`;
      ctx.fillText(badgeText, cx + 45, cy + 14);

      ctx.restore();
    }

    onMouseDown() { return false; }
    onMouseMove() { return null; }
    onMouseUp() {}
  }

  global.LayoutOverlay = LayoutOverlay;
})(window);
