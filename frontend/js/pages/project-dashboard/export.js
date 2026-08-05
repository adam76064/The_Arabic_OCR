/**
 * pages/project-dashboard/export.js - extracted from monolith
 */

function setupExportSystem() {
    document.getElementById('export-btn').addEventListener('click', () => {
        window.location.href = `export.html?id=${currentProjectId}`;
    });
}

