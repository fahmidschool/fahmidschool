// ============================================================
// sidebar.js — Sidebar component
// ============================================================
import { store } from '../store.js';

export function buildSidebar({ containerId, navItems, role }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const profile     = store.get('profile') || {};
  const initials    = _getInitials(profile.displayName || profile.name || profile.surname || 'U');
  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

  container.innerHTML = `
    <aside class="sidebar ${isCollapsed ? 'collapsed' : ''}" id="main-sidebar">
      <div class="sidebar-header">
        <img src="/assets/logo.png" alt="School Logo" class="sidebar-logo" />
        <div class="sidebar-school-name">
          <span class="name-primary">Fahmid Nursery</span>
          <span class="name-secondary">Primary School</span>
        </div>
      </div>

      <nav class="sidebar-nav" id="sidebar-nav">
        ${_buildNavHTML(navItems)}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user">
          <div class="user-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="user-name">
              ${profile.displayName || (profile.surname ? profile.surname + ' ' + profile.firstName : profile.name || 'User')}
            </div>
            <div class="user-role">${role}</div>
          </div>
        </div>
      </div>
    </aside>
  `;

  _highlightActive();
  window.addEventListener('hashchange', _highlightActive);
  _attachToggle();
}

// ── Build nav HTML ──────────────────────────────────────────
function _buildNavHTML(navItems) {
  return navItems.map(section => `
    <div class="nav-section">
      ${section.label
        ? `<div class="nav-section-label">${section.label}</div>`
        : ''}
      ${section.items.map(item => `
        <a class="nav-item"
           data-route="${item.route}"
           href="#${item.route}"
           title="${item.label}">
          <span class="nav-icon">
            <i class="ph-bold ${item.icon}" style="font-size:18px;"></i>
          </span>
          <span class="nav-label">${item.label}</span>
          ${item.badge
            ? `<span class="nav-badge">${item.badge}</span>`
            : ''}
        </a>
      `).join('')}
    </div>
  `).join('');
}

// ── Highlight active nav item ───────────────────────────────
function _highlightActive() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-item').forEach(el => {
    const route = el.dataset.route || '';
    const isActive = hash === route ||
      (route !== '/' && route.length > 1 && hash.startsWith(route));
    el.classList.toggle('active', isActive);
  });
}

// ── Single delegated click handler ─────────────────────────
function _attachToggle() {
  // Guard against duplicate listeners if buildSidebar is called again
  document.removeEventListener('click', _handleGlobalClick);
  document.addEventListener('click', _handleGlobalClick);
}

function _handleGlobalClick(e) {
  // Desktop: collapse / expand
  if (e.target.closest('#topbar-toggle')) {
    _toggleSidebar();
    return;
  }

  // Mobile: open sidebar via hamburger
  if (e.target.closest('#mobile-menu-btn')) {
    _openMobile();
    return;
  }

  // Mobile: close sidebar when overlay is clicked
  if (e.target.closest('#mobile-overlay')) {
    _closeMobile();
    return;
  }

  // Mobile: close sidebar when a nav item is tapped
  if (e.target.closest('.nav-item')) {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar?.classList.contains('mobile-open')) {
      _closeMobile();
    }
  }
}

function _toggleSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const topbar  = document.getElementById('main-topbar');
  const content = document.getElementById('main-content');
  if (!sidebar) return;

  const collapsed = sidebar.classList.toggle('collapsed');
  topbar?.classList.toggle('sidebar-collapsed', collapsed);
  content?.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sidebar-collapsed', String(collapsed));
}

function _openMobile() {
  document.getElementById('main-sidebar')?.classList.add('mobile-open');
  document.getElementById('mobile-overlay')?.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function _closeMobile() {
  document.getElementById('main-sidebar')?.classList.remove('mobile-open');
  document.getElementById('mobile-overlay')?.classList.remove('visible');
  document.body.style.overflow = '';
}

function _getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0] || '')
    .join('')
    .toUpperCase();
}
