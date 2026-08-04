/**
 * core/events.js - progress listeners from Python
 */
(function(global) {
  function initEvents() {
    // Pdf progress (existing window.onPdfProgress)
    // Provide default logger if page didn't set handler yet
    if (!window.onPdfProgress) {
      window.onPdfProgress = (payload) => {
        console.log('[PDF Progress]', payload);
        const el = document.getElementById('pdf-progress-log');
        if (el) el.textContent = `${payload.stage}: ${payload.current}/${payload.total}`;
      };
    }
    if (!window.onPaddleProgress) {
      window.onPaddleProgress = (payload) => {
        // payload can be object {stage,message,percentage} or legacy string
        if (typeof payload === 'object') {
          console.log('[OCR Progress]', payload);
        } else {
          console.log('[OCR Progress legacy]', payload, arguments[1]);
        }
      };
    }
    if (!window.onLanUpdate) {
      window.onLanUpdate = (payload) => {
        console.log('[LAN]', payload);
        if (typeof global.onLanUpdate === 'function' && global.onLanUpdate !== window.onLanUpdate) {
          // avoid recursion if same
        }
      };
    }
  }

  // Init immediately
  initEvents();
  window.addEventListener('pywebviewready', initEvents);

  global.AppEvents = { initEvents };
})(window);
