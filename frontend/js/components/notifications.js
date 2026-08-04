/**
 * components/notifications.js - toast tray
 */
(function(global) {
  function showNotif(msg, type='info') {
    const colors = { info:'#3498db', success:'#27ae60', error:'#e74c3c', warning:'#f39c12' };
    const tray = document.getElementById('notif-tray') || (() => {
      const t = document.createElement('div');
      t.id = 'notif-tray';
      t.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:4000;display:flex;flex-direction:column-reverse;gap:8px;';
      document.body.appendChild(t);
      return t;
    })();
    const n = document.createElement('div');
    const bg = colors[type] || colors.info;
    n.style.cssText = `background:${bg};color:white;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);max-width:280px;cursor:pointer;animation:slideIn 0.25s ease;`;
    n.textContent = msg;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 5000);
  }

  global.showNotif = showNotif;
  global.AppNotify = { show: showNotif };
})(window);
