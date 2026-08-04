/**
 * pages/home.js - rebuilt with AppApi wrapper
 */
async function initHome() {
  const api = window.AppApi || { call: (m,...a)=>window.pywebview.api[m](...a), getProjects: ()=>window.pywebview.api.get_projects() };
  const projects = (await (api.getProjects ? api.getProjects() : api.call('get_projects'))) || [];

  const badge = document.getElementById('projects-count');
  if (badge) badge.textContent = projects.length;

  const recent = document.getElementById('recent-projects');
  if (recent) {
    recent.innerHTML = '';
    const sorted = [...projects].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0,4);
    if (sorted.length === 0) {
      recent.innerHTML = '<p style="color:#aaa; font-size:14px;">لا توجد مشاريع بعد.</p>';
    } else {
      sorted.forEach(p => {
        const total = p.page_count || 0;
        const reviewed = p.reviewed_count || 0;
        const pct = total>0? Math.round(reviewed/total*100):0;
        const card = document.createElement('a');
        card.className = 'recent-card';
        card.href = `project-dashboard.html?id=${p.id}`;
        card.innerHTML = `
          <div>
            <div class="recent-card-title">${window.AppUtils ? window.AppUtils.escapeHtml(p.title) : p.title}</div>
            <div class="recent-card-meta">${p.author || ''} · ${new Date(p.created_at).toLocaleDateString('ar-EG')}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="recent-progress"><div class="recent-progress-fill" style="width:${pct}%"></div></div>
            <span style="font-size:12px; color:#888;">${pct}%</span>
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
