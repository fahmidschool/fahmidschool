// ============================================================
// pupil/dashboard.js — Pupil dashboard module
// ============================================================

import { store }                                          from '/js/store.js';
import { getPupilResults }                                from '/js/services/results.js';
import { getPupilAttendance, computeAttendanceSummary }   from '/js/services/attendance.js';
import { getPupilPayments }                               from '/js/services/fees.js';
import { getPupilCBTResults }                             from '/js/services/cbt.js';
import { getAnnouncements }                               from '/js/services/announcements.js';
import { getActiveSession, getActiveTerm }                from '/js/services/sessions.js';
import { setPageTitle }                                   from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('Dashboard');
  outlet.innerHTML = _skeletonHTML();

  try {
    const uid     = store.get('user')?.uid;
    const profile = store.get('profile');

    if (!uid) {
      outlet.innerHTML = `<div class="alert alert-danger mt-4">Session expired. Please log in again.</div>`;
      return;
    }

    const [session, announcements] = await Promise.all([
      getActiveSession(),
      getAnnouncements({ audience: 'pupil', count: 5 }),
    ]);

    const term = session ? await getActiveTerm(session.id) : null;

    const canQueryTerm = !!(session?.id && term?.id && uid);

    const [results, payments, cbtResults, attendanceRecords] = await Promise.all([
      canQueryTerm ? getPupilResults({ sessionId: session.id, termId: term.id, pupilId: uid }) : Promise.resolve([]),
      getPupilPayments(uid),
      getPupilCBTResults(uid),
      canQueryTerm ? getPupilAttendance({ pupilId: uid, sessionId: session.id, termId: term.id }) : Promise.resolve([]),
    ]);

    const attendance  = computeAttendanceSummary(attendanceRecords);
    const totalPaid   = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const termAverage = results.length
      ? Math.round(results.reduce((s, r) => s + (r.total || 0), 0) / results.length)
      : null;
    const arrears     = payments.filter(p => p.balance && p.balance > 0);

    const displayName = profile?.displayName || `${profile?.surname} ${profile?.firstName}` || 'Pupil';
    const className   = profile?.className || '';

    outlet.innerHTML = `
      <div class="page-enter">

        <!-- Page header -->
        <div class="page-header">
          <div class="page-header-left">
            <h1>Welcome, ${displayName.split(' ')[0]}!</h1>
            <p>${session ? `${session.name}${term ? ' &mdash; ' + term.name : ''}` : 'No active session'}${className ? ' &middot; ' + className : ''}</p>
          </div>
        </div>

        <!-- Stat cards -->
        <div class="grid-4 mb-6">
          ${_statCard({
            icon:  'ph-chart-line-up',
            color: 'blue',
            value: termAverage !== null ? `${termAverage}%` : 'N/A',
            label: 'Term Average',
          })}
          ${_statCard({
            icon:  'ph-calendar-check',
            color: 'green',
            value: `${attendance.percentage}%`,
            label: 'Attendance Rate',
          })}
          ${_statCard({
            icon:  'ph-coins',
            color: 'amber',
            value: `NGN ${totalPaid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
            label: 'Total Fees Paid',
          })}
          ${_statCard({
            icon:  'ph-monitor-play',
            color: 'teal',
            value: cbtResults.length,
            label: 'CBT Exams Taken',
          })}
        </div>

        <!-- Two-column section -->
        <div style="display:grid;grid-template-columns:1fr 360px;gap:var(--sp-5);">

          <!-- Results summary -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Recent Results</div>
                <div class="card-subtitle">${term ? term.name : 'Current term'} performance</div>
              </div>
              <a href="#/results" class="btn btn-ghost btn-sm">View all</a>
            </div>

            ${results.length === 0
              ? `<div class="text-center text-muted" style="padding:var(--sp-8) 0;">
                  <i class="ph-bold ph-medal" style="font-size:36px;display:block;margin-bottom:var(--sp-3);color:var(--clr-text-faint);"></i>
                  No results published yet for this term.
                 </div>`
              : `<div class="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Total</th>
                        <th>Grade</th>
                        <th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${results.slice(0, 6).map(r => `
                        <tr>
                          <td class="font-semibold">${r.subjectName || r.subjectId}</td>
                          <td class="font-bold">${r.total}</td>
                          <td>
                            <span class="badge badge-${_gradeBadge(r.grade)}">${r.grade}</span>
                          </td>
                          <td class="text-muted text-sm">${r.remark || '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                ${results.length > 6
                  ? `<div class="text-center mt-3">
                      <a href="#/results" class="btn btn-ghost btn-sm">View ${results.length - 6} more subjects</a>
                     </div>`
                  : ''
                }`
            }
          </div>

          <!-- Right column -->
          <div style="display:flex;flex-direction:column;gap:var(--sp-5);">

            <!-- Attendance mini-card -->
            <div class="card">
              <div class="card-header">
                <div class="card-title">Attendance</div>
                <a href="#/attendance" class="btn btn-ghost btn-sm">Details</a>
              </div>
              <div class="flex gap-4 mt-1">
                <div class="text-center flex-1">
                  <div style="font-size:1.75rem;font-weight:700;color:var(--clr-success);">${attendance.present}</div>
                  <div class="text-xs text-muted">Present</div>
                </div>
                <div class="text-center flex-1">
                  <div style="font-size:1.75rem;font-weight:700;color:var(--clr-danger);">${attendance.absent}</div>
                  <div class="text-xs text-muted">Absent</div>
                </div>
                <div class="text-center flex-1">
                  <div style="font-size:1.75rem;font-weight:700;color:var(--clr-primary);">${attendance.percentage}%</div>
                  <div class="text-xs text-muted">Rate</div>
                </div>
              </div>
              ${attendance.total > 0
                ? `<div style="height:6px;border-radius:var(--radius-full);background:var(--clr-border);margin-top:var(--sp-3);overflow:hidden;">
                    <div style="height:100%;width:${attendance.percentage}%;background:${attendance.percentage >= 75 ? 'var(--clr-success)' : 'var(--clr-warning)'};border-radius:var(--radius-full);transition:width 0.4s ease;"></div>
                   </div>`
                : ''
              }
            </div>

            <!-- Announcements -->
            <div class="card" style="flex:1;">
              <div class="card-header">
                <div class="card-title">Announcements</div>
                <a href="#/announcements" class="btn btn-ghost btn-sm">View all</a>
              </div>
              ${announcements.length === 0
                ? `<p class="text-muted text-sm">No announcements at this time.</p>`
                : announcements.map(a => `
                    <div class="mb-4 pb-4" style="border-bottom:1px solid var(--clr-border);">
                      <div class="font-semibold text-sm">${a.title}</div>
                      <div class="text-xs text-muted mt-1">${a.body?.slice(0, 80)}${(a.body?.length || 0) > 80 ? '...' : ''}</div>
                      <div class="text-xs text-faint mt-1">${_relativeTime(a.createdAt)}</div>
                    </div>
                  `).join('')
              }
            </div>

          </div>
        </div>

        <!-- Fee status & CBT -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-5);margin-top:var(--sp-5);">

          <!-- Fee status -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Fee Status</div>
                <div class="card-subtitle">Your payment summary</div>
              </div>
              <a href="#/payments" class="btn btn-ghost btn-sm">History</a>
            </div>
            ${arrears.length > 0
              ? `<div class="alert alert-warning mb-3" style="font-size:0.875rem;">
                  <i class="ph-bold ph-warning" style="font-size:16px;"></i>
                  You have ${arrears.length} outstanding balance${arrears.length > 1 ? 's' : ''}. Please contact the bursar.
                 </div>`
              : payments.length > 0
                ? `<div class="alert alert-success mb-3" style="font-size:0.875rem;">
                    <i class="ph-bold ph-check-circle" style="font-size:16px;"></i>
                    All payments are up to date.
                   </div>`
                : ''
            }
            <div class="flex items-center justify-between mt-2">
              <span class="text-muted text-sm">Total Paid</span>
              <span class="font-bold">NGN ${totalPaid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-muted text-sm">Transactions</span>
              <span class="font-semibold">${payments.length}</span>
            </div>
          </div>

          <!-- CBT summary -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">CBT Exams</div>
                <div class="card-subtitle">Your exam history</div>
              </div>
              <a href="#/cbt" class="btn btn-ghost btn-sm">Take exam</a>
            </div>
            ${cbtResults.length === 0
              ? `<div class="text-center text-muted" style="padding:var(--sp-4) 0;">
                  <i class="ph-bold ph-monitor-play" style="font-size:30px;display:block;margin-bottom:var(--sp-2);color:var(--clr-text-faint);"></i>
                  No exams taken yet.
                 </div>`
              : cbtResults.slice(0, 3).map(r => `
                  <div class="flex items-center justify-between mb-3">
                    <div style="min-width:0;">
                      <div class="font-semibold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.examTitle || r.examId}</div>
                      <div class="text-xs text-muted">${r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('en-GB') : '-'}</div>
                    </div>
                    <span class="badge badge-${r.percentage >= 50 ? 'success' : 'danger'}" style="flex-shrink:0;margin-left:var(--sp-2);">
                      ${r.percentage}%
                    </span>
                  </div>
                `).join('')
            }
          </div>

        </div>

        <!-- Quick links -->
        <div class="card mt-5">
          <div class="card-header"><div class="card-title">Quick Links</div></div>
          <div class="flex flex-wrap gap-3">
            ${_quickLink('/results',       'ph-medal',          'My Results')}
            ${_quickLink('/attendance',    'ph-calendar-check', 'Attendance')}
            ${_quickLink('/payments',      'ph-receipt',        'Payments')}
            ${_quickLink('/cbt',           'ph-monitor-play',   'CBT Exams')}
            ${_quickLink('/announcements', 'ph-megaphone',      'Announcements')}
          </div>
        </div>

      </div>
    `;

  } catch (err) {
    console.error('Pupil dashboard error:', err);
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load dashboard. Please refresh the page.</div>`;
  }
}

// ── Helpers ───────────────────────────────────────────────

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

function _gradeBadge(grade) {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  if (grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
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
      <div class="skeleton skeleton-title mb-6" style="width:240px;"></div>
      <div class="grid-4 mb-6">
        ${Array(4).fill('<div class="skeleton skeleton-card" style="height:100px;"></div>').join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 360px;gap:var(--sp-5);">
        <div class="skeleton skeleton-card" style="height:320px;"></div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-5);">
          <div class="skeleton skeleton-card" style="height:120px;"></div>
          <div class="skeleton skeleton-card" style="height:180px;"></div>
        </div>
      </div>
    </div>
  `;
}
