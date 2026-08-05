/**
 * pages/review/fontzoom.js - block display font size zoom
 * Extracted from review.js
 */

const BLOCK_FONT_MIN = 10, BLOCK_FONT_MAX = 32, BLOCK_FONT_STEP = 2, BLOCK_FONT_DEFAULT = 14;
let resetBlockFontSize = () => {}; 

function setupBlockFontZoom() {
    const stored = window.__appSettings?.blockFontSize;
    let size = (typeof stored === 'number' && stored >= BLOCK_FONT_MIN && stored <= BLOCK_FONT_MAX)
        ? stored : BLOCK_FONT_DEFAULT;
    applyBlockFontSize(size);

    const decBtn = document.getElementById('block-font-decrease');
    const incBtn = document.getElementById('block-font-increase');
    if (decBtn) decBtn.addEventListener('click', () => {
        size = Math.max(BLOCK_FONT_MIN, size - BLOCK_FONT_STEP);
        applyBlockFontSize(size);
    });
    if (incBtn) incBtn.addEventListener('click', () => {
        size = Math.min(BLOCK_FONT_MAX, size + BLOCK_FONT_STEP);
        applyBlockFontSize(size);
    });
    resetBlockFontSize = () => {
        size = BLOCK_FONT_DEFAULT;
        applyBlockFontSize(size);
    };

    function applyBlockFontSize(px) {
        document.documentElement.style.setProperty('--block-font-size', px + 'px');
        const pct = Math.round((px / BLOCK_FONT_DEFAULT) * 100);
        const label = document.getElementById('block-font-value');
        if (label) label.textContent = pct + '%';
        if (window.__appSettings) window.__appSettings.blockFontSize = px;
    }

    window.applyBlockFontSize = applyBlockFontSize;
}

window.setupBlockFontZoom = setupBlockFontZoom;
window.resetBlockFontSize = resetBlockFontSize;
