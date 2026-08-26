/**
 * pages/home.js - Modern, fast & interactive Home screen controller
 */
async function initHome() {
  const api = window.AppApi || { call: (m,...a)=>window.pywebview.api[m](...a), getProjects: ()=>window.pywebview.api.get_projects() };
  const projects = (await (api.getProjects ? api.getProjects() : api.call('get_projects'))) || [];

  const badge = document.getElementById('projects-count');
  if (badge) badge.textContent = projects.length;

  const dropzone = document.getElementById('hero-dropzone');
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });
  }

  const recent = document.getElementById('recent-projects');
  if (recent) {
    recent.innerHTML = '';
    const sorted = [...projects].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    if (sorted.length === 0) {
      recent.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; background: var(--color-surface); border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="color: var(--color-text-muted); margin-bottom: 8px;">${window.AppIcons ? window.AppIcons.get('projects', 'width:32px;height:32px;') : ''}</div>
          <p style="color: var(--color-text-muted); font-size: 14px; margin: 0;">${window.AppI18n ? window.AppI18n.t('home.noProjects') : 'لا توجد مشاريع سابقة حالياً. ابدأ بإنشاء مشروع جديد!'}</p>
        </div>`;
    } else {
      sorted.forEach(p => {
        const total = p.page_count || 0;
        const reviewed = p.reviewed_count || 0;
        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
        const card = document.createElement('a');
        card.className = 'recent-card';
        card.href = `project-dashboard.html?id=${p.id}`;
        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${window.AppIcons ? window.AppIcons.get('book', 'width:20px;height:20px;') : ''}
            </div>
            <div>
              <div class="recent-card-title">${window.AppUtils ? window.AppUtils.escapeHtml(p.title) : p.title}</div>
              <div class="recent-card-meta">
                ${p.author ? `${window.AppUtils ? window.AppUtils.escapeHtml(p.author) : p.author} · ` : ''}
                ${total} ${window.AppI18n ? window.AppI18n.t('projects.pages') : 'صفحة'} · 
                ${new Date(p.created_at).toLocaleDateString(document.documentElement.lang || 'ar-EG')}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="text-align: end;">
              <span class="status-badge ${pct === 100 ? 'completed' : (pct > 0 ? 'reviewed' : 'pending')}">
                ${pct === 100 ? 'مكتمل' : (pct > 0 ? `${pct}% منجز` : 'جديد')}
              </span>
            </div>
            <div class="recent-progress"><div class="recent-progress-fill" style="width:${pct}%"></div></div>
          </div>
        `;
        recent.appendChild(card);
      });
    }
  }

  const settingsModal = document.getElementById('settings-modal');
  const close = () => settingsModal?.classList.add('hidden');
  document.getElementById('settings-close')?.addEventListener('click', close);
  document.getElementById('settings-overlay')?.addEventListener('click', close);
  document.getElementById('home-settings-btn')?.addEventListener('click', ()=> settingsModal?.classList.remove('hidden'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_projects) initHome();
  else window.addEventListener('pywebviewready', initHome);
});
