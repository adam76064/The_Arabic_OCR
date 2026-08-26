/**
 * pages/layout-editor/toolbar.js - extracted from monolith
 */

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

    document.getElementById('tool-flowlines')?.addEventListener('click', (e) => {
        window.showReadingFlowlines = !window.showReadingFlowlines;
        e.currentTarget.classList.toggle('active-tool', window.showReadingFlowlines);
        if (typeof drawCanvas === 'function') drawCanvas();
    });

    document.getElementById('btn-delete')?.addEventListener('click', () => { saveHistoryState(); deleteSelected(); });
    document.getElementById('btn-merge')?.addEventListener('click', () => { saveHistoryState(); mergeSelected(); });

    document.getElementById('btn-save')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-save');
        const originalText = btn.textContent;
        
        btn.disabled = true; 
        btn.textContent = 'جاري الحفظ...';
        
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
            
            btn.textContent = 'تم الحفظ';
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

function deleteSelected() {
    if (selectedBoxes.size === 0) return;
    const indices = Array.from(selectedBoxes).sort((a, b) => b - a);
    indices.forEach(idx => ocrData.splice(idx, 1));
    selectedBoxes.clear(); updateSelectionUI(); drawCanvas();
    autoSaveLayoutData(); // <-- ADDED
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

