/**
 * components/modal.js - generic modal helpers
 */
(function(global) {
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Delegated close for overlay and close buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    }
    if (e.target.classList.contains('modal-close')) {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    }
  });

  // Aesthetic dialog fallback (kept from original)
  if (!global.AestheticDialog) {
    global.AestheticDialog = {
      show(title, contentHtml, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'modal aes-overlay';
        overlay.innerHTML = `
          <div class="modal-overlay"></div>
          <div class="modal-box">
            <div class="modal-header"><h3>${title}</h3><button class="modal-close">✕</button></div>
            <div class="modal-body">${contentHtml}
              <div class="form-actions" style="margin-top:16px">
                <button class="btn-secondary aes-btn-cancel">إلغاء</button>
                <button class="btn-primary aes-btn-confirm">تأكيد</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.aes-btn-cancel').addEventListener('click', close);
        overlay.querySelector('.modal-close').addEventListener('click', close);
        overlay.querySelector('.modal-overlay').addEventListener('click', close);
        overlay.querySelector('.aes-btn-confirm').addEventListener('click', () => {
          if (onConfirm) onConfirm(overlay);
          close();
        });
      }
    };
  }

  global.AppModal = { openModal, closeModal };
})(window);
