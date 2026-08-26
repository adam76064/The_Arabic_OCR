const dashboardStatsText = (key, replacements) => window.AppI18n?.t(key, replacements) || key;

/**
 * pages/project-dashboard/stats.js - extracted from monolith
 * Unified tokenized styling for light and dark modes.
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

    // Bar chart via inline SVG
    const barData = [
        { label: dashboardStatsText('dashStats.all'), val: total, color: '#94a3b8' },
        { label: 'OCR', val: ocred, color: '#3b82f6' },
        { label: dashboardStatsText('dashStats.layout'), val: layoutCount, color: '#0ea5e9' },
        { label: dashboardStatsText('dashStats.review'), val: reviewed, color: '#10b981' },
    ];
    const maxVal = Math.max(total, 1);
    const bars = barData.map((d, i) => {
        const h = Math.round((d.val / maxVal) * 120);
        return `<g transform="translate(${i*75+20},0)">
            <rect x="0" y="${130-h}" width="45" height="${h}" fill="${d.color}" rx="6"/>
            <text x="22.5" y="${130-h-5}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--color-text)">${d.val}</text>
            <text x="22.5" y="148" text-anchor="middle" font-size="11" font-weight="600" fill="var(--color-text-muted)">${d.label}</text>
        </g>`;
    });

    // Page grid: color by status
    const gridCells = pages.map((pg, i) => {
        const isOcred = (pg.ocr_data || []).length > 0;
        const allBlocksReviewed = isOcred && pg.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        const isReviewed = (pg.status === 'reviewed' || allBlocksReviewed) && pg.status !== 'pending' && pg.status !== 'unreviewed';

        let fill = 'var(--color-bg-muted)'; // pending
        let border = 'var(--color-border)';
        if (isOcred) { fill = 'rgba(59, 130, 246, 0.25)'; border = 'rgba(59, 130, 246, 0.5)'; }
        
        const isLayoutParsed = isOcred && pg.ocr_data.some(b => b.category !== 'Text' || (b.text && b.text.trim() !== ""));
        if (isLayoutParsed) { fill = 'rgba(14, 165, 233, 0.25)'; border = 'rgba(14, 165, 233, 0.5)'; }
        
        if (isReviewed) { fill = 'rgba(16, 185, 129, 0.25)'; border = 'rgba(16, 185, 129, 0.5)'; }
        
        const statusText = isReviewed ? dashboardStatsText('dashStats.reviewed') : isOcred ? dashboardStatsText('dashStats.extracted') : dashboardStatsText('dashStats.waitingOcr');
        const title = dashboardStatsText('dashStats.pageTitle', { page: i + 1, status: statusText });
        return `<div title="${title}" style="width:22px;height:22px;border-radius:4px;background:${fill};cursor:pointer;border:1px solid ${border};transition:transform 0.15s;" onclick="window.location.href='review.html?id=${currentProjectId}&page=${i}'"></div>`;
    }).join('');

    const userRows = Object.entries(userStats).map(([u, st]) => {
        const pct2 = totalBlocks ? Math.round(st.blocks / totalBlocks * 100) : 0;
        return `<tr style="border-bottom: 1px solid var(--color-border);">
            <td style="padding:10px 14px; color: var(--color-text); font-weight: 600;">${u}</td>
            <td style="padding:10px 14px; color: var(--color-text);">${st.blocks}</td>
            <td style="padding:10px 14px; color: var(--color-text);">${st.pages.size}</td>
            <td style="padding:10px 14px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="flex:1;height:8px;background:var(--color-bg-muted);border-radius:4px;overflow:hidden;">
                        <div style="width:${pct2}%;height:100%;background:var(--color-primary);border-radius:4px;"></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:var(--color-text-muted);">${pct2}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:16px;">
            <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--color-border);box-shadow:var(--shadow-xs);">
                <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);margin-bottom:6px;">${dashboardStatsText('dashStats.overall')}</div>
                <div style="font-size:36px;font-weight:800;color:var(--color-success);">${pct}%</div>
                <div style="height:8px;background:var(--color-bg-muted);border-radius:4px;margin-top:10px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:var(--color-success);border-radius:4px;transition:width .5s;"></div>
                </div>
                <div style="font-size:12px;font-weight:500;color:var(--color-text-muted);margin-top:8px;">${window.AppI18n ? window.AppI18n.t('dashStats.reviewedCount', { reviewed, total }) : `${reviewed} من ${total} صفحة تمت مراجعتها`}</div>
            </div>
            <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--color-border);box-shadow:var(--shadow-xs);">
                <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);margin-bottom:10px;">${dashboardStatsText('dashStats.processing')}</div>
                <svg viewBox="-10 0 ${barData.length * 75 + 30} 160" width="100%" height="130" style="overflow: visible;">
                    ${bars.join('')}
                </svg>
            </div>
        </div>
        <div style="background:var(--color-surface);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--color-border);box-shadow:var(--shadow-xs);">
            <div style="font-size:14px;font-weight:700;color:var(--color-text);margin-bottom:14px;">${dashboardStatsText('dashStats.map')}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${gridCells}</div>
            <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:16px;font-size:12px;color:var(--color-text-muted);">
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:12px;height:12px;background:var(--color-bg-muted);border-radius:2px;border:1px solid var(--color-border);"></span>${dashboardStatsText('dashStats.waitingOcr')}</span>
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:12px;height:12px;background:rgba(59, 130, 246, 0.35);border-radius:2px;border:1px solid rgba(59, 130, 246, 0.6);"></span>${dashboardStatsText('dashStats.ocrPresent')}</span>
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:12px;height:12px;background:rgba(14, 165, 233, 0.35);border-radius:2px;border:1px solid rgba(14, 165, 233, 0.6);"></span>${dashboardStatsText('dashStats.laidOut')}</span>
                <span style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:12px;height:12px;background:rgba(16, 185, 129, 0.35);border-radius:2px;border:1px solid rgba(16, 185, 129, 0.6);"></span>${dashboardStatsText('dashStats.reviewed')}</span>
            </div>
        </div>
        ${userRows ? `
        <div style="background:var(--color-surface);border-radius:var(--radius-lg);border:1px solid var(--color-border);overflow:hidden;margin-top:16px;box-shadow:var(--shadow-xs);">
            <div style="padding:14px 18px;font-size:14px;font-weight:700;color:var(--color-text);border-bottom:1px solid var(--color-border);">${dashboardStatsText('dashStats.members')}</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:var(--color-bg-alt);border-bottom:1px solid var(--color-border);">
                    <th style="padding:10px 14px;text-align:start;font-size:12px;font-weight:700;color:var(--color-text-secondary);">${dashboardStatsText('dashStats.user')}</th>
                    <th style="padding:10px 14px;text-align:start;font-size:12px;font-weight:700;color:var(--color-text-secondary);">${dashboardStatsText('dashStats.blocks')}</th>
                    <th style="padding:10px 14px;text-align:start;font-size:12px;font-weight:700;color:var(--color-text-secondary);">${dashboardStatsText('dashStats.pages')}</th>
                    <th style="padding:10px 14px;text-align:start;font-size:12px;font-weight:700;color:var(--color-text-secondary);">${dashboardStatsText('dashStats.participation')}</th>
                </tr></thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>` : ''}
    `;
}

window.renderDashboardStats = renderDashboardStats;
