// ============================================================
// modal.js — Modal utility
// ============================================================

let _activeModal = null;

export function openModal({ title, bodyHTML, footerHTML, size = '', onClose } = {}) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size ? 'modal-' + size : ''}">
      <div class="modal-header">
        <h3 class="modal-title">${title || ''}</h3>
        <div class="modal-close" id="modal-close-btn">
          <i class="ph-bold ph-x" style="font-size:18px;"></i>
        </div>
      </div>
      <div class="modal-body">${bodyHTML || ''}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);
  _activeModal = backdrop;

  backdrop.querySelector('#modal-close-btn').addEventListener('click', () => {
    closeModal();
    onClose?.();
  });

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) {
      closeModal();
      onClose?.();
    }
  });

  document.addEventListener('keydown', _escHandler);

  return {
    el: backdrop,
    close: closeModal,
    setTitle: (t) => { const el = backdrop.querySelector('.modal-title'); if(el) el.textContent = t; },
    setBody:  (h) => { const el = backdrop.querySelector('.modal-body');  if(el) el.innerHTML = h; },
  };
}

function _escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (_activeModal) {
    _activeModal.remove();
    _activeModal = null;
    document.removeEventListener('keydown', _escHandler);
  }
}
