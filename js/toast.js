// ============================================================
// toast.js — Toast notification system
// ============================================================

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function iconHTML(type) {
  const icons = {
    success: `<i class="ph-bold ph-check-circle" style="font-size:18px;"></i>`,
    warning: `<i class="ph-bold ph-warning-circle" style="font-size:18px;"></i>`,
    danger:  `<i class="ph-bold ph-x-circle"       style="font-size:18px;"></i>`,
    info:    `<i class="ph-bold ph-info"            style="font-size:18px;"></i>`,
  };
  return icons[type] || icons.info;
}

function show({ type = 'info', title, message, duration = 4000 }) {
  const c = getContainer();

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <div class="toast-icon ${type}">${iconHTML(type)}</div>
    <div class="toast-body">
      ${title    ? `<div class="toast-title">${title}</div>` : ''}
      ${message  ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <div class="toast-close"><i class="ph-bold ph-x" style="font-size:14px;"></i></div>
  `;

  el.querySelector('.toast-close').addEventListener('click', () => remove(el));
  c.appendChild(el);

  if (duration > 0) {
    setTimeout(() => remove(el), duration);
  }

  return el;
}

function remove(el) {
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

export const toast = {
  success: (message, title = 'Success') => show({ type: 'success', title, message }),
  warning: (message, title = 'Warning') => show({ type: 'warning', title, message }),
  error:   (message, title = 'Error')   => show({ type: 'danger',  title, message }),
  info:    (message, title = 'Info')    => show({ type: 'info',    title, message }),
  show,
};
