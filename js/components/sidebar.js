// ============================================================
// sidebar.js — Sidebar component builder
// ============================================================

import { authService } from '../auth.js';
import { store }       from '../store.js';
import { router }      from '../router.js';

export function buildSidebar({ containerId, navItems, role }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const profile    = store.get('profile') || {};
  const initials   = _getInitials(profile.displayName || profile.name || 'U');
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
            <div class="user-name">${profile.displayName || profile.name || 'User'}</div>
            <div class="user-role">${role}</div>
          </div>
        </div>
      </div>
    </aside>
  `;

  _attachListeners();
  _highlightActive();

  window.addEventListener('hashchange', _highlightActive);
}

function _buildNavHTML(navItems) {
  return navItems.map(section => `
    <div class="nav-section">
      ${section.label ? `<div class="nav-section-label">${section.label}</div>` : ''}
      ${section.items.map(item => `
        <a class="nav-item" data-route="${item.route}" href="#${item.route}" title="${item.label}">
          <span class="nav-icon"><i class="ph-bold ${item.icon}" style="font-size:18px;"></i></span>
          <span class="nav-label">${item.label}</span>
          ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
        </a>
      `).join('')}
    </div>
  `).join('');
}

function _highlightActive() {
  const hash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.nav-item').forEach(el => {
    const route = el.dataset.route;
    el.classList.toggle('active', hash === route || (route !== '/' && hash.startsWith(route)));
  });
}

function _attachListeners() {
  // Toggle collapse
  document.addEventListener('click', e => {
    if (e.target.closest('#topbar-toggle')) {
      const sidebar = document.getElementById('main-sidebar');
      const topbar  = document.getElementById('main-topbar');
      const content = document.getElementById('main-content');
      const collapsed = sidebar.classList.toggle('collapsed');
      topbar?.classList.toggle('sidebar-collapsed', collapsed);
      content?.classList.toggle('sidebar-collapsed', collapsed);
      localStorage.setItem('sidebar-collapsed', collapsed);
    }
  });

  // Mobile overlay
  document.addEventListener('click', e => {
    if (e.target.closest('#mobile-overlay')) {
      _closeMobile();
    }
    if (e.target.closest('#mobile-menu-btn')) {
      document.getElementById('main-sidebar')?.classList.add('mobile-open');
      document.getElementById('mobile-overlay')?.classList.add('visible');
    }
  });
}

function _closeMobile() {
  document.getElementById('main-sidebar')?.classList.remove('mobile-open');
  document.getElementById('mobile-overlay')?.classList.remove('visible');
}

function _getInitials(name) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
