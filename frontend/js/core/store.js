/**
 * core/store.js - simple reactive store for project, page, settings
 */
(function(global) {
  const listeners = new Set();

  const state = {
    project: null,
    pageIndex: 0,
    appSettings: window.__appSettings || {},
    appDataPath: window.__appDataPath || '',
  };

  function emit() {
    listeners.forEach(fn => {
      try { fn({...state}); } catch(e) { console.error('store listener error', e); }
    });
  }

  global.AppStore = {
    get: () => ({...state}),
    set(partial) {
      Object.assign(state, partial);
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // helpers
    setProject(p) { state.project = p; emit(); },
    setPageIndex(i) { state.pageIndex = i; emit(); },
    setSettings(s) {
      state.appSettings = s;
      window.__appSettings = s;
      emit();
    }
  };
})(window);
