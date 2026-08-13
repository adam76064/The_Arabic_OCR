// js/ui-shared.js
// ══════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// Base styles + the small modal dialog used by several toolbar actions.
// Loaded first — every other toolbar module depends on this.
// ══════════════════════════════════════════════════════════════════════
const DYNAMIC_STYLES = `
<style>
    /* Toolbar Tabs */
    .toolbar-tabs-container { display: flex; flex-direction: column; width: 100%; }
    .toolbar-tabs { display: flex; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; }
    .toolbar-tab-btn { padding: 8px 20px; font-size: 13px; font-weight: bold; color: #64748b; background: transparent; border: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .toolbar-tab-btn:hover { color: #0f172a; }
    .toolbar-tab-btn.active { color: #2563eb; border-bottom: 2px solid #2563eb; background: white; }
    .toolbar-tab-content { display: none; padding: 7px 10px; flex-wrap: wrap; gap: 5px; background: white; align-items: center; }
    .toolbar-tab-content.active { display: flex; }

    /* Forcing Icon Buttons to override review.css */
    #sticky-toolbar button.toolbar-icon-btn, #text-preview-toolbar button.toolbar-icon-btn { 
        display: inline-flex !important; align-items: center !important; justify-content: center !important; 
        width: 32px !important; height: 32px !important; padding: 0 !important; 
        border: 1px solid transparent !important; border-radius: 6px !important; 
        background: transparent !important; color: #334155 !important; cursor: pointer !important; transition: all 0.15s !important; 
    }
    #sticky-toolbar button.toolbar-icon-btn:hover, #text-preview-toolbar button.toolbar-icon-btn:hover { 
        background: #eff6ff !important; border-color: #bfdbfe !important; color: #2563eb !important; 
    }
    #sticky-toolbar button.toolbar-icon-btn.active, #text-preview-toolbar button.toolbar-icon-btn.active {
        background: #dbeafe !important; border-color: #93c5fd !important; color: #2563eb !important;
    }
    
    .toolbar-tabs-container svg, .table-ctx-menu svg { display: inline-block !important; visibility: visible !important; opacity: 1 !important; }
    .toolbar-icon-btn svg { pointer-events: none; stroke: currentColor !important; }
    .toolbar-icon-sep { width: 1px; align-self: stretch; background: #e2e8f0; margin: 2px 4px; display: inline-block !important; }
    
    .toolbar-icon-color-label { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; position: relative; }
    .toolbar-icon-color-label:hover { background: #eff6ff; }
    .toolbar-icon-color-label input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .toolbar-icon-color-bar { position: absolute; bottom: 4px; left: 6px; right: 6px; height: 3px; border-radius: 1px; }
    .toolbar-icon-color-label .toolbar-icon-letter { font-size: 13px; font-weight: bold; line-height: 1; pointer-events: none; color: #334155; }
    .toolbar-icon-color-label svg { pointer-events: none; }

    /* Shared select control (font name / font size) — matches icon-button visual weight */
    .toolbar-select { height: 32px; padding: 0 6px; border: 1px solid transparent; border-radius: 6px; font-size: 13px; color: #334155; background: transparent; cursor: pointer; transition: all 0.15s; }
    .toolbar-select:hover { background: #eff6ff; border-color: #bfdbfe; color: #2563eb; }
    .toolbar-select:focus { outline: none; border-color: #93c5fd; }

    /* Tab bar icons */
    .toolbar-tab-btn { display: inline-flex !important; align-items: center; gap: 6px; }
    .toolbar-tab-btn svg { flex-shrink: 0; }

    /* Aesthetic Modals */
    .aes-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(15,23,42,0.6); z-index: 10000; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(2px); }
    .aes-dialog { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); width: 320px; font-family: inherit; direction: inherit; }
    .aes-dialog h3 { margin: 0 0 16px 0; color: #0f172a; font-size: 17px; }
    .aes-group { margin-bottom: 16px; }
    .aes-group label { display: block; font-size: 13px; color: #475569; margin-bottom: 6px; }
    .aes-group input, .aes-group select { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; font-size: 14px; box-sizing: border-box; }
    .aes-group input:focus, .aes-group select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .aes-group .aes-row { display: flex; gap: 10px; }
    .aes-group .aes-row > * { flex: 1; }
    .aes-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
    .aes-actions button { padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; border: none; }
    .aes-btn-cancel { background: #f1f5f9; color: #475569; }
    .aes-btn-cancel:hover { background: #e2e8f0; }
    .aes-btn-confirm { background: #3b82f6; color: white; }
    .aes-btn-confirm:hover { background: #2563eb; }

    /* Right-Click Context Menu */
    .table-ctx-menu { position: fixed; background: white; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 8px; padding: 6px 0; z-index: 9999; min-width: 230px; max-height: 70vh; overflow-y: auto; font-size: 13px; direction: inherit; }
    .table-ctx-menu.hidden { display: none; }
    .table-ctx-menu::-webkit-scrollbar { width: 6px; }
    .table-ctx-menu::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .table-ctx-menu div.ctx-item { padding: 10px 16px; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .table-ctx-menu div.ctx-item.disabled { opacity: 0.4; pointer-events: none; }
    .table-ctx-menu div.ctx-item:hover { background: #f8fafc; color: #2563eb; }
    .table-ctx-menu hr { margin: 6px 0; border: none; border-top: 1px solid #e2e8f0; }
    .table-ctx-menu .danger:hover { background: #fef2f2; color: #ef4444; }
    .table-ctx-menu svg { flex-shrink: 0; }

    /* Modern Table Injection Styles */
    .block-content table, #text-preview-body table { width: 100%; border-collapse: collapse; margin: 12px 0; table-layout: fixed; background: white; cursor: text; }
    .block-content table td, .block-content table th, #text-preview-body table td, #text-preview-body table th { border: 1px solid #cbd5e1; padding: 8px; min-width: 50px; word-break: break-word; vertical-align: top; transition: background 0.12s; position: relative; }
    .block-content table td:focus, #text-preview-body table td:focus { outline: 2px solid #3b82f6; outline-offset: -1px; }
    .block-content table td.tcell-selected, #text-preview-body table td.tcell-selected, .block-content table th.tcell-selected, #text-preview-body table th.tcell-selected { background-color: rgba(59,130,246,0.18) !important; outline: 1px solid #3b82f6; outline-offset: -1px; }
    body.table-cell-select-mode { user-select: none !important; -webkit-user-select: none !important; }
</style>
`;
document.head.insertAdjacentHTML('beforeend', DYNAMIC_STYLES);

const dialogText = (key) => window.AppI18n?.t(key) || key;

const AestheticDialog = {
    show: function (title, fieldsHtml, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'aes-overlay';
        overlay.innerHTML = `
            <div class="aes-dialog">
                <h3>${title}</h3>
                ${fieldsHtml}
                <div class="aes-actions">
                    <button class="aes-btn-cancel">${dialogText('dialog.cancel')}</button>
                    <button class="aes-btn-confirm">${dialogText('dialog.confirm')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.aes-btn-cancel').onclick = () => overlay.remove();
        overlay.querySelector('.aes-btn-confirm').onclick = () => {
            onConfirm(overlay);
            overlay.remove();
        };
    },

    confirm: function ({ title = dialogText('dialog.confirm'), message, confirmText = dialogText('dialog.apply'), cancelText = dialogText('dialog.notNow'), onConfirm, onCancel }) {
        const overlay = document.createElement('div');
        overlay.className = 'aes-overlay';
        overlay.innerHTML = `
            <div class="aes-dialog" style="width: 440px; max-width: 90vw;">
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; font-size: 17px; color: #0f172a;">${title}</h3>
                <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 22px;">${message}</div>
                <div class="aes-actions">
                    <button class="aes-btn-cancel" style="padding: 9px 18px; border-radius: 6px; font-size: 13px;">${cancelText}</button>
                    <button class="aes-btn-confirm" style="padding: 9px 18px; border-radius: 6px; font-size: 13px; background: #2563eb;">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.aes-btn-cancel').onclick = () => {
            overlay.remove();
            if (onCancel) onCancel();
        };
        overlay.querySelector('.aes-btn-confirm').onclick = () => {
            overlay.remove();
            if (onConfirm) onConfirm();
        };
    },

    alert: function ({ title = dialogText('dialog.alert'), message, buttonText = dialogText('dialog.ok'), onOk }) {
        const overlay = document.createElement('div');
        overlay.className = 'aes-overlay';
        overlay.innerHTML = `
            <div class="aes-dialog" style="width: 400px; max-width: 90vw;">
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; font-size: 17px; color: #0f172a;">${title}</h3>
                <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 22px;">${message}</div>
                <div class="aes-actions">
                    <button class="aes-btn-confirm" style="padding: 9px 22px; border-radius: 6px; font-size: 13px; background: #2563eb;">${buttonText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.aes-btn-confirm').onclick = () => {
            overlay.remove();
            if (onOk) onOk();
        };
    },

    deleteConfirm: function ({
        title = dialogText('dialog.deleteTitle'),
        message = dialogText('dialog.deleteMessage'),
        deleteFilesLabel = dialogText('dialog.deleteFiles'),
        defaultDeleteFiles = false,
        showRemember = true,
        confirmText = dialogText('dialog.delete'),
        cancelText = dialogText('dialog.cancel'),
        onConfirm
    }) {
        const overlay = document.createElement('div');
        overlay.className = 'aes-overlay';
        overlay.innerHTML = `
            <div class="aes-dialog" style="width: 440px; max-width: 92vw;">
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; font-size: 17px; color: #dc2626; display:flex; align-items:center; gap:8px;">
                    <span>⚠️</span> <span>${title}</span>
                </h3>
                <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 16px;">${message}</div>
                
                <div style="background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: #0f172a; cursor: pointer;">
                        <input type="checkbox" id="aes-chk-delete-files" ${defaultDeleteFiles ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #dc2626;">
                        <span>${deleteFilesLabel}</span>
                    </label>
                    ${showRemember ? `
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #64748b; cursor: pointer; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 2px;">
                        <input type="checkbox" id="aes-chk-remember" style="width: 15px; height: 15px; cursor: pointer; accent-color: #2563eb;">
                        <span>${dialogText('dialog.remember')}</span>
                    </label>
                    ` : ''}
                </div>

                <div class="aes-actions">
                    <button class="aes-btn-cancel" style="padding: 9px 18px; border-radius: 6px; font-size: 13px;">${cancelText}</button>
                    <button class="aes-btn-confirm" style="padding: 9px 20px; border-radius: 6px; font-size: 13px; background: #dc2626; color: white;">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.aes-btn-cancel').onclick = () => overlay.remove();
        overlay.querySelector('.aes-btn-confirm').onclick = () => {
            const deleteFiles = overlay.querySelector('#aes-chk-delete-files')?.checked || false;
            const remember = overlay.querySelector('#aes-chk-remember')?.checked || false;
            overlay.remove();
            if (onConfirm) onConfirm({ deleteFiles, remember });
        };
    }
};

// Ensure it is globally accessible
window.lastFocusedEditable = null;

document.addEventListener('focusin', (e) => {
    // Only track if it's a valid text block or the preview body
    if (e.target && e.target.matches('.block-content, #text-preview-body, td')) {
        window.lastFocusedEditable = e.target;
    }
});

window.AestheticDialog = AestheticDialog;
