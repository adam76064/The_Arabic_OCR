const dashboardMessage = (key, replacements) => window.AppI18n?.t(key, replacements) || key;

/**
 * pages/project-dashboard/index.js - extracted from monolith
 */

async function initDashboard() {
    const params = new URLSearchParams(window.location.search);
    currentProjectId = params.get('id');
    
    if (!currentProjectId) {
        window.location.href = 'projects.html';
        return;
    }

    // Load Project Data
    try {
        window.__appDataPath = await window.pywebview.api.get_app_data_path();
        window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');
    } catch (e) {
        console.warn('get_app_data_path failed', e);
        window.__appDataPath = '';
    }

    currentProject = await window.pywebview.api.load_project(currentProjectId);
    if (!currentProject) {
        alert(dashboardMessage('dashboard.loadFailed'));
        window.location.href = 'projects.html';
        return;
    }
    
    // Fetch real daily limits from Python Backend
    paddleTrialsLeft = await window.pywebview.api.get_paddle_limits();

    document.getElementById('dashboard-proj-title').textContent = currentProject.metadata?.title || dashboardMessage('dashboard.untitled');
    
    renderPagesTable();
    renderDashboardStats();
    setupPaddleModal();
    setupEventBindings();
    setupProgressReceiver();
    setupExportSystem();
    setupCollaborationPanel();
}

function setupEventBindings() {
    document.getElementById('dashboard-global-ocr-btn')?.addEventListener('click', () => {
        if (typeof openPaddleModalForFullFile === 'function') {
            openPaddleModalForFullFile();
        } else if (typeof openPaddleModalForBatch === 'function') {
            const allIdx = currentProject?.pages ? currentProject.pages.map((_, i) => i) : [];
            openPaddleModalForBatch(allIdx);
        }
    });

    document.getElementById('dashboard-preprocess-btn')?.addEventListener('click', () => {
        window.location.href = `preprocessing.html?id=${currentProjectId}`;
    });

    document.getElementById('dashboard-settings-btn')?.addEventListener('click', () => {
        window.location.href = `project-settings.html?id=${currentProjectId}`;
    });

    document.getElementById('back-to-review-btn')?.addEventListener('click', () => {
        window.location.href = `review.html?id=${currentProjectId}&page=0`;
    });

    document.getElementById('reset-ocr-modal-prompt')?.addEventListener('click', () => {
        const promptTa = document.getElementById('ocr-modal-llm-prompt');
        if (promptTa) {
            promptTa.value = window.__appSettings?.llmSystemPrompt || window.DEFAULT_LLM_PROMPT;
        }
    });
    
    document.getElementById('paddle-ocr-close').addEventListener('click', () => {
        document.getElementById('paddle-ocr-modal').classList.add('hidden');
    });
    document.getElementById('paddle-ocr-overlay').addEventListener('click', () => {
        document.getElementById('paddle-ocr-modal').classList.add('hidden');
    });

    
    document.getElementById('start-ocr-btn').addEventListener('click', async () => {
        const progressModal = document.getElementById('ocr-progress-modal');
        
        try {
            const tool = document.querySelector('input[name="ocr-tool"]:checked').value;
            const rangeMode = document.querySelector('input[name="ocr-range"]:checked').value;
            
            let start = 1;
            let end = currentProject.pages.length;
            let pageIndices = null;

            if (rangeMode === 'selected') {
                start = parseInt(document.getElementById('ocr-start-page').value);
                end = parseInt(document.getElementById('ocr-end-page').value);
                if (window.selectedBatchIndices && window.selectedBatchIndices.length > 0) {
                    pageIndices = window.selectedBatchIndices;
                }
            }

            document.getElementById('paddle-ocr-modal').classList.add('hidden');
            document.getElementById('ocr-progress-message').textContent = dashboardMessage('dashboard.connecting');
            document.getElementById('ocr-progress-fill').style.width = '5%';
            document.getElementById('ocr-progress-fill').style.background = '#3498db';
            progressModal.classList.remove('hidden');

            if (tool === 'glens') {
                const glensMode = document.querySelector('input[name="glens-mode"]:checked').value;
                
                const response = await window.pywebview.api.trigger_google_lens_ocr(
                    currentProjectId, start - 1, end - 1, glensMode, pageIndices
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert(dashboardMessage('dashboard.pythonError') + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();
                    renderDashboardStats();
                }

            } else if (tool === 'locro') {
                const locroMode = document.querySelector('input[name="locro-mode"]:checked').value;
                const response = await window.pywebview.api.trigger_locro_ocr(
                    currentProjectId, start - 1, end - 1, locroMode, pageIndices
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert(dashboardMessage('dashboard.pythonError') + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();
                    renderDashboardStats();
                }

            } else if (tool === 'llm') {
                const customPrompt = document.getElementById('ocr-modal-llm-prompt')?.value.trim() || window.__appSettings?.llmSystemPrompt || window.DEFAULT_LLM_PROMPT;
                const rememberForProj = document.getElementById('remember-prompt-for-project')?.checked || false;

                if (!apiKey) {
                    alert(dashboardMessage('dashboard.apiRequired'));
                    progressModal.classList.add('hidden');
                    return;
                }
                if (provider === 'custom' && (!baseUrl || !customModel)) {
                    alert(dashboardMessage('dashboard.customRequired'));
                    progressModal.classList.add('hidden');
                    return;
                }

                if (rememberForProj) {
                    if (!currentProject.metadata) currentProject.metadata = {};
                    currentProject.metadata.custom_llm_prompt = customPrompt;
                    await window.pywebview.api.update_project_metadata(currentProjectId, { custom_llm_prompt: customPrompt });
                } else if (currentProject?.metadata?.custom_llm_prompt) {
                    delete currentProject.metadata.custom_llm_prompt;
                    await window.pywebview.api.update_project_metadata(currentProjectId, { custom_llm_prompt: "" });
                }

                const llmConfig = { provider, apiKey, baseUrl, modelName: customModel, systemPrompt: customPrompt };
                await saveLLMSettings(llmConfig);

                const response = await window.pywebview.api.trigger_llm_ocr(
                    currentProjectId, start - 1, end - 1, llmConfig, pageIndices
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert(dashboardMessage('dashboard.pythonError') + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();
                    renderDashboardStats();
                }

            } else if (tool === 'paddle') {
                const response = await window.pywebview.api.trigger_paddle_ocr(currentProjectId, start - 1, end - 1, pageIndices);
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                } else {
                    currentProject = response.project;
                    renderPagesTable();
                    renderDashboardStats();
                    paddleTrialsLeft = response.trials_left;
                    setupPaddleModal();
                }
            }
        } catch (err) {
            console.error("Critical Frontend Error:", err);
            alert("حدث خطأ حرج:\n" + err.message);
            progressModal.classList.add('hidden');
        }
    });
}



document.addEventListener('DOMContentLoaded', () => {
    if (window.AppApi && typeof window.AppApi.ready === 'function') {
        window.AppApi.ready().then(initDashboard);
    } else if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.load_project === 'function') {
        initDashboard();
    } else {
        window.addEventListener('pywebviewready', initDashboard);
    }
});
