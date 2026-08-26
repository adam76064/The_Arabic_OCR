// canvas-rendering.js
// Draws OCR block bounding boxes on the page/thumbnail canvases, and
// handles clicks on the main bbox canvas to select blocks.
// Extracted from review.js. Load alongside review.js (order doesn't matter --
// nothing here runs until an event fires, by which point both scripts have
// loaded). Relies on globals from review.js: currentProject, currentPageIndex,
// selectedBlockIndex, multiSelectedBlocks, scaleRatioX, scaleRatioY,
// CATEGORY_COLORS, selectBlock, updateBlockSelectionUI, closeFullPageView.

// ===== CANVAS RENDERING =====

// Shared by drawBoxes and the tracking highlight below: draws a rect
// rotated around its own center, matching how the OCR reports angle_deg
// per block/line/word.
function withRotatedRect(ctx, px, py, pw, ph, angleDeg, drawFn) {
    const cx = px + pw / 2, cy = py + ph / 2;
    const rad = ((angleDeg || 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    if (angleDeg) ctx.rotate(rad);
    ctx.beginPath();
    ctx.rect(-pw / 2, -ph / 2, pw, ph);
    drawFn();
    ctx.restore();
}

// Word/line/cell tracking highlight — set via setTrackingHighlight(), drawn
// on top of the block boxes whenever the bbox-canvas is (re)rendered.
let currentTrackingHighlight = null;

function setTrackingHighlight(highlight) {
    currentTrackingHighlight = highlight;
    if (!currentProject?.pages[currentPageIndex]) return;
    renderBboxes(currentProject.pages[currentPageIndex].ocr_data || [], selectedBlockIndex);
}

function drawTrackingHighlight(canvas, highlight) {
    if (!highlight?.bbox) return;
    const ctx = canvas.getContext('2d');
    const scale = canvas.clientWidth ? canvas.clientWidth / canvas.width : 1;
    const [x1, y1, x2, y2] = highlight.bbox;
    const px = x1 * scaleRatioX, py = y1 * scaleRatioY;
    const pw = (x2 - x1) * scaleRatioX, ph = (y2 - y1) * scaleRatioY;

    withRotatedRect(ctx, px, py, pw, ph, highlight.angle, () => {
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = '#00e5ff';
        ctx.setLineDash([6 / scale, 4 / scale]);
        ctx.stroke();
    });
}

function drawBoxes(canvas, ocrData, selectedIndex) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.clientWidth ? canvas.clientWidth/canvas.width : 1;

    ocrData.forEach((el, i) => {
        // التصحيح التلقائي لإطار الجدول
        if ((el.category === 'Table' || el.category === 'Vertical-poetry') && el.table_structure && el.table_structure.cells && el.table_structure.cells.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            el.table_structure.cells.forEach(cell => {
                if (cell.bbox && cell.bbox.length === 4) {
                    minX = Math.min(minX, cell.bbox[0]); minY = Math.min(minY, cell.bbox[1]);
                    maxX = Math.max(maxX, cell.bbox[2]); maxY = Math.max(maxY, cell.bbox[3]);
                }
            });
            if (minX !== Infinity) el.bbox = [minX, minY, maxX, maxY];
        }

        const [x1, y1, x2, y2] = el.bbox;
        const px = x1 * scaleRatioX, py = y1 * scaleRatioY;
        const pw = (x2 - x1) * scaleRatioX, ph = (y2 - y1) * scaleRatioY;
        const angle = el.angle_deg || (el.geometry && el.geometry.angle_deg) || 0;
        const color = getCategoryColors()[el.category || 'Text'] || '#3498db';

        // تتبع الخلايا النشطة حالياً في محرر النصوص
        let activeCellIndices = new Set();
        if (typeof activeEditingIndex !== 'undefined' && i === activeEditingIndex) {
            if (window.TableSelection && window.TableSelection.selected && window.TableSelection.selected.length > 0) {
                window.TableSelection.selected.forEach(td => {
                    if (td.dataset.cidx !== undefined) activeCellIndices.add(parseInt(td.dataset.cidx));
                });
            } else {
                const activeTd = document.activeElement?.closest('td');
                if (activeTd && activeTd.dataset.cidx !== undefined) activeCellIndices.add(parseInt(activeTd.dataset.cidx));
            }
        }

        withRotatedRect(ctx, px, py, pw, ph, angle, () => {
            // رسم الكتلة الأساسية
            if (i === selectedIndex || (typeof multiSelectedBlocks !== 'undefined' && multiSelectedBlocks.has(i))) {
                ctx.lineWidth = 4/scale; ctx.strokeStyle='#f1c40f'; ctx.fillStyle='rgba(241,196,15,0.35)';
            } else if (el.reviewed) {
                ctx.lineWidth = 2/scale; ctx.strokeStyle='#27ae60'; ctx.fillStyle='rgba(39,174,96,0.12)';
            } else {
                ctx.lineWidth = 2/scale; ctx.strokeStyle=color; ctx.fillStyle=color+'22';
            }
            ctx.stroke(); ctx.fill();

            // رسم خلايا الجدول الداخلية
            if ((el.category === 'Table' || el.category === 'Vertical-poetry') && el.table_structure && el.table_structure.cells) {
                const cx = px + pw / 2;
                const cy = py + ph / 2;
                
                // === الجديد: لون حدود الجدول يتطابق الآن مع حالة الكتلة (محددة أو عادية) ===
                ctx.strokeStyle = (i === selectedIndex || (typeof multiSelectedBlocks !== 'undefined' && multiSelectedBlocks.has(i))) ? '#f1c40f' : color;
                ctx.lineWidth = 1.2 / scale;
                
                el.table_structure.cells.forEach((cell, cIdx) => {
                    if (!cell.bbox || cell.bbox.length !== 4) return;
                    const [cx1, cy1, cx2, cy2] = cell.bbox;
                    
                    const cpx = cx1 * scaleRatioX; const cpy = cy1 * scaleRatioY;
                    const cpw = (cx2 - cx1) * scaleRatioX; const cph = (cy2 - cy1) * scaleRatioY;

                    ctx.beginPath();
                    ctx.rect(cpx - cx, cpy - cy, cpw, cph);
                    
                    // === الجديد: تظليل الخلية إذا كانت نشطة في محرر النصوص ===
                    if (activeCellIndices.has(cIdx)) {
                        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // أزرق مميز
                        ctx.fill();
                    }
                    ctx.stroke();
                });
            }
        });
    });

    if (canvas.id === 'bbox-canvas' && typeof currentTrackingHighlight !== 'undefined') {
        drawTrackingHighlight(canvas, currentTrackingHighlight);
    }
}

let _rafBboxesId = null;
let _pendingBboxesData = null;
let _pendingBboxesSel = null;

function renderBboxes(ocrData, sel) {
    _pendingBboxesData = ocrData;
    _pendingBboxesSel = sel;
    if (_rafBboxesId) return;
    _rafBboxesId = requestAnimationFrame(() => {
        _rafBboxesId = null;
        const c = document.getElementById('bbox-canvas');
        if (c && _pendingBboxesData) drawBoxes(c, _pendingBboxesData, _pendingBboxesSel);
    });
}

let _rafThumbId = null;
let _pendingThumbArgs = null;

function renderThumbCanvas(canvasId, imgId, ocrData, sel) {
    _pendingThumbArgs = { canvasId, imgId, ocrData, sel };
    if (_rafThumbId) return;
    _rafThumbId = requestAnimationFrame(() => {
        _rafThumbId = null;
        if (!_pendingThumbArgs) return;
        const { canvasId, imgId, ocrData, sel } = _pendingThumbArgs;
        const canvas = document.getElementById(canvasId);
        const img = document.getElementById(imgId);
        if (!canvas || !img?.naturalWidth) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        drawBoxes(canvas, ocrData, sel);
    });
}

function handleCanvasClick(e, canvas) {
    if (!currentProject?.pages[currentPageIndex]) return;
    const ocrData = currentProject.pages[currentPageIndex].ocr_data || [];
    const clickX = e.offsetX * (canvas.width / canvas.clientWidth);
    const clickY = e.offsetY * (canvas.height / canvas.clientHeight);
    let hit = -1;
    let clickedCellIndex = -1;
    
    // 1. تحديد الكتلة والخلية التي تم النقر عليها بدقة
    for (let i = ocrData.length-1; i >= 0; i--) {
        const el = ocrData[i];
        const [x1,y1,x2,y2] = el.bbox;
        const px = x1*scaleRatioX, py = y1*scaleRatioY;
        const pw = (x2-x1)*scaleRatioX, ph = (y2-y1)*scaleRatioY;
        
        const cx = px + pw/2, cy = py + ph/2;
        const angle = el.angle_deg || (el.geometry && el.geometry.angle_deg) || 0;
        
        let testX = clickX, testY = clickY;
        if (angle) {
            const rad = -(angle * Math.PI) / 180; 
            const dx = clickX - cx, dy = clickY - cy;
            testX = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
            testY = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
        }

        if (testX >= px && testX <= px + pw && testY >= py && testY <= py + ph) { 
            hit = i; 
            
            if (el.category === 'Table' && el.table_structure && el.table_structure.cells) {
                for (let cIdx = 0; cIdx < el.table_structure.cells.length; cIdx++) {
                    const cell = el.table_structure.cells[cIdx];
                    if (!cell.bbox) continue;
                    const [cx1, cy1, cx2, cy2] = cell.bbox;
                    const cpx = cx1 * scaleRatioX, cpy = cy1 * scaleRatioY;
                    const cpw = (cx2 - cx1) * scaleRatioX, cph = (cy2 - cy1) * scaleRatioY;
                    
                    if (testX >= cpx && testX <= cpx + cpw && testY >= cpy && testY <= cpy + cph) {
                        clickedCellIndex = cIdx;
                        break;
                    }
                }
            }
            break; 
        }
    }
    
    // 2. معالجة التحديد
    if (e.ctrlKey || e.metaKey) {
        if (hit !== -1) {
            if (typeof multiSelectedBlocks !== 'undefined' && multiSelectedBlocks.has(hit)) {
                multiSelectedBlocks.delete(hit);
                selectedBlockIndex = multiSelectedBlocks.size > 0 ? Array.from(multiSelectedBlocks)[0] : -1;
            } else if (typeof multiSelectedBlocks !== 'undefined') {
                multiSelectedBlocks.add(hit);
                selectedBlockIndex = hit;
            }
            if (typeof updateBlockSelectionUI === 'function') updateBlockSelectionUI();
        }
    } else if (e.shiftKey && selectedBlockIndex !== -1 && hit !== -1) {
        const start = Math.min(selectedBlockIndex, hit);
        const end = Math.max(selectedBlockIndex, hit);
        if (typeof multiSelectedBlocks !== 'undefined') {
            multiSelectedBlocks.clear();
            for(let i=start; i<=end; i++) multiSelectedBlocks.add(i);
        }
        selectedBlockIndex = hit;
        if (typeof updateBlockSelectionUI === 'function') updateBlockSelectionUI();
    } else {
        if (typeof selectBlock === 'function') selectBlock(hit);
        
        // 3. الحل الجذري: إجبار المتصفح على وضع مؤشر الكتابة داخل الخلية!
        if (hit !== -1 && clickedCellIndex !== -1) {
            setTimeout(() => {
                const wrapper = document.querySelector(`.text-block[data-index="${hit}"]`);
                if (wrapper) {
                    const td = wrapper.querySelector(`td[data-cidx="${clickedCellIndex}"]`);
                    if (td) {
                        // استخدام Selection API لزرع المؤشر برمجياً داخل النص
                        const sel = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(td);
                        range.collapse(false); // وضع المؤشر في نهاية النص لتسهيل التعديل
                        sel.removeAllRanges();
                        sel.addRange(range);
                        
                        // تحديث أداة تحديد الجداول لتعرف الخلية النشطة
                        if (window.TableSelection) {
                            window.TableSelection.anchorCell = td;
                            window.TableSelection.selected = [td];
                        }
                        
                        // إعادة رسم الـ Canvas ليظهر التظليل الأزرق المضيء
                        if (typeof renderBboxes === 'function') {
                            renderBboxes(ocrData, hit);
                        }
                    }
                }
            }, 120); // تأخير 120ms لضمان اكتمال حركة التمرير الناعمة (Smooth Scroll)
        }
    }
    
    // 4. إغلاق نوافذ العرض الكبيرة تلقائياً
    if (hit !== -1) {
        if (typeof closeFullPageView === 'function') closeFullPageView();
    }
}

document.addEventListener('click', (e) => {
    const canvas = document.getElementById('bbox-canvas');
    if (canvas && e.target === canvas) handleCanvasClick(e, canvas);
});

