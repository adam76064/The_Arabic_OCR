// js/table-toolbar.js
// ══════════════════════════════════════════════════════════════════════
// TABLE TOOLS TAB + CONTEXT MENU
// ══════════════════════════════════════════════════════════════════════

const TABLE_ICONS = {
    insertTable: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
    textToTable: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M4 6h16M4 12h16M4 18h7M15 15l3 3 3-3M18 15v6"/></svg>`,
    tableToText: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M9 9v6M15 9v6M15 4l-3-3-3 3M12 1v8M15 20l-3 3-3-3M12 23v-8"/></svg>`,
    merge: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18M16 3v18" opacity=".35"/><path d="M4 12h16M9 8l-2 4 2 4M15 8l2 4-2 4"/></svg>`,
    split: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18" /><path d="M9 9l-2-2 2-2M15 9l2-2-2-2M9 15l-2 2 2 2M15 15l2 2-2 2" opacity=".7"/></svg>`,
    borders: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke-width="1.4"/></svg>`,
    valignTop: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M4 4h16"/><rect x="7" y="7" width="4" height="10" rx="1"/><rect x="13" y="7" width="4" height="6" rx="1"/></svg>`,
    valignMiddle: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M4 12h3M17 12h3"/><rect x="7" y="7" width="4" height="10" rx="1"/><rect x="13" y="9" width="4" height="6" rx="1"/></svg>`,
    valignBottom: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M4 20h16"/><rect x="7" y="7" width="4" height="10" rx="1"/><rect x="13" y="11" width="4" height="6" rx="1"/></svg>`,
    insertRowAbove: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="11" width="18" height="10" rx="1"/><path d="M12 8V2M9 5l3-3 3 3"/></svg>`,
    insertRowBelow: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="18" height="10" rx="1"/><path d="M12 16v6M9 19l3 3 3-3"/></svg>`,
    insertColLeft: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="11" y="3" width="10" height="18" rx="1"/><path d="M8 12H2M5 9l-3 3 3 3"/></svg>`,
    insertColRight: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="3" width="10" height="18" rx="1"/><path d="M16 12h6M19 9l3 3-3 3"/></svg>`,
    deleteRow: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M8 12h8"/></svg>`,
    deleteCol: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><rect x="9" y="3" width="6" height="18" rx="1"/><path d="M12 8v8"/></svg>`,
    deleteTable: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`,
    fill: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="display:inline-block;visibility:visible;opacity:1;pointer-events:none;"><path d="M19 11l-8-8-8.5 8.5a2 2 0 0 0 0 2.8l5.7 5.7a2 2 0 0 0 2.8 0L19 11z"/><path d="M5 14h10"/><path d="M17 17c0 1.1.9 3 2 3s2-1.9 2-3c0-1.5-2-3.5-2-3.5S17 15.5 17 17z"/></svg>`,
};

const tableText = (key) => window.AppI18n?.t(key) || key;

const TABLE_TOOLBAR_HTML = `
    <button class="toolbar-icon-btn" id="tb-insert-table" title=tableText('table.insert')>${TABLE_ICONS.insertTable}</button>
    <button class="toolbar-icon-btn" id="tb-text-to-table" title="${tableText('table.textToTable')}">${TABLE_ICONS.textToTable}</button>
    <button class="toolbar-icon-btn" id="tb-table-to-text" title="${tableText('table.tableToText')}">${TABLE_ICONS.tableToText}</button>
    <span class="toolbar-icon-sep"></span>

    <button class="toolbar-icon-btn" id="tb-insert-row-above" title="${tableText('table.rowAbove')}">${TABLE_ICONS.insertRowAbove}</button>
    <button class="toolbar-icon-btn" id="tb-insert-row-below" title="${tableText('table.rowBelow')}">${TABLE_ICONS.insertRowBelow}</button>
    <button class="toolbar-icon-btn" id="tb-insert-col-right" title="${tableText('table.colRight')}">${TABLE_ICONS.insertColRight}</button>
    <button class="toolbar-icon-btn" id="tb-insert-col-left" title="${tableText('table.colLeft')}">${TABLE_ICONS.insertColLeft}</button>
    <span class="toolbar-icon-sep"></span>

    <button class="toolbar-icon-btn" id="tb-merge-cells" title="${tableText('table.merge')}">${TABLE_ICONS.merge}</button>
    <button class="toolbar-icon-btn" id="tb-split-cell" title="${tableText('table.split')}">${TABLE_ICONS.split}</button>
    <span class="toolbar-icon-sep"></span>

    <button class="toolbar-icon-btn" id="tb-borders" title="${tableText('table.borders')}">${TABLE_ICONS.borders}</button>
    <label class="toolbar-icon-color-label" title="${tableText('table.fill')}">
        ${TABLE_ICONS.fill}
        <span class="toolbar-icon-color-bar" id="tb-fill-color-bar" style="background:#fde68a;"></span>
        <input type="color" id="tb-fill-color" value="#fde68a">
    </label>
    <span class="toolbar-icon-sep"></span>

    <button class="toolbar-icon-btn" id="tb-valign-top" title="${tableText('table.top')}">${TABLE_ICONS.valignTop}</button>
    <button class="toolbar-icon-btn" id="tb-valign-middle" title="${tableText('table.middle')}">${TABLE_ICONS.valignMiddle}</button>
    <button class="toolbar-icon-btn" id="tb-valign-bottom" title="${tableText('table.bottom')}">${TABLE_ICONS.valignBottom}</button>
    <span class="toolbar-icon-sep"></span>

    <button class="toolbar-icon-btn" id="tb-delete-row" title="${tableText('table.deleteRow')}" style="color: #ef4444;">${TABLE_ICONS.deleteRow}</button>
    <button class="toolbar-icon-btn" id="tb-delete-col" title="${tableText('table.deleteCol')}" style="color: #ef4444;">${TABLE_ICONS.deleteCol}</button>
    <button class="toolbar-icon-btn" id="tb-delete-table" title="${tableText('table.delete')}" style="color: #ef4444;">${TABLE_ICONS.deleteTable}</button>
`;

// ── Helpers shared between the toolbar buttons and the context menu ─────
function currentTableTarget() {
    let cells = window.TableSelection.getSelectedCells();
    
    // إذا لم يكن هناك تحديد بسحب الماوس، ابحث عن مؤشر الكتابة الحالي
    if (!cells.length) {
        const node = window.getSelection().anchorNode;
        const cell = node ? (node.nodeType === 3 ? node.parentNode.closest('td, th') : node.closest('td, th')) : null;
        if (cell) cells = [cell];
    }
    
    if (cells.length) return { table: cells[0].closest('table'), cells };
    return { table: null, cells: [] };
}

function persist() {
    if (window.persistBrushEdit && window.lastFocusedEditable) window.persistBrushEdit(window.lastFocusedEditable);
}

function applyBorders(cells, { width, style, color }) {
    cells.forEach(td => { td.style.border = `${width}px ${style} ${color}`; });
    persist();
}

function applyFill(cells, color) {
    cells.forEach(td => { td.style.backgroundColor = color; });
    persist();
}

function applyValign(cells, align) {
    cells.forEach(td => { td.style.verticalAlign = align; });
    persist();
}

function insertRowMatching(cell, position) {
    const table = cell.closest('table');
    if (!table) return;
    window.TableModel.insertRow(table, cell, position);
    persist();
}

function insertColMatching(cell, position) {
    const table = cell.closest('table');
    if (!table) return;
    window.TableModel.insertCol(table, cell, position);
    persist();
}

function doMerge(cells) {
    if (!cells || cells.length < 2) return;
    const table = cells[0].closest('table');
    const merged = window.TableModel.mergeCells(table, cells);
    window.TableSelection.clear();
    if (merged) { merged.classList.add('tcell-selected'); window.TableSelection.selected = [merged]; }
    persist();
}

function doSplit(cell) {
    if (!cell) return;
    const table = cell.closest('table');
    window.AestheticDialog.show(
        "${tableText('table.split')}",
        `<div class="aes-group"><label>${tableText('table.splitCols')}</label><input type="number" id="split-c" value="2" min="1"></div>
         <div class="aes-group"><label>${tableText('table.splitRows')}</label><input type="number" id="split-r" value="1" min="1"></div>`,
        (modal) => {
            const sc = parseInt(modal.querySelector('#split-c').value) || 1;
            const sr = parseInt(modal.querySelector('#split-r').value) || 1;
            if (sc === 1 && sr === 1) return;
            window.TableModel.splitCell(table, cell, sr, sc);
            
            // الحفاظ على الخلية الأصلية (أو بدايتها) محددة بعد التقسيم
            window.TableSelection.clearHighlight();
            cell.classList.add('tcell-selected');
            window.TableSelection.selected = [cell];
            window.TableSelection.anchorCell = cell;
            window.TableSelection.table = table;
            persist();
        }
    );
}
function doDeleteRow(cell) { 
    const table = cell.closest('table'); 
    const model = window.TableModel.toModel(table);
    const ref = model.cells.find(c => c.dom === cell);
    let fallbackDom = null;
    
    // البحث عن صف بديل لتحديده (الصف الذي يسبقه، وإن لم يوجد فالذي يليه)
    if (ref) {
        let targetR = ref.r - 1;
        if (targetR < 0) targetR = ref.r + ref.rowSpan; 
        const fallbackCellModel = model.cells.find(c => c.r === targetR && c.c === ref.c);
        if (fallbackCellModel) fallbackDom = fallbackCellModel.dom;
    }

    window.TableModel.deleteRow(table, cell); 
    
    // تطبيق التحديد البديل
    if (!table.parentNode) {
        window.TableSelection.clear();
    } else if (fallbackDom) {
        window.TableSelection.clearHighlight();
        fallbackDom.classList.add('tcell-selected');
        window.TableSelection.selected = [fallbackDom];
        window.TableSelection.anchorCell = fallbackDom;
        window.TableSelection.table = table;
    }
    persist(); 
}

function doDeleteCol(cell) { 
    const table = cell.closest('table'); 
    const model = window.TableModel.toModel(table);
    const ref = model.cells.find(c => c.dom === cell);
    let fallbackDom = null;
    
    // البحث عن عمود بديل لتحديده
    if (ref) {
        let targetC = ref.c - 1;
        if (targetC < 0) targetC = ref.c + ref.colSpan;
        const fallbackCellModel = model.cells.find(c => c.c === targetC && c.r === ref.r);
        if (fallbackCellModel) fallbackDom = fallbackCellModel.dom;
    }

    window.TableModel.deleteCol(table, cell); 
    
    // تطبيق التحديد البديل
    if (!table.parentNode) {
        window.TableSelection.clear();
    } else if (fallbackDom) {
        window.TableSelection.clearHighlight();
        fallbackDom.classList.add('tcell-selected');
        window.TableSelection.selected = [fallbackDom];
        window.TableSelection.anchorCell = fallbackDom;
        window.TableSelection.table = table;
    }
    persist(); 
}

function doDeleteTable(cell) { 
    cell.closest('table').remove(); 
    window.TableSelection.clear(); 
    persist(); 
}

function bordersDialog(cells) {
    window.AestheticDialog.show(
        "${tableText('table.borders')}",
        `<div class="aes-group"><label>${tableText('table.borderWidth')}</label><input type="number" id="border-width" value="1" min="0" max="10"></div>
         <div class="aes-group"><label>${tableText('table.borderStyle')}</label>
            <select id="border-style">
                <option value="solid">${tableText('table.solid')}</option>
                <option value="dashed">${tableText('table.dashed')}</option>
                <option value="dotted">${tableText('table.dotted')}</option>
                <option value="double">${tableText('table.double')}</option>
                <option value="none">${tableText('table.none')}</option>
            </select>
         </div>
         <div class="aes-group"><label>${tableText('table.borderColor')}</label><input type="color" id="border-color" value="#cbd5e1"></div>`,
        (modal) => {
            const width = parseInt(modal.querySelector('#border-width').value) || 0;
            const style = modal.querySelector('#border-style').value;
            const color = modal.querySelector('#border-color').value;
            applyBorders(cells, { width, style, color });
        }
    );
}

// ══════════════════════════════════════════════════════════════════════
// CONTEXT MENU
// ══════════════════════════════════════════════════════════════════════
const TableContextMenu = {
    menuEl: null,
    activeCell: null,

    init() {
        this.menuEl = document.createElement('div');
        this.menuEl.className = 'table-ctx-menu hidden';
        document.body.appendChild(this.menuEl);

        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            const td = e.target.closest('td, th');
            if (td && td.closest('.block-content, #text-preview-body')) {
                e.preventDefault();
                this.activeCell = td;
                // Right-clicking outside the current multi-selection starts a fresh single-cell selection.
                if (!window.TableSelection.selected.includes(td)) {
                    window.TableSelection.clear();
                    td.classList.add('tcell-selected');
                    window.TableSelection.selected = [td];
                    window.TableSelection.table = td.closest('table');
                }
                this.render();
                this.show(e.clientX, e.clientY);
            } else {
                this.hide();
            }
        });
    },

    render() {
        const cells = window.TableSelection.getSelectedCells(this.activeCell);
        const multi = cells.length > 1;
        const cell = this.activeCell;
        const iconSm = (svg) => svg.replace('width="18"', 'width="16"').replace('height="18"', 'height="16"');

        const item = (action, icon, label, opts = {}) =>
            `<div class="ctx-item ${opts.danger ? 'danger' : ''} ${opts.disabled ? 'disabled' : ''}" data-action="${action}">${icon} <span>${label}</span></div>`;

        this.menuEl.innerHTML = [
            item('insertRowAbove', TABLE_ICONS.insertRowAbove, tableText('table.rowAbove')),
            item('insertRowBelow', TABLE_ICONS.insertRowBelow, tableText('table.rowBelow')),
            item('insertColRight', TABLE_ICONS.insertColRight, tableText('table.colRight')),
            item('insertColLeft', TABLE_ICONS.insertColLeft, tableText('table.colLeft')),
            '<hr>',
            item('mergeCells', TABLE_ICONS.merge, tableText('table.merge'), { disabled: !multi }),
            item('splitCell', TABLE_ICONS.split, tableText('table.split'), { disabled: multi }),
            '<hr>',
            item('borders', TABLE_ICONS.borders, 'حدود...'),
            item('fill', iconSm(TABLE_ICONS.fill), tableText('table.fillTitle') + '...'),
            item('valignTop', iconSm(TABLE_ICONS.valignTop), tableText('table.top')),
            item('valignMiddle', iconSm(TABLE_ICONS.valignMiddle), tableText('table.middle')),
            item('valignBottom', iconSm(TABLE_ICONS.valignBottom), tableText('table.bottom')),
            '<hr>',
            item('deleteRow', TABLE_ICONS.deleteRow, tableText('table.deleteRow'), { danger: true }),
            item('deleteCol', TABLE_ICONS.deleteCol, tableText('table.deleteCol'), { danger: true }),
            item('deleteTable', TABLE_ICONS.deleteTable, tableText('table.delete'), { danger: true }),
        ].join('');

        this.menuEl.querySelectorAll('.ctx-item').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.action;
                this.execute(action, cells);
                this.hide();
            });
        });
    },

    execute(action, cells) {
        const cell = this.activeCell;
        switch (action) {
            case 'insertRowAbove': insertRowMatching(cell, 'above'); break;
            case 'insertRowBelow': insertRowMatching(cell, 'below'); break;
            case 'insertColRight': insertColMatching(cell, 'right'); break;
            case 'insertColLeft': insertColMatching(cell, 'left'); break;
            case 'mergeCells': doMerge(cells); break;
            case 'splitCell': doSplit(cell); break;
            case 'borders': bordersDialog(cells); break;
            case 'fill':
                window.AestheticDialog.show(tableText('table.fillTitle'),
                    `<div class="aes-group"><label>${tableText('table.chooseBackground')}</label><input type="color" id="fill-color" value="#fde68a"></div>`,
                    (modal) => applyFill(cells, modal.querySelector('#fill-color').value));
                break;
            case 'valignTop': applyValign(cells, 'top'); break;
            case 'valignMiddle': applyValign(cells, 'middle'); break;
            case 'valignBottom': applyValign(cells, 'bottom'); break;
            case 'deleteRow': doDeleteRow(cell); break;
            case 'deleteCol': doDeleteCol(cell); break;
            case 'deleteTable': doDeleteTable(cell); break;
        }
    },

    show(x, y) {
        this.menuEl.classList.remove('hidden');
        const rect = this.menuEl.getBoundingClientRect();
        let finalX = x, finalY = y;
        if (x + rect.width > window.innerWidth) finalX = window.innerWidth - rect.width - 10;
        if (y + rect.height > window.innerHeight) finalY = y - rect.height;
        if (finalY < 0) finalY = 10;
        this.menuEl.style.left = finalX + 'px';
        this.menuEl.style.top = finalY + 'px';
    },

    hide() {
        this.menuEl.classList.add('hidden');
    }
};

// ══════════════════════════════════════════════════════════════════════
// TABLE TOOLS TAB WIRING
// ══════════════════════════════════════════════════════════════════════
const TableToolbar = {
    init(container) {
        TableContextMenu.init();

        container.querySelector('#tb-insert-table')?.addEventListener('click', () => {
            const target = window.lastFocusedEditable;
            if (!target) { alert(tableText('table.clickText')); return; }
            window.AestheticDialog.show(
                tableText('table.insert'),
                `<div class="aes-group"><label>${tableText('table.columnCount')}</label><input type="number" id="tbl-cols" value="3" min="1"></div>
                 <div class="aes-group"><label>${tableText('table.rowCount')}</label><input type="number" id="tbl-rows" value="3" min="1"></div>`,
                (modal) => {
                    target.focus();
                    const cols = parseInt(modal.querySelector('#tbl-cols').value) || 3;
                    const rows = parseInt(modal.querySelector('#tbl-rows').value) || 3;
                    const t = document.createElement('table');
                    let tbody = '<tbody>';
                    for (let r = 0; r < rows; r++) {
                        tbody += '<tr>';
                        for (let c = 0; c < cols; c++) tbody += '<td><br></td>';
                        tbody += '</tr>';
                    }
                    tbody += '</tbody>';
                    t.innerHTML = tbody;

                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(t);
                    }
                    persist();
                }
            );
        });

        container.querySelector('#tb-text-to-table')?.addEventListener('click', () => {
            const target = window.lastFocusedEditable;
            if (!target) return;
            const selection = window.getSelection();
            const text = selection.toString();
            if (!text.trim()) { alert(tableText('table.selectText')); return; }

            window.AestheticDialog.show(
                tableText('table.textToTable'),
                `<div class="aes-group">
                    <label>${tableText('table.separatorHint')}</label>
                    <input type="text" id="tbl-sep" value="-">
                </div>`,
                (modal) => {
                    target.focus();
                    const sep = modal.querySelector('#tbl-sep').value || '-';
                    const lines = text.split('\n');
                    const newT = document.createElement('table');
                    let newTbody = '<tbody>';
                    lines.forEach(line => {
                        if (!line.trim()) return;
                        newTbody += '<tr>';
                        line.split(sep).forEach(chunk => { newTbody += `<td>${chunk.trim() || '<br>'}</td>`; });
                        newTbody += '</tr>';
                    });
                    newTbody += '</tbody>';
                    newT.innerHTML = newTbody;

                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(newT);
                    }
                    persist();
                }
            );
        });

        container.querySelector('#tb-table-to-text')?.addEventListener('click', () => {
            const target = window.lastFocusedEditable;
            if (!target) return;
            const node = window.getSelection().anchorNode;
            const td = node ? (node.nodeType === 3 ? node.parentNode.closest('td, th') : node.closest('td, th')) : null;
            const table = td ? td.closest('table') : (window.TableSelection.table);

            if (table) {
                window.AestheticDialog.show(
                    "${tableText('table.tableToText')}",
                    `<div class="aes-group">
                        <label>${tableText('table.separatorHint')}</label>
                        <input type="text" id="tbl-sep-to-text" value=" - ">
                    </div>`,
                    (modal) => {
                        target.focus();
                        const sep = modal.querySelector('#tbl-sep-to-text').value || ' ';
                        const textRows = Array.from(table.rows).map(r => Array.from(r.cells).map(c => c.innerText.trim()).join(sep));
                        const textNode = document.createTextNode(textRows.join('\n'));
                        table.parentNode.replaceChild(textNode, table);
                        window.TableSelection.clear();
                        persist();
                    }
                );
            } else {
                alert(tableText('table.clickTable'));
            }
        });

        container.querySelector('#tb-merge-cells')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (cells.length < 2) { alert(tableText('table.selectMultiple')); return; }
            doMerge(cells);
        });

        container.querySelector('#tb-split-cell')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            const cell = cells[0] || window.getSelection().anchorNode?.parentNode?.closest('td, th');
            if (!cell) { alert(tableText('table.clickCell')); return; }
            doSplit(cell);
        });

        container.querySelector('#tb-borders')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.selectCells')); return; }
            bordersDialog(cells);
        });

        const fillInput = container.querySelector('#tb-fill-color');
        fillInput?.addEventListener('input', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) return;
            container.querySelector('#tb-fill-color-bar').style.background = fillInput.value;
            applyFill(cells, fillInput.value);
        });

        ['top', 'middle', 'bottom'].forEach(pos => {
            container.querySelector(`#tb-valign-${pos}`)?.addEventListener('click', () => {
                const { cells } = currentTableTarget();
                if (!cells.length) { alert(tableText('table.selectCells')); return; }
                applyValign(cells, pos);
            });
        });

        // ── Rows & Cols Insertion Buttons ──
        // ── Rows & Cols Insertion Buttons ──
        container.querySelector('#tb-insert-row-above')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickOrSelectCell')); return; }
            insertRowMatching(cells[0], 'above');
        });
        container.querySelector('#tb-insert-row-below')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickOrSelectCell')); return; }
            insertRowMatching(cells[0], 'below');
        });
        container.querySelector('#tb-insert-col-right')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickOrSelectCell')); return; }
            insertColMatching(cells[0], 'right');
        });
        container.querySelector('#tb-insert-col-left')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickOrSelectCell')); return; }
            insertColMatching(cells[0], 'left');
        });

        // ── Deletion Buttons ──
        container.querySelector('#tb-delete-row')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickRowCell')); return; }
            doDeleteRow(cells[0]);
        });
        container.querySelector('#tb-delete-col')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickColCell')); return; }
            doDeleteCol(cells[0]);
        });
        container.querySelector('#tb-delete-table')?.addEventListener('click', () => {
            const { cells } = currentTableTarget();
            if (!cells.length) { alert(tableText('table.clickDeleteTable')); return; }
            doDeleteTable(cells[0]);
        });

    }
};

window.TableToolbar = TableToolbar;
window.TableContextMenu = TableContextMenu;
window.TABLE_TOOLBAR_HTML = TABLE_TOOLBAR_HTML;
window.applyFill = applyFill;
window.applyBorders = applyBorders;
window.applyValign = applyValign;
