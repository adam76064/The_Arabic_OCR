// Shared settings — stored in window.__appSettings (in-memory, reset on page load)
// For persistence across pages in pywebview file:// context, we rely on the backend.
window.__appSettings = window.__appSettings || {
    autoSaveEnabled: false,
    showIV: true,
    showCV: true,
    uiZoom: 1.0,
};
