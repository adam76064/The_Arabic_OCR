/**
 * pages/project-dashboard/progress.js - extracted from monolith
 */

function setupProgressReceiver() {
    window.onPaddleProgress = (payload) => {
        const modal = document.getElementById('ocr-progress-modal');
        const msgEl = document.getElementById('ocr-progress-message');
        const fillEl = document.getElementById('ocr-progress-fill');
        
        // التأكد من أن نافذة التقدم ظاهرة
        modal.classList.remove('hidden');
        
        if (payload.stage === 'error') {
            msgEl.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">${window.AppI18n.t('ocr.errorPrefix')}: ${payload.message}</span>`;
            fillEl.style.background = '#e74c3c';
            fillEl.style.width = '100%';
            
            // إغلاق تلقائي بعد 4 ثوانٍ في حالة الخطأ
            setTimeout(() => { modal.classList.add('hidden'); }, 4000);
            
        } else if (payload.stage === 'completed') {
            const icon = window.AppIcons ? window.AppIcons.get('check') : '';
            msgEl.innerHTML = `<span style="color: #27ae60; font-weight: bold; display:inline-flex; align-items:center; gap:6px;">${icon}<span>${payload.message}</span></span>`;
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

