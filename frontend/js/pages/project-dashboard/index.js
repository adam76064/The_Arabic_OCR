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
    currentProject = await window.pywebview.api.load_project(currentProjectId);
    if (!currentProject) {
        alert('تعذّر تحميل المشروع');
        window.location.href = 'projects.html';
        return;
    }
    
    // Fetch real daily limits from Python Backend
    paddleTrialsLeft = await window.pywebview.api.get_paddle_limits();

    document.getElementById('dashboard-proj-title').textContent = currentProject.metadata?.title || 'مشروع بدون عنوان';
    
    renderPagesTable();
    renderDashboardStats();
    setupPaddleModal();
    setupEventBindings();
    setupProgressReceiver();
    setupExportSystem();
    setupCollaborationPanel();
}

function setupEventBindings() {

    document.getElementById('dashboard-settings-btn')?.addEventListener('click', () => {
        window.location.href = `project-settings.html?id=${currentProjectId}`;
    });

    document.getElementById('back-to-review-btn').addEventListener('click', () => {
        window.history.back();
    });

    document.getElementById('back-to-review-btn').addEventListener('click', () => {
        window.history.back(); // العودة من حيث أتى المستخدم
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

            if (rangeMode === 'selected') {
                start = parseInt(document.getElementById('ocr-start-page').value);
                end = parseInt(document.getElementById('ocr-end-page').value);
            }

            document.getElementById('paddle-ocr-modal').classList.add('hidden');
            document.getElementById('ocr-progress-message').textContent = 'جاري الاتصال بالخادم...';
            document.getElementById('ocr-progress-fill').style.width = '5%';
            document.getElementById('ocr-progress-fill').style.background = '#3498db';
            progressModal.classList.remove('hidden');

            if (tool === 'glens') {
                const glensMode = document.querySelector('input[name="glens-mode"]:checked').value;
                
                const response = await window.pywebview.api.trigger_google_lens_ocr(
                    currentProjectId, start - 1, end - 1, glensMode
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert("حدث خطأ في بايثون: " + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();        // 1. إعادة رسم الجدول بالبيانات الجديدة
                    renderDashboardStats();    // 2. تحديث الإحصائيات
                }

            } else if (tool === 'locro') {
                const locroMode = document.querySelector('input[name="locro-mode"]:checked').value;
                const response = await window.pywebview.api.trigger_locro_ocr(
                    currentProjectId, start - 1, end - 1, locroMode
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert("حدث خطأ في بايثون: " + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();
                    renderDashboardStats();
                }

            // ==========================================
            // 🤖 إضافة كتلة الـ LLM هنا (Phase 1 اكتملت)
            // ==========================================
            } else if (tool === 'llm') {
                const customPrompt = document.getElementById('ocr-modal-llm-prompt')?.value.trim() || window.__appSettings?.llmSystemPrompt || window.DEFAULT_LLM_PROMPT;
                const rememberForProj = document.getElementById('remember-prompt-for-project')?.checked || false;

                if (!apiKey) {
                    alert("يرجى إدخال مفتاح الـ API للنموذج المختار!");
                    progressModal.classList.add('hidden');
                    return;
                }
                if (provider === 'custom' && (!baseUrl || !customModel)) {
                    alert("يرجى إدخال رابط الخادم (Base URL) واسم النموذج للخادم المخصص!");
                    progressModal.classList.add('hidden');
                    return;
                }

                // Save or clear project custom prompt in project metadata if checkbox toggled
                if (rememberForProj) {
                    if (!currentProject.metadata) currentProject.metadata = {};
                    currentProject.metadata.custom_llm_prompt = customPrompt;
                    await window.pywebview.api.update_project_metadata(currentProjectId, { custom_llm_prompt: customPrompt });
                } else if (currentProject?.metadata?.custom_llm_prompt) {
                    delete currentProject.metadata.custom_llm_prompt;
                    await window.pywebview.api.update_project_metadata(currentProjectId, { custom_llm_prompt: "" });
                }

                // Save LLM API config
                const llmConfig = { provider, apiKey, baseUrl, modelName: customModel, systemPrompt: customPrompt };
                await saveLLMSettings(llmConfig);

                const response = await window.pywebview.api.trigger_llm_ocr(
                    currentProjectId, start - 1, end - 1, llmConfig
                );
                
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                    else { alert("حدث خطأ في بايثون: " + response.error); progressModal.classList.add('hidden'); }
                } else {
                    currentProject = response.project;
                    renderPagesTable();        // 1. إعادة رسم الجدول بالبيانات الجديدة
                    renderDashboardStats();    // 2. تحديث الإحصائيات
                }

            } else if (tool === 'paddle') {
                const response = await window.pywebview.api.trigger_paddle_ocr(currentProjectId, start - 1, end - 1);
                if (!response.ok) {
                    if (window.onPaddleProgress) window.onPaddleProgress({ stage: 'error', message: response.error });
                } else {
                    currentProject = response.project;
                    renderPagesTable();        // 1. إعادة رسم الجدول بالبيانات الجديدة
                    renderDashboardStats();    // 2. تحديث الإحصائيات
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
    // التحقق الصارم من وجود الـ api والدالة المطلوبة تحديداً
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.load_project === 'function') {
        initDashboard();
    } else {
        // الانتظار حتى يكتمل حقن جميع الدوال
        window.addEventListener('pywebviewready', initDashboard);
    }
});
