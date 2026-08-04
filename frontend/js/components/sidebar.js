/**
 * components/sidebar.js - collapsible sidebar with injection if missing
 * Merged logic from legacy sidebar.js + new token-based version
 */
(function () {
  const isCollapsedInitial = (() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true' || localStorage.getItem('sidebarCollapsed') === '1';
    } catch(e) { return false; }
  })();

  function injectSidebarIfNeeded() {
    if (document.getElementById('sidebar')) {
      // ensure collapsed state respected
      if (isCollapsedInitial) {
        document.getElementById('sidebar')?.classList.add('collapsed');
        document.getElementById('sidebar-collapsed-tab')?.classList.remove('hidden');
      }
      return;
    }

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const sidebarHTML = `
            <aside id="sidebar" class="${isCollapsedInitial ? 'collapsed' : ''}">
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
                <div class="sidebar-project-info" id="sidebar-project-info" style="${currentPath.includes('review') ? '' : 'display:none;'}">
                    <div class="sidebar-project-title" id="sidebar-proj-title"></div>
                    <div class="sidebar-project-meta" id="sidebar-proj-meta"></div>
                </div>
            </aside>
            <button id="sidebar-collapsed-tab" class="${isCollapsedInitial ? '' : 'hidden'}" title="فتح الشريط الجانبي">▷</button>
        `;

    document.body.classList.add('has-sidebar');
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
  }

  function bindSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const tabBtn = document.getElementById('sidebar-collapsed-tab');
    const exitBtn = document.getElementById('sidebar-exit-btn');

    if (!sidebar) return;

    function setCollapsed(collapsed) {
      sidebar.classList.toggle('collapsed', collapsed);
      if (tabBtn) tabBtn.classList.toggle('hidden', !collapsed);
      try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch(e) {}
    }

    // restore
    try {
      const was = localStorage.getItem('sidebarCollapsed') === '1' || localStorage.getItem('sidebarCollapsed') === 'true';
      setCollapsed(was);
    } catch(e) {}

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        setCollapsed(!isCollapsed);
      });
    }
    if (tabBtn) {
      tabBtn.addEventListener('click', () => setCollapsed(false));
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

    // active link
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && current === href) {
        link.classList.add('active');
      }
    });
  }

  function initSidebar() {
    injectSidebarIfNeeded();
    bindSidebarEvents();
  }

  document.addEventListener('DOMContentLoaded', initSidebar);
  window.addEventListener('pywebviewready', initSidebar);
})();
