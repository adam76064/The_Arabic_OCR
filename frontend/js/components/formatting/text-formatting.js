// js/text-formatting.js
// ══════════════════════════════════════════════════════════════════════
// TEXT FORMATTING TAB + GLOBAL BRUSHES
// ══════════════════════════════════════════════════════════════════════
(function (global) {

const TEXT_ICONS = {
    bold: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/></svg>`,
    italic: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>`,
    underline: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/></svg>`,
    strikeThrough: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M17 6.5c-.8-1.2-2.4-2-4.5-2-3 0-5 1.3-5 3.5 0 1.6 1.2 2.5 3 3"/><path d="M8 17c.9 1.3 2.7 2 4.7 2 3 0 5-1.3 5-3.6 0-1.6-1-2.6-2.7-3.2"/><path d="M3 12h18"/></svg>`,
    superscript: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:inline-block;visibility:visible;opacity:1;"><text x="1" y="19" font-size="15" font-family="Arial, sans-serif">x</text><text x="13" y="10" font-size="10" font-family="Arial, sans-serif">2</text></svg>`,
    subscript: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:inline-block;visibility:visible;opacity:1;"><text x="1" y="16" font-size="15" font-family="Arial, sans-serif">x</text><text x="13" y="22" font-size="10" font-family="Arial, sans-serif">2</text></svg>`,
    highlight: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;pointer-events:none;"><path d="M11 4L4 11l3 3 7-7-3-3z"/><path d="M14 7l3 3"/><path d="M6 15l-2 5 5-2"/></svg>`,
    tashkeel: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><circle cx="8" cy="7" r="1"/><circle cx="13" cy="6" r="1"/><circle cx="17" cy="9" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="11" cy="12" r="1"/><path d="M4 4l16 16"/></svg>`,
    formatPainter: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="14" height="5" rx="1"/><path d="M7 8v4h4"/><rect x="11" y="12" width="6" height="9" rx="1"/></svg>`,
    removeFormat: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M16 3l5 5-9.5 9.5H6L2.5 14 12 4.5z"/><path d="M9.5 20.5H21"/></svg>`,
    alignRight: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>`,
    alignCenter: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>`,
    alignLeft: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`,
    alignJustify: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>`,
    dirRtl: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M21 6H9M21 12H13M21 18H9"/><path d="M7 9L3 12L7 15"/><path d="M3 12H9"/></svg>`,
    dirLtr: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M3 6h12M3 12h8M3 18h12"/><path d="M17 9l4 3l-4 3"/><path d="M21 12h-6"/></svg>`,
};

const textToolText = (key) => global.AppI18n?.t(key) || key;

function getTextToolbarHTML() {
    return `
    <button type="button" class="toolbar-icon-btn" data-cmd="bold" title="${textToolText('format.bold')}">${TEXT_ICONS.bold}</button>
    <button type="button" class="toolbar-icon-btn" data-cmd="italic" title="${textToolText('format.italic')}">${TEXT_ICONS.italic}</button>
    <button type="button" class="toolbar-icon-btn" data-cmd="underline" title="${textToolText('format.underline')}">${TEXT_ICONS.underline}</button>
    <button type="button" class="toolbar-icon-btn" data-cmd="strikeThrough" title="${textToolText('format.strike')}">${TEXT_ICONS.strikeThrough}</button>
    <button type="button" class="toolbar-icon-btn" data-cmd="superscript" title="${textToolText('format.superscript')}">${TEXT_ICONS.superscript}</button>
    <button type="button" class="toolbar-icon-btn" data-cmd="subscript" title="${textToolText('format.subscript')}">${TEXT_ICONS.subscript}</button>
    <span class="toolbar-icon-sep"></span>

    <label class="toolbar-icon-color-label" title="${textToolText('format.textColor')}">
        <span class="toolbar-icon-letter">A</span>
        <span class="toolbar-icon-color-bar" id="tf-fore-color-bar" style="background:#e74c3c;"></span>
        <input type="color" data-color-cmd="foreColor" value="#e74c3c">
    </label>
    <label class="toolbar-icon-color-label" title="${textToolText('format.highlight')}">
        ${TEXT_ICONS.highlight}
        <span class="toolbar-icon-color-bar" id="tf-hilite-color-bar" style="background:#ffff00;"></span>
        <input type="color" data-color-cmd="hiliteColor" value="#ffff00">
    </label>
    <span class="toolbar-icon-sep"></span>

    <select class="toolbar-select dynamic-font-dropdown" data-cmd="fontName" style="max-width: 130px;">
        <option value="">${textToolText('format.font')}</option>
        <option value="Arial">Arial</option>
        <option value="Simplified Arabic">Simplified Arabic</option>
        <option value="Traditional Arabic">Traditional Arabic</option>
        <option value="Amiri">Amiri</option>
        <option value="Cairo">Cairo</option>
    </select>
    <select class="toolbar-select" data-cmd="fontSize">
        <option value="">${textToolText('format.size')}</option>
        <option value="10pt">10 pt</option>
        <option value="13pt">13 pt</option>
        <option value="16pt">16 pt</option>
        <option value="18pt">18 pt</option>
        <option value="24pt">24 pt</option>
        <option value="32pt">32 pt</option>
        <option value="48pt">48 pt</option>
    </select>
    <select class="toolbar-select block-only-tool" data-style-cmd="lineHeight" style="max-width: 90px;" title="${textToolText('format.lineSpacing')}">
        <option value="">${textToolText('format.lines')}</option>
        <option value="1.0">1.0</option>
        <option value="1.15">1.15</option>
        <option value="1.5">1.5</option>
        <option value="2.0">2.0</option>
        <option value="2.5">2.5</option>
        <option value="3.0">3.0</option>
    </select>
    <select class="toolbar-select block-only-tool" data-style-cmd="marginTop" style="max-width: 90px;" title="${textToolText('format.spaceBefore')}">
        <option value="">${textToolText('format.before')}</option>
        <option value="0pt">0 pt</option>
        <option value="6pt">6 pt</option>
        <option value="12pt">12 pt</option>
        <option value="18pt">18 pt</option>
        <option value="24pt">24 pt</option>
    </select>
    <select class="toolbar-select block-only-tool" data-style-cmd="marginBottom" style="max-width: 90px;" title="${textToolText('format.spaceAfter')}">
        <option value="">${textToolText('format.after')}</option>
        <option value="0pt">0 pt</option>
        <option value="6pt">6 pt</option>
        <option value="12pt">12 pt</option>
        <option value="18pt">18 pt</option>
        <option value="24pt">24 pt</option>
    </select>
    <span class="toolbar-icon-sep"></span>

    <button type="button" class="toolbar-icon-btn brush-btn" data-brush="tashkeel" title="${textToolText('format.removeTashkeel')}">${TEXT_ICONS.tashkeel}</button>
    <button type="button" class="toolbar-icon-btn brush-btn" data-brush="format" title="${textToolText('format.copyFormatting')}">${TEXT_ICONS.formatPainter}</button>
    <button type="button" class="toolbar-icon-btn brush-btn" data-brush="removeFormat" title="${textToolText('format.removeFormatting')}">${TEXT_ICONS.removeFormat}</button>

    <span class="toolbar-icon-sep block-only-tool"></span>
    <button type="button" class="toolbar-icon-btn block-only-tool align-btn" data-align="right" title="${textToolText('format.alignRight')}">${TEXT_ICONS.alignRight}</button>
    <button type="button" class="toolbar-icon-btn block-only-tool align-btn" data-align="center" title="${textToolText('format.alignCenter')}">${TEXT_ICONS.alignCenter}</button>
    <button type="button" class="toolbar-icon-btn block-only-tool align-btn" data-align="left" title="${textToolText('format.alignLeft')}">${TEXT_ICONS.alignLeft}</button>
    <button type="button" class="toolbar-icon-btn block-only-tool align-btn" data-align="justify" title="${textToolText('format.justify')}">${TEXT_ICONS.alignJustify}</button>
    <span class="toolbar-icon-sep block-only-tool"></span>
    <button type="button" class="toolbar-icon-btn block-only-tool" data-dir="rtl" title="${textToolText('format.rtl')}">${TEXT_ICONS.dirRtl}</button>
    <button type="button" class="toolbar-icon-btn block-only-tool" data-dir="ltr" title="${textToolText('format.ltr')}">${TEXT_ICONS.dirLtr}</button>
    `;
}

const TEXT_TOOLBAR_HTML = getTextToolbarHTML();

let savedSelectionRange = null;
let savedEditable = null;

function saveCurrentSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const elem = node && (node.nodeType === Node.TEXT_NODE ? node.parentNode : node);
    const editable = elem && elem.closest ? elem.closest('.block-content, #text-preview-body, [contenteditable="true"], td, th') : null;
    if (editable) {
        savedSelectionRange = range.cloneRange();
        savedEditable = editable;
        global.lastFocusedEditable = editable.closest('.block-content, #text-preview-body, [contenteditable="true"]') || editable;
    }
}

function restoreSelection() {
    const target = savedEditable || global.lastFocusedEditable;
    if (target) {
        if (document.activeElement !== target && !target.contains(document.activeElement)) {
            target.focus();
        }
        if (savedSelectionRange) {
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(savedSelectionRange);
            }
            return true;
        }
        return true;
    }
    return false;
}

function ensureWordSelectedIfCollapsed() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    if (!sel.isCollapsed) return; // Explicit user selection range already exists

    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        const offset = range.startOffset;
        if (!text || text.length === 0) return;

        // Word character matching Arabic letters, diacritics, tatweel, Latin letters, digits
        const isWordChar = (ch) => /[\u0600-\u06FF\u0750-\u077F\w\d\u0610-\u061A\u064B-\u065F\u0670]/.test(ch);

        let start = offset;
        let end = offset;

        if (start > 0 && isWordChar(text[start - 1]) && (start >= text.length || !isWordChar(text[start]))) {
            start--;
            end = offset;
        } else if (start < text.length && isWordChar(text[start])) {
            end = offset + 1;
        } else {
            return;
        }

        while (start > 0 && isWordChar(text[start - 1])) {
            start--;
        }

        while (end < text.length && isWordChar(text[end])) {
            end++;
        }

        if (start < end) {
            const newRange = document.createRange();
            newRange.setStart(node, start);
            newRange.setEnd(node, end);
            sel.removeAllRanges();
            sel.addRange(newRange);
            savedSelectionRange = newRange.cloneRange();
        }
    }
}

function applyFontSize(val, target) {
    if (!val || !target) return;
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;

    if (hasSelection) {
        try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
        document.execCommand('fontSize', false, '7');
        const styled = target.querySelectorAll('font[size="7"], span[style*="xxx-large"], span[style*="48px"], font[size]');
        styled.forEach(el => {
            el.removeAttribute('size');
            el.style.fontSize = val;
        });
    } else {
        ensureWordSelectedIfCollapsed();
        const updatedSel = window.getSelection();
        if (updatedSel && updatedSel.rangeCount > 0 && !updatedSel.isCollapsed) {
            try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
            document.execCommand('fontSize', false, '7');
            const styled = target.querySelectorAll('font[size="7"], span[style*="xxx-large"], span[style*="48px"], font[size]');
            styled.forEach(el => {
                el.removeAttribute('size');
                el.style.fontSize = val;
            });
        } else {
            target.style.fontSize = val;
            target.style.setProperty('--block-font-size', val);
        }
    }
}

function applyFontName(val, target) {
    if (!val || !target) return;
    const fontName = val.replace(/^['"]|['"]$/g, '');
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;

    if (hasSelection) {
        try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
        document.execCommand('fontName', false, fontName);
        const styled = target.querySelectorAll(`font[face="${fontName}"], font[face]`);
        styled.forEach(el => {
            el.removeAttribute('face');
            el.style.fontFamily = fontName;
        });
    } else {
        ensureWordSelectedIfCollapsed();
        const updatedSel = window.getSelection();
        if (updatedSel && updatedSel.rangeCount > 0 && !updatedSel.isCollapsed) {
            try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
            document.execCommand('fontName', false, fontName);
            const styled = target.querySelectorAll(`font[face="${fontName}"], font[face]`);
            styled.forEach(el => {
                el.removeAttribute('face');
                el.style.fontFamily = fontName;
            });
        } else {
            target.style.fontFamily = fontName;
        }
    }
}

function applyStyleCmd(cmd, val, target) {
    if (!target) return;
    const selection = window.getSelection();
    const node = selection && selection.rangeCount ? selection.anchorNode : null;
    const currElem = node ? (node.nodeType === Node.TEXT_NODE ? node.parentNode : node) : target;
    const pElem = currElem ? currElem.closest('p, div, li, td, th, h1, h2, h3, h4, h5, h6') : null;

    if (cmd === 'lineHeight') {
        target.style.lineHeight = val;
        target.style.setProperty('--block-line-height', val);
        if (pElem && target.contains(pElem) && pElem !== target) {
            pElem.style.lineHeight = val;
            pElem.style.setProperty('--block-line-height', val);
        }
        target.querySelectorAll('p').forEach(p => {
            p.style.lineHeight = val;
        });
    } else if (cmd === 'marginTop') {
        target.style.marginTop = val;
        target.style.setProperty('--block-space-before', val);
        if (pElem && target.contains(pElem) && pElem !== target) {
            pElem.style.marginTop = val;
            pElem.style.setProperty('--p-space-before', val);
        }
    } else if (cmd === 'marginBottom') {
        target.style.marginBottom = val;
        target.style.setProperty('--block-space-after', val);
        if (pElem && target.contains(pElem) && pElem !== target) {
            pElem.style.marginBottom = val;
            pElem.style.setProperty('--p-space-after', val);
        }
    }
}

let cachedSystemFonts = null;

const TextFormatting = {
    init(container) {
        if (!container) return;

        // Prevent toolbar buttons from stealing focus / collapsing selection on mousedown
        container.querySelectorAll('button, label.toolbar-icon-color-label').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.type === 'color') return;
                saveCurrentSelection();
                e.preventDefault();
            });
        });

        // Save active selection before interacting with dropdowns or color picker
        container.querySelectorAll('select, input[type="color"]').forEach(el => {
            el.addEventListener('mousedown', () => saveCurrentSelection());
            el.addEventListener('focus', () => saveCurrentSelection());
        });

        // Asynchronous font population
        const fontDropdown = container.querySelector('.dynamic-font-dropdown');
        if (fontDropdown) {
            const populateFonts = (fonts) => {
                if (!fonts || fonts.length === 0) return;
                if (fontDropdown.dataset.fontsLoaded === '1') return;
                fontDropdown.dataset.fontsLoaded = '1';
                fontDropdown.innerHTML += `<option disabled>──────────</option>`;
                fonts.forEach(font => {
                    const fontValue = font.includes(' ') ? font : font;
                    const displayName = font.length > 22 ? font.substring(0, 22) + '...' : font;
                    fontDropdown.innerHTML += `<option value="${fontValue}" title="${font}">${displayName}</option>`;
                });
            };

            if (cachedSystemFonts) {
                populateFonts(cachedSystemFonts);
            } else if (global.pywebview?.api?.get_system_fonts) {
                global.pywebview.api.get_system_fonts().then(response => {
                    if (response && response.ok && response.fonts) {
                        cachedSystemFonts = response.fonts;
                        populateFonts(cachedSystemFonts);
                    }
                }).catch(err => console.warn("Could not load system fonts:", err));
            }
        }

        // Basic Formatting (bold, italic, underline, strike, sup, sub)
        container.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                restoreSelection();
                ensureWordSelectedIfCollapsed();
                const cmd = btn.dataset.cmd;
                document.execCommand(cmd, false, null);
                saveCurrentSelection();
                const target = global.lastFocusedEditable || savedEditable;
                if (global.persistBrushEdit && target) global.persistBrushEdit(target);
                updateToolbarState(container);
            });
        });

        // Color Commands
        container.querySelectorAll('input[data-color-cmd]').forEach(inp => {
            const applyColor = () => {
                restoreSelection();
                ensureWordSelectedIfCollapsed();
                const cmd = inp.dataset.colorCmd;
                try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
                document.execCommand(cmd, false, inp.value);
                const bar = cmd === 'foreColor'
                    ? container.querySelector('#tf-fore-color-bar')
                    : container.querySelector('#tf-hilite-color-bar');
                if (bar) bar.style.background = inp.value;
                saveCurrentSelection();
                const target = global.lastFocusedEditable || savedEditable;
                if (global.persistBrushEdit && target) global.persistBrushEdit(target);
                updateToolbarState(container);
            };
            inp.addEventListener('input', applyColor);
            inp.addEventListener('change', applyColor);
        });

        // Font Family & Font Size Dropdowns
        container.querySelectorAll('select[data-cmd]').forEach(sel => {
            sel.addEventListener('change', () => {
                restoreSelection();
                const cmd = sel.dataset.cmd;
                const val = sel.value;
                const target = global.lastFocusedEditable || savedEditable;

                if (val && target) {
                    if (cmd === 'fontSize') {
                        applyFontSize(val, target);
                    } else if (cmd === 'fontName') {
                        applyFontName(val, target);
                    } else {
                        document.execCommand(cmd, false, val);
                    }
                }

                saveCurrentSelection();
                if (global.persistBrushEdit && target) global.persistBrushEdit(target);
                updateToolbarState(container);
            });
        });

        // Paragraph-level Alignment Logic
        container.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                restoreSelection();
                const target = global.lastFocusedEditable || savedEditable;
                if (!target) return;

                const alignVal = btn.dataset.align;
                const selection = window.getSelection();
                const node = selection && selection.rangeCount ? selection.anchorNode : null;
                const currElem = node ? (node.nodeType === 3 ? node.parentNode : node) : target;

                // 1. Table Cells Alignment
                const td = currElem ? currElem.closest('td, th') : null;
                const multi = global.TableSelection ? global.TableSelection.getSelectedCells(td) : (td ? [td] : []);

                if (multi.length > 1) {
                    multi.forEach(c => { c.style.textAlign = alignVal; });
                } else if (td && target.contains(td)) {
                    td.style.textAlign = alignVal;
                } else {
                    // 2. Paragraph-level Alignment
                    const pElem = currElem ? currElem.closest('p, div, li, h1, h2, h3, h4, h5, h6') : null;
                    if (pElem && target.contains(pElem) && pElem !== target) {
                        pElem.style.textAlign = alignVal;
                    } else {
                        let cmd = 'justify' + alignVal.charAt(0).toUpperCase() + alignVal.slice(1);
                        if (alignVal === 'justify') cmd = 'justifyFull';
                        try { document.execCommand(cmd, false, null); } catch (e) {}
                        target.style.textAlign = alignVal;
                    }
                }
                saveCurrentSelection();
                if (global.persistBrushEdit) global.persistBrushEdit(target);
                updateToolbarState(container);
            });
        });

        // Paragraph-level Direction Logic
        container.querySelectorAll('[data-dir]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                restoreSelection();
                const target = global.lastFocusedEditable || savedEditable;
                if (!target) return;

                const dirVal = btn.dataset.dir;
                const selection = window.getSelection();
                const node = selection && selection.rangeCount ? selection.anchorNode : null;
                const currElem = node ? (node.nodeType === 3 ? node.parentNode : node) : target;

                const td = currElem ? currElem.closest('td, th') : null;
                if (td && target.contains(td)) {
                    td.dir = dirVal;
                    td.style.direction = dirVal;
                } else {
                    const pElem = currElem ? currElem.closest('p, div, li, h1, h2, h3, h4, h5, h6') : null;
                    if (pElem && target.contains(pElem) && pElem !== target) {
                        pElem.dir = dirVal;
                        pElem.style.direction = dirVal;
                    } else {
                        target.dir = dirVal;
                        target.style.direction = dirVal;
                    }
                }
                saveCurrentSelection();
                if (global.persistBrushEdit) global.persistBrushEdit(target);
                updateToolbarState(container);
            });
        });

        // Line Spacing & Paragraph Spacing Dropdowns
        container.querySelectorAll('select[data-style-cmd]').forEach(sel => {
            sel.addEventListener('change', () => {
                restoreSelection();
                const target = global.lastFocusedEditable || savedEditable;
                if (!target) return;

                const cmd = sel.dataset.styleCmd;
                const val = sel.value;
                if (val) {
                    applyStyleCmd(cmd, val, target);
                }

                saveCurrentSelection();
                if (global.persistBrushEdit && target) global.persistBrushEdit(target);
                updateToolbarState(container);
            });
        });

        // Dynamic Toolbar State Synchronizer
        const syncToolbar = () => {
            saveCurrentSelection();
            updateToolbarState(container);
        };
        document.addEventListener('selectionchange', syncToolbar);
        document.addEventListener('keyup', syncToolbar);
        document.addEventListener('mouseup', syncToolbar);
        document.addEventListener('focusin', syncToolbar);

        setupGlobalBrushes();
    }
};

function rgbToHex(rgbStr) {
    if (!rgbStr || rgbStr === 'transparent' || rgbStr.includes('rgba(0, 0, 0, 0)')) return null;
    const m = rgbStr.match(/\d+/g);
    if (!m || m.length < 3) return null;
    const r = parseInt(m[0]).toString(16).padStart(2, '0');
    const g = parseInt(m[1]).toString(16).padStart(2, '0');
    const b = parseInt(m[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function _syncSingleToolbar(container) {
    if (!container) return;

    const activeEl = document.activeElement;
    if (activeEl && container.contains(activeEl) && activeEl.tagName === 'SELECT') {
        return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const node = sel.anchorNode;
    if (!node) return;

    const elem = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    if (!elem) return;

    const editable = elem.closest && elem.closest('.block-content, #text-preview-body, [contenteditable="true"], td, th');
    if (!editable) return;

    // 1. Basic Formatting Commands
    const isBold = document.queryCommandState('bold') || !!elem.closest('b, strong') || (parseInt(window.getComputedStyle(elem).fontWeight, 10) >= 600) || window.getComputedStyle(elem).fontWeight === 'bold';
    const isItalic = document.queryCommandState('italic') || !!elem.closest('i, em') || window.getComputedStyle(elem).fontStyle === 'italic';
    const isUnderline = document.queryCommandState('underline') || !!elem.closest('u') || (window.getComputedStyle(elem).textDecorationLine || '').includes('underline') || (window.getComputedStyle(elem).textDecoration || '').includes('underline');
    const isStrike = document.queryCommandState('strikeThrough') || !!elem.closest('s, strike, del') || (window.getComputedStyle(elem).textDecorationLine || '').includes('line-through') || (window.getComputedStyle(elem).textDecoration || '').includes('line-through');
    const isSup = document.queryCommandState('superscript') || !!elem.closest('sup');
    const isSub = document.queryCommandState('subscript') || !!elem.closest('sub');

    container.querySelector('button[data-cmd="bold"]')?.classList.toggle('active', !!isBold);
    container.querySelector('button[data-cmd="italic"]')?.classList.toggle('active', !!isItalic);
    container.querySelector('button[data-cmd="underline"]')?.classList.toggle('active', !!isUnderline);
    container.querySelector('button[data-cmd="strikeThrough"]')?.classList.toggle('active', !!isStrike);
    container.querySelector('button[data-cmd="superscript"]')?.classList.toggle('active', !!isSup);
    container.querySelector('button[data-cmd="subscript"]')?.classList.toggle('active', !!isSub);

    // 2. Text Color
    let fontColorHex = null;
    try {
        const qColor = document.queryCommandValue('foreColor');
        if (qColor) fontColorHex = rgbToHex(qColor);
    } catch (e) {}
    if (!fontColorHex) {
        const colElem = elem.closest('font[color]') || elem.closest('[style*="color"]');
        if (colElem) {
            fontColorHex = rgbToHex(window.getComputedStyle(colElem).color);
        } else {
            fontColorHex = rgbToHex(window.getComputedStyle(elem).color);
        }
    }
    if (fontColorHex) {
        const bar = container.querySelector('#tf-fore-color-bar');
        const inp = container.querySelector('input[data-color-cmd="foreColor"]');
        if (bar) bar.style.background = fontColorHex;
        if (inp) inp.value = fontColorHex;
    }

    // 3. Highlight Color
    let bgNode = elem;
    let bgColorHex = null;
    while (bgNode && bgNode !== editable && bgNode.parentNode) {
        const bg = window.getComputedStyle(bgNode).backgroundColor;
        const hex = rgbToHex(bg);
        if (hex) {
            bgColorHex = hex;
            break;
        }
        bgNode = bgNode.parentNode;
    }
    const hiliteBar = container.querySelector('#tf-hilite-color-bar');
    const hiliteInp = container.querySelector('input[data-color-cmd="hiliteColor"]');
    if (bgColorHex) {
        if (hiliteBar) hiliteBar.style.background = bgColorHex;
        if (hiliteInp) hiliteInp.value = bgColorHex;
    } else {
        if (hiliteBar) hiliteBar.style.background = '#ffff00';
        if (hiliteInp) hiliteInp.value = '#ffff00';
    }

    // 4. Font Family
    const fontDropdown = container.querySelector('select[data-cmd="fontName"]');
    if (fontDropdown) {
        let currentFont = '';
        const styledEl = elem.closest('[style*="font-family"]');
        if (styledEl) currentFont = styledEl.style.fontFamily;
        if (!currentFont) {
            const fontEl = elem.closest('font[face]');
            if (fontEl) currentFont = fontEl.getAttribute('face');
        }
        if (!currentFont && editable) {
            currentFont = editable.style.fontFamily;
        }
        if (!currentFont) {
            try { currentFont = document.queryCommandValue('fontName') || ''; } catch (e) {}
        }
        if (!currentFont) {
            currentFont = window.getComputedStyle(elem).fontFamily || '';
        }
        const cleanFont = currentFont.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
        let matchedIndex = 0;
        if (cleanFont) {
            for (let i = 1; i < fontDropdown.options.length; i++) {
                const opt = fontDropdown.options[i];
                if (opt.disabled) continue;
                const optVal = opt.value.replace(/['"]/g, '').trim().toLowerCase();
                const optText = opt.textContent.replace(/['"]/g, '').trim().toLowerCase();
                if (optVal === cleanFont || optText === cleanFont || (optVal && cleanFont.includes(optVal)) || (optVal && optVal.includes(cleanFont))) {
                    matchedIndex = i;
                    break;
                }
            }
        }
        fontDropdown.selectedIndex = matchedIndex;
    }

    // 5. Font Size
    const fontSizeSel = container.querySelector('select[data-cmd="fontSize"]');
    if (fontSizeSel) {
        let matchedIdx = 0;
        let fontSizeStr = '';
        const styledEl = elem.closest('[style*="font-size"]');
        if (styledEl) fontSizeStr = styledEl.style.fontSize;
        if (!fontSizeStr) {
            const fontEl = elem.closest('font[size]');
            if (fontEl) {
                const s = fontEl.getAttribute('size');
                const legacyMap = { '1': '10pt', '2': '13pt', '3': '16pt', '4': '18pt', '5': '24pt', '6': '32pt', '7': '48pt' };
                fontSizeStr = legacyMap[s] || '';
            }
        }
        if (!fontSizeStr && editable) {
            fontSizeStr = editable.style.fontSize || editable.style.getPropertyValue('--block-font-size') || '';
        }
        if (!fontSizeStr) {
            const cs = window.getComputedStyle(elem);
            const px = parseFloat(cs.fontSize);
            if (!isNaN(px) && px > 0) {
                fontSizeStr = Math.round(px * 0.75) + 'pt';
            }
        }

        if (fontSizeStr) {
            const targetPt = parseFloat(fontSizeStr);
            if (!isNaN(targetPt)) {
                let minDiff = 2.5;
                for (let i = 1; i < fontSizeSel.options.length; i++) {
                    const optPt = parseFloat(fontSizeSel.options[i].value);
                    if (!isNaN(optPt)) {
                        const diff = Math.abs(optPt - targetPt);
                        if (diff < minDiff) {
                            minDiff = diff;
                            matchedIdx = i;
                        }
                    }
                }
            }
        }
        fontSizeSel.selectedIndex = matchedIdx;
    }

    // 6. Alignment
    const pElem = elem.closest('p, div, li, td, th, h1, h2, h3, h4, h5, h6') || elem;
    const computedAlign = window.getComputedStyle(pElem).textAlign || 'right';
    let align = 'right';
    if (computedAlign.includes('center')) align = 'center';
    else if (computedAlign.includes('left')) align = 'left';
    else if (computedAlign.includes('justify')) align = 'justify';
    else if (computedAlign.includes('right')) align = 'right';

    container.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === align);
    });

    // 7. Direction
    const dir = pElem.dir || window.getComputedStyle(pElem).direction || 'rtl';
    const normDir = dir.toLowerCase().includes('ltr') ? 'ltr' : 'rtl';
    container.querySelectorAll('[data-dir]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dir === normDir);
    });

    // 8. Line Spacing
    const lineHeightSel = container.querySelector('select[data-style-cmd="lineHeight"]');
    if (lineHeightSel) {
        let lhRaw = pElem.style.lineHeight ||
                    pElem.style.getPropertyValue('--block-line-height') ||
                    editable.style.getPropertyValue('--block-line-height') ||
                    editable.style.lineHeight || '';

        let matchedLhIdx = 0;
        let numLh = parseFloat(lhRaw);
        if (isNaN(numLh) || numLh <= 0) {
            const cs = window.getComputedStyle(pElem);
            const lhPx = parseFloat(cs.lineHeight);
            const fsPx = parseFloat(cs.fontSize);
            if (!isNaN(lhPx) && !isNaN(fsPx) && fsPx > 0) {
                numLh = Math.round((lhPx / fsPx) * 100) / 100;
            }
        }
        if (!isNaN(numLh) && numLh > 0) {
            let minDiff = 0.25;
            for (let i = 1; i < lineHeightSel.options.length; i++) {
                const optVal = parseFloat(lineHeightSel.options[i].value);
                if (!isNaN(optVal)) {
                    const diff = Math.abs(optVal - numLh);
                    if (diff < minDiff) {
                        minDiff = diff;
                        matchedLhIdx = i;
                    }
                }
            }
        }
        lineHeightSel.selectedIndex = matchedLhIdx;
    }

    function matchMarginSelect(sel, rawVal, computedPx) {
        if (!sel) return;
        let matchedIdx = 0;
        if (rawVal) {
            const mPt = rawVal.match(/(\d+(?:\.\d+)?)/);
            if (mPt) {
                const targetPt = parseFloat(mPt[1]);
                let minDiff = 2.5;
                for (let i = 1; i < sel.options.length; i++) {
                    const optPtMatch = sel.options[i].value.match(/(\d+(?:\.\d+)?)/);
                    if (optPtMatch) {
                        const optPt = parseFloat(optPtMatch[1]);
                        const diff = Math.abs(optPt - targetPt);
                        if (diff < minDiff) {
                            minDiff = diff;
                            matchedIdx = i;
                        }
                    }
                }
            }
        }
        if (matchedIdx === 0 && computedPx) {
            const px = parseFloat(computedPx);
            if (!isNaN(px) && px > 0) {
                const pt = px * 0.75;
                let minDiff = 3.5;
                for (let i = 1; i < sel.options.length; i++) {
                    const optPtMatch = sel.options[i].value.match(/(\d+(?:\.\d+)?)/);
                    if (optPtMatch) {
                        const optPt = parseFloat(optPtMatch[1]);
                        const diff = Math.abs(optPt - pt);
                        if (diff < minDiff) {
                            minDiff = diff;
                            matchedIdx = i;
                        }
                    }
                }
            }
        }
        sel.selectedIndex = matchedIdx;
    }

    const marginTopSel = container.querySelector('select[data-style-cmd="marginTop"]');
    if (marginTopSel) {
        const mtRaw = pElem.style.marginTop ||
                      pElem.style.getPropertyValue('--p-space-before') ||
                      editable.style.getPropertyValue('--block-space-before') ||
                      editable.style.marginTop || '';
        const csMt = window.getComputedStyle(pElem).marginTop;
        matchMarginSelect(marginTopSel, mtRaw, csMt);
    }

    const marginBotSel = container.querySelector('select[data-style-cmd="marginBottom"]');
    if (marginBotSel) {
        const mbRaw = pElem.style.marginBottom ||
                      pElem.style.getPropertyValue('--p-space-after') ||
                      editable.style.getPropertyValue('--block-space-after') ||
                      editable.style.marginBottom || '';
        const csMb = window.getComputedStyle(pElem).marginBottom;
        matchMarginSelect(marginBotSel, mbRaw, csMb);
    }
}

function updateToolbarState(container) {
    if (container) {
        _syncSingleToolbar(container);
    } else {
        const toolbars = document.querySelectorAll('#sticky-toolbar, #text-preview-toolbar, .formatting-toolbar-group');
        toolbars.forEach(tb => _syncSingleToolbar(tb));
    }
}

// ══════════════════════════════════════════════════════════════════════
// GLOBAL BRUSHES
// ══════════════════════════════════════════════════════════════════════
let _brushesBound = false;
function setupGlobalBrushes() {
    if (_brushesBound) return;
    _brushesBound = true;

    const TASHKEEL_RE = /[\u064B-\u0652\u0670\u0653-\u0655]/g;
    let activeBrush = null; let copiedStyle = null;

    function removeTashkeelFromRange(range) {
        if (!range) return;
        const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentNode
            : range.commonAncestorContainer;
            
        const textNodes = [];
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
            textNodes.push(range.commonAncestorContainer);
        } else {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        try {
                            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                        } catch (e) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                }
            );
            let currentNode;
            while ((currentNode = walker.nextNode())) {
                textNodes.push(currentNode);
            }
        }

        textNodes.forEach(node => {
            let start = (node === range.startContainer) ? range.startOffset : 0;
            let end = (node === range.endContainer) ? range.endOffset : node.nodeValue.length;
            if (start < end) {
                const before = node.nodeValue.substring(0, start);
                const target = node.nodeValue.substring(start, end);
                const after = node.nodeValue.substring(end);
                node.nodeValue = before + target.replace(TASHKEEL_RE, '') + after;
            }
        });
    }

    function setBrushVisual(name, on) { document.querySelectorAll(`button[data-brush="${name}"]`).forEach(b => b.classList.toggle('active', on)); }
    function deactivateBrushes() { if (activeBrush) setBrushVisual(activeBrush, false); activeBrush = null; document.body.style.cursor = ''; }

    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-brush]');
        if (!btn) return;
        const name = btn.dataset.brush;

        if (name === 'format' && activeBrush !== 'format') {
            if (!global.lastFocusedEditable) return;
            copiedStyle = {
                bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'), strikeThrough: document.queryCommandState('strikeThrough'),
            };
        }

        if (activeBrush === name) deactivateBrushes();
        else {
            if (activeBrush) setBrushVisual(activeBrush, false);
            activeBrush = name;
            setBrushVisual(name, true);
            document.body.style.cursor = name === 'format' ? 'copy' : 'crosshair';
        }
    });

    document.addEventListener('mouseup', (e) => {
        const contentEl = e.target.closest('.block-content, #text-preview-body');
        if (!contentEl || !activeBrush) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        if (activeBrush === 'tashkeel') {
            const range = sel.getRangeAt(0);
            removeTashkeelFromRange(range);
            if (global.persistBrushEdit) global.persistBrushEdit(contentEl);
            sel.removeAllRanges();
        } else if (activeBrush === 'format' && copiedStyle) {
            if (copiedStyle.bold) document.execCommand('bold', false, null);
            if (copiedStyle.italic) document.execCommand('italic', false, null);
            if (copiedStyle.underline) document.execCommand('underline', false, null);
            if (copiedStyle.strikeThrough) document.execCommand('strikeThrough', false, null);
            if (global.persistBrushEdit) global.persistBrushEdit(contentEl);
            deactivateBrushes();
        } else if (activeBrush === 'removeFormat') {
            document.execCommand('removeFormat', false, null);
            if (global.persistBrushEdit) global.persistBrushEdit(contentEl);
            deactivateBrushes();
        }
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activeBrush) deactivateBrushes(); });
}

global.TextFormatting = TextFormatting;
global.TEXT_TOOLBAR_HTML = TEXT_TOOLBAR_HTML;
global.getTextToolbarHTML = getTextToolbarHTML;
global.updateToolbarState = updateToolbarState;
global.updateFormattingToolbarState = updateToolbarState;

})(window);

