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
        const startBtn = document.getElementById('start-ocr-btn');
        
        if (glensSubOpts) glensSubOpts.classList.add('hidden');
        if (locroSubOpts) locroSubOpts.classList.add('hidden');
        if (llmSubOpts) llmSubOpts.classList.add('hidden');

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

