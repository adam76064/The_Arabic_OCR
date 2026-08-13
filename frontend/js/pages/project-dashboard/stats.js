const dashboardStatsText = (key, replacements) => window.AppI18n?.t(key, replacements) || key;

/**
 * pages/project-dashboard/stats.js - extracted from monolith
 */

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
        { label: dashboardStatsText('dashStats.all'), val: total, color: '#95a5a6' },
        { label: 'OCR', val: ocred, color: '#3498db' },
        { label: dashboardStatsText('dashStats.layout'), val: layoutCount, color: '#0369a1' },
        { label: dashboardStatsText('dashStats.review'), val: reviewed, color: '#27ae60' },
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
        
        const statusText = isReviewed ? dashboardStatsText('dashStats.reviewed') : isOcred ? dashboardStatsText('dashStats.extracted') : dashboardStatsText('dashStats.waitingOcr');
        const title = dashboardStatsText('dashStats.pageTitle', { page: i + 1, status: statusText });
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
                <div style="font-size:13px;color:#888;margin-bottom:4px;">${dashboardStatsText('dashStats.overall')}</div>
                <div style="font-size:36px;font-weight:800;color:#27ae60;">${pct}%</div>
                <div style="height:8px;background:#eee;border-radius:4px;margin-top:10px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:#27ae60;border-radius:4px;transition:width .5s;"></div>
                </div>
                <div style="font-size:12px;color:#888;margin-top:6px;">${reviewed} من ${total} صفحة مراجَعة</div>
            </div>
            <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <div style="font-size:13px;color:#888;margin-bottom:10px;">${dashboardStatsText('dashStats.processing')}</div>
                <svg viewBox="-10 0 ${barData.length * 75 + 30} 160" width="100%" height="130" style="overflow: visible;">
                    ${bars.join('')}
                </svg>
            </div>
        </div>
        <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
            <div style="font-size:13px;font-weight:700;color:#555;margin-bottom:12px;">${dashboardStatsText('dashStats.map')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${gridCells}</div>
            <div style="display:flex;gap:14px;margin-top:14px;font-size:12px;color:#888;">
                <span><span style="display:inline-block;width:12px;height:12px;background:#eee;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #ddd;"></span>${dashboardStatsText('dashStats.waitingOcr')}</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#aed6f1;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #99c9e8;"></span>${dashboardStatsText('dashStats.ocrPresent')}</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#bae6fd;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #7dd3fc;"></span>${dashboardStatsText('dashStats.laidOut')}</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#a9dfbf;border-radius:2px;vertical-align:middle;margin-left:4px;border:1px solid #8cc9a5;"></span>تمت المراجَعة</span>
            </div>
        </div>
        ${userRows ? `
        <div style="background:white;border-radius:10px;border:1px solid #e0e0e0;overflow:hidden;margin-top:20px;box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
            <div style="padding:14px 16px;font-size:13px;font-weight:700;color:#555;border-bottom:1px solid #eee;">${dashboardStatsText('dashStats.members')}</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8f9fa;">
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">${dashboardStatsText('dashStats.user')}</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">${dashboardStatsText('dashStats.blocks')}</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">${dashboardStatsText('dashStats.pages')}</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">${dashboardStatsText('dashStats.participation')}</th>
                </tr></thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>` : ''}
    `;
}

