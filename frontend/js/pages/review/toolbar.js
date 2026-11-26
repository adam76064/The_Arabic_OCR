/**
 * pages/review/toolbar.js - toolbar setup (navigation, thumbnail, save)
 * Extracted from review.js
 */

function setupToolbar() {
    document.getElementById('prev-page')?.addEventListener('click', () => navigatePage(-1));
    document.getElementById('next-page')?.addEventListener('click', () => navigatePage(1));
    document.getElementById('undo-btn')?.addEventListener('click', performUndo);
    document.getElementById('redo-btn')?.addEventListener('click', performRedo);

    // Prevent focus loss when clicking toolbar buttons
    document.querySelectorAll('#sticky-toolbar button, .formatting-toolbar-group button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.type !== 'color') {
                e.preventDefault();
            }
        });
    });

    document.getElementById('thumb-popup-canvas')?.addEventListener('click', (e) => {
        handleCanvasClick(e, document.getElementById('thumb-popup-canvas'));
    });

    document.getElementById('toolbar-thumb-wrapper')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('thumb-popup-canvas')) return;
        openFullPageView();
    });

    document.getElementById('save-page')?.addEventListener('click', async (e) => {
        // 1. Force sync of the currently active block before saving
        if (activeEditingIndex !== -1 && currentProject?.pages[currentPageIndex]) {
            const el = currentProject.pages[currentPageIndex].ocr_data[activeEditingIndex];
            const contentEl = document.querySelector(`.text-block[data-index="${activeEditingIndex}"] .block-content`);
            if (el && contentEl && typeof syncElementFromContent === 'function') {
                syncElementFromContent(el, contentEl);
            }
        }
        
        // 2. Execute Save
        const btn = e.currentTarget;
        btn.disabled = true;
        await saveBlockSilently();
        window.markPageDirty(false);
        if (typeof showNotif === 'function') showNotif(window.AppI18n.t('review.pageSaved'), 'success');
        setTimeout(() => btn.disabled = false, 500);
    });

    // Integrity Audit Modal logic
    document.getElementById('integrity-audit-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('integrity-audit-modal');
        if (modal) modal.classList.remove('hidden');
    });

    document.getElementById('integrity-audit-close')?.addEventListener('click', () => {
        document.getElementById('integrity-audit-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-run-audit')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-run-audit');
        const loading = document.getElementById('audit-loading');
        const results = document.getElementById('audit-results');
        const projId = currentProject?.id || (typeof currentProjectId !== 'undefined' ? currentProjectId : null);
        if (!btn || !projId) return;

        const scope = document.querySelector('input[name="audit-scope"]:checked')?.value || 'current';
        const pageIndices = (scope === 'current') ? [currentPageIndex] : null;

        const ignoreKashida = document.getElementById('audit-opt-kashida')?.checked ?? true;
        const strictTashkeel = document.getElementById('audit-opt-strict-tashkeel')?.checked ?? true;
        const auditOptions = {
            ignore_kashida: ignoreKashida,
            ignore_tashkeel: !strictTashkeel,
        };

        btn.disabled = true;
        loading.classList.remove('hidden');
        results.classList.add('hidden');

        try {
            const report = await window.pywebview.api.audit_project_integrity(projId, pageIndices, null, auditOptions);
            loading.classList.add('hidden');
            if (!report || !report.ok) {
                alert('فشل التدقيق: ' + (report?.error || 'خطأ غير معروف'));
                return;
            }

            results.classList.remove('hidden');
            const pct = report.match_percentage ?? 100.0;
            const isMatch = report.is_verbatim_match;

            const pctEl = document.getElementById('audit-match-pct');
            const badgeEl = document.getElementById('audit-match-badge');
            const cardEl = document.getElementById('audit-score-card');

            pctEl.textContent = `${pct}%`;
            if (isMatch || pct === 100.0) {
                cardEl.style.background = 'rgba(39, 174, 96, 0.12)';
                cardEl.style.border = '1px solid rgba(39, 174, 96, 0.3)';
                pctEl.style.color = '#27ae60';
                badgeEl.style.background = '#27ae60';
                badgeEl.style.color = '#fff';
                badgeEl.textContent = 'تطابق تام 100% (Verbatim Match)';
            } else if (pct >= 95.0) {
                cardEl.style.background = 'rgba(243, 156, 18, 0.12)';
                cardEl.style.border = '1px solid rgba(243, 156, 18, 0.3)';
                pctEl.style.color = '#d68910';
                badgeEl.style.background = '#d68910';
                badgeEl.style.color = '#fff';
                badgeEl.textContent = 'تطابق مرتفع جداً مع بعض التفاوت';
            } else {
                cardEl.style.background = 'rgba(231, 76, 60, 0.12)';
                cardEl.style.border = '1px solid rgba(231, 76, 60, 0.3)';
                pctEl.style.color = '#e74c3c';
                badgeEl.style.background = '#e74c3c';
                badgeEl.style.color = '#fff';
                badgeEl.textContent = 'تفاوت ملحوظ بين النص والأصل';
            }

            document.getElementById('audit-src-hash').textContent = report.source_hash || '—';
            document.getElementById('audit-tgt-hash').textContent = report.target_hash || '—';
            const srcMerkleEl = document.getElementById('audit-src-merkle');
            if (srcMerkleEl) srcMerkleEl.textContent = report.source_merkle_root || '—';
            const tgtMerkleEl = document.getElementById('audit-tgt-merkle');
            if (tgtMerkleEl) tgtMerkleEl.textContent = report.target_merkle_root || '—';

            const discSection = document.getElementById('audit-discrepancies-section');
            const discList = document.getElementById('audit-discrepancies-list');
            const discCount = document.getElementById('audit-disc-count');

            const discrepancies = report.discrepancies || [];
            if (discrepancies.length > 0) {
                discSection.classList.remove('hidden');
                discCount.textContent = report.total_discrepancy_count || discrepancies.length;
                discList.innerHTML = discrepancies.map(d => {
                    return `<div style="padding: 6px 10px; background: var(--color-surface); border-radius: 4px; border-inline-start: 3px solid var(--color-danger);">
                        <div style="font-weight: 600; color: var(--color-text-secondary); font-size: 11px;">النوع: ${d.type}</div>
                        <div style="color: var(--color-danger); text-decoration: line-through;">الأصل: "${d.source_segment || ''}"</div>
                        <div style="color: var(--color-success);">الحالي: "${d.target_segment || ''}"</div>
                    </div>`;
                }).join('');
            } else {
                discSection.classList.add('hidden');
            }
        } catch (err) {
            console.error('Audit failed', err);
            loading.classList.add('hidden');
            alert('خطأ أثناء فحص السلامة: ' + err);
        } finally {
            btn.disabled = false;
        }
    });

    // ── Filmstrip Navigator (UI-R4 / G-4) ──
    const toggleFilmstripBtn = document.getElementById('toggle-filmstrip-btn');
    const filmstrip = document.getElementById('review-filmstrip');
    if (toggleFilmstripBtn && filmstrip) {
        toggleFilmstripBtn.addEventListener('click', () => {
            filmstrip.classList.toggle('hidden');
        });
    }

    // ── Keyboard Shortcut Cheat Sheet Modal (UI-R9) ──
    const cheatModal = document.getElementById('shortcuts-cheat-modal');
    const openCheatBtn = document.getElementById('btn-cheat-sheet');
    const closeCheatBtn = document.getElementById('shortcuts-cheat-close');
    const cheatOverlay = document.getElementById('shortcuts-cheat-overlay');

    const toggleCheatSheet = () => {
        cheatModal?.classList.toggle('hidden');
    };

    openCheatBtn?.addEventListener('click', toggleCheatSheet);
    closeCheatBtn?.addEventListener('click', () => cheatModal?.classList.add('hidden'));
    cheatOverlay?.addEventListener('click', () => cheatModal?.classList.add('hidden'));

    window.addEventListener('keydown', (e) => {
        // Alt+Left / Alt+Right for Page Filmstrip Navigation (UI-R4)
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            const step = (e.key === 'ArrowRight') ? 1 : -1;
            navigatePage(step);
            return;
        }

        // '?' opens shortcuts cheat sheet (UI-R9)
        if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const ae = document.activeElement;
            const isTyping = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
            if (!isTyping) {
                e.preventDefault();
                toggleCheatSheet();
            }
        }
    });

    // ── Search & Replace Bar (F-1 / UI-R5) ──
    const searchDrawer = document.getElementById('project-search-bar');
    const openSearchBtn = document.getElementById('btn-open-search');
    const closeSearchBtn = document.getElementById('btn-close-search');
    const searchInput = document.getElementById('proj-search-input');
    const replaceInput = document.getElementById('proj-replace-input');
    const searchCountEl = document.getElementById('search-results-count');

    const toggleSearch = () => {
        if (!searchDrawer) return;
        const isHidden = searchDrawer.classList.toggle('hidden');
        if (!isHidden && searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    };

    openSearchBtn?.addEventListener('click', toggleSearch);
    closeSearchBtn?.addEventListener('click', () => searchDrawer?.classList.add('hidden'));

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            toggleSearch();
        }
    });

    document.getElementById('btn-do-search')?.addEventListener('click', async () => {
        const query = searchInput?.value?.trim();
        if (!query || !currentProject) return;
        const isRegex = document.getElementById('search-opt-regex')?.checked || false;
        try {
            const api = window.AppApi || window.pywebview?.api;
            let results = [];
            if (api?.search_project) {
                results = await api.search_project(currentProject.id, query, isRegex);
            } else {
                // Client-side search across loaded project pages
                currentProject.pages.forEach((p, pIdx) => {
                    (p.ocr_data || []).forEach((b, bIdx) => {
                        const txt = b.text || '';
                        if (txt.includes(query)) {
                            results.push({ page_index: pIdx, block_index: bIdx });
                        }
                    });
                });
            }
            if (searchCountEl) searchCountEl.textContent = `${results.length} نتيجة`;
            if (results.length > 0) {
                // Navigate to first match
                window.goToPage?.(results[0].page_index);
            }
        } catch (err) {
            console.error('Search error', err);
        }
    });

    document.getElementById('btn-do-replace-all')?.addEventListener('click', async () => {
        const findText = searchInput?.value?.trim();
        const repText = replaceInput?.value ?? '';
        if (!findText || !currentProject) return;
        const isRegex = document.getElementById('search-opt-regex')?.checked || false;
        try {
            const api = window.AppApi || window.pywebview?.api;
            if (api?.replace_in_project) {
                const res = await api.replace_in_project(currentProject.id, findText, repText, isRegex);
                if (res?.ok) {
                    if (searchCountEl) searchCountEl.textContent = `تم استبدال ${res.replacement_count || 0}`;
                    if (typeof updateReviewPanel === 'function') updateReviewPanel();
                }
            } else {
                let replaced = 0;
                currentProject.pages.forEach(p => {
                    (p.ocr_data || []).forEach(b => {
                        if (b.text && b.text.includes(findText)) {
                            b.text = b.text.replaceAll(findText, repText);
                            replaced++;
                        }
                    });
                });
                if (searchCountEl) searchCountEl.textContent = `تم استبدال ${replaced}`;
                window.markPageDirty(true);
                if (typeof updateReviewPanel === 'function') updateReviewPanel();
            }
        } catch (err) {
            console.error('Replace error', err);
        }
    });
}

function markPageDirty(dirty = true) {
    const pill = document.getElementById('save-status-pill');
    const txt = document.getElementById('save-status-text');
    if (!pill || !txt) return;
    if (dirty) {
        pill.className = 'save-status-pill dirty';
        txt.textContent = '● غير محفوظ (Ctrl+S)';
    } else {
        pill.className = 'save-status-pill saved';
        txt.textContent = '✓ تم الحفظ';
    }
}
window.markPageDirty = markPageDirty;

function renderReviewFilmstrip() {
    const area = document.getElementById('filmstrip-scroll-area');
    if (!area || !currentProject?.pages) return;
    area.innerHTML = '';
    currentProject.pages.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = `filmstrip-item ${idx === currentPageIndex ? 'current' : ''}`;
        item.dataset.index = idx;
        const thumbUrl = window.__appDataPath 
            ? `file:///${window.__appDataPath}/projects/${currentProject.id}/thumbs/${p.image_path}` 
            : `projects/${currentProject.id}/thumbs/${p.image_path}`;
        const fallbackUrl = window.__appDataPath 
            ? `file:///${window.__appDataPath}/projects/${currentProject.id}/images/${p.image_path}` 
            : `projects/${currentProject.id}/images/${p.image_path}`;

        item.innerHTML = `
            <img src="${thumbUrl}" alt="P${idx+1}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackUrl}';">
            <span class="filmstrip-badge">${idx + 1}</span>
        `;
        item.addEventListener('click', () => {
            window.goToPage?.(idx);
        });
        area.appendChild(item);
    });
}
window.renderReviewFilmstrip = renderReviewFilmstrip;

function updateFilmstripHighlight() {
    document.querySelectorAll('.filmstrip-item').forEach(item => {
        const idx = parseInt(item.dataset.index, 10);
        item.classList.toggle('current', idx === currentPageIndex);
    });
}
window.updateFilmstripHighlight = updateFilmstripHighlight;

window.setupToolbar = setupToolbar;
