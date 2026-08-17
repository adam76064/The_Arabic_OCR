// block-context-menu.js
// Right-click context menu + split-block modal + block merge/split engine.
// Extracted from review.js. Load this file alongside review.js (order does not
// matter — everything here only runs from event handlers or from
// setupBlockContextMenu(), which review.js's initApp() calls after both
// scripts have loaded). Relies on globals defined in review.js:
// currentProject, currentPageIndex, selectedBlockIndex, multiSelectedBlocks,
// scaleRatioX, scaleRatioY, pushHistory, saveBlockSilently, selectBlock,
// updateReviewPanel, updateBlockSelectionUI.

const blockContextText = (key) => window.AppI18n?.t(key) || key;

const BLOCK_CONTEXT_MODALS_HTML = `
<div id="block-context-menu" class="hidden table-ctx-menu" style="position: absolute; z-index: 5000; min-width: 220px;">
    <div id="ctx-search-quran-unified" class="ctx-item">${blockContextText('block.quran')}</div>
    <div id="ctx-merge-blocks" class="ctx-item">${blockContextText('block.merge')}</div>
    <div id="ctx-split-block" class="ctx-item">${blockContextText('block.split')}</div>
</div>

<div id="split-block-modal" class="modal hidden" style="z-index: 6000;">
   <div class="modal-overlay"></div>
   <div class="modal-box" style="width: 500px; max-width: 95vw; padding: 0;">
       <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid #eee;">
           <h3 style="margin:0; font-size:16px;">${blockContextText('block.splitTitle')}</h3>
           <button class="modal-close" id="split-close">✕</button>
       </div>
       <div class="modal-body" style="padding: 20px; text-align:center;">
           <p style="font-size:13px; color:#666; margin-top:0; margin-bottom:16px;">${blockContextText('block.splitHint')}</p>
           
           <div id="split-img-container" style="position:relative; display:inline-block; border:2px dashed #cbd5e1; border-radius:6px; cursor:crosshair; max-width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow:hidden;">
               <img id="split-target-img" src="" style="display:block; max-width:100%; pointer-events:none;">
               <div id="split-line" style="position:absolute; left:0; right:0; height:2px; background:#e74c3c; top:50%; pointer-events:none; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>
           </div>
           
           <div style="margin-top:20px; display:flex; justify-content:center; gap:24px; font-size:14px; background: #f8fafc; padding: 10px; border-radius: 6px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="radio" name="split_axis" value="y" checked> ${blockContextText('block.horizontal')}</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="radio" name="split_axis" value="x"> ${blockContextText('block.vertical')}</label>
           </div>
           
           <div class="form-actions" style="margin-top:24px;">
               <button id="split-confirm" class="btn-success" style="width:100%; font-size:14px; padding:10px;">${blockContextText('block.confirmSplit')}</button>
           </div>
       </div>
   </div>
</div>
`;

// ══════════════════════════════════════════════════════════════════════
// BLOCK MERGE & SPLIT ENGINE (NEW)
// ══════════════════════════════════════════════════════════════════════
let splitBlockData = null;

function setupBlockContextMenu() {
    const menu = document.getElementById('block-context-menu');
    const splitModal = document.getElementById('split-block-modal');
    
    document.getElementById('split-close').addEventListener('click', () => splitModal.classList.add('hidden'));
    splitModal.querySelector('.modal-overlay').addEventListener('click', () => splitModal.classList.add('hidden'));

    const splitContainer = document.getElementById('split-img-container');
    const splitLine = document.getElementById('split-line');
    let lineLocked = false; // Tracks if user clicked to lock the line

    // Reset lock when changing direction (Horizontal/Vertical)
    document.querySelectorAll('input[name="split_axis"]').forEach(radio => {
        radio.addEventListener('change', () => {
            lineLocked = false;
            splitLine.style.background = '#e74c3c';
            splitLine.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';
            
            // Reset to center perfectly based on axis
            if (radio.value === 'y') {
                splitLine.style.top = '50%'; splitLine.style.left = '0px'; 
                splitLine.style.right = '0px'; splitLine.style.width = 'auto'; splitLine.style.height = '2px';
            } else {
                splitLine.style.left = '50%'; splitLine.style.top = '0px'; 
                splitLine.style.right = 'auto'; splitLine.style.width = '2px'; splitLine.style.height = '100%';
            }
            if (splitBlockData) splitBlockData.splitRatio = 0.5;
        });
    });

    // Click to Lock/Unlock the line
    splitContainer.addEventListener('click', () => {
        if (!splitBlockData) return;
        lineLocked = !lineLocked;
        // Turn green when locked, back to red when unlocked
        splitLine.style.background = lineLocked ? '#2ecc71' : '#e74c3c'; 
        splitLine.style.boxShadow = lineLocked ? '0 0 8px #2ecc71' : '0 0 4px rgba(0,0,0,0.4)';
    });

    // Interactive splitting line
    splitContainer.addEventListener('mousemove', (e) => {
        if (!splitBlockData || lineLocked) return;
        const rect = splitContainer.getBoundingClientRect();
        const isHorizontal = document.querySelector('input[name="split_axis"]:checked').value === 'y';
        
        if (isHorizontal) {
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            splitLine.style.top = y + 'px';
            splitLine.style.left = '0px';
            splitLine.style.right = '0px'; // Lock horizontal stretch
            splitLine.style.width = 'auto';
            splitLine.style.height = '2px';
            splitBlockData.splitRatio = y / rect.height;
        } else {
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            splitLine.style.left = x + 'px';
            splitLine.style.top = '0px';
            splitLine.style.right = 'auto'; // FIX: Free the right anchor so it moves!
            splitLine.style.width = '2px';
            splitLine.style.height = '100%';
            splitBlockData.splitRatio = x / rect.width;
        }
    });

    // Confirm Split
    document.getElementById('split-confirm').addEventListener('click', async () => {
        if (!splitBlockData) return;
        const page = currentProject.pages[currentPageIndex];
        const block = page.ocr_data[splitBlockData.index];
        const isHorizontal = document.querySelector('input[name="split_axis"]:checked').value === 'y';
        
        const r = splitBlockData.splitRatio;
        const [x1, y1, x2, y2] = block.bbox;
        
        let bbox1, bbox2;
        if (isHorizontal) {
            const splitY = y1 + r * (y2 - y1);
            bbox1 = [x1, y1, x2, splitY];
            bbox2 = [x1, splitY, x2, y2];
        } else {
            const splitX = x1 + r * (x2 - x1);
            bbox1 = [x1, y1, splitX, y2];
            bbox2 = [splitX, y1, x2, y2];
        }
        
        const block1 = { ...block, bbox: bbox1, text: '', reviewed: false };
        const block2 = { ...block, bbox: bbox2, text: '', reviewed: false };
        
        pushHistory(currentPageIndex);
        page.ocr_data.splice(splitBlockData.index, 1, block1, block2);

        // Re-align lines, words, and text for both split blocks from raw OCR backup
        if (window.pywebview?.api?.repopulate_page_text_from_raw) {
            try {
                const res = await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, page.ocr_data);
                if (res && res.ok && res.ocr_data) {
                    page.ocr_data = res.ocr_data;
                }
            } catch (e) {
                console.error("Failed to repopulate text for split blocks:", e);
            }
        }
        
        splitModal.classList.add('hidden');
        splitBlockData = null;
        selectBlock(-1);
        updateReviewPanel();
        saveBlockSilently();
    });

    // Right-Click trigger
    document.addEventListener('contextmenu', (e) => {
        const blockEl = e.target.closest('.text-block');
        if (!blockEl) {
            if(menu) menu.classList.add('hidden');
            return;
        }
        
        const index = parseInt(blockEl.dataset.index);
        
        // If right-clicked block isn't already multi-selected, select only it
        if (!multiSelectedBlocks.has(index)) {
            selectBlock(index);
        }
        
        // Detect if cursor is inside text for splitting
        const contentEl = e.target.closest('.block-content');
        let canSplit = false;
        
        if (contentEl && multiSelectedBlocks.size === 1) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0 && sel.anchorNode && contentEl.contains(sel.anchorNode)) {
                canSplit = true;
                const range = sel.getRangeAt(0);
                
                // Magic: Split HTML exactly at cursor
                const preRange = range.cloneRange();
                preRange.selectNodeContents(contentEl);
                preRange.setEnd(range.startContainer, range.startOffset);
                const preDiv = document.createElement('div');
                preDiv.appendChild(preRange.cloneContents());
                
                const postRange = range.cloneRange();
                postRange.selectNodeContents(contentEl);
                postRange.setStart(range.endContainer, range.endOffset);
                const postDiv = document.createElement('div');
                postDiv.appendChild(postRange.cloneContents());
                
                splitBlockData = {
                    index: index,
                    preHtml: preDiv.innerHTML.trim() || '<br>',
                    postHtml: postDiv.innerHTML.trim() || '<br>'
                };
            }
        } else {
            splitBlockData = null;
        }

        e.preventDefault();
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        menu.classList.remove('hidden');
        
        const selText = window.getSelection().toString().trim();
        const canSearchQuran = selText.length > 0;
        
        document.getElementById('ctx-search-quran-unified').style.display = canSearchQuran ? 'flex' : 'none';
        document.getElementById('ctx-merge-blocks').style.display = multiSelectedBlocks.size > 1 ? 'flex' : 'none';
        document.getElementById('ctx-split-block').style.display = canSplit ? 'flex' : 'none';
    });

    document.getElementById('ctx-search-quran-unified')?.addEventListener('click', () => {
        menu.classList.add('hidden');
        const selText = window.getSelection().toString().trim();
        if (window.saveCursorSelection && window.openQuranModal) {
            window.saveCursorSelection();
            window.openQuranModal(selText);
        }
    });

    document.addEventListener('click', (e) => {
        if (menu && !e.target.closest('#block-context-menu')) menu.classList.add('hidden');
    });
    
    document.getElementById('ctx-merge-blocks')?.addEventListener('click', () => {
        menu.classList.add('hidden');
        mergeSelectedBlocks();
    });
    
    document.getElementById('ctx-split-block')?.addEventListener('click', () => {
        menu.classList.add('hidden');
        if (!splitBlockData) return;
        
        const page = currentProject.pages[currentPageIndex];
        const block = page.ocr_data[splitBlockData.index];
        const img = document.getElementById('page-image');
        
        // Exact tight crop for the split modal
        const canvas = document.createElement('canvas');
        const [x1, y1, x2, y2] = block.bbox;
        const px = x1 * scaleRatioX, py = y1 * scaleRatioY;
        const pw = (x2 - x1) * scaleRatioX, ph = (y2 - y1) * scaleRatioY;
        
        const drawW = Math.max(pw, 1);
        const drawH = Math.max(ph, 1);
        
        canvas.width = drawW; canvas.height = drawH;
        canvas.getContext('2d').drawImage(img, px, py, drawW, drawH, 0, 0, drawW, drawH);
        
        document.getElementById('split-target-img').src = canvas.toDataURL();
        splitModal.classList.remove('hidden');
        splitBlockData.splitRatio = 0.5; 
        
        // Reset red line UI
        document.getElementById('split-line').style.top = '50%';
        document.getElementById('split-line').style.height = '2px';
        document.getElementById('split-line').style.width = '100%';
        document.getElementById('split-line').style.left = '0';
        document.querySelector('input[name="split_axis"][value="y"]').checked = true;
    });
}

function mergeSelectedBlocks() {
    if (multiSelectedBlocks.size < 2) return;
    const page = currentProject.pages[currentPageIndex];
    pushHistory(currentPageIndex);
    
    // Sort so we merge them visually top-to-bottom
    const indices = Array.from(multiSelectedBlocks).sort((a,b) => a - b);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let mergedText = [];
    let mergedLines = [];
    
    indices.forEach(idx => {
        const b = page.ocr_data[idx];
        const [x1, y1, x2, y2] = b.bbox;
        minX = Math.min(minX, x1); minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
        mergedText.push(b.text || '');
        if (b.lines && b.lines.length) {
            mergedLines.push(...JSON.parse(JSON.stringify(b.lines)));
        }
    });
    
    const firstIdx = indices[0];
    const baseBlock = page.ocr_data[firstIdx];
    
    const newBlock = {
        ...baseBlock,
        bbox: [minX, minY, maxX, maxY],
        text: mergedText.join('<br>'),
        lines: mergedLines,
        reviewed: false
    };
    
    for (let i = indices.length - 1; i >= 0; i--) {
        page.ocr_data.splice(indices[i], 1);
    }
    
    page.ocr_data.splice(firstIdx, 0, newBlock);

    // Re-align lines and word tracking for merged block from raw OCR backup
    if (window.pywebview?.api?.repopulate_page_text_from_raw) {
        window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, page.ocr_data)
            .then(res => {
                if (res && res.ok && res.ocr_data) {
                    page.ocr_data = res.ocr_data;
                    updateReviewPanel();
                }
            }).catch(e => console.error("Repopulate merge failed:", e));
    }
    
    selectBlock(firstIdx);
    updateReviewPanel(); 
    saveBlockSilently();
}

