/**
 * pages/review/panels.js - resizable panels + layout toggle
 * Extracted from review.js setupResizablePanels for clarity.
 */
(function(global) {
  function setupResize(handleId, panelId, minVal, maxVal) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;
    let startY, startX, startH, startW;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('#toggle-layout-view-btn')) return;
      startY = e.clientY;
      startX = e.clientX;
      startH = panel.offsetHeight;
      startW = panel.offsetWidth;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
    function onMove(e) {
      const container = document.getElementById('editor-panels-container');
      const isSideBySide = container && container.classList.contains('side-by-side-mode');
      if (isSideBySide && panelId === 'crop-section') {
        const deltaX = e.clientX - startX;
        const maxW = Math.round(container.offsetWidth * 0.8);
        const newW = Math.max(120, Math.min(maxW, startW + deltaX));
        panel.style.width = newW + 'px';
      } else {
        const deltaY = e.clientY - startY;
        const newH = Math.max(minVal, Math.min(maxVal, startH + deltaY));
        panel.style.height = newH + 'px';
      }
      if (typeof global.updateSwitchBtnPosition === 'function') global.updateSwitchBtnPosition();
      if (panelId === 'crop-section' && typeof global.applyCropZoom === 'function') global.applyCropZoom();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  function updateSwitchBtnPosition() {
    const btn = document.getElementById('toggle-layout-view-btn');
    const container = document.getElementById('editor-panels-container');
    const cropSection = document.getElementById('crop-section');
    if (!btn || !container || !cropSection) return;
    const isSideBySide = container.classList.contains('side-by-side-mode');
    if (isSideBySide) {
      const cropW = cropSection.offsetWidth;
      btn.style.top = '50%';
      btn.style.left = cropW + 'px';
      btn.style.transform = 'translate(-50%, -50%)';
    } else {
      const cropH = cropSection.offsetHeight;
      btn.style.top = cropH + 'px';
      btn.style.left = '50%';
      btn.style.transform = 'translate(-50%, -50%)';
    }
  }

  function setupPanels() {
    setupResize('crop-resize-handle', 'crop-section', 80, 500);
    setupResize('blocks-resize-handle', 'blocks-list-wrapper', 80, 800);

    const btn = document.getElementById('toggle-layout-view-btn');
    const container = document.getElementById('editor-panels-container');
    const cropSection = document.getElementById('crop-section');
    if (!btn || !container) return;

    if (window.__appSettings?.reviewSideBySideMode) {
      container.classList.add('side-by-side-mode');
      if (cropSection) cropSection.style.height = '';
    }
    updateSwitchBtnPosition();
    window.addEventListener('resize', updateSwitchBtnPosition);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isSideBySide = container.classList.toggle('side-by-side-mode');
      if (cropSection) {
        cropSection.style.height = '';
        cropSection.style.width = '';
      }
      updateSwitchBtnPosition();
      if (window.__appSettings) {
        window.__appSettings.reviewSideBySideMode = isSideBySide;
        if (typeof saveAppSettings === 'function') saveAppSettings();
      }
      if (typeof applyCropZoom === 'function') {
        setTimeout(() => { updateSwitchBtnPosition(); applyCropZoom(); }, 50);
      }
    });
  }

  global.ReviewPanels = { setupResize, updateSwitchBtnPosition, setupPanels };
  global.updateSwitchBtnPosition = updateSwitchBtnPosition; // legacy compat
  global.setupResizablePanels = setupPanels;
})(window);
