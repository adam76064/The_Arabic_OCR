/**
 * pages/layout-editor/canvas.js - extracted from monolith
 */

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

function getMouseCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

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

    // Visual Reading Flowlines
    if (window.showReadingFlowlines && ocrData && ocrData.length > 1) {
        ctx.save();
        ctx.lineWidth = 2.5 / scale;
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.85)';
        ctx.setLineDash([6 / scale, 4 / scale]);

        for (let i = 0; i < ocrData.length - 1; i++) {
            const b1 = ocrData[i].bbox;
            const b2 = ocrData[i+1].bbox;
            const c1x = (b1[0] + (b1[2]-b1[0])/2) * scaleRatioX;
            const c1y = (b1[1] + (b1[3]-b1[1])/2) * scaleRatioY;
            const c2x = (b2[0] + (b2[2]-b2[0])/2) * scaleRatioX;
            const c2y = (b2[1] + (b2[3]-b2[1])/2) * scaleRatioY;

            ctx.beginPath();
            ctx.moveTo(c1x, c1y);
            // Smooth curve
            const cpX = (c1x + c2x) / 2;
            const cpY = Math.min(c1y, c2y) - 20;
            ctx.quadraticCurveTo(cpX, cpY, c2x, c2y);
            ctx.stroke();

            // Draw center dot
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.arc(c1x, c1y, 4 / scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

