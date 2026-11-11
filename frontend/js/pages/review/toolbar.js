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
}

window.setupToolbar = setupToolbar;
