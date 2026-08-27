/**
 * pages/home.js - Modern, Fast & Calm Home Screen Controller
 */
async function initHome() {
  const recent = document.getElementById('recent-projects');
  if (recent) {
    // Show skeleton shimmer while loading
    recent.innerHTML = `
      <div class="skeleton-shimmer" style="height: 60px; margin-bottom: 10px; border-radius: var(--radius-lg);"></div>
      <div class="skeleton-shimmer" style="height: 60px; margin-bottom: 10px; border-radius: var(--radius-lg);"></div>
    `;
  }

  const api = window.AppApi || { call: (m,...a)=>window.pywebview.api[m](...a), getProjects: ()=>window.pywebview.api.get_projects() };
  let projects = [];
  try {
    projects = (await (api.getProjects ? api.getProjects() : api.call('get_projects'))) || [];
  } catch (e) {
    console.error('Error loading projects:', e);
  }

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

  if (recent) {
    recent.innerHTML = '';
    const sorted = [...projects].sort((a,b)=> new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
    if (sorted.length === 0) {
      recent.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; background: var(--color-surface); border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="color: var(--color-primary); margin-bottom: 8px;">${window.AppIcons ? window.AppIcons.get('projects', 'width:32px;height:32px;') : ''}</div>
          <p style="color: var(--color-text-muted); font-size: 14px; margin: 0;">${window.AppI18n ? window.AppI18n.t('home.noProjects') : 'لا توجد مشاريع سابقة حالياً. ابدأ بإنشاء مشروع جديد!'}</p>
        </div>`;
    } else {
      sorted.forEach((p, idx) => {
        const total = p.page_count || 0;
        const reviewed = p.reviewed_count || 0;
        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
        const card = document.createElement('a');
        card.className = 'recent-card';
        card.href = `project-dashboard.html?id=${encodeURIComponent(p.id)}`;
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        card.style.flexWrap = 'wrap';
        card.style.gap = '12px';
        card.style.textDecoration = 'none';
        card.style.color = 'inherit';

        const safeTitle = window.AppUtils ? window.AppUtils.escapeHtml(p.title || '') : (p.title || '');
        const safeAuthor = p.author ? (window.AppUtils ? window.AppUtils.escapeHtml(p.author) : p.author) : '';
        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString(document.documentElement.lang || 'ar-EG') : '';

        const isRtl = document.documentElement.dir === 'rtl' || !document.documentElement.dir;
        const chevronName = isRtl ? 'chevronLeft' : 'chevronRight';

        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px;">
            <div style="width: 42px; height: 42px; border-radius: var(--radius-md); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${window.AppIcons ? window.AppIcons.get('book', 'width:20px;height:20px;') : ''}
            </div>
            <div>
              <span class="recent-card-title" style="color: var(--color-text); font-weight: 700; display: block;">${safeTitle}</span>
              <div class="recent-card-meta" style="color: var(--color-text-muted); font-size: 12px; margin-top: 3px;">
                ${safeAuthor ? `${safeAuthor} · ` : ''}
                ${total} ${window.AppI18n ? (total === 1 ? window.AppI18n.t('dash.page') : window.AppI18n.t('dashStats.pages')) : 'صفحة'} · ${dateStr}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="text-align: end; min-width: 80px;">
              <span class="status-badge ${pct === 100 ? 'completed' : (pct > 0 ? 'reviewed' : 'pending')}">
                ${pct === 100 ? (window.AppI18n ? window.AppI18n.t('filter.completed') : 'مكتمل') : (pct > 0 ? (window.AppI18n ? `${pct}% ` + window.AppI18n.t('stats.completed') : `${pct}% منجز`) : (window.AppI18n ? window.AppI18n.t('filter.new') : 'جديد'))}
              </span>
            </div>
            <div class="recent-progress" style="width: 120px;"><div class="recent-progress-fill" style="width:${pct}%"></div></div>
            <div style="color: var(--color-text-muted); display: flex; align-items: center;">
              ${window.AppIcons ? window.AppIcons.get(chevronName, 'width:16px;height:16px;') : ''}
            </div>
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

window.addEventListener('languageChanged', () => {
  initHome();
});

document.addEventListener('DOMContentLoaded', () => {
  if (window.AppApi && typeof window.AppApi.ready === 'function') {
    window.AppApi.ready().then(initHome);
  } else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_projects) {
    initHome();
  } else {
    window.addEventListener('pywebviewready', initHome);
  }
});
