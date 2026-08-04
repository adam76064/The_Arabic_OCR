(function () {
    // 1. Read persistent state immediately
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

    function injectSidebar() {
        if (document.getElementById('sidebar')) return; // Avoid duplicate injection

        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        const sidebarHTML = `
            <aside id="sidebar" class="${isCollapsed ? 'collapsed' : ''}">
                <div id="sidebar-toggle-row">
                    <span class="sidebar-app-name">◈ أداة مراجعة OCR</span>
                    <button id="toggle-sidebar" title="إخفاء الشريط الجانبي">◁</button>
                </div>
                <nav class="sidebar-nav">
                    <a href="index.html" class="sidebar-link ${currentPath === 'index.html' ? 'active' : ''}">🏠 الرئيسية</a>
                    <a href="projects.html" class="sidebar-link ${currentPath === 'projects.html' ? 'active' : ''}">📂 المشاريع</a>
                    <a href="#" class="sidebar-link sidebar-link-accent trigger-new-project">＋ مشروع جديد</a>
                    <a href="settings.html" class="sidebar-link ${currentPath === 'settings.html' ? 'active' : ''}">⚙ الإعدادات</a>
                    <a href="#" id="sidebar-exit-btn" class="sidebar-link sidebar-link-danger">❌ خروج</a>
                </nav>
                <div class="sidebar-project-info" id="sidebar-project-info" style="${currentPath.includes('review.html') ? '' : 'display:none;'}">
                    <div class="sidebar-project-title" id="sidebar-proj-title"></div>
                    <div class="sidebar-project-meta" id="sidebar-proj-meta"></div>
                </div>
            </aside>
            <button id="sidebar-collapsed-tab" class="${isCollapsed ? '' : 'hidden'}" title="فتح الشريط الجانبي">▷</button>
        `;

        document.body.classList.add('has-sidebar');
        document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        bindSidebarEvents();
    }

    function bindSidebarEvents() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggle-sidebar');
        const tabBtn = document.getElementById('sidebar-collapsed-tab');
        const exitBtn = document.getElementById('sidebar-exit-btn');

        if (toggleBtn && sidebar && tabBtn) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.add('collapsed');
                tabBtn.classList.remove('hidden');
                localStorage.setItem('sidebarCollapsed', 'true');
            });

            tabBtn.addEventListener('click', () => {
                sidebar.classList.remove('collapsed');
                tabBtn.classList.add('hidden');
                localStorage.setItem('sidebarCollapsed', 'false');
            });
        }

        if (exitBtn) {
            exitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('هل أنت متأكد من الخروج من التطبيق؟')) {
                    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
                        window.pywebview.api.close_app();
                    } else {
                        window.close();
                    }
                }
            });
        }
    }

    // Apply state on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        const existingSidebar = document.getElementById('sidebar');
        const existingTab = document.getElementById('sidebar-collapsed-tab');

        if (existingSidebar && existingTab) {
            // Respect stored state on review page
            if (isCollapsed) {
                existingSidebar.classList.add('collapsed');
                existingTab.classList.remove('hidden');
            } else {
                existingSidebar.classList.remove('collapsed');
                existingTab.classList.add('hidden');
            }
            bindSidebarEvents();
        } else {
            injectSidebar();
        }
    });
})();