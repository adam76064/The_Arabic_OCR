// js/ui-shared.js
// ══════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES & DIALOGS (100% Tokenized & Zero Emojis)
// ══════════════════════════════════════════════════════════════════════

const DYNAMIC_STYLES = `
<style>
    /* Toolbar Tabs */
    .toolbar-tabs-container { display: flex; flex-direction: column; width: 100%; }
    .toolbar-tabs { display: flex; background: var(--color-bg-alt); border-bottom: 1px solid var(--color-border); }
    .toolbar-tab-btn { padding: 8px 18px; font-size: var(--text-sm); font-weight: bold; color: var(--color-text-muted); background: transparent; border: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
    .toolbar-tab-btn:hover { color: var(--color-text); }
    .toolbar-tab-btn.active { color: var(--color-primary); border-bottom: 2px solid var(--color-primary); background: var(--color-surface); }
    .toolbar-tab-content { display: none; padding: 7px 10px; flex-wrap: wrap; gap: 5px; background: var(--color-surface); align-items: center; }
    .toolbar-tab-content.active { display: flex; }

    /* Icon Buttons Override */
    #sticky-toolbar button.toolbar-icon-btn, #text-preview-toolbar button.toolbar-icon-btn { 
        display: inline-flex !important; align-items: center !important; justify-content: center !important; 
        width: 32px !important; height: 32px !important; padding: 0 !important; 
        border: 1px solid transparent !important; border-radius: var(--radius-sm) !important; 
        background: transparent !important; color: var(--color-text-secondary) !important; cursor: pointer !important; transition: all 0.15s !important; 
    }
    #sticky-toolbar button.toolbar-icon-btn:hover, #text-preview-toolbar button.toolbar-icon-btn:hover { 
        background: var(--color-surface-hover) !important; border-color: var(--color-border-strong) !important; color: var(--color-primary) !important; 
    }
    #sticky-toolbar button.toolbar-icon-btn.active, #text-preview-toolbar button.toolbar-icon-btn.active {
        background: var(--color-primary-light) !important; border-color: var(--color-primary) !important; color: var(--color-primary) !important;
    }
    
    .toolbar-tabs-container svg, .table-ctx-menu svg { display: inline-block !important; visibility: visible !important; opacity: 1 !important; }
    .toolbar-icon-btn svg { pointer-events: none; stroke: currentColor !important; }
    .toolbar-icon-sep { width: 1px; align-self: stretch; background: var(--color-border); margin: 2px 4px; display: inline-block !important; }
    
    .toolbar-icon-color-label { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--radius-sm); cursor: pointer; position: relative; }
    .toolbar-icon-color-label:hover { background: var(--color-surface-hover); }
    .toolbar-icon-color-label input[type="color"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .toolbar-icon-color-bar { position: absolute; bottom: 4px; left: 6px; right: 6px; height: 3px; border-radius: 1px; }
    .toolbar-icon-color-label .toolbar-icon-letter { font-size: var(--text-sm); font-weight: bold; line-height: 1; pointer-events: none; color: var(--color-text); }
    .toolbar-icon-color-label svg { pointer-events: none; }

    /* Shared select control (font name / font size) */
    .toolbar-select { height: 32px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--text-sm); color: var(--color-text); background: var(--color-surface); cursor: pointer; transition: all 0.15s; }
    .toolbar-select:hover { border-color: var(--color-border-strong); }
    .toolbar-select:focus { outline: none; border-color: var(--color-primary); }

    /* Tab bar icons */
    .toolbar-tab-btn { display: inline-flex !important; align-items: center; gap: 6px; }
    .toolbar-tab-btn svg { flex-shrink: 0; }

    /* Aesthetic Modals (Zero Emojis, Tokenized) */
    .aes-overlay { position: fixed; inset: 0; background: rgba(14, 17, 23, 0.65); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.15s ease; }
    .aes-dialog { background: var(--color-surface); padding: 22px; border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); width: 340px; border: 1px solid var(--color-border); font-family: inherit; direction: inherit; color: var(--color-text); animation: slideIn 0.2s var(--ease-spring); }
    .aes-dialog h3 { margin: 0 0 16px 0; color: var(--color-text); font-size: var(--text-md); font-weight: 700; }
    .aes-group { margin-bottom: 14px; }
    .aes-group label { display: block; font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: 6px; font-weight: 600; }
    .aes-group input, .aes-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text); outline: none; font-size: var(--text-base); box-sizing: border-box; }
    .aes-group input:focus, .aes-group select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
    .aes-group .aes-row { display: flex; gap: 10px; }
    .aes-group .aes-row > * { flex: 1; }
    .aes-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .aes-actions button { padding: 8px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; font-size: var(--text-sm); border: none; transition: all var(--trans-fast); }
    .aes-btn-cancel { background: var(--color-bg-muted); color: var(--color-text-secondary); }
    .aes-btn-cancel:hover { background: var(--color-border-strong); color: var(--color-text); }
    .aes-btn-confirm { background: var(--color-primary); color: var(--color-text-inverse); }
    .aes-btn-confirm:hover { background: var(--color-primary-hover); }

    /* Right-Click Context Menu */
    .table-ctx-menu { position: fixed; background: var(--color-surface-elevated); border: 1px solid var(--color-border-strong); box-shadow: var(--shadow-xl); border-radius: var(--radius-md); padding: 6px 0; z-index: 9999; min-width: 230px; max-height: 70vh; overflow-y: auto; font-size: var(--text-sm); direction: inherit; }
    .table-ctx-menu.hidden { display: none; }
    .table-ctx-menu div.ctx-item { padding: 9px 16px; cursor: pointer; color: var(--color-text); display: flex; align-items: center; gap: 8px; transition: background 0.12s; }
    .table-ctx-menu div.ctx-item.disabled { opacity: 0.4; pointer-events: none; }
    .table-ctx-menu div.ctx-item:hover { background: var(--color-surface-hover); color: var(--color-primary); }
    .table-ctx-menu hr { margin: 6px 0; border: none; border-top: 1px solid var(--color-border); }
    .table-ctx-menu .danger:hover { background: var(--color-danger-light); color: var(--color-danger); }
    .table-ctx-menu svg { flex-shrink: 0; }
</style>
`;
document.head.insertAdjacentHTML('beforeend', DYNAMIC_STYLES);

const dialogText = (key) => window.AppI18n?.t(key) || key;
const getIcon = (name) => window.AppIcons ? window.AppIcons.get(name) : '';

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
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid var(--color-border); padding-bottom: 10px; font-size: 16px; color: var(--color-text);">${title}</h3>
                <div style="font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 20px;">${message}</div>
                <div class="aes-actions">
                    <button class="aes-btn-cancel" style="padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px;">${cancelText}</button>
                    <button class="aes-btn-confirm" style="padding: 8px 18px; border-radius: var(--radius-md); font-size: 13px; background: var(--color-primary); color: white;">${confirmText}</button>
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
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid var(--color-border); padding-bottom: 10px; font-size: 16px; color: var(--color-text);">${title}</h3>
                <div style="font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 20px;">${message}</div>
                <div class="aes-actions">
                    <button class="aes-btn-confirm" style="padding: 8px 22px; border-radius: var(--radius-md); font-size: 13px; background: var(--color-primary); color: white;">${buttonText}</button>
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
        const warnIcon = getIcon('warning');
        overlay.innerHTML = `
            <div class="aes-dialog" style="width: 440px; max-width: 92vw;">
                <h3 style="margin-top:0; margin-bottom:12px; border-bottom: 1px solid var(--color-border); padding-bottom: 10px; font-size: 16px; color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                    ${warnIcon} <span>${title}</span>
                </h3>
                <div style="font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">${message}</div>
                
                <div style="background: var(--color-bg); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--color-text); cursor: pointer;">
                        <input type="checkbox" id="aes-chk-delete-files" ${defaultDeleteFiles ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-danger);">
                        <span>${deleteFilesLabel}</span>
                    </label>
                    ${showRemember ? `
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; border-top: 1px solid var(--color-border); padding-top: 8px; margin-top: 2px;">
                        <input type="checkbox" id="aes-chk-remember" style="width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-primary);">
                        <span>${dialogText('dialog.remember')}</span>
                    </label>
                    ` : ''}
                </div>

                <div class="aes-actions">
                    <button class="aes-btn-cancel" style="padding: 8px 16px; border-radius: var(--radius-md); font-size: 13px;">${cancelText}</button>
                    <button class="aes-btn-confirm" style="padding: 8px 20px; border-radius: var(--radius-md); font-size: 13px; background: var(--color-danger); color: white;">${confirmText}</button>
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

window.lastFocusedEditable = null;

document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches('.block-content, #text-preview-body, td')) {
        window.lastFocusedEditable = e.target;
    }
});

window.AestheticDialog = AestheticDialog;
