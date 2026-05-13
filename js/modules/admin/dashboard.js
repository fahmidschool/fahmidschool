// ============================================================
// admin/dashboard.js — Admin dashboard module
// ============================================================

import { getAllPupils }           from '/js/services/pupils.js';
import { getAllTeachers }         from '/js/services/teachers.js';
import { getAllClasses }          from '/js/services/classes.js';
import { getPayments }           from '/js/services/fees.js';
import { getAnnouncements }      from '/js/services/announcements.js';
import { getActiveSession }      from '/js/services/sessions.js';
import { getAuditLogs }          from '/js/services/audit.js';
import { setPageTitle }          from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('Dashboard');
  outlet.innerHTML = _skeletonHTML();

  try {
    const [pupils, teachers, classes, session, announcements, logs] = await Promise.all([
      getAllPupils(),
      getAllTeachers(),
      getAllClasses(),
      getActiveSession(),
      getAnnouncements({ count: 5 }),
      getAuditLogs(10),
    ]);

    const payments = session ? await getPayments({ sessionId: session.id }) : [];
    const revenue  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    outlet.innerHTML = `
      <style>
        .dash-two-col {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: var(--sp-5);
        }
        @media (max-width: 768px) {
          .dash-two-col {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="page-enter">

        <!-- Page header -->
        <div class="page-header">
          <div class="page-header-left">
            <h1>Dashboard</h1>
            <p>${session ? `Current session: ${session.name}` : 'No active session'}</p>
          </div>
          <div class="page-header-right">
            <a href="#/announcements" class="btn btn-primary">
              <i class="ph-bold ph-megaphone"></i>
              New Announcement
            </a>
          </div>
        </div>

        <!-- Stat cards -->
        <div class="grid-4 mb-6">
          ${_statCard({ icon: 'ph-student',              color: 'green', value: pupils.length,            label: 'Total Pupils' })}
          ${_statCard({ icon: 'ph-chalkboard-teacher',   color: 'blue',  value: teachers.length,          label: 'Teaching Staff' })}
          ${_statCard({ icon: 'ph-chalkboard',           color: 'teal',  value: classes.length,           label: 'Classes' })}
          ${_statCard({ icon: 'ph-money',                color: 'amber', value: `NGN ${_fmt(revenue)}`,   label: 'Revenue This Session' })}
        </div>

        <!-- Two-column section -->
        <div class="dash-two-col">

          <!-- Recent activity -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Recent Activity</div>
                <div class="card-subtitle">Latest system actions</div>
              </div>
            </div>
            <div id="audit-list">
              ${logs.length === 0
                ? '<p class="text-muted text-sm">No activity yet.</p>'
                : logs.map(l => `
                    <div class="flex items-center gap-3 mb-3">
                      <div class="stat-icon green" style="width:34px;height:34px;border-radius:var(--radius-sm);flex-shrink:0;">
                        <i class="ph-bold ph-activity" style="font-size:15px;"></i>
                      </div>
                      <div class="flex-1" style="min-width:0;">
                        <div class="text-sm font-semibold">${_formatAction(l.action)}</div>
                        <div class="text-xs text-muted">${l.actorName || 'System'} &middot; ${_relativeTime(l.timestamp)}</div>
                      </div>
                    </div>
                  `).join('')
              }
            </div>
          </div>

          <!-- Announcements -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Announcements</div>
              <a href="#/announcements" class="btn btn-ghost btn-sm">View all</a>
            </div>
            ${announcements.length === 0
              ? '<p class="text-muted text-sm">No announcements yet.</p>'
              : announcements.map(a => `
                  <div class="mb-4 pb-4" style="border-bottom:1px solid var(--clr-border);">
                    <div class="font-semibold text-sm">${a.title}</div>
                    <div class="text-xs text-muted mt-1">${a.body?.slice(0, 80)}${a.body?.length > 80 ? '...' : ''}</div>
                    <div class="text-xs text-faint mt-1">${_relativeTime(a.createdAt)}</div>
                  </div>
                `).join('')
            }
          </div>

        </div>

        <!-- Quick links -->
        <div class="card mt-5">
          <div class="card-header"><div class="card-title">Quick Actions</div></div>
          <div class="flex flex-wrap gap-3">
            ${_quickLink('/pupils',     'ph-user-plus',    'Add Pupil')}
            ${_quickLink('/results',    'ph-medal',        'Enter Results')}
            ${_quickLink('/payments',   'ph-money',        'Record Payment')}
            ${_quickLink('/attendance', 'ph-user-check',   'Take Attendance')}
            ${_quickLink('/cbt',        'ph-monitor-play', 'Create CBT Exam')}
            ${_quickLink('/broadsheet', 'ph-table',        'View Broadsheet')}
          </div>
        </div>

      </div>
    `;

  } catch (err) {
    console.error('Dashboard error:', err);
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load dashboard data. Please refresh the page.</div>`;
  }
}

function _statCard({ icon, color, value, label }) {
  return `
    <div class="stat-card">
      <div class="stat-icon ${color}">
        <i class="ph-bold ${icon}" style="font-size:22px;"></i>
      </div>
      <div class="stat-body">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

function _quickLink(route, icon, label) {
  return `
    <a href="#${route}" class="btn btn-secondary" style="gap:8px;">
      <i class="ph-bold ${icon}" style="font-size:16px;"></i>
      ${label}
    </a>
  `;
}

function _fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatAction(action) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function _relativeTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return date.toLocaleDateString('en-GB');
}

function _skeletonHTML() {
  return `
    <div>
      <div class="skeleton skeleton-title mb-6" style="width:200px;"></div>
      <div class="grid-4 mb-6">
        ${Array(4).fill('<div class="skeleton skeleton-card" style="height:100px;"></div>').join('')}
      </div>
      <div class="skeleton skeleton-card" style="height:300px;"></div>
    </div>
  `;
}
