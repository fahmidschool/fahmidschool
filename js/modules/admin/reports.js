// ============================================================
// admin/reports.js — School-wide reports and analytics
// ============================================================

import { getAllPupils }                      from '/js/services/pupils.js';
import { getAllTeachers }                    from '/js/services/teachers.js';
import { getAllClasses }                     from '/js/services/classes.js';
import { getPayments }                       from '/js/services/fees.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { getAuditLogs }                     from '/js/services/audit.js';
import { setPageTitle }                     from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('Reports');
  outlet.innerHTML = `<div class="text-center mt-6"><span class="spinner spinner-dark"></span></div>`;

  try {
    const [pupils, teachers, classes, sessions, logs] = await Promise.all([
      getAllPupils(),
      getAllTeachers(),
      getAllClasses(),
      getAllSessions(),
      getAuditLogs(20),
    ]);

    const activeSession = sessions.find(s => s.isActive);
    const payments      = activeSession ? await getPayments({ sessionId: activeSession.id }) : [];
    const totalRevenue  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const arrears       = payments.filter(p => p.balance && p.balance > 0);

    // Gender distribution
    const male   = pupils.filter(p => p.gender === 'Male').length;
    const female = pupils.filter(p => p.gender === 'Female').length;

    // Class distribution
    const classCounts = classes.map(c => ({
      name:  c.name,
      count: pupils.filter(p => p.classId === c.id).length,
    }));

    // Payment method breakdown
    const methodMap = {};
    payments.forEach(p => {
      const m = p.method || 'Unknown';
      methodMap[m] = (methodMap[m] || 0) + Number(p.amount || 0);
    });

    outlet.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Reports</h1>
          <p>School-wide analytics and summaries</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-secondary" onclick="window.print()">
            <i class="ph-bold ph-printer"></i> Print Report
          </button>
        </div>
      </div>

      <!-- Summary stats -->
      <div class="grid-4 mb-6">
        <div class="stat-card">
          <div class="stat-icon green"><i class="ph-bold ph-student" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${pupils.length}</div>
            <div class="stat-label">Total Pupils</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ph-bold ph-chalkboard-teacher" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${teachers.length}</div>
            <div class="stat-label">Teaching Staff</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ph-bold ph-money" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">NGN ${_fmt(totalRevenue)}</div>
            <div class="stat-label">Revenue (Current Session)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ph-bold ph-warning" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${arrears.length}</div>
            <div class="stat-label">Arrear Cases</div>
          </div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-5);">

        <!-- Enrolment by class -->
        <div class="card">
          <div class="card-header"><div class="card-title">Enrolment by Class</div></div>
          ${classCounts.map(c => `
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="stat-icon green" style="width:32px;height:32px;border-radius:var(--radius-sm);">
                  <i class="ph-bold ph-chalkboard" style="font-size:14px;"></i>
                </div>
                <span class="font-medium">${c.name}</span>
              </div>
              <div class="flex items-center gap-3">
                <div style="width:120px;height:6px;background:var(--clr-border);border-radius:var(--radius-full);overflow:hidden;">
                  <div style="width:${pupils.length ? Math.round((c.count/pupils.length)*100) : 0}%;height:100%;background:var(--clr-primary);border-radius:var(--radius-full);"></div>
                </div>
                <span class="font-bold" style="min-width:30px;text-align:right;">${c.count}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Gender distribution -->
        <div class="card">
          <div class="card-header"><div class="card-title">Gender Distribution</div></div>
          <div class="flex items-center gap-5 mb-5">
            <div class="text-center flex-1">
              <div style="font-size:2.5rem;font-weight:700;color:var(--clr-info);">${male}</div>
              <div class="text-sm text-muted">Male</div>
              <div class="text-xs text-faint">${pupils.length ? Math.round((male/pupils.length)*100) : 0}%</div>
            </div>
            <div style="width:1px;height:80px;background:var(--clr-border);"></div>
            <div class="text-center flex-1">
              <div style="font-size:2.5rem;font-weight:700;color:var(--clr-accent);">${female}</div>
              <div class="text-sm text-muted">Female</div>
              <div class="text-xs text-faint">${pupils.length ? Math.round((female/pupils.length)*100) : 0}%</div>
            </div>
          </div>
          <div style="height:12px;background:var(--clr-border);border-radius:var(--radius-full);overflow:hidden;">
            <div style="width:${pupils.length ? Math.round((male/pupils.length)*100) : 50}%;height:100%;background:var(--clr-info);border-radius:var(--radius-full);"></div>
          </div>
          <div class="flex justify-between mt-2 text-xs text-muted">
            <span>Male ${pupils.length ? Math.round((male/pupils.length)*100) : 0}%</span>
            <span>Female ${pupils.length ? Math.round((female/pupils.length)*100) : 0}%</span>
          </div>
        </div>

        <!-- Payment method breakdown -->
        <div class="card">
          <div class="card-header"><div class="card-title">Revenue by Payment Method</div></div>
          ${Object.entries(methodMap).length === 0
            ? '<p class="text-muted text-sm">No payment data available.</p>'
            : Object.entries(methodMap).map(([method, amount]) => `
                <div class="flex items-center justify-between mb-3">
                  <span class="font-medium">${method}</span>
                  <span class="font-bold">NGN ${_fmt(amount)}</span>
                </div>
              `).join('')
          }
        </div>

        <!-- Audit log -->
        <div class="card">
          <div class="card-header"><div class="card-title">Recent System Activity</div></div>
          ${logs.map(l => `
            <div class="flex items-start gap-3 mb-3">
              <div class="stat-icon green" style="width:30px;height:30px;flex-shrink:0;">
                <i class="ph-bold ph-activity" style="font-size:13px;"></i>
              </div>
              <div class="flex-1">
                <div class="text-sm font-semibold">${_formatAction(l.action)}</div>
                <div class="text-xs text-muted">${l.actorName || 'System'} &mdash; ${_relTime(l.timestamp)}</div>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  } catch (err) {
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load reports. ${err.message}</div>`;
  }
}

function _fmt(n) {
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatAction(action) {
  return (action || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function _relTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return date.toLocaleDateString('en-GB');
}
