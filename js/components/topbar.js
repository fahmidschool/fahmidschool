// ============================================================
// topbar.js — Topbar component
// ============================================================

import { authService } from '../auth.js';
import { toast }       from '../toast.js';

export function buildTopbar({ containerId, pageTitle = '' }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

  container.innerHTML = `
    <header class="topbar ${isCollapsed ? 'sidebar-collapsed' : ''}" id="main-topbar">
      <div class="topbar-left">
        <div class="topbar-toggle" id="topbar-toggle" title="Toggle Sidebar">
          <i class="ph-bold ph-list" style="font-size:20px;"></i>
        </div>
        <div class="page-title" id="page-title">${pageTitle}</div>
      </div>

      <div class="topbar-right">
        <div class="topbar-action" title="Announcements" id="notif-btn">
          <i class="ph-bold ph-bell" style="font-size:20px;"></i>
          <span class="notif-dot" id="notif-dot" style="display:none;"></span>
        </div>
        <div class="topbar-action" title="Sign Out" id="logout-btn">
          <i class="ph-bold ph-sign-out" style="font-size:20px;"></i>
        </div>
      </div>
    </header>
  `;

  // Update page title on route change
  window.addEventListener('hashchange', () => {
    // title is set per-module via setPageTitle()
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await authService.logOut();
      window.location.href = '/index.html';
    } catch {
      toast.error('Sign out failed. Please try again.');
    }
  });
}

export function setPageTitle(title) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
}
