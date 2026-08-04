/**
 * core/api.js - wrapper around pywebview.api with ready promise.
 * Provides unified call interface.
 */
(function(global) {
  let readyPromise = null;

  function isApiReady() {
    return !!(window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_projects === 'function');
  }

  function whenReady() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve) => {
      if (isApiReady()) {
        resolve(window.pywebview.api);
        return;
      }
      window.addEventListener('pywebviewready', () => {
        resolve(window.pywebview.api);
      }, { once: true });
      // fallback poll in case event missed
      const interval = setInterval(() => {
        if (isApiReady()) {
          clearInterval(interval);
          resolve(window.pywebview.api);
        }
      }, 100);
    });
    return readyPromise;
  }

  async function call(method, ...args) {
    const api = await whenReady();
    if (!api[method]) {
      throw new Error(`API method ${method} not found`);
    }
    return api[method](...args);
  }

  global.AppApi = {
    ready: whenReady,
    call,
    // convenience wrappers preserving old names
    getProjects: () => call('get_projects'),
    loadProject: (id) => call('load_project', id),
    createProject: (meta, pdfPath) => call('create_project', meta, pdfPath),
    deleteProject: (id, delFiles) => call('delete_project', id, delFiles),
    updatePageOcr: (pid, idx, data, status) => call('update_page_ocr', pid, idx, data, status),
    getAppSettings: () => call('get_app_settings'),
    saveAppSettings: (s) => call('save_app_settings', s),
    exportProject: (pid, fmt, indices, opts, outDir) => call('export_project', pid, fmt, indices, opts, outDir),
    // ... add as needed fallback generic call covers rest
  };

  // Also expose as global for legacy code that uses window.pywebview.api directly
  // but prefer AppApi.call for new code.
})(window);
