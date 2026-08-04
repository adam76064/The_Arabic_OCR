let resizeStartTs = null; // Saves table grid state before resizing
let isMarqueeSelecting = false; 
let marqueeStartX = 0, marqueeStartY = 0;

// js/layout-editor.js

// ─── STATE MANAGEMENT ───
let currentProject = null;
let currentPageIndex = 0;
let ocrData = [];
let scaleRatioX = 1, scaleRatioY = 1;

// Undo/Redo History
let historyStack = { undo: [], redo: [] };
const HISTORY_LIMIT = 50;

// Tool & Interaction State
let currentTool = 'select'; // 'select' | 'move' | 'draw' | 'order'
let selectedBoxes = new Set();
let nextOrderSequence = 1;

let isDrawing = false;
let isResizing = false;
let isMoving = false;
let resizeHandle = null; 
let resizeStartBbox = null;
let moveStartBboxes = [];
let drawStartX = 0, drawStartY = 0;
let currentMouseX = 0, currentMouseY = 0;
let activeBoxIdx = -1;

// Table Editor State
let selectedTableCells = { blockIdx: null, cellIndices: [] }; 
let isDraggingTableLine = false; 

const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b'
};

// توليد الألوان والتصنيفات ديناميكياً بدمج الأساسية مع المخصصة
function getCategoryColors() {
    return { ...BASE_CATEGORIES, ...(window.__appSettings?.customCategories || {}) };
}

// Visual Mask for Arabic UI
const CATEGORY_ARABIC_MAP = {
    'Text': 'نص عادي',
    'Table': 'جدول',
    'Title': 'عنوان رئيسي',
    'Section-header': 'عنوان فرعي',
    'Picture': 'صورة / رسم',
    'Caption': 'تسمية توضيحية',
    'List-item': 'عنصر قائمة',
    'Footnote': 'حاشية سفلية',
    'Page-header': 'رأس الصفحة',
    'Page-footer': 'تذييل الصفحة',
    'Formula': 'معادلة رياضية'
};

// Helper function that translates standard categories, but leaves custom Arabic categories (like شعر عمودي) as they are.
function getCategoryNameAR(catName) {
    return CATEGORY_ARABIC_MAP[catName] || catName;
}

function getAllCategories() {
    return Object.keys(getCategoryColors());
}

// دالة مساعدة سحرية لمعاملة الشعر العمودي كجدول
function isTableLike(category) {
    return category === 'Table' || category === 'شعر عمودي';
}

// ─── HISTORY ENGINE ───
function saveHistoryState() {
    historyStack.undo.push(JSON.stringify(ocrData));
    if (historyStack.undo.length > HISTORY_LIMIT) historyStack.undo.shift();
    historyStack.redo = [];
    updateHistoryButtons();
}

function doUndo() {
    if (historyStack.undo.length === 0) return;
    historyStack.redo.push(JSON.stringify(ocrData));
    ocrData = JSON.parse(historyStack.undo.pop());
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] }; // <-- Fixed here
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
}

function doRedo() {
    if (historyStack.redo.length === 0) return;
    historyStack.undo.push(JSON.stringify(ocrData));
    ocrData = JSON.parse(historyStack.redo.pop());
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] }; // <-- Fixed here
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if(btnUndo) btnUndo.disabled = historyStack.undo.length === 0;
    if(btnRedo) btnRedo.disabled = historyStack.redo.length === 0;
}

async function autoSaveLayoutData() {
    if (window.__appSettings?.autoSaveLayout === true && currentProject) {
        
        // 1. UPDATE IN-MEMORY MASTER OBJECT SO IT DOESN'T GET STALE
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        
        const btn = document.getElementById('btn-save');
        if (!btn) return;
        
        const originalText = '💾 حفظ التخطيط';
        btn.textContent = '⏳ جاري الحفظ...';
        
        try { 
            if (window.pywebview?.api?.repopulate_page_text_from_raw) {
                const res = await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, ocrData);
                if (res && res.ok && res.ocr_data) {
                    ocrData = res.ocr_data;
                    currentProject.pages[currentPageIndex].ocr_data = res.ocr_data;
                }
            } else {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            }
            btn.textContent = '✔ تم الحفظ';
        } catch (e) { 
            console.error('Layout auto-save failed:', e); 
            btn.textContent = '❌ خطأ';
        }
        
        setTimeout(() => { 
            if (btn.textContent === '✔ تم الحفظ' || btn.textContent === '❌ خطأ') {
                btn.textContent = originalText; 
            }
        }, 1000);
    }
}

// ─── INITIALIZATION ───
async function initLayoutEditor() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const pageParam = params.get('page');

    if (!projectId || pageParam === null) { window.location.href = 'projects.html'; return; }
    currentPageIndex = parseInt(pageParam);

    window.__appDataPath = await window.pywebview.api.get_app_data_path();
    window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');

    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject || !currentProject.pages[currentPageIndex]) return;

    const page = currentProject.pages[currentPageIndex];
    document.getElementById('page-num-display').textContent = currentPageIndex + (currentProject.metadata?.logical_start || 1);
    
    ocrData = JSON.parse(JSON.stringify(page.ocr_data || []));

    injectPropertiesPanel();
    setupToolbar();
    loadImageAndCanvas(page);
    setupKeyboardShortcuts();
}

// ─── TABLE EDITOR ENGINE ───
window.TableEditor = {
    activeHandle: null,
    contextMenu: null,

    checkHitCell: function(x, y, tableBlock, scaleRatioX, scaleRatioY) {
        if (!tableBlock.table_structure || !tableBlock.table_structure.cells) return -1;
        const cells = tableBlock.table_structure.cells;
        for (let i = 0; i < cells.length; i++) {
            const [cx1, cy1, cx2, cy2] = cells[i].bbox;
            if (x >= cx1 * scaleRatioX && x <= cx2 * scaleRatioX &&
                y >= cy1 * scaleRatioY && y <= cy2 * scaleRatioY) {
                return i;
            }
        }
        return -1;
    },

    checkHitInternalLines: function(x, y, tableBlock, scaleRatioX, scaleRatioY, scale) {
        if (!tableBlock.table_structure || !tableBlock.table_structure.cols_x) return null;
        const ts = tableBlock.table_structure;
        const hs = 6 / scale; 
        
        // Helper: Check if a grid line segment passes through the interior of a merged cell at (x, y)
        const isInteriorToCell = (axis, lineIdx, testX, testY) => {
            if (!ts.cells) return false;
            for (let cell of ts.cells) {
                const cx1 = ts.cols_x[cell.col] * scaleRatioX;
                const cx2 = ts.cols_x[cell.col + (cell.col_span || 1)] * scaleRatioX;
                const cy1 = ts.rows_y[cell.row] * scaleRatioY;
                const cy2 = ts.rows_y[cell.row + (cell.row_span || 1)] * scaleRatioY;

                if (axis === 'x') {
                    const lx = ts.cols_x[lineIdx] * scaleRatioX;
                    // Is lx strictly inside this cell's horizontal span and testY within its vertical range?
                    if (lx > cx1 + 1 && lx < cx2 - 1 && testY >= cy1 && testY <= cy2) {
                        return true;
                    }
                } else if (axis === 'y') {
                    const ly = ts.rows_y[lineIdx] * scaleRatioY;
                    // Is ly strictly inside this cell's vertical span and testX within its horizontal range?
                    if (ly > cy1 + 1 && ly < cy2 - 1 && testX >= cx1 && testX <= cx2) {
                        return true;
                    }
                }
            }
            return false;
        };

        // Check vertical grid lines
        for (let i = 1; i < ts.cols_x.length - 1; i++) {
            let lx = ts.cols_x[i] * scaleRatioX;
            if (Math.abs(x - lx) <= hs) {
                let minY = ts.rows_y[0] * scaleRatioY, maxY = ts.rows_y[ts.rows_y.length - 1] * scaleRatioY;
                if (y >= minY && y <= maxY) {
                    if (!isInteriorToCell('x', i, x, y)) {
                        return { axis: 'x', index: i };
                    }
                }
            }
        }

        // Check horizontal grid lines
        for (let i = 1; i < ts.rows_y.length - 1; i++) {
            let ly = ts.rows_y[i] * scaleRatioY;
            if (Math.abs(y - ly) <= hs) {
                let minX = ts.cols_x[0] * scaleRatioX, maxX = ts.cols_x[ts.cols_x.length - 1] * scaleRatioX;
                if (x >= minX && x <= maxX) {
                    if (!isInteriorToCell('y', i, x, y)) {
                        return { axis: 'y', index: i };
                    }
                }
            }
        }
        return null;
    },

    updateCursor: function(canvas, hit) {
        if (!hit) return false;
        canvas.style.cursor = hit.axis === 'x' ? 'col-resize' : 'row-resize';
        return true;
    },

    handleDragLine: function(currentX, currentY, tableBlock, scaleRatioX, scaleRatioY) {
        if (!this.activeHandle || !tableBlock.table_structure) return;
        const ts = tableBlock.table_structure;
        const { axis, index } = this.activeHandle;

        if (axis === 'x') {
            let newX = currentX / scaleRatioX;
            let minBound = ts.cols_x[index - 1] + 2, maxBound = ts.cols_x[index + 1] - 2;
            ts.cols_x[index] = Math.max(minBound, Math.min(newX, maxBound));
        } else {
            let newY = currentY / scaleRatioY;
            let minBound = ts.rows_y[index - 1] + 2, maxBound = ts.rows_y[index + 1] - 2;
            ts.rows_y[index] = Math.max(minBound, Math.min(newY, maxBound));
        }
        this.syncCellsToGrid(ts);
    },

    syncCellsToGrid: function(ts) {
        ts.cells.forEach(cell => {
            cell.bbox = [
                ts.cols_x[cell.col], 
                ts.rows_y[cell.row], 
                ts.cols_x[cell.col + cell.col_span], 
                ts.rows_y[cell.row + cell.row_span]
            ];
        });
    },

    mergeCells: function(tableBlock, cellIndices) {
        saveHistoryState();
        const ts = tableBlock.table_structure;
        let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;
        let mergedTexts = [];

        cellIndices.forEach(idx => {
            const c = ts.cells[idx];
            minRow = Math.min(minRow, c.row); minCol = Math.min(minCol, c.col);
            maxRow = Math.max(maxRow, c.row + (c.row_span || 1) - 1); 
            maxCol = Math.max(maxCol, c.col + (c.col_span || 1) - 1);
            if (c.text && c.text.trim()) mergedTexts.push(c.text.trim());
        });

        const mergedCell = {
            row: minRow, 
            col: minCol,
            row_span: maxRow - minRow + 1, 
            col_span: maxCol - minCol + 1,
            bbox: [ts.cols_x[minCol], ts.rows_y[minRow], ts.cols_x[maxCol + 1], ts.rows_y[maxRow + 1]],
            text: mergedTexts.join(' <br> ')
        };

        ts.cells = ts.cells.filter((_, idx) => !cellIndices.includes(idx));
        ts.cells.push(mergedCell);
        autoSaveLayoutData();
    },

    splitCell: function(tableBlock, cellIdx) {
        saveHistoryState();
        const ts = tableBlock.table_structure;
        const target = ts.cells[cellIdx];
        if (target.row_span === 1 && target.col_span === 1) return;

        ts.cells.splice(cellIdx, 1);

        for(let r = target.row; r < target.row + target.row_span; r++) {
            for(let c = target.col; c < target.col + target.col_span; c++) {
                ts.cells.push({
                    row: r, col: c, row_span: 1, col_span: 1,
                    bbox: [ts.cols_x[c], ts.rows_y[r], ts.cols_x[c+1], ts.rows_y[r+1]], text: ""
                });
            }
        }
        autoSaveLayoutData(); // <-- Add this
    },

    addRowCol: function(tableBlock, type, cell) {
        saveHistoryState();
        const ts = tableBlock.table_structure;
        
        if (type === 'row_above' || type === 'row_below') {
            const rIdx = type === 'row_above' ? cell.row : cell.row + cell.row_span;
            const newY = rIdx === 0 ? ts.rows_y[0] - 20 : (ts.rows_y[rIdx] + ts.rows_y[rIdx-1])/2;
            ts.rows_y.splice(rIdx, 0, newY);
            ts.rows++;
            
            const newCells = [];
            ts.cells.forEach(c => {
                if (c.row >= rIdx) c.row++;
                else if (c.row + c.row_span > rIdx) c.row_span++;
                newCells.push(c);
                if (c.row === rIdx && c.row_span === 1) {
                    newCells.push({ row: rIdx, col: c.col, row_span: 1, col_span: c.col_span, bbox: [], text: "" });
                }
            });
            ts.cells = newCells;
        } else {
            const cIdx = type === 'col_left' ? cell.col : cell.col + cell.col_span;
            const newX = cIdx === 0 ? ts.cols_x[0] - 20 : (ts.cols_x[cIdx] + ts.cols_x[cIdx-1])/2;
            ts.cols_x.splice(cIdx, 0, newX);
            ts.cols++;
            
            const newCells = [];
            ts.cells.forEach(c => {
                if (c.col >= cIdx) c.col++;
                else if (c.col + c.col_span > cIdx) c.col_span++;
                newCells.push(c);
                if (c.col === cIdx && c.col_span === 1) {
                    newCells.push({ row: c.row, col: cIdx, row_span: c.row_span, col_span: 1, bbox: [], text: "" });
                }
            });
            ts.cells = newCells;
        }
        this.syncCellsToGrid(ts);
        autoSaveLayoutData(); // <-- Add this
    },

    removeRowCol: function(tableBlock, type, cell) {
        saveHistoryState();
        const ts = tableBlock.table_structure;
        if (type === 'row') {
            if (ts.rows <= 1) return;
            ts.rows_y.splice(cell.row + 1, 1);
            ts.rows--;
            ts.cells = ts.cells.filter(c => c.row !== cell.row);
            ts.cells.forEach(c => {
                if (c.row > cell.row) c.row--;
                else if (c.row + c.row_span > cell.row) c.row_span--;
            });
        } else {
            if (ts.cols <= 1) return;
            ts.cols_x.splice(cell.col + 1, 1);
            ts.cols--;
            ts.cells = ts.cells.filter(c => c.col !== cell.col);
            ts.cells.forEach(c => {
                if (c.col > cell.col) c.col--;
                else if (c.col + c.col_span > cell.col) c.col_span--;
            });
        }
        this.syncCellsToGrid(ts);
        autoSaveLayoutData(); // <-- Add this
    },

    showContextMenu: function(e, tableBlock, hitCellIdx, drawCallback) {
        e.preventDefault();
        this.hideContextMenu();

        const ts = tableBlock.table_structure;
        const cell = ts.cells[hitCellIdx];
        if (!cell) return;

        const menu = document.createElement('div');
        menu.id = 'canvas-context-menu';
        menu.style.cssText = `
            position: fixed; top: ${e.clientY}px; left: ${e.clientX}px;
            background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
            z-index: 10000; font-family: system-ui, sans-serif; font-size: 13px; color: #374151;
            min-width: 200px; overflow: hidden; direction: rtl; display: flex; flex-direction: column;
            padding: 6px 0;
        `;

        const createItem = (text, icon, onClick, danger=false) => {
            const div = document.createElement('div');
            div.innerHTML = `<span style="margin-left: 10px; font-size: 15px;">${icon}</span> <span>${text}</span>`;
            div.style.cssText = `padding: 8px 16px; cursor: pointer; display: flex; align-items: center; transition: background 0.15s; ${danger ? 'color: #dc2626;' : 'color: #1f2937;'}`;
            div.onmouseover = () => div.style.background = danger ? '#fef2f2' : '#f3f4f6';
            div.onmouseout = () => div.style.background = 'transparent';
            div.onclick = () => { onClick(); this.hideContextMenu(); drawCallback(); };
            return div;
        };

        const divider = () => {
            const div = document.createElement('div');
            div.style.cssText = 'height: 1px; background: #e5e7eb; margin: 4px 0;';
            return div;
        };

        if (selectedTableCells.cellIndices && selectedTableCells.cellIndices.length > 1) {
            menu.appendChild(createItem('دمج الخلايا المحددة', '🔗', () => {
                this.mergeCells(tableBlock, selectedTableCells.cellIndices);
                selectedTableCells = { blockIdx: null, cellIndices: [] }; 
            }));
            menu.appendChild(divider());
        }

        menu.appendChild(createItem('إضافة صف للأعلى', '⬆️', () => this.addRowCol(tableBlock, 'row_above', cell)));
        menu.appendChild(createItem('إضافة صف للأسفل', '⬇️', () => this.addRowCol(tableBlock, 'row_below', cell)));
        menu.appendChild(createItem('إضافة عمود لليمين', '➡️', () => this.addRowCol(tableBlock, 'col_right', cell)));
        menu.appendChild(createItem('إضافة عمود لليسار', '⬅️', () => this.addRowCol(tableBlock, 'col_left', cell)));
        menu.appendChild(divider());
        menu.appendChild(createItem('حذف الصف الحالي', '🗑️', () => this.removeRowCol(tableBlock, 'row', cell), true));
        menu.appendChild(createItem('حذف العمود الحالي', '🗑️', () => this.removeRowCol(tableBlock, 'col', cell), true));

        menu.appendChild(createItem('تقسيم الخلية (عمودياً من المنتصف)', '↔️', () => this.bisectCell(tableBlock, hitCellIdx, 'v')));
        menu.appendChild(createItem('تقسيم الخلية (أفقياً من المنتصف)', '↕️', () => this.bisectCell(tableBlock, hitCellIdx, 'h')));
        menu.appendChild(divider());

        document.body.appendChild(menu);
        this.contextMenu = menu;
    },

    hideContextMenu: function() {
        if (this.contextMenu) { this.contextMenu.remove(); this.contextMenu = null; }
    },

    bisectCell: function(tableBlock, cellIdx, axis) {
        saveHistoryState();
        const ts = tableBlock.table_structure;
        const target = ts.cells[cellIdx];
        
        if (axis === 'v') {
            // Add vertical line in the center of the cell
            const midX = (ts.cols_x[target.col] + ts.cols_x[target.col + target.col_span]) / 2;
            ts.cols_x.splice(target.col + 1, 0, midX);
            ts.cols++;
            
            const newCells = [];
            let newCell = null;
            ts.cells.forEach((c, idx) => {
                if (c.col > target.col) {
                    c.col++;
                } else if (c.col <= target.col && c.col + c.col_span > target.col) {
                    if (idx === cellIdx) {
                        // Split the target cell
                        newCell = {
                            row: c.row, col: c.col + 1,
                            row_span: c.row_span, col_span: c.col_span,
                            bbox: [], text: ""
                        };
                    } else {
                        // Increase span for cells spanning across the new line
                        c.col_span++;
                    }
                }
                newCells.push(c);
            });
            if (newCell) newCells.push(newCell);
            ts.cells = newCells;
        } else {
            // Add horizontal line in the center of the cell
            const midY = (ts.rows_y[target.row] + ts.rows_y[target.row + target.row_span]) / 2;
            ts.rows_y.splice(target.row + 1, 0, midY);
            ts.rows++;
            
            const newCells = [];
            let newCell = null;
            ts.cells.forEach((c, idx) => {
                if (c.row > target.row) {
                    c.row++;
                } else if (c.row <= target.row && c.row + c.row_span > target.row) {
                    if (idx === cellIdx) {
                        newCell = {
                            row: c.row + 1, col: c.col,
                            row_span: c.row_span, col_span: c.col_span,
                            bbox: [], text: ""
                        };
                    } else {
                        c.row_span++;
                    }
                }
                newCells.push(c);
            });
            if (newCell) newCells.push(newCell);
            ts.cells = newCells;
        }
        this.syncCellsToGrid(ts);
        autoSaveLayoutData();
    },

};

document.addEventListener('click', (e) => {
    if (!e.target.closest('#canvas-context-menu')) window.TableEditor?.hideContextMenu?.();
});

// ─── UI & EVENT BINDINGS ───
function injectPropertiesPanel() {
    const oldPanel = document.getElementById('block-props-panel');
    if (oldPanel) oldPanel.remove();

    const panelHTML = `
        <div id="block-props-panel" style="position: fixed; top: 90px; left: 30px; background: white; padding: 16px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; width: 220px; display: none; z-index: 1000; direction: rtl;">
            <!-- تم إضافة المعرف prop-panel-header وتنسيقات السحب هنا -->
            <div id="prop-panel-header" style="font-size: 14px; font-weight: bold; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; color: #1e293b; cursor: grab; user-select: none; display: flex; align-items: center;">
                <span style="color:#94a3b8; margin-left:8px; cursor: inherit; font-size: 16px;">⋮⋮</span> خصائص الكتلة
            </div>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #64748b;">النوع (Label):</label>
            <select id="prop-category" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 16px; font-size: 13px; outline: none; cursor: pointer;">
                ${getAllCategories().map(c => `<option value="${c}">${getCategoryNameAR(c)}</option>`).join('')}
            </select>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #64748b;">الترتيب (Order):</label>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button id="prop-move-up" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: 6px;">⬆️</button>
                <input type="number" id="prop-order" min="1" style="width: 60px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center;">
                <button id="prop-move-down" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: 6px;">⬇️</button>
            </div>

            <div id="prop-table-tools" style="display: none; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #d35400;">طريقة التخطيط:</label>
                <select id="table-extract-method" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 8px; font-size: 12px; outline: none;">
                    <option value="auto">تلقائي (شامل)</option>
                    <option value="native">1. من الـ PDF الرقمي (متجهات)</option>
                    <option value="coordinates">2. إحداثيات الكلمات (دقيق)</option>
                    <option value="smear">3. معالجة الصور (ممسوح ضوئياً)</option>
                </select>
                <button id="btn-auto-table" class="btn-secondary" style="width: 100%; padding: 8px; border-radius: 6px; border-color: #d35400; color: #d35400; font-weight: bold; margin-bottom: 6px;">🛠️ تخطيط الجدول</button>
                <div style="font-size: 11px; color: #7f8c8d; text-align: center;">(انقر بالزر الأيمن داخل خلايا الجدول للدمج والتعديل)</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // --- منطق سحب وتحريك اللوحة ---
    const panel = document.getElementById('block-props-panel');
    const header = document.getElementById('prop-panel-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        header.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        let newTop = panel.offsetTop - pos2;
        let newLeft = panel.offsetLeft - pos1;

        // منع اللوحة من الخروج خارج الشاشة
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));

        panel.style.top = newTop + "px";
        panel.style.left = newLeft + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        header.style.cursor = 'grab';
    }
    // --------------------------------

    // تفعيل الأحداث الخاصة بالخصائص
    document.getElementById('prop-category').addEventListener('change', async (e) => {
        saveHistoryState();
        const idx = Array.from(selectedBoxes)[0];
        const oldCat = ocrData[idx].category;
        const newCat = e.target.value;
        ocrData[idx].category = newCat;
        if (isTableLike(newCat)) {
            await handleTableCategoryChangeInLayout(idx, newCat, oldCat);
        } else {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
    });

    document.getElementById('btn-auto-table').addEventListener('click', async () => {
        saveHistoryState();
        const idx = Array.from(selectedBoxes)[0];
        const btn = document.getElementById('btn-auto-table');
        const method = document.getElementById('table-extract-method').value;
        
        btn.textContent = '⏳ جاري التحليل...'; btn.disabled = true;
        try {
            await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            const response = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, idx, method);
            if (response.ok && response.table_structure) {
                ocrData[idx].table_structure = response.table_structure;
                drawCanvas(); 
            } else alert("Failed to analyze table."); 
        } catch (e) { alert('Error communicating with backend.'); } 
        finally { btn.textContent = '🛠️ تخطيط الجدول'; btn.disabled = false; }
    });
}

async function handleTableCategoryChangeInLayout(idx, newCat, oldCat) {
    const remember = localStorage.getItem('autoTableParse_remember') === 'true';
    const savedAction = localStorage.getItem('autoTableParse_action');

    const executeAutoParse = async () => {
        try {
            if (window.pywebview?.api?.auto_layout_table_block) {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
                const res = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, idx, "smear");
                const updatedProj = await window.pywebview.api.load_project(currentProject.id);
                if (updatedProj && updatedProj.pages[currentPageIndex]) {
                    currentProject = updatedProj;
                    ocrData = JSON.parse(JSON.stringify(updatedProj.pages[currentPageIndex].ocr_data || []));
                }
            }
        } catch (err) {
            console.error("Auto table layout failed:", err);
        } finally {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
    };

    if (remember) {
        if (savedAction === 'yes') {
            await executeAutoParse();
        } else {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
        return;
    }

    const catNameAR = getCategoryNameAR(newCat);
    const modalContent = `
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
            هل ترغب في الكشف التلقائي عن تخطيط الهيكل (الصفوف والأعمدة) للكتلة المحددة كـ <strong>"${catNameAR}"</strong> باستخدام التعرف الضوئي؟
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-remember-table-parse-layout" style="accent-color: #2563eb;">
            <span>تذكر اختياري وعدم السؤال مرة أخرى</span>
        </label>
    `;

    if (window.AestheticDialog?.show) {
        window.AestheticDialog.show('الكشف التلقائي عن التخطيط 📊', modalContent, async (overlay) => {
            const chk = overlay.querySelector('#chk-remember-table-parse-layout');
            if (chk && chk.checked) {
                localStorage.setItem('autoTableParse_remember', 'true');
                localStorage.setItem('autoTableParse_action', 'yes');
            }
            await executeAutoParse();
        });

        setTimeout(() => {
            const overlay = document.querySelector('.aes-overlay');
            if (overlay) {
                const cancelBtn = overlay.querySelector('.aes-btn-cancel');
                if (cancelBtn) {
                    cancelBtn.onclick = () => {
                        const chk = overlay.querySelector('#chk-remember-table-parse-layout');
                        if (chk && chk.checked) {
                            localStorage.setItem('autoTableParse_remember', 'true');
                            localStorage.setItem('autoTableParse_action', 'no');
                        }
                        overlay.remove();
                        updateSelectionUI(); drawCanvas();
                        autoSaveLayoutData();
                    };
                }
            }
        }, 10);
    } else {
        updateSelectionUI(); drawCanvas();
        autoSaveLayoutData();
    }
}

function loadImageAndCanvas(page) {
    const img = document.getElementById('page-image');
    const canvas = document.getElementById('layout-canvas');
    img.src = `file:///${window.__appDataPath}/projects/${currentProject.id}/images/${page.image_path}`;
    img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const nativeW = page.native_width || (img.naturalWidth / 200 * 72);
        const nativeH = page.native_height || (img.naturalHeight / 200 * 72);
        scaleRatioX = img.naturalWidth / nativeW;
        scaleRatioY = img.naturalHeight / nativeH;
        setupCanvasEvents(canvas);
        drawCanvas();
    };
}

function setupToolbar() {
    document.getElementById('btn-undo')?.addEventListener('click', doUndo);
    document.getElementById('btn-redo')?.addEventListener('click', doRedo);
    document.getElementById('btn-back')?.addEventListener('click', () => window.history.back());
    document.getElementById('prev-page')?.addEventListener('click', () => navigatePage(-1));
    document.getElementById('next-page')?.addEventListener('click', () => navigatePage(1));
    
    // Using currentTarget ensures the CSS highlight applies to the button, not the icon
    const wireTool = (id, name) => {
        document.getElementById(id)?.addEventListener('click', (e) => setTool(name, e.currentTarget));
    };
    wireTool('tool-draw', 'draw');
    wireTool('tool-select', 'select');
    wireTool('tool-move', 'move');
    wireTool('tool-order', 'order');

    document.getElementById('btn-delete')?.addEventListener('click', () => { saveHistoryState(); deleteSelected(); });
    document.getElementById('btn-merge')?.addEventListener('click', () => { saveHistoryState(); mergeSelected(); });

    document.getElementById('btn-save')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-save');
        const originalText = btn.textContent;
        
        btn.disabled = true; 
        btn.textContent = '⏳ جاري الحفظ...';
        
        try {
            if (window.pywebview?.api?.repopulate_page_text_from_raw) {
                const res = await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, ocrData);
                if (res && res.ok && res.ocr_data) {
                    ocrData = res.ocr_data;
                    currentProject.pages[currentPageIndex].ocr_data = res.ocr_data;
                    drawCanvas();
                }
            } else {
                currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            }
            
            btn.textContent = '✔ تم الحفظ';
            setTimeout(() => { 
                btn.textContent = originalText; 
                btn.disabled = false; 
            }, 1000);
            
        } catch (e) { 
            console.error('Failed to save manually:', e);
            btn.disabled = false; 
            btn.textContent = originalText; 
        }
    });
}

function deleteSelected() {
    if (selectedBoxes.size === 0) return;
    const indices = Array.from(selectedBoxes).sort((a, b) => b - a);
    indices.forEach(idx => ocrData.splice(idx, 1));
    selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
    autoSaveLayoutData(); // <-- ADDED
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) initLayoutEditor();
    else window.addEventListener('pywebviewready', initLayoutEditor);
});

async function navigatePage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex < 0 || newIndex >= currentProject.pages.length) return;
    
    // Only update memory and push to backend IF auto-save is actually ON
    if (window.__appSettings?.autoSaveLayout) {
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        try { 
            if (window.pywebview?.api?.repopulate_page_text_from_raw) {
                await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, ocrData);
            } else {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            }
        } catch (e) { 
            console.error("Auto-save failed", e); 
        }
    }

    currentPageIndex = newIndex;
    selectedBoxes.clear();
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI();
    loadPage(currentPageIndex);
}

function setTool(toolName, btnEl) {
    // If you click the active tool again, it turns off completely (neutral state)
    if (currentTool === toolName && toolName !== 'none') {
        currentTool = 'none';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
        document.getElementById('layout-canvas').style.cursor = 'default';
        selectedBoxes.clear(); 
        selectedTableCells = { blockIdx: null, cellIndices: [] }; // <-- Fixed here
        updateSelectionUI(); drawCanvas();
        return;
    }

    currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
    
    if (btnEl) btnEl.classList.add('active-tool');
    else document.getElementById(`tool-${toolName}`)?.classList.add('active-tool');
    
    const canvas = document.getElementById('layout-canvas');
    if (toolName === 'draw') canvas.style.cursor = 'crosshair';
    else if (toolName === 'move') canvas.style.cursor = 'move';
    else canvas.style.cursor = 'default';
    
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] }; // <-- Fixed here
    updateSelectionUI(); drawCanvas();
}

function updateSelectionUI() {
    const btnDel = document.getElementById('btn-delete');
    const btnMerge = document.getElementById('btn-merge'); // Added this
    
    if (btnDel) btnDel.disabled = selectedBoxes.size === 0;
    if (btnMerge) btnMerge.disabled = selectedBoxes.size < 2; // Activates on 2+ selections
    
    const panel = document.getElementById('block-props-panel');
    if (!panel) return;

    if (selectedBoxes.size === 1 && (currentTool === 'select' || currentTool === 'move')) {
        panel.style.display = 'block';
        const idx = Array.from(selectedBoxes)[0];
        const cat = ocrData[idx].category || 'Text';

        document.getElementById('prop-category').value = cat;
        document.getElementById('prop-order').value = idx + 1;
        
        const tableTools = document.getElementById('prop-table-tools');
        if(tableTools) tableTools.style.display = isTableLike(cat) ? 'block' : 'none';
    } else {
        panel.style.display = 'none';
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
        if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRedo(); }
        if (e.key === 'Escape') { isDrawing = false; setTool('select'); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedBoxes.size > 0) { saveHistoryState(); deleteSelected(); }
        }
    });
}

function getMouseCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

// ─── MASTER MOUSE EVENTS ───
function setupCanvasEvents(canvas) {
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (currentTool !== 'select' || selectedBoxes.size !== 1) return;
        const { x, y } = getMouseCoords(e, canvas);
        const hitBlock = Array.from(selectedBoxes)[0];
        const tableBlock = ocrData[hitBlock];
        if (isTableLike(tableBlock.category) && tableBlock.table_structure) {

            // Inside setupCanvasEvents() -> contextmenu event listener:
            const hitCellIdx = window.TableEditor?.checkHitCell?.(x, y, tableBlock, scaleRatioX, scaleRatioY) ?? -1;
            if (hitCellIdx !== -1) {
                if (selectedTableCells.blockIdx !== hitBlock || !selectedTableCells.cellIndices.includes(hitCellIdx)) {
                    selectedTableCells.blockIdx = hitBlock;
                    selectedTableCells.cellIndices = [hitCellIdx];
                    drawCanvas();
                }
                
                // Pass the contextual object array tracking to your TableEditor panel execution layer
                window.TableEditor.showContextMenu(e, tableBlock, hitCellIdx, () => {
                    selectedTableCells = { blockIdx: null, cellIndices: [] };
                    drawCanvas();
                });
            }
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; 
        window.TableEditor?.hideContextMenu?.(); 
        const { x, y } = getMouseCoords(e, canvas);

        if (currentTool === 'draw') {
            saveHistoryState();
            isDrawing = true; drawStartX = x; drawStartY = y;
            currentMouseX = x; currentMouseY = y;
            return;
        } 
        
        let hitBlock = -1;
        let hitHandle = null;

        for (let i = ocrData.length - 1; i >= 0; i--) {
            const [bx1, by1, bx2, by2] = ocrData[i].bbox;
            const px = bx1*scaleRatioX, py = by1*scaleRatioY;
            const pw = (bx2-bx1)*scaleRatioX, ph = (by2-by1)*scaleRatioY;
            const cx = px + pw/2, cy = py + ph/2;
            const angle = ocrData[i].angle_deg || 0;
            let testX = x, testY = y;
            if (angle) {
                const rad = (angle * Math.PI) / 180; 
                const dx = x - cx, dy = y - cy;
                testX = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
                testY = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
            }

            if (currentTool === 'move' && selectedBoxes.has(i) && selectedBoxes.size === 1) {
                const hs = 8;
                if (Math.abs(testY - py) <= hs && Math.abs(testX - px) <= hs) hitHandle = 'tl';
                else if (Math.abs(testY - py) <= hs && Math.abs(testX - (px + pw)) <= hs) hitHandle = 'tr';
                else if (Math.abs(testY - (py + ph)) <= hs && Math.abs(testX - px) <= hs) hitHandle = 'bl';
                else if (Math.abs(testY - (py + ph)) <= hs && Math.abs(testX - (px + pw)) <= hs) hitHandle = 'br';
                else if (Math.abs(testY - py) <= hs && Math.abs(testX - cx) <= hs) hitHandle = 't';
                else if (Math.abs(testY - (py + ph)) <= hs && Math.abs(testX - cx) <= hs) hitHandle = 'b';
                else if (Math.abs(testX - px) <= hs && Math.abs(testY - cy) <= hs) hitHandle = 'l';
                else if (Math.abs(testX - (px + pw)) <= hs && Math.abs(testY - cy) <= hs) hitHandle = 'r';
                if (hitHandle) { hitBlock = i; break; }
            }
            if (testX >= px && testX <= px + pw && testY >= py && testY <= py + ph) { hitBlock = i; break; }
        }

        // --- EMPTY CANVAS MARQUEE ---
        if (hitBlock === -1 && (currentTool === 'select' || currentTool === 'move')) {
            isMarqueeSelecting = true; marqueeStartX = x; marqueeStartY = y;
            if (!(e.ctrlKey || e.metaKey)) selectedBoxes.clear();
            selectedTableCells = { blockIdx: null, cellIndices: [] }; 
            updateSelectionUI(); drawCanvas();
            return;
        }

        // --- REORDER TOOL ---
        if (currentTool === 'order') {
            if (hitBlock !== -1) {
                saveHistoryState();
                const el = ocrData.splice(hitBlock, 1)[0];
                ocrData.splice(nextOrderSequence - 1, 0, el);
                nextOrderSequence++; drawCanvas();
                autoSaveLayoutData(); // <-- ADDED
            }
            return;
        }

        // --- SELECT TOOL (Internal Table Edits) ---
        if (currentTool === 'select') {
            const scale = canvas.clientWidth ? canvas.clientWidth / canvas.width : 1;
            if (hitBlock !== -1 && selectedBoxes.has(hitBlock) && selectedBoxes.size === 1) {
                const tableBlock = ocrData[hitBlock];
                if (isTableLike(tableBlock.category) && tableBlock.table_structure) {
                    if (!e.shiftKey) {
                        const hitLine = window.TableEditor?.checkHitInternalLines?.(x, y, tableBlock, scaleRatioX, scaleRatioY, scale);
                        if (hitLine) {
                            saveHistoryState();
                            isDraggingTableLine = true; window.TableEditor.activeHandle = hitLine;
                            return; 
                        }
                    }

                    if (window.TableEditor?.checkHitCell) {
                        const hitCellIdx = window.TableEditor.checkHitCell(x, y, tableBlock, scaleRatioX, scaleRatioY);
                        if (hitCellIdx !== -1) {
                            if (selectedTableCells.blockIdx !== hitBlock) {
                                selectedTableCells.blockIdx = hitBlock;
                                selectedTableCells.cellIndices = [];
                            }

                            if (e.shiftKey) {
                                if (selectedTableCells.cellIndices.includes(hitCellIdx)) {
                                    selectedTableCells.cellIndices = selectedTableCells.cellIndices.filter(id => id !== hitCellIdx);
                                } else {
                                    selectedTableCells.cellIndices.push(hitCellIdx);
                                }
                            } else {
                                selectedTableCells.cellIndices = [hitCellIdx];
                            }
                            drawCanvas();
                            return; // Lock interaction scope to cells
                        }
                    }
                }
            }

            if (hitBlock !== -1) {
                if (!selectedBoxes.has(hitBlock)) {
                    if (e.shiftKey && selectedBoxes.size > 0) {
                        // Range Selection
                        const lastSelected = Array.from(selectedBoxes).pop();
                        const start = Math.min(lastSelected, hitBlock);
                        const end = Math.max(lastSelected, hitBlock);
                        for (let i = start; i <= end; i++) selectedBoxes.add(i);
                    } else if (!(e.ctrlKey || e.metaKey || e.shiftKey)) { 
                        selectedBoxes.clear(); 
                        selectedTableCells = { blockIdx: null, cellIndices: [] }; 
                        selectedBoxes.add(hitBlock); 
                    } else {
                        selectedBoxes.add(hitBlock); 
                    }
                    updateSelectionUI(); drawCanvas();
                } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    // Deselect if already selected and holding modifier
                    selectedBoxes.delete(hitBlock); updateSelectionUI(); drawCanvas();
                }
            } else {
                selectedBoxes.clear(); 
                selectedTableCells = { blockIdx: null, cellIndices: [] }; 
                updateSelectionUI(); drawCanvas();
            }
        }

        // --- MOVE TOOL (Moving/Resizing) ---
        if (currentTool === 'move') {
            if (hitHandle) {
                saveHistoryState();
                isResizing = true; resizeHandle = hitHandle; activeBoxIdx = hitBlock;
                resizeStartBbox = [...ocrData[hitBlock].bbox];
                resizeStartTs = ocrData[hitBlock].table_structure ? JSON.parse(JSON.stringify(ocrData[hitBlock].table_structure)) : null;
                resizeStartX = x; resizeStartY = y;
            } else if (hitBlock !== -1) {
                if (!selectedBoxes.has(hitBlock)) {
                    if (e.shiftKey && selectedBoxes.size > 0) {
                        const lastSelected = Array.from(selectedBoxes).pop();
                        const start = Math.min(lastSelected, hitBlock);
                        const end = Math.max(lastSelected, hitBlock);
                        for (let i = start; i <= end; i++) selectedBoxes.add(i);
                    } else if (!(e.ctrlKey || e.metaKey || e.shiftKey)) { 
                        selectedBoxes.clear(); 
                        selectedTableCells = { blockIdx: null, cellIndices: [] }; 
                        selectedBoxes.add(hitBlock); 
                    } else {
                        selectedBoxes.add(hitBlock); 
                    }
                    updateSelectionUI(); drawCanvas();
                } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    selectedBoxes.delete(hitBlock); updateSelectionUI(); drawCanvas(); return;
                }
                saveHistoryState();
                isMoving = true; resizeStartX = x; resizeStartY = y;
                moveStartBboxes = Array.from(selectedBoxes).map(i => ({ 
                    idx: i, bbox: [...ocrData[i].bbox], 
                    ts: ocrData[i].table_structure ? JSON.parse(JSON.stringify(ocrData[i].table_structure)) : null 
                }));
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const { x, y } = getMouseCoords(e, canvas);
        currentMouseX = x; currentMouseY = y;

        if (isDrawing) { drawCanvas(); return; }
        if (isMarqueeSelecting) { drawCanvas(); return; }

        if (isDraggingTableLine) {
            const activeTableIdx = Array.from(selectedBoxes)[0];
            window.TableEditor?.handleDragLine?.(x, y, ocrData[activeTableIdx], scaleRatioX, scaleRatioY);
            drawCanvas(); return;
        }

        if (isMoving) {
            const dx = (currentMouseX - resizeStartX) / scaleRatioX;
            const dy = (currentMouseY - resizeStartY) / scaleRatioY;
            moveStartBboxes.forEach(obj => {
                const [bx1, by1, bx2, by2] = obj.bbox;
                const el = ocrData[obj.idx];
                el.bbox = [bx1 + dx, by1 + dy, bx2 + dx, by2 + dy];
                // Shift the internal Table Grid so it doesn't get left behind!
                if (obj.ts) {
                    el.table_structure.cols_x = obj.ts.cols_x.map(cx => cx + dx);
                    el.table_structure.rows_y = obj.ts.rows_y.map(cy => cy + dy);
                    el.table_structure.cells.forEach((c, i) => {
                        const [cx1, cy1, cx2, cy2] = obj.ts.cells[i].bbox;
                        c.bbox = [cx1 + dx, cy1 + dy, cx2 + dx, cy2 + dy];
                    });
                }
            });
            drawCanvas(); return;
        }

        if (isResizing) {
            const rad = ((ocrData[activeBoxIdx].angle_deg || 0) * Math.PI) / 180;
            const screenDx = currentMouseX - resizeStartX;
            const screenDy = currentMouseY - resizeStartY;
            
            const localDx = screenDx * Math.cos(rad) - screenDy * Math.sin(rad);
            const localDy = screenDx * Math.sin(rad) + screenDy * Math.cos(rad);
            
            const nativeDx = localDx / scaleRatioX;
            const nativeDy = localDy / scaleRatioY;
            
            let [nx1, ny1, nx2, ny2] = resizeStartBbox;
            if (resizeHandle.includes('l')) nx1 += nativeDx;
            if (resizeHandle.includes('r')) nx2 += nativeDx;
            if (resizeHandle.includes('t')) ny1 += nativeDy;
            if (resizeHandle.includes('b')) ny2 += nativeDy;
            
            let finalHandle = resizeHandle;
            if (nx1 > nx2) { 
                let t = nx1; nx1 = nx2; nx2 = t; 
                finalHandle = finalHandle.replace('l','X').replace('r','l').replace('X','r'); 
                resizeStartX = currentMouseX; resizeStartY = currentMouseY; resizeStartBbox = [nx1,ny1,nx2,ny2]; resizeHandle = finalHandle; 
            }
            if (ny1 > ny2) { 
                let t = ny1; ny1 = ny2; ny2 = t; 
                finalHandle = finalHandle.replace('t','X').replace('b','t').replace('X','b'); 
                resizeStartX = currentMouseX; resizeStartY = currentMouseY; resizeStartBbox = [nx1,ny1,nx2,ny2]; resizeHandle = finalHandle; 
            }
            
            const el = ocrData[activeBoxIdx];
            el.bbox = [nx1, ny1, nx2, ny2];

            // Scale the internal Table Grid proportionally
            if (resizeStartTs) {
                const oldW = resizeStartBbox[2] - resizeStartBbox[0];
                const oldH = resizeStartBbox[3] - resizeStartBbox[1];
                const newW = nx2 - nx1;
                const newH = ny2 - ny1;
                
                el.table_structure.cols_x = resizeStartTs.cols_x.map(cx => nx1 + ((cx - resizeStartBbox[0]) / oldW) * newW);
                el.table_structure.rows_y = resizeStartTs.rows_y.map(cy => ny1 + ((cy - resizeStartBbox[1]) / oldH) * newH);
                el.table_structure.cells.forEach((c, i) => {
                    const [cx1, cy1, cx2, cy2] = resizeStartTs.cells[i].bbox;
                    c.bbox = [
                        nx1 + ((cx1 - resizeStartBbox[0]) / oldW) * newW,
                        ny1 + ((cy1 - resizeStartBbox[1]) / oldH) * newH,
                        nx1 + ((cx2 - resizeStartBbox[0]) / oldW) * newW,
                        ny1 + ((cy2 - resizeStartBbox[1]) / oldH) * newH
                    ];
                });
            }
            drawCanvas(); return;
        }

        // Cursor styling
        if (currentTool === 'select' && selectedBoxes.size === 1) {
            const idx = Array.from(selectedBoxes)[0];
            const tableBlock = ocrData[idx];
            const scale = canvas.clientWidth ? canvas.clientWidth / canvas.width : 1;
            if (isTableLike(tableBlock.category) && tableBlock.table_structure && !e.shiftKey) {
                const hitLine = window.TableEditor?.checkHitInternalLines?.(x, y, tableBlock, scaleRatioX, scaleRatioY, scale);
                if (window.TableEditor?.updateCursor?.(canvas, hitLine)) return;
            }
        } 
        
        if (currentTool === 'move' && selectedBoxes.size === 1) {
            const idx = Array.from(selectedBoxes)[0];
            const [bx1, by1, bx2, by2] = ocrData[idx].bbox;
            const px = bx1 * scaleRatioX, py = by1 * scaleRatioY;
            const pw = (bx2 - bx1) * scaleRatioX, ph = (by2 - by1) * scaleRatioY;
            const cx = px + pw / 2, cy = py + ph / 2;
            const angle = ocrData[idx].angle_deg || 0;
            let testX = x, testY = y;
            if (angle) {
                const rad = (angle * Math.PI) / 180; 
                const dx = x - cx, dy = y - cy;
                testX = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
                testY = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
            }
            const hs = 8;
            const onLeft = Math.abs(testX - px) <= hs, onRight = Math.abs(testX - (px + pw)) <= hs;
            const onTop = Math.abs(testY - py) <= hs, onBottom = Math.abs(testY - (py + ph)) <= hs;
            const onCenterX = Math.abs(testX - cx) <= hs, onCenterY = Math.abs(testY - cy) <= hs;

            if ((onTop && onLeft) || (onBottom && onRight)) canvas.style.cursor = 'nwse-resize';
            else if ((onTop && onRight) || (onBottom && onLeft)) canvas.style.cursor = 'nesw-resize';
            else if ((onTop || onBottom) && onCenterX) canvas.style.cursor = 'ns-resize';
            else if ((onLeft || onRight) && onCenterY) canvas.style.cursor = 'ew-resize';
            else canvas.style.cursor = 'move';
        } else if(currentTool !== 'move') {
            canvas.style.cursor = currentTool === 'draw' ? 'crosshair' : 'default';
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDraggingTableLine) { 
            isDraggingTableLine = false; 
            if(window.TableEditor) window.TableEditor.activeHandle = null; 
            return; 
        }

        if (isMarqueeSelecting) {
            isMarqueeSelecting = false;
            const rx1 = Math.min(marqueeStartX, currentMouseX) / scaleRatioX;
            const ry1 = Math.min(marqueeStartY, currentMouseY) / scaleRatioY;
            const rx2 = Math.max(marqueeStartX, currentMouseX) / scaleRatioX;
            const ry2 = Math.max(marqueeStartY, currentMouseY) / scaleRatioY;

            if ((rx2 - rx1) > 2 && (ry2 - ry1) > 2) {
                ocrData.forEach((el, i) => {
                    const [bx1, by1, bx2, by2] = el.bbox;
                    if (bx1 < rx2 && bx2 > rx1 && by1 < ry2 && by2 > ry1) selectedBoxes.add(i);
                });
            }
            updateSelectionUI(); drawCanvas();
            return;
        }

        if (isDrawing) {
            isDrawing = false;
            const x1 = Math.min(drawStartX, currentMouseX) / scaleRatioX;
            const y1 = Math.min(drawStartY, currentMouseY) / scaleRatioY;
            const x2 = Math.max(drawStartX, currentMouseX) / scaleRatioX;
            const y2 = Math.max(drawStartY, currentMouseY) / scaleRatioY;

            if ((x2 - x1) > 10 && (y2 - y1) > 10) {
                ocrData.push({ bbox: [x1, y1, x2, y2], angle_deg: 0, text: "", category: "Text", reviewed: false });
                autoSaveLayoutData();
            } else { historyStack.undo.pop(); }
            selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
        }

        if (isMoving || isResizing) {
            const boxesToUpdate = isMoving ? moveStartBboxes.map(b => b.idx) : [activeBoxIdx];
            boxesToUpdate.forEach(idx => { if (typeof updateGeometryFromBbox === 'function') updateGeometryFromBbox(idx); });
            isMoving = false; isResizing = false;
            autoSaveLayoutData();
        }
    });
}

function drawCanvas() {
    const canvas = document.getElementById('layout-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.clientWidth ? canvas.clientWidth / canvas.width : 1;

    ocrData.forEach((el, index) => {
        const [x1, y1, x2, y2] = el.bbox;
        const px = x1 * scaleRatioX, py = y1 * scaleRatioY;
        const pw = (x2 - x1) * scaleRatioX, ph = (y2 - y1) * scaleRatioY;
        const color = getCategoryColors()[el.category || 'Text'] || '#3498db';

        const cx = px + pw/2, cy = py + ph/2;
        const angle = el.angle_deg || 0;
        const rad = (-angle * Math.PI) / 180;

        ctx.save();
        ctx.translate(cx, cy);
        if (angle) ctx.rotate(rad);

        ctx.beginPath();
        ctx.rect(-pw/2, -ph/2, pw, ph);

        if (selectedBoxes.has(index)) {
            ctx.lineWidth = 4 / scale;
            ctx.strokeStyle = '#f1c40f'; 
            ctx.fillStyle = 'rgba(241,196,15,0.35)';
        } else {
            ctx.lineWidth = 2 / scale;
            ctx.strokeStyle = color;
            ctx.fillStyle = color + '22';
        }
        
        ctx.stroke(); ctx.fill();
        
       // رسم مربع الرقم
        ctx.save();
        const textStr = (index + 1).toString();
        ctx.direction = 'ltr'; // إجبار الكانفاس على وضع LTR لتجنب الانعكاس
        ctx.font = `bold ${14/scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textWidth = ctx.measureText(textStr).width;
        const badgeW = Math.max(26 / scale, textWidth + (16 / scale)); 
        const badgeH = 24 / scale;
        
        // الزاوية العلوية اليسرى تماماً
        const badgeX = -pw/2; 
        const badgeY = -ph/2 - badgeH; 

        // رسم خلفية المربع
        ctx.fillStyle = selectedBoxes.has(index) ? '#f1c40f' : color;
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        
        // رسم النص
        ctx.fillStyle = 'white';
        ctx.fillText(textStr, badgeX + (badgeW / 2), badgeY + (badgeH / 2) + (1/scale));
        ctx.restore();

        if (el.table_structure && el.table_structure.cells) {
            el.table_structure.cells.forEach((cell, cIdx) => {
                const [cx1, cy1, cx2, cy2] = cell.bbox;
                
                // +0.5 Fixes the "sub-pixel blur/drift" for crisp canvas lines
                const ppx = Math.round(cx1 * scaleRatioX) + 0.5;
                const ppy = Math.round(cy1 * scaleRatioY) + 0.5;
                const ppw = Math.round((cx2 - cx1) * scaleRatioX);
                const pph = Math.round((cy2 - cy1) * scaleRatioY);

                ctx.save();
                ctx.beginPath();
                ctx.rect(ppx - cx, ppy - cy, ppw, pph);
                
                const isCellSelected = (selectedTableCells.blockIdx === index) && (selectedTableCells.cellIndices.includes(cIdx));

                if (isCellSelected) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.4)'; 
                    ctx.fill();
                }

                ctx.strokeStyle = 'rgba(211, 84, 0, 0.8)';
                ctx.lineWidth = 1.5 / scale;
                ctx.stroke();
                ctx.restore();
            });
        }

        if (currentTool === 'move' && selectedBoxes.has(index) && selectedBoxes.size === 1) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2980b9';
            ctx.lineWidth = 2 / scale;
            const hs = 8 / scale;
            const handles = [
                {x: -pw/2, y: -ph/2}, {x: 0, y: -ph/2}, {x: pw/2, y: -ph/2},
                {x: -pw/2, y: 0},                       {x: pw/2, y: 0},
                {x: -pw/2, y: ph/2},  {x: 0, y: ph/2},  {x: pw/2, y: ph/2}
            ];
            handles.forEach(h => {
                ctx.fillRect(h.x - hs/2, h.y - hs/2, hs, hs);
                ctx.strokeRect(h.x - hs/2, h.y - hs/2, hs, hs);
            });
        }

        ctx.restore();
    });

    if (isDrawing) {
        ctx.beginPath();
        ctx.rect(drawStartX, drawStartY, currentMouseX - drawStartX, currentMouseY - drawStartY);
        ctx.lineWidth = 2 / scale;
        ctx.strokeStyle = '#e74c3c';
        ctx.fillStyle = 'rgba(231,76,60,0.2)';
        ctx.stroke(); ctx.fill();
    }

    // Inside drawCanvas(), at the very end:
    if (isMarqueeSelecting) {
        ctx.beginPath();
        ctx.rect(marqueeStartX, marqueeStartY, currentMouseX - marqueeStartX, currentMouseY - marqueeStartY);
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = '#3498db';
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
        ctx.stroke(); ctx.fill();
        ctx.setLineDash([]);
    }
    
}

function deleteSelected() {
    if (selectedBoxes.size === 0) return;
    const indices = Array.from(selectedBoxes).sort((a, b) => b - a);
    indices.forEach(idx => ocrData.splice(idx, 1));
    selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
    autoSaveLayoutData(); // <-- ADDED
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) initLayoutEditor();
    else window.addEventListener('pywebviewready', initLayoutEditor);
});

async function navigatePage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex < 0 || newIndex >= currentProject.pages.length) return;
    
    // Only update memory and push to backend IF auto-save is actually ON
    if (window.__appSettings?.autoSaveLayout) {
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        try { 
            await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData); 
        } catch (e) { 
            console.error("Auto-save failed", e); 
        }
    }
    
    currentPageIndex = newIndex;
    const page = currentProject.pages[currentPageIndex];
    document.getElementById('page-num-display').textContent = currentPageIndex + (currentProject.metadata?.logical_start || 1);
    
    ocrData = JSON.parse(JSON.stringify(page.ocr_data || []));
    selectedBoxes.clear();
    
    // ❌ REMOVED: setTool('select'); 
    
    updateSelectionUI();
    loadImageAndCanvas(page);
    
    const url = new URL(window.location);
    url.searchParams.set('page', currentPageIndex);
    window.history.replaceState({}, '', url);
}

function deleteSelected() {
    if (selectedBoxes.size === 0) return;
    const indices = Array.from(selectedBoxes).sort((a, b) => b - a);
    indices.forEach(idx => ocrData.splice(idx, 1));
    selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
}

function mergeSelected() {
    if (selectedBoxes.size < 2) return;
    const indices = Array.from(selectedBoxes).sort((a, b) => {
        const boxA = ocrData[a].bbox; const boxB = ocrData[b].bbox;
        if (Math.abs(boxA[1] - boxB[1]) > 10) return boxA[1] - boxB[1];
        return boxB[0] - boxA[0];
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let mergedTexts = [];
    let mergedLines = [];

    indices.forEach(idx => {
        const b = ocrData[idx];
        const [x1, y1, x2, y2] = b.bbox;
        minX = Math.min(minX, x1); minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
        if (b.text && b.text.trim().length > 0) mergedTexts.push(b.text.trim());
        if (b.lines && b.lines.length) mergedLines.push(...JSON.parse(JSON.stringify(b.lines)));
    });

    const firstIdx = indices[0];
    const newBlock = { ...ocrData[firstIdx], bbox: [minX, minY, maxX, maxY], text: mergedTexts.join('<br>'), lines: mergedLines, reviewed: false };

    const removeIndices = [...indices].sort((a, b) => b - a);
    removeIndices.forEach(idx => ocrData.splice(idx, 1));
    ocrData.splice(Math.min(...indices), 0, newBlock);

    selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
    autoSaveLayoutData(); // <-- ADDED
}