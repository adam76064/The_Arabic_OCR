/**
 * core/api.js - wrapper around pywebview.api with ready promise.
 * Provides unified call interface.
 */
(function(global) {
  let readyPromise = null;

  function isApiReady() {
    return !!(window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_projects === 'function');
  }

  function whenReady(timeoutMs = 1200) {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      if (isApiReady()) {
        resolve(window.pywebview.api);
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          clearInterval(interval);
          reject(new Error('pywebview API initialization timed out'));
        }
      }, timeoutMs);

      window.addEventListener('pywebviewready', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          clearInterval(interval);
          resolve(window.pywebview.api);
        }
      }, { once: true });
      // fallback poll in case event missed
      const interval = setInterval(() => {
        if (isApiReady()) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            clearInterval(interval);
            resolve(window.pywebview.api);
          }
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
    probeDigitalPages: (pid, indices) => call('probe_digital_pages', pid, indices),
    triggerDigitalExtraction: (pid, start, end, indices) => call('trigger_digital_extraction', pid, start, end, indices),
    auditProjectIntegrity: (pid, indices, docxPath, options) => call('audit_project_integrity', pid, indices, docxPath, options),
    migrateProjectOcr: (pid) => call('migrate_project_ocr_to_pages', pid),
    searchProject: (pid, q, regex, indices) => call('search_project', pid, q, regex, indices),
    replaceInProject: (pid, find, rep, regex, indices) => call('replace_in_project', pid, find, rep, regex, indices),
    duplicateProject: (id) => call('duplicate_project', id),
    updateProjectMetadata: (id, meta) => call('update_project_metadata', id, meta),
    listPageSnapshots: (pid, idx) => call('list_page_snapshots', pid, idx),
    restorePageSnapshot: (pid, idx, fn) => call('restore_page_snapshot', pid, idx, fn),
    // ... add as needed fallback generic call covers rest
  };

  // Also expose as global for legacy code that uses window.pywebview.api directly
  // but prefer AppApi.call for new code.
})(window);
