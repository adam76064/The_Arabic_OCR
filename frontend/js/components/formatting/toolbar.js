// js/toolbar.js
// ══════════════════════════════════════════════════════════════════════
// TOOLBAR ORCHESTRATOR
// Loads after ui-shared.js, table-model.js, table-selection.js,
// table-toolbar.js and text-formatting.js. Just assembles the tabbed
// shell and wires the two tabs to their respective modules.
// ══════════════════════════════════════════════════════════════════════

const TAB_ICONS = {
    text: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    table: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
    tools: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L2 19l3 3 7.1-7.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-3-3 2.5-2.5z"/></svg>`,
    book: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
};

const formatText = (key) => window.AppI18n?.t(key) || key;

function getToolbarHTML() {
    const textHtml = (typeof window.getTextToolbarHTML === 'function') ? window.getTextToolbarHTML() : (window.TEXT_TOOLBAR_HTML || '');
    const tableHtml = (typeof window.getTableToolbarHTML === 'function') ? window.getTableToolbarHTML() : (window.TABLE_TOOLBAR_HTML || '');

    return `
    <div class="toolbar-tabs-container">
        <div class="toolbar-tabs">
            <button class="toolbar-tab-btn active" data-tab="text-tools">${TAB_ICONS.text}<span>${formatText('format.text')}</span></button>
            <button class="toolbar-tab-btn" data-tab="table-tools">${TAB_ICONS.table}<span>${formatText('format.tables')}</span></button>
            <button class="toolbar-tab-btn" data-tab="processing-tools">${TAB_ICONS.tools}<span>${formatText('format.processing')}</span></button>
        </div>

        <div class="toolbar-tab-content active" id="text-tools">${textHtml}</div>
        <div class="toolbar-tab-content" id="table-tools">${tableHtml}</div>
        <div class="toolbar-tab-content" id="processing-tools">
            <button class="toolbar-icon-btn" id="insert-quran-btn" title="${formatText('format.quranTitle')}" style="width:auto !important; padding: 0 10px !important; gap: 6px; font-size: 13px; font-weight: bold;">${TAB_ICONS.book}<span>${formatText('format.quran')}</span></button>
        </div>
    </div>
    `;
}

async function injectToolbar(containerId, isBlockEditor = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = getToolbarHTML();

    if (!isBlockEditor) {
        container.querySelectorAll('.block-only-tool').forEach(el => el.remove());
    }

    // Tab Switching Logic
    container.querySelectorAll('.toolbar-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.toolbar-tab-btn, .toolbar-tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            container.querySelector('#' + btn.dataset.tab).classList.add('active');
        });
    });

    await window.TextFormatting.init(container);
    window.TableToolbar.init(container);
}

window.injectToolbar = injectToolbar;
window.getToolbarHTML = getToolbarHTML;

