// ============================================================
// router.js — Client-side hash router with lazy loading
// ============================================================

const _routes  = new Map();
let   _outlet  = null;
let   _current = null;

function defineOutlet(selector) {
  _outlet = document.querySelector(selector);
}

function register(path, loader) {
  _routes.set(path, loader);
}

function navigate(path) {
  window.location.hash = path;
}

async function _resolve() {
  const hash = window.location.hash.slice(1) || '/';
  const path = hash.split('?')[0];

  if (path === _current) return;
  _current = path;

  // Find best matching route
  let loader = _routes.get(path);

  // Try parameterized match
  if (!loader) {
    for (const [route, fn] of _routes.entries()) {
      const pattern = route.replace(/:([^/]+)/g, '([^/]+)');
      const match   = path.match(new RegExp(`^${pattern}$`));
      if (match) { loader = fn; break; }
    }
  }

  if (!loader) {
    if (_outlet) _outlet.innerHTML = _notFoundHTML();
    return;
  }

  // Show skeleton
  if (_outlet) _outlet.innerHTML = _skeletonHTML();

  try {
    const module = await loader();
    if (module?.default && _outlet) {
      _outlet.innerHTML = '';
      await module.default(_outlet);
      _outlet.classList.add('page-enter');
      requestAnimationFrame(() => _outlet.classList.remove('page-enter'));
    }
  } catch (err) {
    console.error('Router: Failed to load module', path, err);
    if (_outlet) _outlet.innerHTML = `<div class="card text-center mt-6"><p class="text-danger">Failed to load page. Please refresh.</p></div>`;
  }
}

function _skeletonHTML() {
  return `
    <div style="padding:8px 0;">
      <div class="skeleton skeleton-title mb-4"></div>
      <div class="grid-4" style="margin-bottom:24px;">
        ${Array(4).fill('<div class="skeleton skeleton-card"></div>').join('')}
      </div>
      <div class="skeleton-card" style="height:240px;border-radius:var(--radius-lg);"></div>
    </div>
  `;
}

function _notFoundHTML() {
  return `
    <div class="card text-center" style="max-width:400px;margin:60px auto;">
      <i class="ph-bold ph-compass-rose" style="font-size:48px;color:var(--clr-text-faint);"></i>
      <h3 style="margin-top:16px;">Page Not Found</h3>
      <p class="text-muted mt-2">The page you are looking for does not exist.</p>
      <button class="btn btn-primary mt-4" onclick="history.back()">Go Back</button>
    </div>
  `;
}

function init() {
  window.addEventListener('hashchange', _resolve);
  _resolve();
}

export const router = { defineOutlet, register, navigate, init };
