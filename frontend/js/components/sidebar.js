/**
 * components/sidebar.js - Collapsible Sidebar with SVG Icons & Non-blocking Exit
 */
(function () {
  function readCollapsedState() {
    try {
      const v = localStorage.getItem('sidebarCollapsed');
      return v === 'true' || v === '1';
    } catch (e) { return false; }
  }

  function injectSidebarIfNeeded() {
    let sidebar = document.getElementById('sidebar');
    if (sidebar) {
      document.body.classList.add('has-sidebar');
      return sidebar;
    }

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isCollapsed = readCollapsedState();

    const icon = (name) => (window.AppIcons ? window.AppIcons.get(name) : '');

    const sidebarHTML = `
            <aside id="sidebar" class="${isCollapsed ? 'collapsed' : ''}">
                <div id="sidebar-toggle-row">
                    <span class="sidebar-app-name">${icon('logo')} <span data-i18n="app.name">أداة مراجعة OCR</span></span>
                    <button id="toggle-sidebar" data-i18n-title="sidebar.hide" title="إخفاء الشريط الجانبي">${icon('collapseRTL')}</button>
                </div>
                <nav class="sidebar-nav">
                    <a href="index.html" class="sidebar-link ${currentPath === 'index.html' ? 'active' : ''}">${icon('home')}<span data-i18n="nav.home">الرئيسية</span></a>
                    <a href="projects.html" class="sidebar-link ${currentPath === 'projects.html' ? 'active' : ''}">${icon('projects')}<span data-i18n="nav.projects">المشاريع</span></a>
                    <a href="#" class="sidebar-link sidebar-link-accent trigger-new-project">${icon('plus')}<span data-i18n="nav.newProject">مشروع جديد</span></a>
                    <a href="settings.html" class="sidebar-link ${currentPath === 'settings.html' ? 'active' : ''}">${icon('settings')}<span data-i18n="nav.settings">الإعدادات</span></a>
                    <a href="#" id="sidebar-exit-btn" class="sidebar-link sidebar-link-danger">${icon('exit')}<span data-i18n="nav.exit">خروج</span></a>
                </nav>
                <div class="sidebar-project-info" id="sidebar-project-info" style="${currentPath.includes('review') ? '' : 'display:none;'}">
                    <div class="sidebar-project-title" id="sidebar-proj-title"></div>
                    <div class="sidebar-project-meta" id="sidebar-proj-meta"></div>
                </div>
            </aside>
            <button id="sidebar-collapsed-tab" class="${isCollapsed ? '' : 'hidden'}" data-i18n-title="sidebar.show" title="فتح الشريط الجانبي">${icon('expandRTL')}</button>
        `;

    document.body.classList.add('has-sidebar');
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    const injected = document.getElementById('sidebar');
    if (globalThis.AppI18n) globalThis.AppI18n.applyDocumentLanguage();
    return injected;
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
      try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
      document.body.classList.add('has-sidebar');
    }

    setCollapsed(readCollapsedState());

    if (toggleBtn && !toggleBtn._sidebarBound) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        setCollapsed(!isCollapsed);
      });
      toggleBtn._sidebarBound = true;
    }

    if (tabBtn && !tabBtn._sidebarBound) {
      tabBtn.addEventListener('click', () => {
        setCollapsed(false);
      });
      tabBtn._sidebarBound = true;
    }

    if (exitBtn && !exitBtn._sidebarBound) {
      exitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const confirmExit = () => {
          if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_app === 'function') {
            window.pywebview.api.close_app();
          } else {
            window.close();
          }
        };

        if (window.AestheticDialog) {
          window.AestheticDialog.confirm({
            title: window.AppI18n ? window.AppI18n.t('nav.exit') : 'خروج',
            message: window.AppI18n ? window.AppI18n.t('sidebar.exitConfirm') : 'هل أنت متأكد من رغبتك في إغلاق التطبيق؟',
            confirmText: window.AppI18n ? window.AppI18n.t('nav.exit') : 'خروج',
            onConfirm: confirmExit
          });
        } else {
          if (confirm(window.AppI18n ? window.AppI18n.t('sidebar.exitConfirm') : 'هل تريد الخروج؟')) {
            confirmExit();
          }
        }
      });
      exitBtn._sidebarBound = true;
    }

    // Active link highlighting
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
    setTimeout(bindSidebarEvents, 0);
    setTimeout(bindSidebarEvents, 100);
  }

  document.addEventListener('DOMContentLoaded', initSidebar);
  window.addEventListener('pywebviewready', initSidebar);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(initSidebar, 0);
  }
})();
