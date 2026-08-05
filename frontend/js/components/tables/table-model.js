// js/table-model.js
// ══════════════════════════════════════════════════════════════════════
// TABLE GRID MODEL
// Every structural table operation (insert/delete row & col, merge, split)
// goes through this module. We never poke rows/cells by hand elsewhere —
// instead we read the table into a flat grid of {dom, r, c, rowSpan, colSpan}
// records, mutate that grid, then rebuild real <tr>/<td> elements from it.
// This keeps rowSpan/colSpan math correct in one place instead of being
// re-derived (and re-broken) in every handler.
// ══════════════════════════════════════════════════════════════════════

const TableModel = {

    // Maps every occupied grid position -> the cell that occupies it.
    // grid[r][c] = { cell, originRow, originCol, rowSpan, colSpan }
    getGrid(table) {
        const rows = Array.from(table.rows);
        const grid = [];
        rows.forEach((row, r) => {
            if (!grid[r]) grid[r] = [];
            let c = 0;
            Array.from(row.cells).forEach(cell => {
                while (grid[r][c]) c++; // skip columns already covered by a rowSpan from above
                const rowSpan = cell.rowSpan || 1;
                const colSpan = cell.colSpan || 1;
                for (let rr = 0; rr < rowSpan; rr++) {
                    if (!grid[r + rr]) grid[r + rr] = [];
                    for (let cc = 0; cc < colSpan; cc++) {
                        grid[r + rr][c + cc] = { cell, originRow: r, originCol: c, rowSpan, colSpan };
                    }
                }
                c += colSpan;
            });
        });
        return grid;
    },

    // Flattens the grid into a deduplicated list of logical cell records.
    toModel(table) {
        const grid = this.getGrid(table);
        const seen = new Set();
        const cells = [];
        let numCols = 0;
        grid.forEach(row => {
            row.forEach(g => { if (g) numCols = Math.max(numCols, g.originCol + g.colSpan); });
        });
        grid.forEach(row => {
            row.forEach(g => {
                if (g && !seen.has(g.cell)) {
                    seen.add(g.cell);
                    cells.push({ dom: g.cell, r: g.originRow, c: g.originCol, rowSpan: g.rowSpan, colSpan: g.colSpan });
                }
            });
        });
        return { cells, numRows: grid.length, numCols };
    },

    // Rebuilds the table's DOM from a model. Reuses the original <td> elements
    // (so content/inline styles survive) but repositions them into fresh rows.
    fromModel(table, model) {
        const rows = [];
        for (let r = 0; r < model.numRows; r++) rows.push(document.createElement('tr'));
        model.cells
            .slice()
            .sort((a, b) => (a.r - b.r) || (a.c - b.c))
            .forEach(c => {
                const td = c.dom;
                if (c.rowSpan > 1) td.rowSpan = c.rowSpan; else td.removeAttribute('rowspan');
                if (c.colSpan > 1) td.colSpan = c.colSpan; else td.removeAttribute('colspan');
                if (!td.innerHTML.trim()) td.innerHTML = '<br>';
                rows[c.r].appendChild(td);
            });
        let tbody = table.querySelector('tbody');
        if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
        tbody.innerHTML = '';
        rows.forEach(r => tbody.appendChild(r));
    },

    cloneStyle(sourceTd, targetTd) {
        if (!sourceTd) return;
        targetTd.style.cssText = sourceTd.style.cssText;
        targetTd.className = sourceTd.className;
    },

    makeCell(styleSource) {
        const td = document.createElement('td');
        td.innerHTML = '<br>';
        this.cloneStyle(styleSource, td);
        return td;
    },

    // ── Row insertion ───────────────────────────────────────────────
    // Inserts one full grid row at `insertAt`, cloning cell styles from
    // `styleRowIndex` (the reference row the user right-clicked in).
    insertGridRow(model, insertAt, styleRowIndex) {
        model.cells.forEach(c => {
            if (c.r < insertAt && c.r + c.rowSpan > insertAt) c.rowSpan += 1; // spanning cell swallows the new row
            else if (c.r >= insertAt) c.r += 1;
        });
        const covered = new Set();
        model.cells.forEach(c => {
            if (c.r <= insertAt && c.r + c.rowSpan > insertAt) {
                for (let cc = c.c; cc < c.c + c.colSpan; cc++) covered.add(cc);
            }
        });
        const styleRow = model.cells.filter(c => c.r === styleRowIndex || c.r === styleRowIndex + (styleRowIndex >= insertAt ? 1 : 0));
        for (let cc = 0; cc < model.numCols; cc++) {
            if (!covered.has(cc)) {
                const styleSource = styleRow.find(c => cc >= c.c && cc < c.c + c.colSpan);
                model.cells.push({ dom: this.makeCell(styleSource && styleSource.dom), r: insertAt, c: cc, rowSpan: 1, colSpan: 1 });
            }
        }
        model.numRows += 1;
    },

    insertGridCol(model, insertAt, styleColIndex) {
        model.cells.forEach(c => {
            if (c.c < insertAt && c.c + c.colSpan > insertAt) c.colSpan += 1;
            else if (c.c >= insertAt) c.c += 1;
        });
        const covered = new Set();
        model.cells.forEach(c => {
            if (c.c <= insertAt && c.c + c.colSpan > insertAt) {
                for (let rr = c.r; rr < c.r + c.rowSpan; rr++) covered.add(rr);
            }
        });
        const styleCol = model.cells.filter(c => c.c === styleColIndex || c.c === styleColIndex + (styleColIndex >= insertAt ? 1 : 0));
        for (let rr = 0; rr < model.numRows; rr++) {
            if (!covered.has(rr)) {
                const styleSource = styleCol.find(c => rr >= c.r && rr < c.r + c.rowSpan);
                model.cells.push({ dom: this.makeCell(styleSource && styleSource.dom), r: rr, c: insertAt, rowSpan: 1, colSpan: 1 });
            }
        }
        model.numCols += 1;
    },

    insertRow(table, refCell, position) {
        const model = this.toModel(table);
        const ref = model.cells.find(c => c.dom === refCell);
        if (!ref) return;
        const insertAt = position === 'above' ? ref.r : ref.r + ref.rowSpan;
        const styleRowIndex = ref.r;
        this.insertGridRow(model, insertAt, styleRowIndex);
        this.fromModel(table, model);
    },

    insertCol(table, refCell, position) {
        const model = this.toModel(table);
        const ref = model.cells.find(c => c.dom === refCell);
        if (!ref) return;
        const insertAt = position === 'left' ? ref.c : ref.c + ref.colSpan;
        const styleColIndex = ref.c;
        this.insertGridCol(model, insertAt, styleColIndex);
        this.fromModel(table, model);
    },

    // ── Deletion ─────────────────────────────────────────────────────
    deleteRow(table, refCell) {
        const model = this.toModel(table);
        const ref = model.cells.find(c => c.dom === refCell);
        if (!ref) return;
        if (model.numRows <= 1) { table.remove(); return; }
        const targetR = ref.r;
        const kept = [];
        model.cells.forEach(c => {
            if (c.r < targetR && c.r + c.rowSpan > targetR) { c.rowSpan -= 1; kept.push(c); return; }
            if (c.r === targetR) {
                if (c.rowSpan > 1) { c.r += 1; c.rowSpan -= 1; } else { return; }
            }
            if (c.r > targetR) c.r -= 1;
            kept.push(c);
        });
        model.cells = kept;
        model.numRows -= 1;
        this.fromModel(table, model);
    },

    deleteCol(table, refCell) {
        const model = this.toModel(table);
        const ref = model.cells.find(c => c.dom === refCell);
        if (!ref) return;
        if (model.numCols <= 1) { table.remove(); return; }
        const targetC = ref.c;
        const kept = [];
        model.cells.forEach(c => {
            if (c.c < targetC && c.c + c.colSpan > targetC) { c.colSpan -= 1; kept.push(c); return; }
            if (c.c === targetC) {
                if (c.colSpan > 1) { c.c += 1; c.colSpan -= 1; } else { return; }
            }
            if (c.c > targetC) c.c -= 1;
            kept.push(c);
        });
        model.cells = kept;
        model.numCols -= 1;
        this.fromModel(table, model);
    },

    // ── Merge ────────────────────────────────────────────────────────
    // `cells` is any set of <td>/<th> the user selected. We compute the
    // smallest stable rectangle that contains them (growing to swallow any
    // cell that only partially overlaps) and collapse it into one cell.
    getSelectionRect(table, cells) {
        const grid = this.getGrid(table);
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        cells.forEach(cell => {
            for (const row of grid) {
                for (const g of row) {
                    if (g && g.cell === cell) {
                        minR = Math.min(minR, g.originRow); maxR = Math.max(maxR, g.originRow + g.rowSpan - 1);
                        minC = Math.min(minC, g.originCol); maxC = Math.max(maxC, g.originCol + g.colSpan - 1);
                    }
                }
            }
        });
        let rect = { minR, maxR, minC, maxC };
        let changed = true;
        while (changed) {
            changed = false;
            for (let r = rect.minR; r <= rect.maxR; r++) {
                for (let c = rect.minC; c <= rect.maxC; c++) {
                    const g = grid[r] && grid[r][c];
                    if (!g) continue;
                    const endR = g.originRow + g.rowSpan - 1, endC = g.originCol + g.colSpan - 1;
                    if (g.originRow < rect.minR) { rect.minR = g.originRow; changed = true; }
                    if (endR > rect.maxR) { rect.maxR = endR; changed = true; }
                    if (g.originCol < rect.minC) { rect.minC = g.originCol; changed = true; }
                    if (endC > rect.maxC) { rect.maxC = endC; changed = true; }
                }
            }
        }
        return rect;
    },

    mergeCells(table, cells) {
        if (!cells || cells.length < 2) return null;
        const rect = this.getSelectionRect(table, cells);
        const model = this.toModel(table);
        const involved = model.cells.filter(c => c.r >= rect.minR && c.r <= rect.maxR && c.c >= rect.minC && c.c <= rect.maxC);
        if (involved.length < 2) return null;
        involved.sort((a, b) => (a.r - b.r) || (a.c - b.c));
        const anchor = involved[0];
        const html = involved
            .map(c => c.dom.innerHTML.trim())
            .filter(h => h && h !== '<br>')
            .join(' ');
        anchor.dom.innerHTML = html || '<br>';
        anchor.r = rect.minR; anchor.c = rect.minC;
        anchor.rowSpan = rect.maxR - rect.minR + 1;
        anchor.colSpan = rect.maxC - rect.minC + 1;
        model.cells = model.cells.filter(c => !involved.includes(c) || c === anchor);
        this.fromModel(table, model);
        return anchor.dom;
    },

    // ── Split ────────────────────────────────────────────────────────
    // Divides `cell`'s bounding box into `sr` rows x `sc` cols. If the box
    // is currently smaller than requested, real rows/columns are inserted
    // into the whole table first (never a nested sub-table) so the grid
    // stays a single valid HTML table.
    splitCell(table, cell, sr, sc) {
        sr = Math.max(1, sr | 0); sc = Math.max(1, sc | 0);
        let model = this.toModel(table);
        let target = model.cells.find(c => c.dom === cell);
        if (!target) return;

        // The box we're dividing is at least as big as the cell's current
        // span, and at least as big as what was requested. Growth only adds
        // new sibling cells alongside the target — it never changes the
        // target's own rowSpan/colSpan — so these must be captured now.
        const boxH = Math.max(sr, target.rowSpan);
        const boxW = Math.max(sc, target.colSpan);
        const growRows = boxH - target.rowSpan;
        const growCols = boxW - target.colSpan;

        for (let i = 0; i < growRows; i++) {
            this.insertGridRow(model, target.r + target.rowSpan, target.r);
            target = model.cells.find(c => c.dom === cell);
        }
        for (let i = 0; i < growCols; i++) {
            this.insertGridCol(model, target.c + target.colSpan, target.c);
            target = model.cells.find(c => c.dom === cell);
        }

        const rowSizes = this._distribute(boxH, sr);
        const colSizes = this._distribute(boxW, sc);

        // Remove every cell whose origin falls inside the box (that's the
        // target itself, plus any filler cells we just grew into place).
        const r0 = target.r, c0 = target.c;
        const insideBox = c => c.r >= r0 && c.r < r0 + boxH && c.c >= c0 && c.c < c0 + boxW;
        model.cells = model.cells.filter(c => !insideBox(c));

        const originalHtml = target.dom.innerHTML.trim();
        let r = r0;
        let first = true;
        for (let ri = 0; ri < sr; ri++) {
            let c = c0;
            for (let ci = 0; ci < sc; ci++) {
                const td = first ? target.dom : this.makeCell(target.dom);
                if (first) td.innerHTML = (originalHtml && originalHtml !== '<br>') ? originalHtml : '<br>';
                model.cells.push({ dom: td, r, c, rowSpan: rowSizes[ri], colSpan: colSizes[ci] });
                first = false;
                c += colSizes[ci];
            }
            r += rowSizes[ri];
        }
        this.fromModel(table, model);
    },

    // Splits `total` grid units into `parts` pieces as evenly as possible.
    _distribute(total, parts) {
        const base = Math.floor(total / parts);
        let remainder = total - base * parts;
        const sizes = [];
        for (let i = 0; i < parts; i++) {
            sizes.push(base + (remainder > 0 ? 1 : 0));
            if (remainder > 0) remainder--;
        }
        return sizes;
    }
};

window.TableModel = TableModel;
