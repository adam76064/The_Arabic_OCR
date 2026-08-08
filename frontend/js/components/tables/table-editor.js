// frontend/js/table-editor.js

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
        
        for (let i = 1; i < ts.cols_x.length - 1; i++) {
            let lx = ts.cols_x[i] * scaleRatioX;
            if (Math.abs(x - lx) <= hs) {
                let minY = ts.rows_y[0] * scaleRatioY, maxY = ts.rows_y[ts.rows_y.length - 1] * scaleRatioY;
                if (y >= minY && y <= maxY) return { axis: 'x', index: i };
            }
        }
        for (let i = 1; i < ts.rows_y.length - 1; i++) {
            let ly = ts.rows_y[i] * scaleRatioY;
            if (Math.abs(y - ly) <= hs) {
                let minX = ts.cols_x[0] * scaleRatioX, maxX = ts.cols_x[ts.cols_x.length - 1] * scaleRatioX;
                if (x >= minX && x <= maxX) return { axis: 'y', index: i };
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
        this.rebuildGrid(ts);
    },

    rebuildGrid: function(ts) {
        const newCells = [];
        for (let r = 0; r < ts.rows_y.length - 1; r++) {
            for (let c = 0; c < ts.cols_x.length - 1; c++) {
                newCells.push({
                    row: r, col: c, row_span: 1, col_span: 1,
                    bbox: [ts.cols_x[c], ts.rows_y[r], ts.cols_x[c+1], ts.rows_y[r+1]],
                    text: ""
                });
            }
        }
        ts.cells = newCells;
        ts.rows = ts.rows_y.length - 1;
        ts.cols = ts.cols_x.length - 1;
    },

    mergeCells: function(tableBlock, cellIndices) {
        if (!tableBlock.table_structure || cellIndices.length < 2) return;
        const ts = tableBlock.table_structure;
        let minRow = Infinity, minCol = Infinity, maxRow = -Infinity, maxCol = -Infinity;

        cellIndices.forEach(idx => {
            const c = ts.cells[idx];
            minRow = Math.min(minRow, c.row); minCol = Math.min(minCol, c.col);
            maxRow = Math.max(maxRow, c.row + c.row_span - 1); maxCol = Math.max(maxCol, c.col + c.col_span - 1);
        });

        const mergedCell = {
            row: minRow, col: minCol,
            row_span: maxRow - minRow + 1, col_span: maxCol - minCol + 1,
            bbox: [ts.cols_x[minCol], ts.rows_y[minRow], ts.cols_x[maxCol + 1], ts.rows_y[maxRow + 1]],
            text: ""
        };

        ts.cells = ts.cells.filter((_, idx) => !cellIndices.includes(idx));
        ts.cells.push(mergedCell);
    },

    showContextMenu: function(e, tableBlock, hitCellIdx, drawCallback) {
        e.preventDefault();
        this.hideContextMenu();

        const ts = tableBlock.table_structure;
        const cell = ts.cells[hitCellIdx];
        if (!cell) return;

        // Icons come from the shared AppIcons registry (js/icons.js) so this
        // right-click menu matches the SVG icon language used everywhere
        // else in the app instead of emoji.
        const icon = (name) => (window.AppIcons ? window.AppIcons.get(name) : '');

        const menu = document.createElement('div');
        menu.id = 'canvas-context-menu';
        menu.style.cssText = `
            position: fixed; top: ${e.clientY}px; left: ${e.clientX}px;
            background: white; border: 1px solid #cbd5e1; border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 10000;
            font-family: sans-serif; font-size: 13px; color: #334155; min-width: 180px;
            overflow: hidden; direction: rtl;
        `;

        const createItem = (text, icon, onClick, danger=false) => {
            const div = document.createElement('div');
            div.innerHTML = `<span style="margin-left: 8px;">${icon}</span> ${text}`;
            div.style.cssText = `padding: 10px 16px; cursor: pointer; display: flex; align-items: center; transition: background 0.2s; ${danger ? 'color: #e74c3c;' : ''}`;
            div.onmouseover = () => div.style.background = danger ? '#fef2f2' : '#f1f5f9';
            div.onmouseout = () => div.style.background = 'white';
            div.onclick = () => { onClick(); this.hideContextMenu(); drawCallback(); };
            return div;
        };

        const divider = () => {
            const div = document.createElement('div');
            div.style.cssText = 'height: 1px; background: #e2e8f0; margin: 4px 0;';
            return div;
        };

        if (window.selectedTableCells && window.selectedTableCells.length > 1) {
            menu.appendChild(createItem('دمج الخلايا المحددة', icon('merge'), () => {
                this.mergeCells(tableBlock, window.selectedTableCells);
                window.selectedTableCells = [];
            }));
            menu.appendChild(divider());
        }

        menu.appendChild(createItem('إضافة صف للأعلى', icon('rowAbove'), () => {
            const y = (ts.rows_y[cell.row] + (ts.rows_y[Math.max(0, cell.row-1)] || ts.rows_y[0])) / 2;
            ts.rows_y.splice(cell.row, 0, y); this.rebuildGrid(ts);
        }));
        menu.appendChild(createItem('إضافة صف للأسفل', icon('rowBelow'), () => {
            const y = (ts.rows_y[cell.row+1] + (ts.rows_y[cell.row+2] || ts.rows_y[ts.rows_y.length-1])) / 2;
            ts.rows_y.splice(cell.row+1, 0, y); this.rebuildGrid(ts);
        }));
        menu.appendChild(divider());
        menu.appendChild(createItem('إضافة عمود لليمين', icon('colRight'), () => {
            const x = (ts.cols_x[cell.col+1] + (ts.cols_x[cell.col+2] || ts.cols_x[ts.cols_x.length-1])) / 2;
            ts.cols_x.splice(cell.col+1, 0, x); this.rebuildGrid(ts);
        }));
        menu.appendChild(createItem('إضافة عمود لليسار', icon('colLeft'), () => {
            const x = (ts.cols_x[cell.col] + (ts.cols_x[Math.max(0, cell.col-1)] || ts.cols_x[0])) / 2;
            ts.cols_x.splice(cell.col, 0, x); this.rebuildGrid(ts);
        }));
        menu.appendChild(divider());
        menu.appendChild(createItem('حذف الصف الحالي', icon('trash'), () => {
            if (ts.rows_y.length > 2) { ts.rows_y.splice(cell.row+1, 1); this.rebuildGrid(ts); }
        }, true));
        menu.appendChild(createItem('حذف العمود الحالي', icon('trash'), () => {
            if (ts.cols_x.length > 2) { ts.cols_x.splice(cell.col+1, 1); this.rebuildGrid(ts); }
        }, true));

        document.body.appendChild(menu);
        this.contextMenu = menu;
    },

    hideContextMenu: function() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('#canvas-context-menu')) window.TableEditor?.hideContextMenu?.();
});