// text-tracking-engine.js
// Real-time word/line alignment engine for the crop-viewer tracking feature.
//
// Pure logic only — no DOM rendering here (that stays in canvas-rendering.js,
// which already draws bbox rects; this module just tells it WHICH bbox).
// Exposed as window.TextTrackingEngine. Load alongside review.js, order
// doesn't matter (same reasoning as your other split-out modules).
//
// Scope:
//   - Text/Title/etc. blocks -> word-level tracking via diff-based anchors,
//     with graceful fallback to the nearest anchored word, and ultimately to
//     the line/block bbox if nothing anchors at all.
//   - Table blocks -> NOT handled here. Table cells only ever have a single
//     bbox per cell (no per-word data), so tracking a table is just "which
//     <td> has focus" -> look up that cell in table_structure.cells. That's
//     a couple of lines wherever you handle table cell focus; no diffing
//     needed, see getHighlightBBox() below for how the two paths split.

(function () {

    // ── 1. Normalization ──────────────────────────────────────────────────
    // Tashkeel + tatweel/kashida stripping. Runs on BOTH sides of every
    // comparison, regardless of the project's own text_features settings —
    // a person can always type diacritics/kashida by hand mid-edit, so we
    // can't rely on import-time cleanup having already handled it.
    const DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08E1\u08E3-\u08FF]/g;
    const TATWEEL_RE = /\u0640/g;

    function normalizeWord(w) {
        return w.replace(DIACRITICS_RE, '').replace(TATWEEL_RE, '');
    }

    // ── 2. Tokenization ───────────────────────────────────────────────────
    // Splits Arabic letter-runs and punctuation/digit-runs into separate
    // tokens (matches how the OCR itself tokenizes -- e.g. "صباه" and ":"
    // come through as two separate words), regardless of whether the person
    // typed a space before the punctuation. Each token keeps its [start,end)
    // char offset in the source string, needed to map a caret position back
    // to a token index later.
    const TOKEN_RE = /[\u0600-\u06FF\u0750-\u077F]+|[^\s\u0600-\u06FF\u0750-\u077F]+/g;

    function tokenize(text) {
        const tokens = [];
        let m;
        TOKEN_RE.lastIndex = 0;
        while ((m = TOKEN_RE.exec(text)) !== null) {
            tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
        }
        return tokens;
    }

    // ── 3. Diff (LCS-based) ───────────────────────────────────────────────
    // Paragraph-sized inputs (tens, occasionally low hundreds of words), so
    // a plain O(N*M) LCS table is comfortably fast (sub-millisecond) and
    // keeps this dependency-free rather than pulling in a diff library.
    // This is what replaces a hand-tuned "check word index too" heuristic:
    // LCS finds the globally optimal content+order alignment in one pass.
    function diffTokens(origWordTexts, curWordTexts) {
        const a = origWordTexts.map(normalizeWord);
        const b = curWordTexts.map(normalizeWord);
        const n = a.length, m = b.length;

        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }

        const ops = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) {
                ops.push({ type: 'equal', origIndex: i, curIndex: j });
                i++; j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                ops.push({ type: 'delete', origIndex: i });
                i++;
            } else {
                ops.push({ type: 'insert', curIndex: j });
                j++;
            }
        }
        while (i < n) { ops.push({ type: 'delete', origIndex: i }); i++; }
        while (j < m) { ops.push({ type: 'insert', curIndex: j }); j++; }
        return ops;
    }

    // ── 4. Anchor map ─────────────────────────────────────────────────────
    // originalWords: flat array of {text, bbox} — straight from a block's
    //                lines[<i>].words[] in your project JSON.
    // currentText:   plain text of the block/line as currently edited.
    // Returns: array parallel to the CURRENT tokens; each slot is either
    //          { bbox, start, end } (an anchor) or null (no OCR match).
    function buildAnchorMap(originalWords, currentText) {
        const curTokens = tokenize(currentText);
        const ops = diffTokens(originalWords.map(w => w.text), curTokens.map(t => t.text));

        const anchors = new Array(curTokens.length).fill(null);
        for (const op of ops) {
            if (op.type === 'equal') {
                anchors[op.curIndex] = { bbox: originalWords[op.origIndex].bbox, origIndex: op.origIndex };
            }
        }
        return { anchors, curTokens };
    }

    // ── 5. Caret -> anchor lookup ─────────────────────────────────────────
    // caretOffset: plain-text char offset within the same string passed to
    // buildAnchorMap (see getCaretPlainTextOffset() below for how to get one
    // from a live contenteditable selection).
    // Falls back to the nearest anchored neighbor if the caret's own word
    // has no match (e.g. mid-edit on a brand-new word) -- returns null only
    // if literally nothing in the block/line anchored, in which case the
    // caller should fall back to the line or block bbox.
    function findAnchorAtCaret(anchors, curTokens, caretOffset) {
        if (!curTokens.length) return null;
        let tokenIndex = curTokens.findIndex(t => caretOffset >= t.start && caretOffset <= t.end);
        if (tokenIndex === -1) {
            tokenIndex = curTokens.findIndex(t => t.start > caretOffset);
            if (tokenIndex === -1) tokenIndex = curTokens.length - 1;
        }
        if (anchors[tokenIndex]) return anchors[tokenIndex];

        for (let r = 1; r < anchors.length; r++) {
            if (anchors[tokenIndex - r]) return anchors[tokenIndex - r];
            if (anchors[tokenIndex + r]) return anchors[tokenIndex + r];
        }
        return null;
    }

    // ── 6. DOM helpers ────────────────────────────────────────────────────
    // Plain-text char offset of the caret within `el` (a contenteditable
    // block, or a single <p> inside one). Standard clone-range technique --
    // independent of whatever inline formatting tags currently wrap it.
    function getCaretPlainTextOffset(el) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        range.selectNodeContents(el);
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
        return range.toString().length;
    }

    // NOTE: if a <p> line ever contains a manually-inserted <br> (splitting
    // it visually without a corresponding new lines[] entry), textContent
    // won't reflect that break. That's a rare enough edit that treating the
    // whole paragraph as one tracking unit in that case is a reasonable
    // simplification rather than something to special-case up front.
    function getPlainText(el) {
        return el.textContent || '';
    }

    // ── 7. Top-level orchestrator ─────────────────────────────────────────
    // blockEl:   the .block-content contenteditable element
    // blockData: the matching ocr_data[] entry (has .lines[] or .table_structure)
    // mode:      'word' (default) | 'line' | 'off'
    // Returns: { bbox, angle, level } where level is 'word'|'line'|'block'|'cell',
    //          or null if there's nothing to highlight / tracking is off.
    //
    // NOTE: this deliberately locates the caret via window.getSelection().anchorNode,
    // NOT document.activeElement. When a block is focused, document.activeElement
    // IS the contenteditable .block-content div itself -- .closest() from there
    // only walks upward and can never reach a descendant <p> or <td>. This is
    // the same anchorNode-based technique table-toolbar.js's currentTableTarget()
    // already uses to find "which cell is the caret in".
    function getCaretContainerNode() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const node = sel.anchorNode;
        if (!node) return null;
        return node.nodeType === 3 ? node.parentNode : node; // text node -> its element
    }

    function getHighlightBBox(blockEl, blockData, cfg) {
        cfg = cfg || { cells: true, words: true, lines: true, block: true };
        const caretNode = getCaretContainerNode();

        // 1. Table Cells Tracking (Table and Vertical-poetry)
        if ((blockData.category === 'Table' || blockData.category === 'Vertical-poetry') && blockData.table_structure) {
            if (!cfg.cells) return cfg.block && blockData.bbox ? { bbox: blockData.bbox, angle: blockData.angle_deg || 0, level: 'block' } : null;
            
            const td = caretNode?.closest?.('td, th');
            if (!td || !blockEl.contains(td)) {
                return cfg.block && blockData.bbox ? { bbox: blockData.bbox, angle: blockData.angle_deg || 0, level: 'block' } : null;
            }
            const table = td.closest('table');
            if (!table || !window.TableModel) return null;
            const model = window.TableModel.toModel(table);
            const found = model.cells.find(c => c.dom === td);
            if (!found) return null;
            const cell = blockData.table_structure.cells.find(c => c.row === found.r && c.col === found.c);
            return cell ? { bbox: cell.bbox, angle: 0, level: 'cell' } : null;
        }

        const lines = blockData.lines || [];
        if (!lines.length) return cfg.block && blockData.bbox ? { bbox: blockData.bbox, angle: blockData.angle_deg || 0, level: 'block' } : null;

        // NEW: Flatten all words from all lines into a single continuous array.
        // We attach the parent line's bounding box to each word so we can still track lines!
        let originalWords = [];
        lines.forEach(line => {
            if (line.words) {
                line.words.forEach(w => {
                    originalWords.push({
                        ...w,
                        parentLineBbox: line.bbox,
                        parentLineAngle: (line.geometry && line.geometry.angle_deg) || 0
                    });
                });
            }
        });

        if (originalWords.length === 0) {
            return cfg.block && blockData.bbox ? { bbox: blockData.bbox, angle: blockData.angle_deg || 0, level: 'block' } : null;
        }

        // Measure the caret offset against the ENTIRE block's text, ignoring HTML tags
        const currentText = getPlainText(blockEl);
        const caretOffset = getCaretPlainTextOffset(blockEl);

        const { anchors, curTokens } = buildAnchorMap(originalWords, currentText);
        const anchor = findAnchorAtCaret(anchors, curTokens, caretOffset);

        if (anchor) {
            const origWord = originalWords[anchor.origIndex];

            // 2. Word Tracking
            if (cfg.words) {
                return { bbox: anchor.bbox, angle: (origWord.geometry && origWord.geometry.angle_deg) || 0, level: 'word' };
            }

            // 3. Line Tracking
            // If words are disabled but lines are enabled, use the parent line of the anchored word
            if (cfg.lines) {
                return { bbox: origWord.parentLineBbox, angle: origWord.parentLineAngle, level: 'line' };
            }
        }

        // 4. Block Tracking Fallback (If no words matched or neither words/lines are enabled)
        return cfg.block && blockData.bbox ? { bbox: blockData.bbox, angle: blockData.angle_deg || 0, level: 'block' } : null;
    }

    window.TextTrackingEngine = {
        normalizeWord, tokenize, diffTokens, buildAnchorMap,
        findAnchorAtCaret, getCaretPlainTextOffset, getPlainText, getHighlightBBox
    };
})();
