/**
 * pages/projects.js - Modern, fast projects list with live filtering and status tags
 */
let allLoadedProjects = [];
let currentFilter = 'all';

async function initProjects() {
  await renderProjectsTable();

  document.getElementById('back-btn')?.addEventListener('click', ()=>{
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) window.history.back();
    else window.location.href = 'index.html';
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndDisplayProjects());
  }

  const filterButtons = document.querySelectorAll('#projects-filter-bar button');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active', 'btn-primary'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      filterAndDisplayProjects();
    });
  });
}

function filterAndDisplayProjects() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('projects-tbody');
  if (!tbody) return;

  const filtered = allLoadedProjects.filter(p => {
    const total = p.page_count || 0;
    const reviewed = p.reviewed_count || 0;
    const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    // Filter by status
    if (currentFilter === 'completed' && pct < 100) return false;
    if (currentFilter === 'in_progress' && (pct === 0 || pct === 100)) return false;
    if (currentFilter === 'new' && pct > 0) return false;

    // Filter by search query
    if (query) {
      const matchTitle = (p.title || '').toLowerCase().includes(query);
      const matchAuthor = (p.author || '').toLowerCase().includes(query);
      if (!matchTitle && !matchAuthor) return false;
    }

    return true;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted); padding:40px;">${window.AppI18n ? window.AppI18n.t('projects.none') : 'لا توجد مشاريع مطابقة للبحث'}</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const total = p.page_count || 0;
    const reviewed = p.reviewed_count || 0;
    const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    const date = new Date(p.created_at).toLocaleDateString(document.documentElement.lang || 'ar-EG');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${window.AppUtils ? window.AppUtils.escapeHtml(p.title) : p.title}</strong></td>
      <td>${p.author ? (window.AppUtils ? window.AppUtils.escapeHtml(p.author) : p.author) : '—'}</td>
      <td style="direction:ltr; text-align:start;">${date}</td>
      <td>${total || '—'}</td>
      <td>
        <div class="progress-cell">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-label">${pct}%</span>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="table-btn table-btn-open" data-icon="eye" data-id="${p.id}">${window.AppI18n ? window.AppI18n.t('projects.open') : 'فتح'}</button>
          <button class="table-btn table-btn-delete" data-icon="trash" data-id="${p.id}">${window.AppI18n ? window.AppI18n.t('projects.delete') : 'حذف'}</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  bindTableActionButtons();
}

function bindTableActionButtons() {
  document.querySelectorAll('.table-btn-open').forEach(btn => {
    btn.addEventListener('click', () => { window.location.href = `project-dashboard.html?id=${btn.dataset.id}`; });
  });

  document.querySelectorAll('.table-btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const projId = btn.dataset.id;
      const projectObj = allLoadedProjects.find(p => p.id === projId);
      const projTitle = projectObj?.title || (window.AppI18n ? window.AppI18n.t('projects.untitled') : 'مشروع');
      
      const executeDeletion = async (deleteFiles) => {
        await window.pywebview.api.delete_project(projId, deleteFiles);
        await renderProjectsTable();
      };

      const prompt = window.__appSettings?.promptDeleteProject !== false;
      const defaultDeleteFiles = window.__appSettings?.deleteProjectFiles !== false;

      if (prompt && window.AestheticDialog?.deleteConfirm) {
        window.AestheticDialog.deleteConfirm({
          title: window.AppI18n ? window.AppI18n.t('projects.deleteTitle') : 'تأكيد الحذف',
          message: window.AppI18n ? window.AppI18n.t('projects.deleteMessage', { title: projTitle }) : `هل أنت متأكد من حذف ${projTitle}؟`,
          deleteFilesLabel: window.AppI18n ? window.AppI18n.t('projects.deleteFiles') : 'حذف الملفات من القرص',
          defaultDeleteFiles,
          showRemember: true,
          onConfirm: async ({deleteFiles, remember}) => {
            if (remember) {
              window.__appSettings.promptDeleteProject = false;
              window.__appSettings.deleteProjectFiles = deleteFiles;
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

async function renderProjectsTable() {
  allLoadedProjects = (await window.pywebview.api.get_projects()) || [];
  allLoadedProjects.sort((a,b) => (b.created_at > a.created_at ? 1 : -1));

  // Update counts
  let completedCount = 0;
  let progressCount = 0;
  let newCount = 0;

  allLoadedProjects.forEach(p => {
    const total = p.page_count || 0;
    const reviewed = p.reviewed_count || 0;
    const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    if (pct === 100) completedCount++;
    else if (pct > 0) progressCount++;
    else newCount++;
  });

  const cAll = document.getElementById('count-all');
  const cComp = document.getElementById('count-completed');
  const cProg = document.getElementById('count-progress');
  const cNew = document.getElementById('count-new');

  if (cAll) cAll.textContent = allLoadedProjects.length;
  if (cComp) cComp.textContent = completedCount;
  if (cProg) cProg.textContent = progressCount;
  if (cNew) cNew.textContent = newCount;

  filterAndDisplayProjects();
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.AppApi && typeof window.AppApi.ready === 'function') {
    window.AppApi.ready().then(initProjects);
  } else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_projects) {
    initProjects();
  } else {
    window.addEventListener('pywebviewready', initProjects);
  }
});
