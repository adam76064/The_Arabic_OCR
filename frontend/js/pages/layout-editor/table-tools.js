/**
 * pages/layout-editor/table-tools.js - TableEditor engine
 */

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

        // Icons come from the shared AppIcons registry (js/icons.js) so this
        // right-click menu matches the SVG icon language used everywhere
        // else in the app instead of emoji.
        const icon = (name) => (window.AppIcons ? window.AppIcons.get(name) : '');

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
            menu.appendChild(createItem('دمج الخلايا المحددة', icon('merge'), () => {
                this.mergeCells(tableBlock, selectedTableCells.cellIndices);
                selectedTableCells = { blockIdx: null, cellIndices: [] }; 
            }));
            menu.appendChild(divider());
        }

        menu.appendChild(createItem('إضافة صف للأعلى', icon('rowAbove'), () => this.addRowCol(tableBlock, 'row_above', cell)));
        menu.appendChild(createItem('إضافة صف للأسفل', icon('rowBelow'), () => this.addRowCol(tableBlock, 'row_below', cell)));
        menu.appendChild(createItem('إضافة عمود لليمين', icon('colRight'), () => this.addRowCol(tableBlock, 'col_right', cell)));
        menu.appendChild(createItem('إضافة عمود لليسار', icon('colLeft'), () => this.addRowCol(tableBlock, 'col_left', cell)));
        menu.appendChild(divider());
        menu.appendChild(createItem('حذف الصف الحالي', icon('trash'), () => this.removeRowCol(tableBlock, 'row', cell), true));
        menu.appendChild(createItem('حذف العمود الحالي', icon('trash'), () => this.removeRowCol(tableBlock, 'col', cell), true));

        menu.appendChild(createItem('تقسيم الخلية (عمودياً من المنتصف)', icon('splitV'), () => this.bisectCell(tableBlock, hitCellIdx, 'v')));
        menu.appendChild(createItem('تقسيم الخلية (أفقياً من المنتصف)', icon('splitH'), () => this.bisectCell(tableBlock, hitCellIdx, 'h')));
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

