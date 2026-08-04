// js/table-selection.js
// ══════════════════════════════════════════════════════════════════════
// MULTI-CELL SELECTION
// Lets the user drag across cells to select a range, the way Word does.
// This is also the fix for "selecting cells selects my whole textbox":
// we take over the mouse gesture ourselves the moment a drag crosses into
// a second cell, and stop native selection from running at all.
// ══════════════════════════════════════════════════════════════════════
const TableSelection = {
    table: null,
    anchorCell: null,
    isDragging: false,
    isRangeSelecting: false,
    selected: [],

    init() {
        document.addEventListener('mousedown', (e) => this._onMouseDown(e));
        document.addEventListener('mousemove', (e) => this._onMouseMove(e));
        document.addEventListener('mouseup', () => this._onMouseUp());
        
        // Prevent native text selection from interfering with cell dragging
        document.addEventListener('selectstart', (e) => {
            if (this.isRangeSelecting || this.isDragging) {
                const cell = this._cellAt(e);
                if (cell && this.anchorCell && cell !== this.anchorCell) {
                    e.preventDefault();
                }
            }
        });
    },

    _cellAt(e) {
        const target = e.target.closest && e.target.closest('td, th');
        if (!target) return null;
        const host = target.closest('.block-content, #text-preview-body');
        return host ? target : null;
    },

    _onMouseDown(e) {
        if (e.button !== 0) return; // left click only
        const cell = this._cellAt(e);
        
        if (!cell) {
            // Protect toolbar clicks from clearing selection
            if (e.target.closest('.toolbar, .toolbar-tabs-container, #sticky-toolbar, .table-ctx-menu, .aes-overlay, .modal, .modal-box')) {
                return;
            }
            this.clear();
            return;
        }
        
        const table = cell.closest('table');
        if (this.table !== table) this.clear();
        this.table = table;

        // MULTI-SELECT: Ctrl or Meta(Cmd) Click
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.isRangeSelecting = true;
            const idx = this.selected.indexOf(cell);
            if (idx > -1) {
                this.selected.splice(idx, 1);
                cell.classList.remove('tcell-selected');
            } else {
                this.selected.push(cell);
                cell.classList.add('tcell-selected');
            }
            this.anchorCell = cell; // Base for future shift-clicks
            return;
        }

        // RANGE SELECT: Shift Click
        if (e.shiftKey && this.anchorCell) {
            e.preventDefault();
            this.isRangeSelecting = true;
            this._highlightRange(this.anchorCell, cell);
            return;
        }

        // Normal Click (Start Drag)
        this.clearHighlight();
        this.anchorCell = cell;
        this.isDragging = true;
        this.isRangeSelecting = false;
    },

    _onMouseMove(e) {
        if (!this.isDragging || !this.anchorCell) return;
        const cell = this._cellAt(e);
        if (!cell || cell.closest('table') !== this.table) return;

        if (!this.isRangeSelecting) {
            if (cell === this.anchorCell) return; // still just a click, not a drag yet
            // First real movement into another cell: take over from native selection.
            this.isRangeSelecting = true;
            document.body.classList.add('table-cell-select-mode');
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
        }
        e.preventDefault();
        this._highlightRange(this.anchorCell, cell);
    },

    _onMouseUp() {
        if (this.isRangeSelecting) {
            document.body.classList.remove('table-cell-select-mode');
        } else if (this.isDragging) {
            // Plain click, no drag — a single cell "selection", let caret placement proceed normally.
            this._highlightRange(this.anchorCell, this.anchorCell);
        }
        this.isDragging = false;
    },

    _highlightRange(cellA, cellB) {
        const table = cellA.closest('table');
        if (!table) return;
        this.clearHighlight();
        const rect = window.TableModel.getSelectionRect(table, [cellA, cellB]);
        const grid = window.TableModel.getGrid(table);
        const set = new Set();
        for (let r = rect.minR; r <= rect.maxR; r++) {
            for (let c = rect.minC; c <= rect.maxC; c++) {
                const g = grid[r] && grid[r][c];
                if (g) set.add(g.cell);
            }
        }
        this.selected = Array.from(set);
        this.selected.forEach(td => td.classList.add('tcell-selected'));
    },

    clearHighlight() {
        document.querySelectorAll('.tcell-selected').forEach(td => td.classList.remove('tcell-selected'));
    },

    clear() {
        this.clearHighlight();
        this.table = null;
        this.anchorCell = null;
        this.selected = [];
        this.isDragging = false;
        this.isRangeSelecting = false;
    },

    // Returns the current multi-cell selection, or falls back to whatever
    // single cell the caret/right-click is in.
    getSelectedCells(fallbackCell) {
        if (this.selected && this.selected.length > 0) return this.selected;
        return fallbackCell ? [fallbackCell] : [];
    },

    // HELPER: Use this for Bold, Italic, Color, etc. anywhere in your app!
    applyFormat(command, value = null) {
        if (!this.selected || this.selected.length === 0) return false;
        const sel = window.getSelection();
        this.selected.forEach(td => {
            const range = document.createRange();
            range.selectNodeContents(td);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand(command, false, value);
        });
        sel.removeAllRanges();
        // Trigger auto-save
        const blockContent = this.selected[0].closest('.block-content');
        if (blockContent && window.persistBrushEdit) window.persistBrushEdit(blockContent);
        return true;
    }
};

// // OVERRIDE execCommand to support multi-cell formatting seamlessly!
// const originalExecCommand = document.execCommand;
// document.execCommand = function(commandId, showUI, value) {
//     // If we have multiple cells selected in our custom TableSelection tool...
//     if (window.TableSelection && window.TableSelection.selected && window.TableSelection.selected.length > 0) {
//         let success = false;
//         const sel = window.getSelection();
        
//         // Apply the format to each cell individually behind the scenes
//         window.TableSelection.selected.forEach(td => {
//             const range = document.createRange();
//             range.selectNodeContents(td);
//             sel.removeAllRanges();
//             sel.addRange(range);
//             success = originalExecCommand.call(document, commandId, showUI, value) || success;
//         });
        
//         sel.removeAllRanges();
        
//         // Trigger auto-save for the edited table block
//         const blockContent = window.TableSelection.selected[0].closest('.block-content, #text-preview-body');
//         if (blockContent && window.persistBrushEdit) {
//             window.persistBrushEdit(blockContent);
//         }
//         return success;
//     }
    
//     // Default behavior for normal text blocks
//     return originalExecCommand.call(document, commandId, showUI, value);
// };


// OVERRIDE execCommand to support multi-cell formatting seamlessly!
const originalExecCommand = document.execCommand;
document.execCommand = function(commandId, showUI, value) {
    const visuallySelectedCells = document.querySelectorAll('.tcell-selected');
    
    if (visuallySelectedCells.length > 0) {
        let success = false;
        const sel = window.getSelection();
        
        visuallySelectedCells.forEach(td => {
            const range = document.createRange();
            range.selectNodeContents(td);
            sel.removeAllRanges();
            sel.addRange(range);
            success = originalExecCommand.call(document, commandId, showUI, value) || success;
        });
        
        sel.removeAllRanges();
        
        const blockContent = visuallySelectedCells[0].closest('.block-content, #text-preview-body');
        if (blockContent && window.persistBrushEdit) window.persistBrushEdit(blockContent);
        return success;
    }
    
    return originalExecCommand.call(document, commandId, showUI, value);
};

TableSelection.init();
window.TableSelection = TableSelection;

