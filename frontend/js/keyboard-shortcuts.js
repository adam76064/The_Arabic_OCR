// keyboard-shortcuts.js
// Command handlers + keydown listener for the review screen's shortcut system.
// Extracted from review.js. Load alongside review.js (order doesn't matter).
// Relies on globals from review.js: currentProject, selectedBlockIndex,
// resetBlockFontSize, performUndo, performRedo, moveFocusAndReview, deleteBlock,
// and on the shared shortcut-customization module for getShortcutFor,
// normalizeKeyCombo, and window.__KEYBOARD_COMMANDS.

// ===== KEYBOARD SHORTCUTS =====
const COMMAND_HANDLERS = {
    'save-page':           () => document.getElementById('save-page')?.click(),
    'prev-page':           () => document.getElementById('prev-page')?.click(),
    'next-page':           () => document.getElementById('next-page')?.click(),
    'load-ocr-page':       () => document.getElementById('ocr-range-btn')?.click(),
    'toggle-sidebar':      () => document.getElementById('toggle-sidebar')?.click(),
    'project-settings':    () => window.location.href = `project-settings.html?id=${currentProject.id}`,
    'undo':                () => performUndo(),
    'redo':                () => performRedo(),
    'text-preview':        () => document.getElementById('text-preview-btn')?.click(),
    'dashboard':           () => document.getElementById('dashboard-btn')?.click(),

    'focus-next-block':    () => moveFocusAndReview(1),
    'focus-prev-block':    () => moveFocusAndReview(-1),

    'delete-block':        () => deleteBlock(),
    
    'toggle-reviewed':     () => {
        if (selectedBlockIndex === -1) return;
        document.querySelector(`.text-block[data-index="${selectedBlockIndex}"] .block-review-btn`)?.click();
    },
    'block-font-increase': () => document.getElementById('block-font-increase')?.click(),
    'block-font-decrease': () => document.getElementById('block-font-decrease')?.click(),
    'block-font-reset':    () => resetBlockFontSize(),

    'crop-zoom-in':        () => document.getElementById('crop-zoom-in')?.click(),
    'crop-zoom-out':       () => document.getElementById('crop-zoom-out')?.click(),
    'crop-zoom-reset':     () => document.getElementById('crop-zoom-reset')?.click(),

    'fmt-bold':            () => (document.querySelector('#sticky-toolbar button[data-cmd="bold"]') || document.querySelector('button[data-cmd="bold"]'))?.click(),
    'fmt-italic':          () => (document.querySelector('#sticky-toolbar button[data-cmd="italic"]') || document.querySelector('button[data-cmd="italic"]'))?.click(),
    'fmt-underline':       () => (document.querySelector('#sticky-toolbar button[data-cmd="underline"]') || document.querySelector('button[data-cmd="underline"]'))?.click(),
    'fmt-strike':          () => (document.querySelector('#sticky-toolbar button[data-cmd="strikeThrough"]') || document.querySelector('button[data-cmd="strikeThrough"]'))?.click(),
    'fmt-superscript':     () => (document.querySelector('#sticky-toolbar button[data-cmd="superscript"]') || document.querySelector('button[data-cmd="superscript"]'))?.click(),
    'fmt-subscript':       () => (document.querySelector('#sticky-toolbar button[data-cmd="subscript"]') || document.querySelector('button[data-cmd="subscript"]'))?.click(),
    'fmt-remove':          () => (document.querySelector('#sticky-toolbar button[data-brush="removeFormat"]') || document.querySelector('button[data-brush="removeFormat"]'))?.click(),
    'brush-tashkeel':      () => (document.querySelector('#sticky-toolbar button[data-brush="tashkeel"]') || document.querySelector('button[data-brush="tashkeel"]'))?.click(),
    'brush-format':        () => (document.querySelector('#sticky-toolbar button[data-brush="format"]') || document.querySelector('button[data-brush="format"]'))?.click(),

    'align-right':         () => (document.querySelector('#sticky-toolbar button[data-align="right"]') || document.querySelector('button[data-align="right"]'))?.click(),
    'align-left':          () => (document.querySelector('#sticky-toolbar button[data-align="left"]') || document.querySelector('button[data-align="left"]'))?.click(),
    'align-center':        () => (document.querySelector('#sticky-toolbar button[data-align="center"]') || document.querySelector('button[data-align="center"]'))?.click(),
    'align-justify':       () => (document.querySelector('#sticky-toolbar button[data-align="justify"]') || document.querySelector('button[data-align="justify"]'))?.click(),
    'dir-rtl':             () => (document.querySelector('#sticky-toolbar button[data-dir="rtl"]') || document.querySelector('button[data-dir="rtl"]'))?.click(),
    'dir-ltr':             () => (document.querySelector('#sticky-toolbar button[data-dir="ltr"]') || document.querySelector('button[data-dir="ltr"]'))?.click(),
};

const NATIVE_CONTENTEDITABLE_KEYS = new Set(['b', 'i', 'u', 'z', 'y']);

function isTypingInPlainFormField() {
    const ae = document.activeElement;
    return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
}

function setupKeyboardShortcuts() {
    const idByCommand = {
        'save-page': 'save-page', 'prev-page': 'prev-page', 'next-page': 'next-page',
        'load-ocr-page': 'ocr-range-btn', 'toggle-sidebar': 'toggle-sidebar',
        'undo': 'undo-btn', 'redo': 'redo-btn', 'text-preview': 'text-preview-btn', 'dashboard': 'dashboard-btn',
        'block-font-increase': 'block-font-increase', 'block-font-decrease': 'block-font-decrease',
        'crop-zoom-in': 'crop-zoom-in', 'crop-zoom-out': 'crop-zoom-out', 'crop-zoom-reset': 'crop-zoom-reset',
    };
    function refreshTooltips() {
        Object.entries(idByCommand).forEach(([cmdId, elId]) => {
            const el = document.getElementById(elId);
            const key = getShortcutFor(cmdId);
            if (el && key) {
                const base = (el.dataset.baseTitle ??= el.title);
                el.title = base ? `${base} (${key})` : key;
            }
        });
    }
    refreshTooltips();
    window.addEventListener('appSettingsLoaded', refreshTooltips);

    document.addEventListener('keydown', (e) => {
        if (isTypingInPlainFormField()) return;
        const isEditable = e.target.closest && e.target.closest('.block-content, #text-preview-body');
        
        const physicalLetter = e.code && e.code.startsWith('Key')
            ? e.code.slice(3).toLowerCase()
            : ((window.ARABIC_TO_LATIN_KEYS && window.ARABIC_TO_LATIN_KEYS[e.key]) || e.key).toLowerCase();

        if (isEditable && (e.ctrlKey || e.metaKey) && NATIVE_CONTENTEDITABLE_KEYS.has(physicalLetter)) {
            e.preventDefault(); 
        }

        const combo = normalizeKeyCombo(e);
        if (!combo) return;

        for (const cmd of window.__KEYBOARD_COMMANDS) {
            if (getShortcutFor(cmd.id) === combo && COMMAND_HANDLERS[cmd.id]) {
                e.preventDefault();
                COMMAND_HANDLERS[cmd.id]();
                return;
            }
        }
    });
}

