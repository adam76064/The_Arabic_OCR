/**
 * components/notifications.js - Toast Notification Tray (Tokenized & Zero Emojis)
 */
(function(global) {
  function showNotif(msg, type = 'info') {
    const iconName = type === 'success' ? 'checkCircle' : (type === 'error' ? 'warning' : (type === 'warning' ? 'warning' : 'info'));
    const iconSvg = global.AppIcons ? global.AppIcons.get(iconName) : '';

    const colorVars = {
      info: 'var(--color-primary)',
      success: 'var(--color-success)',
      error: 'var(--color-danger)',
      warning: 'var(--color-warning)'
    };

    const tray = document.getElementById('notif-tray') || (() => {
      const t = document.createElement('div');
      t.id = 'notif-tray';
      t.style.cssText = 'position:fixed;bottom:20px;inset-inline-start:20px;z-index:9999;display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;';
      document.body.appendChild(t);
      return t;
    })();

    const n = document.createElement('div');
    const bg = colorVars[type] || colorVars.info;
    n.style.cssText = `
      background: ${bg};
      color: var(--color-text-inverse, #ffffff);
      padding: 10px 16px;
      border-radius: var(--radius-md, 8px);
      font-size: var(--text-sm, 13px);
      font-weight: 500;
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.25));
      max-width: 320px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: auto;
      animation: slideIn 0.2s var(--ease-spring, ease);
      user-select: none;
    `;
    n.innerHTML = `<span style="flex-shrink:0;">${iconSvg}</span><span>${msg}</span>`;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 4500);
  }

  global.showNotif = showNotif;
  global.AppNotify = { show: showNotif };
})(window);
