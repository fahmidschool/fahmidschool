// ============================================================
// pupil/attendance.js — Pupil attendance view
// ============================================================

import { store }                                        from '/js/store.js';
import { getPupilAttendance, computeAttendanceSummary } from '/js/services/attendance.js';
import { getAllSessions, getTermsBySession }             from '/js/services/sessions.js';
import { setPageTitle }                                 from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('My Attendance');

  const uid      = store.get('user')?.uid;
  const sessions = await getAllSessions();

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>My Attendance</h1>
        <p>View your attendance records</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-2" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="pa-session">
            <option value="">Select Session</option>
            ${sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="pa-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
      </div>
    </div>

    <div id="pa-area">
      <div class="card text-center text-muted" style="padding:var(--sp-10);">
        Select a session and term to view attendance records.
      </div>
    </div>
  `;

  document.getElementById('pa-session').addEventListener('change', async e => {
    if (!e.target.value) return;
    const terms   = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('pa-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('pa-term').addEventListener('change', async e => {
    const sessionId = document.getElementById('pa-session').value;
    const termId    = e.target.value;
    if (!sessionId || !termId) return;

    const area = document.getElementById('pa-area');
    area.innerHTML = `<div class="text-center mt-4"><span class="spinner spinner-dark"></span></div>`;

    try {
      const records = await getPupilAttendance({ pupilId: uid, sessionId, termId });
      const summary = computeAttendanceSummary(records);

      area.innerHTML = `
        <div class="grid-4 mb-5">
          <div class="stat-card">
            <div class="stat-icon green"><i class="ph-bold ph-check-circle" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${summary.present}</div>
              <div class="stat-label">Days Present</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red"><i class="ph-bold ph-x-circle" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${summary.absent}</div>
              <div class="stat-label">Days Absent</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber"><i class="ph-bold ph-clock" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${summary.total}</div>
              <div class="stat-label">School Days</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue"><i class="ph-bold ph-chart-pie" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${summary.percentage}%</div>
              <div class="stat-label">Attendance Rate</div>
            </div>
          </div>
        </div>

        ${records.length > 0 ? `
          <div class="card" style="padding:0;">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.sort((a, b) => b.date.localeCompare(a.date)).map(r => `
                    <tr>
                      <td>${new Date(r.date).toLocaleDateString('en-GB', {weekday:'short', year:'numeric', month:'short', day:'numeric'})}</td>
                      <td>
                        <span class="badge badge-${r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'danger'}">
                          ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td class="text-muted text-sm">${r.remark || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `<div class="card text-center text-muted" style="padding:var(--sp-10);">No attendance records for this term.</div>`}
      `;
    } catch (err) {
      area.innerHTML = `<div class="alert alert-danger">Failed to load attendance. ${err.message}</div>`;
    }
  });
}
