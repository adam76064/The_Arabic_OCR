// js/project-creator.js
// ══════════════════════════════════════════════════════════════════════
// UNIVERSAL PROJECT CREATOR
// Injects the aesthetic popup and handles PDF processing anywhere in the app.
// ══════════════════════════════════════════════════════════════════════

const PROJECT_CREATOR_HTML = `
    <div id="new-proj-modal" class="modal hidden" style="z-index: 9999;">
        <div class="modal-overlay" id="new-proj-overlay"></div>
        <div class="modal-box" style="width: 400px; padding: 0;">
            <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid #eee;">
                <h3 style="margin: 0; font-size: 18px; color: #2c3e50;">إنشاء مشروع جديد</h3>
                <button class="modal-close" id="new-proj-close" style="background: #f1f5f9; border-radius: 6px; padding: 4px 8px;">✕</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #475569;">اسم المشروع <span style="color:#e74c3c;">*</span></label>
                    <input type="text" id="np-title" placeholder="أدخل اسم الكتاب أو المشروع..." style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box;" required>
                </div>
                <div class="form-group">
                    <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #475569;">ملف الكتاب (PDF) <span style="color:#e74c3c;">*</span></label>
                    <button type="button" id="np-pick-pdf" class="btn-secondary" style="width: 100%; padding: 10px; border: 1px dashed #3b82f6; background: #eff6ff; color: #2563eb; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        اختر ملف PDF...
                    </button>
                    <div id="np-pdf-path" style="font-size: 12px; color: #94a3b8; margin-top: 8px; text-align: left; direction: ltr; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">لم يُختر ملف</div>
                </div>
                <div class="form-actions" style="margin-top: 28px;">
                    <button id="np-submit" class="btn-success" style="width: 100%; padding: 12px; font-size: 15px; font-weight: bold;">إنشاء وبدء المعالجة</button>
                </div>
            </div>
        </div>
    </div>

    <div id="pdf-progress-modal" class="modal hidden" style="z-index: 10000;">
        <div class="modal-overlay"></div>
        <div class="modal-box" style="width:420px; padding: 24px;">
            <h3 style="margin-top: 0; color: #2c3e50; margin-bottom: 16px;">جارٍ إنشاء المشروع</h3>
            <p id="pdf-progress-message" style="font-size:14px;color:#555;margin-bottom:14px;">جارٍ التحقق من ملف PDF...</p>
            <div class="progress-bar" style="height:10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
                <div id="pdf-progress-fill" style="height: 100%; background: #3b82f6; width:0%; transition:width 0.2s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;color:#888; font-weight: bold;">
                <span id="pdf-progress-count"></span>
                <span id="pdf-progress-pct">0%</span>
            </div>
            <p style="font-size:12px;color:#aaa;margin-top:16px; text-align: center;">قد تستغرق الملفات الكبيرة عدة دقائق. الرجاء عدم إغلاق التطبيق.</p>
        </div>
    </div>
`;

document.head.insertAdjacentHTML('beforeend', `<style>#np-title:focus { border-color: #3b82f6; outline: 2px solid rgba(59,130,246,0.2); }</style>`);
document.body.insertAdjacentHTML('beforeend', PROJECT_CREATOR_HTML);

let selectedPdfPath = null;

function initProjectCreator() {
    const projModal = document.getElementById('new-proj-modal');
    const progModal = document.getElementById('pdf-progress-modal');
    
    // Bind all buttons with the class 'trigger-new-project'
    document.querySelectorAll('.trigger-new-project').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('np-title').value = '';
            selectedPdfPath = null;
            document.getElementById('np-pdf-path').textContent = 'لم يُختر ملف';
            projModal.classList.remove('hidden');
        });
    });

    document.getElementById('new-proj-close').addEventListener('click', () => projModal.classList.add('hidden'));
    document.getElementById('new-proj-overlay').addEventListener('click', () => projModal.classList.add('hidden'));

    document.getElementById('np-pick-pdf').addEventListener('click', async () => {
        const path = await window.pywebview.api.select_pdf();
        if (path) {
            selectedPdfPath = path;
            document.getElementById('np-pdf-path').textContent = path;
            document.getElementById('np-pdf-path').style.color = '#3b82f6';
        }
    });

    document.getElementById('np-submit').addEventListener('click', async () => {
        const title = document.getElementById('np-title').value.trim();
        if (!title) { alert('الرجاء إدخال اسم المشروع'); return; }
        if (!selectedPdfPath) { alert('الرجاء اختيار ملف PDF'); return; }

        projModal.classList.add('hidden');
        progModal.classList.remove('hidden');
        setPdfProgress('hashing', 0, 0);

        // DEFAULT METADATA (Will be editable later in the new Project Settings page)
        const metadata = {
            title: title, author: "", publisher: "", logical_start: 1, lan_enabled: false, lan_password: null,
            text_features: {
                remove_kasheeda: true, clean_extra_lines: false, clean_double_spaces: false,
                fix_punctuation: false, fix_waw: false, superscript_footnotes: false, normalize_hamza: false,
                tashkeel_option: "none", tanween_option: "none", remove_all_tashkeel: false, remove_tashkeel_keep_tanween: false
            }
        };

        try {
            const project = await window.pywebview.api.create_project(metadata, selectedPdfPath);
            setPdfProgress('done', project.pages ? project.pages.length : 0, project.pages ? project.pages.length : 0);
            
            window.location.href = `project-settings.html?id=${project.id}`;
        } catch (err) {
            console.error(err);
            progModal.classList.add('hidden');
            alert('حدث خطأ أثناء إنشاء المشروع. الرجاء المحاولة مرة أخرى.');
        }
    });
}

function setPdfProgress(stage, current, total) {
    const msgEl = document.getElementById('pdf-progress-message');
    const fillEl = document.getElementById('pdf-progress-fill');
    const countEl = document.getElementById('pdf-progress-count');
    const pctEl = document.getElementById('pdf-progress-pct');
    if (!msgEl) return;

    if (stage === 'hashing') {
        msgEl.textContent = 'جارٍ التحقق من ملف PDF...'; fillEl.style.width = '0%'; countEl.textContent = ''; pctEl.textContent = '';
    } else if (stage === 'rendering') {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        msgEl.textContent = 'جارٍ معالجة صفحات PDF...'; fillEl.style.width = pct + '%';
        countEl.textContent = `${current} / ${total} صفحة`; pctEl.textContent = pct + '%';
    } else if (stage === 'done') {
        msgEl.textContent = 'اكتملت المعالجة، جارٍ فتح المشروع...'; fillEl.style.width = '100%'; pctEl.textContent = '100%';
    }
}
window.onPdfProgress = (payload) => setPdfProgress(payload.stage, payload.current, payload.total);

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) initProjectCreator();
    else window.addEventListener('pywebviewready', initProjectCreator);
});