/**
 * components/sidebar.js - collapsible sidebar logic
 * Replaces previous large sidebar.js with clean, token-based version.
 */
(function() {
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('toggle-sidebar');
    const collapsedTab = document.getElementById('sidebar-collapsed-tab');

    if (!sidebar) return;

    function setCollapsed(collapsed) {
      sidebar.classList.toggle('collapsed', collapsed);
      if (collapsedTab) collapsedTab.classList.toggle('hidden', !collapsed);
      try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch(e) {}
    }

    // restore
    try {
      const wasCollapsed = localStorage.getItem('sidebarCollapsed') === '1';
      if (wasCollapsed) setCollapsed(true);
    } catch(e) {}

    if (toggle) {
      toggle.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        setCollapsed(!isCollapsed);
      });
    }
    if (collapsedTab) {
      collapsedTab.addEventListener('click', () => setCollapsed(false));
    }

    // active link handling based on current page
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && current === href) {
        link.classList.add('active');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initSidebar);
  window.addEventListener('pywebviewready', initSidebar);
})();
