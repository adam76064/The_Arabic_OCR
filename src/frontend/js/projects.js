async function initApp() {
    await renderTable();

    document.getElementById('search-input').addEventListener('input', function () {
        const q = this.value.toLowerCase();
        document.querySelectorAll('#projects-tbody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});

async function renderTable() {
    const projects = await window.pywebview.api.get_projects();
    const tbody = document.getElementById('projects-tbody');
    tbody.innerHTML = '';

    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#aaa; padding:40px;">لا توجد مشاريع بعد.</td></tr>';
        return;
    }

    projects.sort((a, b) => b.created_at > a.created_at ? 1 : -1).forEach(p => {
        const total = p.page_count || 0;
        const reviewed = p.reviewed_count || 0;
        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
        const date = new Date(p.created_at).toLocaleDateString('ar-EG');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.title}</strong></td>
            <td>${p.author || '—'}</td>
            <td style="direction:ltr; text-align:right;">${date}</td>
            <td>${total || '—'}</td>
            <td>
                <div class="progress-cell">
                    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                    <span class="progress-label">${pct}%</span>
                </div>
            </td>
            <td>
                <div class="table-actions">
                    <button class="table-btn table-btn-open" data-id="${p.id}">فتح</button>
                    <button class="table-btn table-btn-delete" data-id="${p.id}">حذف</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.table-btn-open').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `review.html?id=${btn.dataset.id}`;
        });
    });

    document.querySelectorAll('.table-btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) {
                await window.pywebview.api.delete_project(btn.dataset.id);
                await renderTable();
            }
        });
    });
}
