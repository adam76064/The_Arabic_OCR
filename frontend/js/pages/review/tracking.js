/**
 * pages/review/tracking.js - word/line/cell tracking
 * Cleaned version - single definitions, proper global exposure
 */

// Default tracking config
const defaultTrackingConfig = { cells: true, words: false, lines: false, block: false };

// Load saved config from localStorage or use default
let savedTrackingConfig = null;
try {
    const raw = localStorage.getItem('trackingConfig');
    if (raw) savedTrackingConfig = JSON.parse(raw);
} catch (e) {}
window.__trackingConfig = savedTrackingConfig ? savedTrackingConfig : defaultTrackingConfig;

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function updateTrackingHighlight(contentEl, element) {
    if (!window.TextTrackingEngine) return;
    if (typeof setTrackingHighlight !== 'function') return;
    if (typeof panCropViewTo !== 'function') return;
    try {
        const highlight = window.TextTrackingEngine.getHighlightBBox(contentEl, element, window.__trackingConfig);
        if (typeof setTrackingHighlight === 'function') setTrackingHighlight(highlight);
        if (highlight?.bbox && typeof panCropViewTo === 'function') panCropViewTo(highlight.bbox);
    } catch (e) {
        console.warn('[Tracking] update failed', e);
    }
}

const debouncedTrackingUpdate = debounce(updateTrackingHighlight, 120);

// Expose globally for editor.js and other modules (both as window props and global lexical)
window.debounce = debounce;
window.updateTrackingHighlight = updateTrackingHighlight;
window.debouncedTrackingUpdate = debouncedTrackingUpdate;
window.defaultTrackingConfig = defaultTrackingConfig;

// Also create var for backward compat with bare global access (let/const are global lexical, but we also set window)
if (typeof debouncedTrackingUpdate !== 'undefined') {
    // Already defined
}

// Setup UI for tracking settings (runs at load time after DOM)
(function setupTrackingUI() {
    const btn = document.getElementById('track-settings-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            const menu = document.getElementById('track-settings-menu');
            if (menu) menu.classList.toggle('hidden');
        });
    }

    ['cells', 'words', 'lines', 'block'].forEach(key => {
        const checkbox = document.getElementById('cfg-track-' + key);
        if (checkbox) {
            try { checkbox.checked = window.__trackingConfig[key]; } catch (e) {}
            checkbox.addEventListener('change', (e) => {
                window.__trackingConfig[key] = e.target.checked;
                try { localStorage.setItem('trackingConfig', JSON.stringify(window.__trackingConfig)); } catch (ex) {}
                if (typeof activeEditingIndex !== 'undefined' && activeEditingIndex !== -1 && typeof currentProject !== 'undefined' && currentProject?.pages[currentPageIndex]) {
                    const contentEl = document.querySelector(`.text-block[data-index="${activeEditingIndex}"] .block-content`);
                    const element = currentProject.pages[currentPageIndex].ocr_data[activeEditingIndex];
                    if (contentEl && element) updateTrackingHighlight(contentEl, element);
                }
            });
        }
    });
})();

// Also expose ReviewTracking for new code
window.ReviewTracking = {
    update: updateTrackingHighlight,
    debounced: debouncedTrackingUpdate,
    config: window.__trackingConfig,
    debounce: debounce
};
