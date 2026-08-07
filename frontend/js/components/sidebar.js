/**
 * components/sidebar.js - collapsible sidebar with injection
 * Fixed: ensures has-sidebar, robust collapse, debug logs when debug=True
 */
(function () {
  console.log('[Sidebar] component loading...');

  function readCollapsedState() {
    try {
      const v = localStorage.getItem('sidebarCollapsed');
      return v === 'true' || v === '1';
    } catch (e) { return false; }
  }

  function injectSidebarIfNeeded() {
    let sidebar = document.getElementById('sidebar');
    if (sidebar) {
      console.log('[Sidebar] already exists, ensuring has-sidebar class');
      document.body.classList.add('has-sidebar');
      return sidebar;
    }

    console.log('[Sidebar] injecting sidebar HTML');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isCollapsed = readCollapsedState();

    // Icon names map to entries in AppIcons (js/icons.js), keeping this
    // sidebar visually consistent with the review page's SVG toolbars
    // instead of emoji. Falls back to plain text if icons.js hasn't
    // loaded yet for some reason.
    const icon = (name) => (window.AppIcons ? window.AppIcons.get(name) : '');

    const sidebarHTML = `
            <aside id="sidebar" class="${isCollapsed ? 'collapsed' : ''}">
                <div id="sidebar-toggle-row">
                    <span class="sidebar-app-name">${icon('logo')} أداة مراجعة OCR</span>
                    <button id="toggle-sidebar" title="إخفاء الشريط الجانبي">${icon('collapseRTL')}</button>
                </div>
                <nav class="sidebar-nav">
                    <a href="index.html" class="sidebar-link ${currentPath === 'index.html' ? 'active' : ''}">${icon('home')}<span>الرئيسية</span></a>
                    <a href="projects.html" class="sidebar-link ${currentPath === 'projects.html' ? 'active' : ''}">${icon('projects')}<span>المشاريع</span></a>
                    <a href="#" class="sidebar-link sidebar-link-accent trigger-new-project">${icon('plus')}<span>مشروع جديد</span></a>
                    <a href="settings.html" class="sidebar-link ${currentPath === 'settings.html' ? 'active' : ''}">${icon('settings')}<span>الإعدادات</span></a>
                    <a href="#" id="sidebar-exit-btn" class="sidebar-link sidebar-link-danger">${icon('exit')}<span>خروج</span></a>
                </nav>
                <div class="sidebar-project-info" id="sidebar-project-info" style="${currentPath.includes('review') ? '' : 'display:none;'}">
                    <div class="sidebar-project-title" id="sidebar-proj-title"></div>
                    <div class="sidebar-project-meta" id="sidebar-proj-meta"></div>
                </div>
            </aside>
            <button id="sidebar-collapsed-tab" class="${isCollapsed ? '' : 'hidden'}" title="فتح الشريط الجانبي">${icon('expandRTL')}</button>
        `;

    document.body.classList.add('has-sidebar');
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    return document.getElementById('sidebar');
  }

  function bindSidebarEvents() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const tabBtn = document.getElementById('sidebar-collapsed-tab');
    const exitBtn = document.getElementById('sidebar-exit-btn');

    if (!sidebar) {
      console.warn('[Sidebar] bind failed - no sidebar element');
      return;
    }

    console.log('[Sidebar] binding events, sidebar found');

    function setCollapsed(collapsed) {
      console.log('[Sidebar] setCollapsed', collapsed);
      sidebar.classList.toggle('collapsed', collapsed);
      if (tabBtn) tabBtn.classList.toggle('hidden', !collapsed);
      try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
      // Also ensure body has class
      document.body.classList.add('has-sidebar');
    }

    // Apply stored state on bind
    setCollapsed(readCollapsedState());

    // Remove any old listeners by cloning? Use once flag to avoid duplicate binds
    if (toggleBtn && !toggleBtn._sidebarBound) {
      toggleBtn.addEventListener('click', () => {
        console.log('[Sidebar] toggle clicked');
        const isCollapsed = sidebar.classList.contains('collapsed');
        setCollapsed(!isCollapsed);
      });
      toggleBtn._sidebarBound = true;
    }

    if (tabBtn && !tabBtn._sidebarBound) {
      tabBtn.addEventListener('click', () => {
        console.log('[Sidebar] tab clicked - expand');
        setCollapsed(false);
      });
      tabBtn._sidebarBound = true;
    }

    if (exitBtn && !exitBtn._sidebarBound) {
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
      exitBtn._sidebarBound = true;
    }

    // Active link
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && current === href) {
        link.classList.add('active');
      }
    });
  }

  function initSidebar() {
    console.log('[Sidebar] initSidebar called, readyState', document.readyState);
    injectSidebarIfNeeded();
    // Give DOM a tick before binding in case injection is async
    setTimeout(bindSidebarEvents, 0);
    setTimeout(bindSidebarEvents, 100);
  }

  // Try multiple entry points
  document.addEventListener('DOMContentLoaded', initSidebar);
  window.addEventListener('pywebviewready', initSidebar);
  // Also try immediately if DOM already loaded
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(initSidebar, 0);
  }
})();
