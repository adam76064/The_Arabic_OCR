const ocrModalText = (key) => window.AppI18n?.t(key) || key;

/**
 * pages/project-dashboard/ocr-modal.js - extracted from monolith
 */

function setupPaddleModal() {
    const modal = document.getElementById('paddle-ocr-modal');
    
    // Setup Limits UI
    const limitHint = document.getElementById('paddle-limit-hint');
    const paddleContainer = document.getElementById('tool-paddle-container');
    const paddleRadio = document.querySelector('input[value="paddle"]');
    const startBtn = document.getElementById('start-ocr-btn');
    
    document.getElementById('paddle-files-left').textContent = paddleTrialsLeft;
    
    if (paddleTrialsLeft <= 0) {
        paddleContainer.classList.add('disabled');
        paddleRadio.disabled = true;
        limitHint.textContent = ocrModalText('ocr.limitReached');
        startBtn.disabled = true;
    }

    // Range Toggle Logic
    const rangeInputsContainer = document.getElementById('ocr-range-inputs');
    const rangeHint = document.getElementById('range-hint-text');
    
    document.querySelectorAll('input[name="ocr-range"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'all') {
                rangeInputsContainer.style.opacity = '0.5';
                rangeInputsContainer.style.pointerEvents = 'none';
                rangeHint.textContent = ocrModalText('ocr.allPages');
            } else {
                rangeInputsContainer.style.opacity = '1';
                rangeInputsContainer.style.pointerEvents = 'auto';
                rangeHint.textContent = ocrModalText('ocr.defaultRange');
            }
        });
        
    });
   
    document.querySelectorAll('input[name="ocr-tool"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const glensSubOpts = document.getElementById('glens-sub-options');
        const locroSubOpts = document.getElementById('locro-sub-options');
        const llmSubOpts = document.getElementById('llm-sub-options');
        const digitalSubOpts = document.getElementById('digital-sub-options');
        const startBtn = document.getElementById('start-ocr-btn');
        
        if (glensSubOpts) glensSubOpts.classList.add('hidden');
        if (locroSubOpts) locroSubOpts.classList.add('hidden');
        if (llmSubOpts) llmSubOpts.classList.add('hidden');
        if (digitalSubOpts) digitalSubOpts.classList.add('hidden');

        if (e.target.value === 'glens') {
            if (glensSubOpts) glensSubOpts.classList.remove('hidden');
            startBtn.disabled = false;
        } else if (e.target.value === 'locro') {
            if (locroSubOpts) locroSubOpts.classList.remove('hidden');
            startBtn.disabled = false;
        } else if (e.target.value === 'llm') {
            if (llmSubOpts) llmSubOpts.classList.remove('hidden');
            startBtn.disabled = false;
            loadLLMSettings();
        } else if (e.target.value === 'digital') {
            if (digitalSubOpts) digitalSubOpts.classList.remove('hidden');
            startBtn.disabled = false;
        } else {
            if (paddleTrialsLeft <= 0) {
                startBtn.disabled = true;
            }
        }
    });
    });

    // Handle Custom Endpoint fields visibility
    document.getElementById('llm-provider')?.addEventListener('change', (e) => {
        const customFields = document.getElementById('llm-custom-fields');
        if (e.target.value === 'custom') {
            customFields.classList.remove('hidden');
        } else {
            customFields.classList.add('hidden');
        }
    });

    // Digital Triage Probe button handler
    document.getElementById('btn-probe-digital')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-probe-digital');
        const resBox = document.getElementById('digital-probe-result');
        const summaryEl = document.getElementById('digital-probe-summary');
        const chipsEl = document.getElementById('digital-probe-chips');
        const pid = (typeof currentProjectId !== 'undefined' && currentProjectId) ? currentProjectId : currentProject?.id;
        if (!btn || !pid) return;

        const rangeMode = document.querySelector('input[name="ocr-range"]:checked')?.value || 'all';
        let pageIndices = null;
        if (rangeMode === 'selected') {
            const start = parseInt(document.getElementById('ocr-start-page').value) || 1;
            const end = parseInt(document.getElementById('ocr-end-page').value) || currentProject?.pages?.length || 1;
            if (window.selectedBatchIndices && window.selectedBatchIndices.length > 0) {
                pageIndices = window.selectedBatchIndices;
            } else {
                pageIndices = [];
                for (let i = start - 1; i <= end - 1; i++) pageIndices.push(i);
            }
        }

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = window.AppI18n ? window.AppI18n.t('ocr.probing') : '⏳ جاري الفحص...';

        try {
            const res = await window.pywebview.api.probe_digital_pages(pid, pageIndices);
            if (res && res.ok && res.pages) {
                resBox.classList.remove('hidden');
                const digitalPages = res.pages.filter(p => p.is_digital);
                const scannedPages = res.pages.filter(p => !p.is_digital);

                summaryEl.innerHTML = window.AppI18n
                    ? window.AppI18n.t('ocr.probeResultSummary', { digital: digitalPages.length, scanned: scannedPages.length })
                    : `نتيجة الفحص: ${digitalPages.length} صفحة رقمية (استخراج 100%) | ${scannedPages.length} صفحة مصورة (تحتاج OCR)`;

                chipsEl.innerHTML = res.pages.map(p => {
                    const icon = p.is_digital ? '🟢' : '🟡';
                    const title = p.is_digital ? 'صفحة رقمية جاهزة للاستخراج' : (p.reason || 'صفحة مصورة');
                    return `<span title="${title}" style="display:inline-flex; align-items:center; gap:2px; font-size:11px; padding:2px 6px; border-radius:3px; background:${p.is_digital ? 'rgba(39,174,96,0.1)' : 'rgba(243,156,18,0.1)'}; color:${p.is_digital ? '#27ae60' : '#d68910'}; font-weight:600;">${icon} ص${p.page_number}</span>`;
                }).join('');
            } else {
                alert((window.AppI18n ? window.AppI18n.t('dashboard.pythonError') : 'خطأ: ') + (res?.error || ''));
            }
        } catch (err) {
            console.error('Probe failed', err);
            alert('فشل الفحص: ' + err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    // Update the hint text based on the selected Google Lens mode
    document.querySelectorAll('input[name="glens-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const hint = document.getElementById('glens-mode-hint');
            if (e.target.value === 'full_page') {
                hint.textContent = ocrModalText('ocr.lensFull');
            } else {
                hint.textContent = ocrModalText('ocr.lensBlocks');
            }
        });
    });

}

function openPaddleModalForBatch(indices) {
    const modal = document.getElementById('paddle-ocr-modal');
    if (!modal) return;
    if (!indices || indices.length === 0) {
        openPaddleModalForFullFile();
        return;
    }
    window.selectedBatchIndices = indices.slice().sort((a, b) => a - b);
    const minPage = window.selectedBatchIndices[0] + 1;
    const maxPage = window.selectedBatchIndices[window.selectedBatchIndices.length - 1] + 1;
    document.getElementById('ocr-start-page').value = minPage;
    document.getElementById('ocr-end-page').value = maxPage;

    const rangeHint = document.getElementById('range-hint-text');
    if (rangeHint) {
        if (indices.length > 1) {
            rangeHint.textContent = window.AppI18n 
                ? window.AppI18n.t('dash.selectedPagesList', { count: indices.length, pages: window.selectedBatchIndices.map(i => i + 1).join(', ') })
                : `الصفحات المحددة (${indices.length} صفحة): ${window.selectedBatchIndices.map(i => i + 1).join('، ')}`;
        } else {
            rangeHint.textContent = window.AppI18n 
                ? window.AppI18n.t('dash.selectedSinglePage', { num: minPage })
                : `الصفحة المحددة: ${minPage}`;
        }
    }
    
    const selectedRadio = document.querySelector('input[name="ocr-range"][value="selected"]');
    if (selectedRadio) selectedRadio.click();
    syncOcrModalLlmPrompt();
    modal.classList.remove('hidden');
}

function openPaddleModalForFullFile() {
    const modal = document.getElementById('paddle-ocr-modal');
    if (!modal) return;
    window.selectedBatchIndices = null;
    
    document.getElementById('ocr-start-page').value = 1;
    document.getElementById('ocr-end-page').value = currentProject?.pages ? currentProject.pages.length : 1;
    
    const rangeHint = document.getElementById('range-hint-text');
    if (rangeHint) rangeHint.textContent = ocrModalText('ocr.allPages');

    const allRadio = document.querySelector('input[name="ocr-range"][value="all"]');
    if (allRadio) allRadio.click();
    else {
        const selectedRadio = document.querySelector('input[name="ocr-range"][value="selected"]');
        if (selectedRadio) selectedRadio.click();
    }
    syncOcrModalLlmPrompt();
    modal.classList.remove('hidden');
}

function openPaddleModalForSinglePage(pageIndex) {
    const modal = document.getElementById('paddle-ocr-modal');
    if (!modal) return;
    window.selectedBatchIndices = [pageIndex];
    document.getElementById('ocr-start-page').value = pageIndex + 1;
    document.getElementById('ocr-end-page').value = pageIndex + 1;

    const rangeHint = document.getElementById('range-hint-text');
    if (rangeHint) {
        rangeHint.textContent = window.AppI18n 
            ? window.AppI18n.t('dash.selectedSinglePage', { num: pageIndex + 1 })
            : `الصفحة المحددة: ${pageIndex + 1}`;
    }

    const selectedRadio = document.querySelector('input[name="ocr-range"][value="selected"]');
    if (selectedRadio) selectedRadio.click();
    syncOcrModalLlmPrompt();
    modal.classList.remove('hidden');
}

function syncOcrModalLlmPrompt() {
    const promptTa = document.getElementById('ocr-modal-llm-prompt');
    const chkRemember = document.getElementById('remember-prompt-for-project');
    if (!promptTa) return;

    const projCustomPrompt = currentProject?.metadata?.custom_llm_prompt;
    if (projCustomPrompt) {
        promptTa.value = projCustomPrompt;
        if (chkRemember) chkRemember.checked = true;
    } else {
        promptTa.value = window.__appSettings?.llmSystemPrompt || window.DEFAULT_LLM_PROMPT;
        if (chkRemember) chkRemember.checked = false;
    }
}

