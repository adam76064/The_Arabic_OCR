/**
 * pages/review/preview.js - text preview overlay, notifications, lan updates, dashboard
 */

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

(function setupTextPreview() {
    const rawToggle = document.getElementById('text-preview-raw-toggle');
    function buildPreviewHTML() {
        const logicalStart = currentProject?.metadata?.logical_start || 1;
        const raw = rawToggle.checked;
        return currentProject.pages.map((page, i) => {
            const blocksHtml = (page.ocr_data || []).map((el, bIndex) => {
                if (el.category === 'Picture') return '';
                
                // RENDER FULLY FUNCTIONAL TABLES IN PREVIEW
                if (isTableLike(el.category) && el.table_structure) {
                    let grid = Array.from({length: el.table_structure.rows || 1}, () => []);
                    el.table_structure.cells.forEach(c => {
                        if(grid[c.row]) grid[c.row][c.col] = c;
                    });
                    
                    let tableHtml = `<table class="review-table layout-table-overlay" dir="ltr" style="width:100%; border-collapse:collapse; margin-top:8px; background:white;"><tbody>`;
                    for(let r=0; r<(el.table_structure.rows || 1); r++) {
                        tableHtml += `<tr>`;
                        for(let c=0; c<(el.table_structure.cols || 1); c++) {
                            let cell = grid[r] && grid[r][c];
                            if (cell) {
                                let rs = cell.row_span > 1 ? ` rowspan="${cell.row_span}"` : '';
                                let cs = cell.col_span > 1 ? ` colspan="${cell.col_span}"` : '';
                                let align = cell.align || el.align || ( (cell.dir || el.dir || 'rtl') === 'rtl' ? 'right' : 'left' );
                                let dir = cell.dir || el.dir || 'rtl';
                                let border = cell.border || '2px solid #d35400';
                                let bg = cell.bg_color ? ` background-color:${cell.bg_color};` : '';
                                let valign = cell.valign ? ` vertical-align:${cell.valign};` : '';
                                tableHtml += `<td${rs}${cs} style="border:${border}; padding:8px; text-align:${align};${bg}${valign}" dir="${dir}">${cell.text || '<br>'}</td>`;
                            }
                        }
                        tableHtml += `</tr>`;
                    }
                    tableHtml += `</tbody></table>`;
                    return `<div class="preview-block-chunk" data-block-index="${bIndex}" style="margin-bottom: 6px;">${tableHtml}</div>`;
                }

                // Normal Text Rendering
                const t = el.text || '';
                let innerHTML = '';
                if (raw) innerHTML = `<p>${escapeHtml(t)}</p>`;
                else { try { innerHTML = window.marked ? window.marked.parse(t) : `<p>${escapeHtml(t)}</p>`; } catch { innerHTML = `<p>${escapeHtml(t)}</p>`; } }
                return `<div class="preview-block-chunk" data-block-index="${bIndex}" style="margin-bottom: 6px;">${innerHTML}</div>`;
            }).join('');
            return `<div class="preview-page" data-page-index="${i}">` +
                   `<div class="preview-page-sep" contenteditable="false" style="color:#999;font-size:13px;margin:18px 0 8px;user-select:none;">── صفحة ${i + logicalStart} ──</div>` +
                   blocksHtml + `</div>`;
        }).join('');
    }

    function renderPreview() { document.getElementById('text-preview-body').innerHTML = buildPreviewHTML(); }
    document.getElementById('text-preview-btn').addEventListener('click', () => { renderPreview(); document.getElementById('text-preview-overlay').classList.remove('hidden'); });
    rawToggle.addEventListener('change', () => { if (!document.getElementById('text-preview-overlay').classList.contains('hidden')) renderPreview(); });
    document.getElementById('text-preview-close').addEventListener('click', () => { document.getElementById('text-preview-overlay').classList.add('hidden'); });

    document.getElementById('text-preview-save').addEventListener('click', () => {
        const isRaw = rawToggle.checked;
        const touchedPages = new Set();
        document.querySelectorAll('#text-preview-body .preview-page').forEach(pageDiv => {
            const pIndex = parseInt(pageDiv.dataset.pageIndex);
            if (!currentProject.pages[pIndex]) return;
            const page = currentProject.pages[pIndex];
            
            pageDiv.querySelectorAll('.preview-block-chunk').forEach(chunkDiv => {
                const bIndex = parseInt(chunkDiv.dataset.blockIndex);
                const target = page.ocr_data[bIndex];
                if (!target) return;

                // HANDLE TABLE SAVING VS TEXT SAVING
                if (target.category === 'Table' && target.table_structure) {
                    const changed = syncElementFromContent(target, chunkDiv);
                    if (changed) {
                        if (!touchedPages.has(pIndex)) { pushHistory(pIndex); touchedPages.add(pIndex); }
                        if (window.__appSettings?.autoMarkReviewed !== false) target.reviewed = true;
                    }
                } else {
                    const newText = isRaw ? chunkDiv.textContent.trim() : chunkDiv.innerHTML.trim();
                    if (newText !== target.text) {
                        if (!touchedPages.has(pIndex)) { pushHistory(pIndex); touchedPages.add(pIndex); }
                        target.text = newText;
                        if (window.__appSettings?.autoMarkReviewed !== false) target.reviewed = true;
                    }
                }
            });
        });

        const touchedArr = Array.from(touchedPages);
        if (touchedArr.length > 0) {
            Promise.all(touchedArr.map(i => window.pywebview.api.update_page_ocr(currentProject.id, i, currentProject.pages[i].ocr_data || [])))
            .then(() => { showNotif('تم حفظ التعديلات في الكتل الخاصة بها ✓', 'success'); updateReviewPanel(); })
            .catch(() => showNotif('حدث خطأ أثناء الحفظ', 'error'));
        } else { showNotif('لم يتم إجراء أي تعديلات للحفظ', 'info'); }
        document.getElementById('text-preview-overlay').classList.add('hidden');
    });
})();




function showNotif(msg, type = 'info') {
    const colors = { info:'#3498db', success:'#27ae60', error:'#e74c3c', warning:'#f39c12' };
    const tray = document.getElementById('notif-tray');
    const n = document.createElement('div');
    n.style.cssText = `background:${colors[type]||colors.info};color:white;padding:10px 16px;border-radius:8px; font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);max-width:280px;cursor:pointer; animation:slideIn 0.25s ease;`;
    n.textContent = msg;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 5000);
}

window.showNotif = showNotif;

window.onLanUpdate = function(payload) {
    if (!currentProject?.metadata) return;
    const meta = currentProject.metadata;
    const type = payload.type;
    if ((type === 'presence' || type === 'user_joining' || type === 'user_leaving') && (meta.notif_join !== false)) {
        if (type === 'user_joining' || (type === 'presence' && payload.status === 'join')) {
            showNotif(`👤 ${payload.username || 'عضو جديد'} انضم إلى المجموعة السحابية`, 'info');
        } else if (type === 'user_leaving' || (type === 'presence' && payload.status === 'leave')) {
            showNotif(`👤 ${payload.username || 'عضو'} غادر المجموعة السحابية`, 'info');
        }
    }
    if (type === 'sync_update') {
        if (meta.notif_edit !== false) showNotif(`✏️ ${payload.username || 'مستخدم سحابي'} عدّل صفحة ${(payload.page_index||0)+1}`, 'info');
        const pg = currentProject?.pages[payload.page_index];
        if (pg) { 
            pg.ocr_data = payload.ocr_data; 
            if (payload.page_index === currentPageIndex && typeof updateReviewPanel === 'function') {
                updateReviewPanel(); 
            }
        }
    }
};

;(function setupDashboard() {
    document.getElementById('dashboard-btn')?.addEventListener('click', () => {
        if (currentProject) window.location.href = `project-dashboard.html?id=${currentProject.id}`;
    });
})();

window.persistBrushEdit = async function(contentEl) {
    if (contentEl.id === 'text-preview-body') return;
    const blockEl = contentEl.closest('.text-block');
    const idx = parseInt(blockEl?.dataset.index);
    if (!isNaN(idx) && currentProject?.pages[currentPageIndex]) {
        const el = currentProject.pages[currentPageIndex].ocr_data[idx];
        if (el) {
            pushHistory(currentPageIndex);
            syncElementFromContent(el, contentEl);
            
            if (window.__appSettings?.autoMarkReviewed !== false) {
                el.reviewed = true; 
                const reviewBtn = blockEl?.querySelector('.block-review-btn');
                if (reviewBtn) { reviewBtn.textContent = '✔ تمت'; reviewBtn.classList.add('reviewed'); }
            }

            await autoSaveBlock();
            refreshIndicatorsFor(blockEl, el);
        }
    }
};

