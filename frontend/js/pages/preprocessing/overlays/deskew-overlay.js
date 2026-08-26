/*
 * preprocessing/overlays/deskew-overlay.js — Stage 3: Deskew guide grid overlay.
 */
(function (global) {
  class DeskewOverlay {
    render(ctx, width, height) {
      const state = global.PreprocessingState;
      const angle = state.stagesParams.deskew?.angle || 0;

      ctx.save();
      // Draw horizontal alignment grid lines (soft blue/cyan)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const gridSpacing = 40;
      for (let y = gridSpacing; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating Angle Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      
      const badgeW = 110;
      const badgeH = 32;
      ctx.beginPath();
      ctx.roundRect(width - badgeW - 20, 20, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`📐 ${Number(angle).toFixed(2)}°`, width - 20 - badgeW / 2, 20 + badgeH / 2);

      ctx.restore();
    }

    onMouseDown() { return false; }
    onMouseMove() { return null; }
    onMouseUp() {}
  }

  global.DeskewOverlay = DeskewOverlay;
})(window);
