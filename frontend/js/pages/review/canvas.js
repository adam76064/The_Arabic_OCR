/**
 * pages/review/canvas.js - canvas rendering facade
 * Thin wrapper around canvas-rendering.js functions (drawBoxes, renderBboxes, etc.)
 */
(function(global) {
  const CanvasFacade = {
    drawBoxes(canvas, data, selected) {
      if (typeof global.drawBoxes === 'function') return global.drawBoxes(canvas, data, selected);
      console.warn('drawBoxes not available');
    },
    renderBboxes(data, selected) {
      if (typeof global.renderBboxes === 'function') return global.renderBboxes(data, selected);
    },
    renderThumb(canvasId, imgId, data, selected) {
      if (typeof global.renderThumbCanvas === 'function') return global.renderThumbCanvas(canvasId, imgId, data, selected);
    },
    handleClick(e, canvas) {
      if (typeof global.handleCanvasClick === 'function') return global.handleCanvasClick(e, canvas);
    }
  };
  global.ReviewCanvas = CanvasFacade;
})(window);
