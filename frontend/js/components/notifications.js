/**
 * components/notifications.js - Toast Notification Tray (Tokenized & Theme-Aware)
 */
(function(global) {
  function showNotif(msg, type = 'info') {
    const iconName = type === 'success' ? 'checkCircle' : (type === 'error' ? 'warning' : (type === 'warning' ? 'warning' : 'info'));
    const iconSvg = global.AppIcons ? global.AppIcons.get(iconName, 'width:18px;height:18px;') : '';

    const colorConfig = {
      info: {
        border: 'var(--color-primary)',
        iconColor: 'var(--color-primary)'
      },
      success: {
        border: 'var(--color-success)',
        iconColor: 'var(--color-success)'
      },
      error: {
        border: 'var(--color-danger)',
        iconColor: 'var(--color-danger)'
      },
      warning: {
        border: 'var(--color-warning)',
        iconColor: 'var(--color-warning)'
      }
    };

    const cfg = colorConfig[type] || colorConfig.info;

    const tray = document.getElementById('notif-tray') || (() => {
      const t = document.createElement('div');
      t.id = 'notif-tray';
      t.style.cssText = 'position:fixed;bottom:24px;inset-inline-start:24px;z-index:99999;display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none;';
      document.body.appendChild(t);
      return t;
    })();

    const n = document.createElement('div');
    n.className = `app-notification-toast toast-${type}`;
    n.style.cssText = `
      background: var(--color-surface-elevated, var(--color-surface, #ffffff));
      color: var(--color-text, #0f172a);
      border: 1px solid var(--color-border, #e2e8f0);
      border-inline-start: 4px solid ${cfg.border};
      padding: 12px 18px;
      border-radius: var(--radius-md, 8px);
      font-size: var(--text-sm, 13.5px);
      font-weight: 600;
      box-shadow: var(--shadow-lg, 0 10px 24px rgba(0,0,0,0.2));
      max-width: 380px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
      animation: slideIn 0.22s var(--ease-spring, ease);
      user-select: none;
      backdrop-filter: blur(8px);
    `;
    n.innerHTML = `<span style="flex-shrink:0; color:${cfg.iconColor}; display:flex; align-items:center;">${iconSvg}</span><span style="flex:1; line-height:1.4;">${msg}</span>`;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { 
      n.style.opacity = '0';
      n.style.transform = 'translateY(8px)';
      n.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => { if (n.parentNode) n.remove(); }, 200);
    }, 4500);
  }

  global.showNotif = showNotif;
  global.AppNotify = { show: showNotif };
})(window);
