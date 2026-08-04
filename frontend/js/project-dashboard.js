let currentProject = null;
let currentProjectId = null;

// Mocking daily limit state for Phase 1. 
// In Phase 2, this will be fetched from window.__appSettings or python backend.
let paddleTrialsLeft = 3; 

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

function setupProgressReceiver() {
    window.onPaddleProgress = (payload) => {
        const modal = document.getElementById('ocr-progress-modal');
        const msgEl = document.getElementById('ocr-progress-message');
        const fillEl = document.getElementById('ocr-progress-fill');
        
        // التأكد من أن نافذة التقدم ظاهرة
        modal.classList.remove('hidden');
        
        if (payload.stage === 'error') {
            msgEl.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">خطأ: ${payload.message}</span>`;
            fillEl.style.background = '#e74c3c';
            fillEl.style.width = '100%';
            
            // إغلاق تلقائي بعد 4 ثوانٍ في حالة الخطأ
            setTimeout(() => { modal.classList.add('hidden'); }, 4000);
            
        } else if (payload.stage === 'completed') {
            msgEl.innerHTML = `<span style="color: #27ae60; font-weight: bold;">✔ ${payload.message}</span>`;
            fillEl.style.background = '#27ae60';
            fillEl.style.width = '100%';
            
            // التحديث والإغلاق عند الانتهاء بنجاح
            setTimeout(async () => {
                modal.classList.add('hidden');
                currentProject = await window.pywebview.api.load_project(currentProjectId);
                renderPagesTable(); 
                if (typeof renderDashboardStats === 'function') renderDashboardStats();
            }, 1500);
            
        } else {
            // تحديث رسالة وشريط التقدم بشكل طبيعي
            msgEl.textContent = payload.message;
            fillEl.style.background = '#3498db';
            fillEl.style.width = (payload.percentage || 10) + '%';
        }
    };
}

function renderPagesTable() {
    const tbody = document.getElementById('pages-table-body');
    tbody.innerHTML = '';

    if (!currentProject.pages || currentProject.pages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">لا توجد صفحات في هذا المشروع.</td></tr>';
        return;
    }

    currentProject.pages.forEach((page, index) => {
        const isOcred = page.ocr_data && page.ocr_data.length > 0;
        
        // Auto-detect if all blocks are reviewed
        const allBlocksReviewed = isOcred && page.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        const isReviewed = (page.status === 'reviewed' || allBlocksReviewed) && page.status !== 'pending' && page.status !== 'unreviewed';
        
        // Dynamic Layout Status
        const layoutStatusText = isOcred ? 'تخطيط تلقائي' : 'لم يخطط بعد';
        const layoutStatusStyle = isOcred ? 'background: #e0f2fe; color: #0369a1;' : 'background: #f1f5f9; color: #64748b;';
        
        const pageNum = index + 1;
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${pageNum}</strong></td>
            <td>
                <span class="status-badge ${isOcred ? 'parsed' : 'unparsed'}">
                    ${isOcred ? '✔ تم استخراج النص' : '⏳ بانتظار OCR'}
                </span>
            </td>
            <td>
                <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${layoutStatusStyle}">
                    ${layoutStatusText}
                </span>
            </td>
            <td>
                <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${isReviewed ? 'background: #d1fae5; color: #059669;' : 'background: #fef3c7; color: #d97706;'}">
                    ${isReviewed ? '✔ تمت المراجعة' : '⏳ بانتظار المراجعة'}
                </span>
            </td>
            <td style="text-align: left; display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn-primary layout-editor-btn" data-index="${index}">تخطيط (Layout)</button>
                <button class="btn-secondary open-page-btn" data-index="${index}">مراجعة</button>
                <button class="btn-secondary single-ocr-btn" data-index="${index}">OCR</button>
                <button class="btn-danger remove-page-btn" data-index="${index}">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    bindTableButtons();
}

function bindTableButtons() {

    // الزر الجديد للانتقال إلى محرر الكتل
    document.querySelectorAll('.layout-editor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            window.location.href = `layout-editor.html?id=${currentProjectId}&page=${idx}`;
        });
    });


    document.querySelectorAll('.open-page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            // Navigates to review page. We pass a page parameter so review.js knows where to jump.
            // Note: you may need a small tweak in review.js later to parse &page=idx on load.
            window.location.href = `review.html?id=${currentProjectId}&page=${idx}`;
        });
    });

    document.querySelectorAll('.single-ocr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            openPaddleModalForSinglePage(parseInt(idx));
        });
    });

    document.querySelectorAll('.remove-page-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.target.dataset.index);
            const pageNum = idx + 1;
            
            const executeDeletion = async (deleteFiles) => {
                const res = await window.pywebview.api.delete_page(currentProjectId, idx, deleteFiles);
                if (res && res.ok) {
                    currentProject = await window.pywebview.api.load_project(currentProjectId);
                    renderPagesTable();
                    if (typeof renderDashboardStats === 'function') renderDashboardStats();
                } else {
                    alert('تعذّر حذف الصفحة: ' + (res?.error || 'خطأ غير معروف'));
                }
            };

            const prompt = window.__appSettings?.promptDeletePage !== false;
            const defaultDeleteFiles = !!(window.__appSettings?.deletePageFiles);

            if (prompt && window.AestheticDialog?.deleteConfirm) {
                window.AestheticDialog.deleteConfirm({
                    title: 'حذف الصفحة',
                    message: `هل أنت متأكد من رغبتك في حذف الصفحة رقم <strong>${pageNum}</strong> من هذا المشروع؟`,
                    deleteFilesLabel: 'حذف الصور والملفات المرتبطة بهذه الصفحة من القرص الصلب أيضاً',
                    defaultDeleteFiles: defaultDeleteFiles,
                    showRemember: true,
                    onConfirm: async ({ deleteFiles, remember }) => {
                        if (remember) {
                            window.__appSettings.promptDeletePage = false;
                            window.__appSettings.deletePageFiles = deleteFiles;
                            if (typeof saveAppSettings === 'function') saveAppSettings();
                        }
                        await executeDeletion(deleteFiles);
                    }
                });
            } else {
                await executeDeletion(defaultDeleteFiles);
            }
        });
    });
}

// ===== PADDLE OCR MODAL LOGIC =====

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
        limitHint.textContent = 'استنفدت الحد الأقصى (3 ملفات) لليوم. يرجى المحاولة غداً.';
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
                rangeHint.textContent = 'سيتم معالجة جميع صفحات الكتاب بدون استثناء.';
            } else {
                rangeInputsContainer.style.opacity = '1';
                rangeInputsContainer.style.pointerEvents = 'auto';
                rangeHint.textContent = 'تم تعيين النطاق الافتراضي ليبدأ من أول صفحة غير معالجة.';
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
                hint.textContent = 'سيتم إرسال الصفحة لـ Google Lens واستخراج النصوص مع بناء مربعات التحديد (BBoxes) تلقائياً.';
            } else {
                hint.textContent = 'سيتم جلب نصوص الصفحة الأصلية ومطابقتها هندسياً (Spatial Intersection) مع كتل النص الموجودة حالياً لضمان عدم تغير التنسيق.';
            }
        });
    });

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

function openPaddleModalForFullFile() {
    const modal = document.getElementById('paddle-ocr-modal');
    
    // Find first un-OCRed page
    let firstUnparsed = 1;
    for (let i = 0; i < currentProject.pages.length; i++) {
        if (!currentProject.pages[i].ocr_data || currentProject.pages[i].ocr_data.length === 0) {
            firstUnparsed = i + 1;
            break;
        }
    }

    document.getElementById('ocr-start-page').value = firstUnparsed;
    document.getElementById('ocr-end-page').value = currentProject.pages.length;
    
    document.querySelector('input[value="selected"]').click();
    syncOcrModalLlmPrompt();
    modal.classList.remove('hidden');
}

function openPaddleModalForSinglePage(pageIndex) {
    const modal = document.getElementById('paddle-ocr-modal');
    document.getElementById('ocr-start-page').value = pageIndex + 1;
    document.getElementById('ocr-end-page').value = pageIndex + 1;
    document.querySelector('input[value="selected"]').click();
    syncOcrModalLlmPrompt();
    modal.classList.remove('hidden');
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

function renderDashboardStats() {
    const container = document.getElementById('dashboard-stats-container');
    if (!currentProject) return;
    
    const pages = currentProject.pages || [];
    const total = pages.length;
    
    const reviewed = pages.filter(p => {
        const isOcred = (p.ocr_data || []).length > 0;
        const allBlocksReviewed = isOcred && p.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        return (p.status === 'reviewed' || allBlocksReviewed) && p.status !== 'pending' && p.status !== 'unreviewed';
    }).length;
    const ocred = pages.filter(p => (p.ocr_data||[]).length > 0).length;
    
    // Dynamic layout count based on the new logic
    const layoutCount = ocred;
    
    const pct = total ? Math.round(reviewed / total * 100) : 0;

    // Per-user participation
    const userStats = {};
    pages.forEach(page => {
        (page.ocr_data || []).forEach(el => {
            const u = el.reviewed_by || null;
            if (!u) return;
            userStats[u] = userStats[u] || { blocks: 0, pages: new Set() };
            userStats[u].blocks++;
            userStats[u].pages.add(page.pdf_index ?? 0);
        });
    });
    const totalBlocks = pages.reduce((s, p) => s + (p.ocr_data||[]).length, 0);

    // Bar chart via inline SVG (تمت إضافة عمود التخطيط)
    const barData = [
        { label: 'الكل', val: total, color: '#95a5a6' },
        { label: 'OCR', val: ocred, color: '#3498db' },
        { label: 'تخطيط', val: layoutCount, color: '#0369a1' },
        { label: 'مراجعة', val: reviewed, color: '#27ae60' },
    ];
    const maxVal = Math.max(total, 1);
    const bars = barData.map((d, i) => {
        const h = Math.round((d.val / maxVal) * 120);
        // تم تقليص العرض ليتسع لـ 4 أعمدة بدلاً من 3
        return `<g transform="translate(${i*75+20},0)">
            <rect x="0" y="${130-h}" width="45" height="${h}" fill="${d.color}" rx="4"/>
            <text x="22.5" y="${130-h-5}" text-anchor="middle" font-size="13" fill="#333">${d.val}</text>
            <text x="22.5" y="148" text-anchor="middle" font-size="11" fill="#888">${d.label}</text>
        </g>`;
    });

    // Page grid: color by status
    const gridCells = pages.map((pg, i) => {
        const isOcred = (pg.ocr_data || []).length > 0;
        const allBlocksReviewed = isOcred && pg.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        const isReviewed = (pg.status === 'reviewed' || allBlocksReviewed) && pg.status !== 'pending' && pg.status !== 'unreviewed';

        let fill = '#eee'; // pending
        if (isOcred) fill = '#aed6f1'; // ocred
        
        const isLayoutParsed = isOcred && pg.ocr_data.some(b => b.category !== 'Text' || (b.text && b.text.trim() !== ""));
        if (isLayoutParsed) fill = '#bae6fd'; // Layout parsed
        
        if (isReviewed) fill = '#a9dfbf'; // reviewed
        
        const statusText = isReviewed ? 'تمت المراجعة' : isOcred ? 'تم استخراج النص' : 'بانتظار OCR';
        const title = `صفحة ${i+1} (${statusText})`;
        return `<div title="${title}" style="width:20px;height:20px;border-radius:3px;background:${fill};cursor:pointer;border:1px solid rgba(0,0,0,0.08);transition:transform 0.15s;" onclick="window.location.href='review.html?id=${currentProjectId}&page=${i}'"></div>`;
    }).join('');

    const userRows = Object.entries(userStats).map(([u, st]) => {
        const pct2 = totalBlocks ? Math.round(st.blocks / totalBlocks * 100) : 0;
        return `<tr>
            <td style="padding:8px 12px;">${u}</td>
            <td style="padding:8px 12px;">${st.blocks}</td>
            <td style="padding:8px 12px;">${st.pages.size}</td>
            <td style="padding:8px 12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;">
                        <div style="width:${pct2}%;height:100%;background:#3498db;border-radius:4px;"></div>
                    </div>
                    <span style="font-size:12px;color:#888;">${pct2}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
            <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <div style="font-size:13px;color:#888;margin-bottom:4px;">التقدم الكلي للمراجعة</div>
                <div style="font-size:36px;font-weight:800;color:#27ae60;">${pct}%</div>
                <div style="height:8px;background:#eee;border-radius:4px;margin-top:10px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:#27ae60;border-radius:4px;transition:width .5s;"></div>
                </div>
                <div style="font-size:12px;color:#888;margin-top:6px;">${reviewed} من ${total} صفحة مراجَعة</div>
            </div>
            <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <div style="font-size:13px;color:#888;margin-bottom:10px;">إحصائيات المعالجة</div>
                <svg viewBox="-10 0 ${barData.length * 75 + 30} 160" width="100%" height="130" style="overflow: visible;">
                    ${bars.join('')}
                </svg>
            </div>
        </div>
        <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
            <div style="font-size:13px;font-weight:700;color:#555;margin-bottom:12px;">خريطة الصفحات</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${gridCells}</div>
            <div style="display:flex;gap:14px;margin-top:14px;font-size:12px;color:#888;">
                <span><span style="display:inline-block;width:12px;height:12px;background:#eee;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #ddd;"></span>بانتظار OCR</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#aed6f1;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #99c9e8;"></span>OCR موجود</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#bae6fd;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #7dd3fc;"></span>تم التخطيط</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#a9dfbf;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #8cc9a5;"></span>تمت المراجَعة</span>
            </div>
        </div>
        ${userRows ? `
        <div style="background:white;border-radius:10px;border:1px solid #e0e0e0;overflow:hidden;margin-top:20px;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
            <div style="padding:14px 16px;font-size:13px;font-weight:700;color:#555;border-bottom:1px solid #eee;">مشاركة الأعضاء</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8f9fa;">
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">المستخدم</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">الكتل</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">الصفحات</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">المشاركة</th>
                </tr></thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>` : ''}
    `;
}

// LLM INCLUSION

function loadLLMSettings() {
    const settings = window.__appSettings?.llmConfig || {};
    if (settings.provider) document.getElementById('llm-provider').value = settings.provider;
    if (settings.apiKey) document.getElementById('llm-api-key').value = settings.apiKey;
    if (settings.baseUrl) document.getElementById('llm-base-url').value = settings.baseUrl;
    if (settings.modelName) document.getElementById('llm-model-name').value = settings.modelName;
    
    // Trigger change to show/hide custom fields
    document.getElementById('llm-provider').dispatchEvent(new Event('change'));
}

async function saveLLMSettings(config) {
    if (!document.getElementById('llm-remember-api').checked) return;
    
    window.__appSettings = window.__appSettings || {};
    window.__appSettings.llmConfig = config;
    
    if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.save_app_settings(window.__appSettings);
    }
}


// ══════════════════════════════════════════════════════════════════════
// EXPORT SYSTEM ARCHITECTURE
// ══════════════════════════════════════════════════════════════════════
function setupExportSystem() {
    document.getElementById('export-btn').addEventListener('click', () => {
        window.location.href = `export.html?id=${currentProjectId}`;
    });
}

// ══════════════════════════════════════════════════════════════════════
// COLLABORATION & BROADCASTING PRESENCE PANEL
// ══════════════════════════════════════════════════════════════════════
let coopPollInterval = null;

async function setupCollaborationPanel() {
    const meta = currentProject.metadata || {};
    const lanStatusEl = document.getElementById('dash-lan-status');
    const cloudStatusEl = document.getElementById('dash-cloud-status');
    const syncBtn = document.getElementById('dash-sync-gdrive-btn');

    let lanState = meta.lan_broadcasting ?? false;
    let cloudState = meta.cloud_broadcasting ?? false;

    const renderBadges = () => {
        if (lanStatusEl) {
            lanStatusEl.textContent = lanState ? '📡 محلي: 🟢 مفعل' : '📡 محلي: 🔴 متوقف';
            lanStatusEl.style.background = lanState ? '#dcfce7' : '#fee2e2';
            lanStatusEl.style.color = lanState ? '#15803d' : '#b91c1c';
        }
    };
    renderBadges();

    // Interactive Badge Click Handlers
    if (lanStatusEl) {
        lanStatusEl.addEventListener('click', async () => {
            lanState = !lanState;
            currentProject.metadata.lan_broadcasting = lanState;
            renderBadges();
            await window.pywebview.api.toggle_broadcasting(currentProjectId, 'lan', lanState);
        });
    }

    // Active Collaborators Polling
    const pollActiveUsers = async () => {
        try {
            const collaborators = await window.pywebview.api.get_active_collaborators(currentProjectId);
            const container = document.getElementById('dash-active-collaborators');
            if (!container) return;

            const lanUsers = collaborators.lan || [];
            const allUsers = lanUsers.map(u => ({ name: u, type: 'lan' }));

            if (allUsers.length === 0) {
                container.innerHTML = `<span style="color: #94a3b8; font-style: italic;">لا يوجد أعضاء متصلون حالياً</span>`;
            } else {
                container.innerHTML = allUsers.map(u => {
                    const icon = u.type === 'lan' ? '💻' : '👤';
                    const bg = u.type === 'lan' ? '#e0f2fe' : '#ffedd5';
                    const color = u.type === 'lan' ? '#0369a1' : '#c2410c';
                    return `<span style="background:${bg}; color:${color}; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 12px;">${icon} ${u.name}</span>`;
                }).join('');
            }
        } catch(e) {
            console.error("Error polling collaborators:", e);
        }
    };

    pollActiveUsers();
    if (coopPollInterval) clearInterval(coopPollInterval);
    coopPollInterval = setInterval(pollActiveUsers, 4000);
}