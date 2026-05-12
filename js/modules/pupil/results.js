// ============================================================
// pupil/results.js — Pupil results view
// ============================================================

import { store }            from '/js/store.js';
import { getPupilResults }  from '/js/services/results.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { setPageTitle }     from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('My Results');

  const uid      = store.get('user')?.uid;
  const sessions = await getAllSessions();

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>My Results</h1>
        <p>View your academic performance by session and term</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-2" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="p-session">
            <option value="">Select Session</option>
            ${sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="p-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
      </div>
    </div>

    <div id="p-results-area">
      <div class="card text-center text-muted" style="padding:var(--sp-10);">
        Select a session and term to view your results.
      </div>
    </div>
  `;

  document.getElementById('p-session').addEventListener('change', async e => {
    const sessionId = e.target.value;
    if (!sessionId) return;
    const terms   = await getTermsBySession(sessionId);
    const termSel = document.getElementById('p-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('p-term').addEventListener('change', async e => {
    const sessionId = document.getElementById('p-session').value;
    const termId    = e.target.value;
    if (!sessionId || !termId) return;

    const area = document.getElementById('p-results-area');
    area.innerHTML = `<div class="text-center mt-4"><span class="spinner spinner-dark"></span></div>`;

    try {
      const results = await getPupilResults({ sessionId, termId, pupilId: uid });

      if (results.length === 0) {
        area.innerHTML = `
          <div class="card text-center text-muted" style="padding:var(--sp-10);">
            <i class="ph-bold ph-medal" style="font-size:40px;display:block;margin-bottom:var(--sp-3);color:var(--clr-text-faint);"></i>
            No results published for this term yet.
          </div>`;
        return;
      }

      const totalScore = results.reduce((s, r) => s + (r.total || 0), 0);
      const average    = Math.round(totalScore / results.length);
      const highest    = Math.max(...results.map(r => r.total || 0));
      const lowest     = Math.min(...results.map(r => r.total || 0));

      area.innerHTML = `
        <div class="grid-3 mb-5">
          <div class="stat-card">
            <div class="stat-icon blue"><i class="ph-bold ph-chart-line-up" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${average}%</div>
              <div class="stat-label">Term Average</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><i class="ph-bold ph-arrow-up" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${highest}</div>
              <div class="stat-label">Highest Score</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber"><i class="ph-bold ph-books" style="font-size:22px;"></i></div>
            <div class="stat-body">
              <div class="stat-value">${results.length}</div>
              <div class="stat-label">Subjects</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:0;">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>CA 1</th>
                  <th>CA 2</th>
                  <th>Exam</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td class="font-semibold">${r.subjectName || r.subjectId}</td>
                    <td>${r.ca1 ?? '-'}</td>
                    <td>${r.ca2 ?? '-'}</td>
                    <td>${r.exam ?? '-'}</td>
                    <td class="font-bold">${r.total}</td>
                    <td>
                      <span class="badge badge-${_gradeBadge(r.grade)}">
                        ${r.grade}
                      </span>
                    </td>
                    <td class="text-muted text-sm">${r.remark || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      area.innerHTML = `<div class="alert alert-danger">Failed to load results. ${err.message}</div>`;
    }
  });
}

function _gradeBadge(grade) {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  if (grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
}
