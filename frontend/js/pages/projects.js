/**
 * pages/projects.js - Modern, fast projects list with live filtering and status tags
 */
let allLoadedProjects = [];
let currentFilter = 'all';
let currentSort = 'recent';
let activeContextMenuProjectId = null;

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

  const sortSelect = document.getElementById('projects-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      filterAndDisplayProjects();
    });
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

  setupProjectContextMenu();

  window.addEventListener('languageChanged', () => {
    filterAndDisplayProjects();
  });
}

function sortProjectsList(list) {
  return [...list].sort((a, b) => {
    if (currentSort === 'alpha') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (currentSort === 'pages_desc') {
      return (b.page_count || 0) - (a.page_count || 0);
    } else if (currentSort === 'pages_asc') {
      return (a.page_count || 0) - (b.page_count || 0);
    } else {
      // 'recent'
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    }
  });
}

function filterAndDisplayProjects() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('projects-tbody');
  if (!tbody) return;

  let filtered = allLoadedProjects.filter(p => {
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

  filtered = sortProjectsList(filtered);

  tbody.innerHTML = '';
  if (allLoadedProjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px 20px;">
          <div style="width: 52px; height: 52px; margin: 0 auto 12px; border-radius: var(--radius-full); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center;">
            ${window.AppIcons ? window.AppIcons.get('projects', 'width:28px;height:28px;') : '📁'}
          </div>
          <h3 style="margin: 0 0 6px 0; color: var(--color-text); font-size: 16px; font-weight: 700;">${window.AppI18n ? window.AppI18n.t('projects.none') : 'لا توجد مشاريع حتى الآن'}</h3>
          <p style="color: var(--color-text-muted); font-size: 13px; margin: 0 0 16px 0;">ابدأ بإنشاء أول مشروع لك لمعالجة وتدقيق النصوص العربية</p>
          <button type="button" class="btn-primary trigger-new-project" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px;">
            ${window.AppIcons ? window.AppIcons.get('plus', 'width:14px;height:14px;') : '+'}
            <span>${window.AppI18n ? window.AppI18n.t('nav.newProject') : 'مشروع جديد'}</span>
          </button>
        </td>
      </tr>
    `;
    return;
  }

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
          <button class="table-btn table-btn-menu" data-id="${p.id}" title="خيارات إضافية (يمين الفأرة)" style="padding: 4px 10px; font-weight: bold; background: var(--color-bg-muted); color: var(--color-text);">⋮</button>
        </div>
      </td>
    `;
    tr.dataset.id = p.id;
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showProjectContextMenu(p.id, e.clientX, e.clientY);
    });
    tbody.appendChild(tr);
  });

  if (window.AppIcons && typeof window.AppIcons.applyIcons === 'function') {
    window.AppIcons.applyIcons(tbody);
  }

  bindTableActionButtons();
}

function showProjectContextMenu(projId, x, y) {
  activeContextMenuProjectId = projId;
  const menu = document.getElementById('project-card-context-menu');
  if (!menu) return;

  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
  menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  menu.classList.remove('hidden');
}

function hideProjectContextMenu() {
  const menu = document.getElementById('project-card-context-menu');
  if (menu) menu.classList.add('hidden');
  activeContextMenuProjectId = null;
}

function setupProjectContextMenu() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#project-card-context-menu')) {
      hideProjectContextMenu();
    }
  });

  document.getElementById('pctx-open')?.addEventListener('click', () => {
    if (activeContextMenuProjectId) {
      window.location.href = `project-dashboard.html?id=${encodeURIComponent(activeContextMenuProjectId)}`;
    }
    hideProjectContextMenu();
  });

  document.getElementById('pctx-rename')?.addEventListener('click', async () => {
    const projId = activeContextMenuProjectId;
    hideProjectContextMenu();
    if (!projId) return;
    const project = allLoadedProjects.find(p => p.id === projId);
    const oldTitle = project?.title || '';
    const newTitle = prompt(window.AppI18n ? window.AppI18n.t('projects.renamePrompt') : 'أدخل الاسم الجديد للمشروع:', oldTitle);
    if (newTitle && newTitle.trim() && newTitle.trim() !== oldTitle) {
      try {
        const api = window.AppApi || window.pywebview?.api;
        if (api?.update_project_metadata) {
          await api.update_project_metadata(projId, { title: newTitle.trim() });
        } else if (api?.call) {
          await api.call('update_project_metadata', projId, { title: newTitle.trim() });
        }
        if (window.showNotif) window.showNotif(window.AppI18n ? window.AppI18n.t('projects.renameSuccess') : 'تمت إعادة تسمية المشروع بنجاح', 'success');
        await renderProjectsTable();
      } catch (err) {
        alert('فشل إعادة التسمية: ' + err);
      }
    }
  });

  document.getElementById('pctx-duplicate')?.addEventListener('click', async () => {
    const projId = activeContextMenuProjectId;
    hideProjectContextMenu();
    if (!projId) return;
    try {
      const api = window.AppApi || window.pywebview?.api;
      let res;
      if (api?.duplicate_project) {
        res = await api.duplicate_project(projId);
      } else if (api?.call) {
        res = await api.call('duplicate_project', projId);
      }
      if (res?.ok || res?.id) {
        if (window.showNotif) window.showNotif(window.AppI18n ? window.AppI18n.t('projects.duplicateSuccess') : 'تم استنساخ المشروع بنجاح', 'success');
        await renderProjectsTable();
      } else {
        alert('فشل استنساخ المشروع: ' + (res?.error || 'خطأ'));
      }
    } catch (err) {
      alert('خطأ أثناء الاستنساخ: ' + err);
    }
  });

  document.getElementById('pctx-export')?.addEventListener('click', () => {
    if (activeContextMenuProjectId) {
      window.location.href = `export.html?id=${encodeURIComponent(activeContextMenuProjectId)}`;
    }
    hideProjectContextMenu();
  });

  document.getElementById('pctx-delete')?.addEventListener('click', () => {
    const projId = activeContextMenuProjectId;
    hideProjectContextMenu();
    if (projId) {
      const btn = document.querySelector(`.table-btn-delete[data-id="${projId}"]`);
      btn?.click();
    }
  });
}

function bindTableActionButtons() {
  document.querySelectorAll('.table-btn-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      showProjectContextMenu(btn.dataset.id, rect.left, rect.bottom + 4);
    });
  });
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
  try {
    if (window.AppApi && typeof window.AppApi.getProjects === 'function') {
      allLoadedProjects = (await window.AppApi.getProjects()) || [];
    } else if (window.pywebview?.api?.get_projects) {
      allLoadedProjects = (await window.pywebview.api.get_projects()) || [];
    } else {
      allLoadedProjects = [];
    }
  } catch (err) {
    console.error('Failed to load projects:', err);
    allLoadedProjects = [];
  }
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
  let initialized = false;
  const safeInit = () => {
    if (initialized) return;
    initialized = true;
    initProjects();
  };

  if (window.AppApi && typeof window.AppApi.ready === 'function') {
    window.AppApi.ready().then(safeInit).catch(safeInit);
  } else if (window.pywebview && window.pywebview.api && window.pywebview.api.get_projects) {
    safeInit();
  } else {
    window.addEventListener('pywebviewready', safeInit);
    setTimeout(safeInit, 1200); // Browser/mock fallback
  }
});
