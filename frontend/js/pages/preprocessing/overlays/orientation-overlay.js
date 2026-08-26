/*
 * preprocessing/overlays/orientation-overlay.js — Stage 1: Fix Orientation visual overlay.
 */
(function (global) {
  class OrientationOverlay {
    render(ctx, width, height) {
      const state = global.PreprocessingState;
      const rotation = state.stagesParams.orientation?.rotation || 0;

      // Draw subtle orientation badge in corner
      ctx.save();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.85)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      const badgeW = 120;
      const badgeH = 34;
      const pad = 16;
      ctx.beginPath();
      ctx.roundRect(pad, pad, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⟳ ${rotation}°`, pad + badgeW / 2, pad + badgeH / 2);
      ctx.restore();
    }

    onMouseDown() { return false; }
    onMouseMove() { return null; }
    onMouseUp() {}
  }

  global.OrientationOverlay = OrientationOverlay;
})(window);
