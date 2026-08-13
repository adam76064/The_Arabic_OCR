/**
 * pages/projects.js - rebuilt with modular API
 */
async function initProjects() {
  await renderProjectsTable();
  document.getElementById('back-btn')?.addEventListener('click', ()=>{
    if (window.history.length>1 && document.referrer && document.referrer.includes(window.location.host)) window.history.back();
    else window.location.href='index.html';
  });
  document.getElementById('search-input')?.addEventListener('input', function(){
    const q=this.value.toLowerCase();
    document.querySelectorAll('#projects-tbody tr').forEach(row=>{
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

async function renderProjectsTable() {
  const projects = await window.pywebview.api.get_projects();
  const tbody = document.getElementById('projects-tbody');
  if (!tbody) return;
  tbody.innerHTML='';

  if (!projects || projects.length===0) {
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center; color:#aaa; padding:40px;">${window.AppI18n.t('projects.none')}</td></tr>`;
    return;
  }

  projects.sort((a,b)=> b.created_at > a.created_at ? 1 : -1).forEach(p=>{
    const total=p.page_count||0;
    const reviewed=p.reviewed_count||0;
    const pct= total>0? Math.round(reviewed/total*100):0;
    const date=new Date(p.created_at).toLocaleDateString(document.documentElement.lang || 'ar-EG');
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${p.title}</strong></td>
      <td>${p.author||'—'}</td>
      <td style="direction:ltr; text-align:right;">${date}</td>
      <td>${total||'—'}</td>
      <td><div class="progress-cell"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-label">${pct}%</span></div></td>
      <td><div class="table-actions"><button class="table-btn table-btn-open" data-id="${p.id}">${window.AppI18n.t('projects.open')}</button><button class="table-btn table-btn-delete" data-id="${p.id}">${window.AppI18n.t('projects.delete')}</button></div></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.table-btn-open').forEach(btn=>{
    btn.addEventListener('click', ()=>{ window.location.href=`project-dashboard.html?id=${btn.dataset.id}`; });
  });
  document.querySelectorAll('.table-btn-delete').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const projId=btn.dataset.id;
      const projectObj=projects.find(p=>p.id===projId);
      const projTitle=projectObj?.title||window.AppI18n.t('projects.untitled');
      const executeDeletion=async (deleteFiles)=>{
        await window.pywebview.api.delete_project(projId, deleteFiles);
        await renderProjectsTable();
      };
      const prompt=window.__appSettings?.promptDeleteProject!==false;
      const defaultDeleteFiles=window.__appSettings?.deleteProjectFiles!==false;
      if (prompt && window.AestheticDialog?.deleteConfirm) {
        window.AestheticDialog.deleteConfirm({
          title:window.AppI18n.t('projects.deleteTitle'),
          message:window.AppI18n.t('projects.deleteMessage', { title: projTitle }),
          deleteFilesLabel:window.AppI18n.t('projects.deleteFiles'),
          defaultDeleteFiles,
          showRemember:true,
          onConfirm: async ({deleteFiles, remember})=>{
            if (remember){
              window.__appSettings.promptDeleteProject=false;
              window.__appSettings.deleteProjectFiles=deleteFiles;
              if (typeof saveAppSettings==='function') saveAppSettings();
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

document.addEventListener('DOMContentLoaded', ()=>{
  if (window.pywebview && window.pywebview.api && window.pywebview.api.get_projects) initProjects();
  else window.addEventListener('pywebviewready', initProjects);
});
