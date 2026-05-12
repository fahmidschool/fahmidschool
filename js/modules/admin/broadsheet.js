// ============================================================
// admin/broadsheet.js — Class broadsheet with rankings
// ============================================================

import { getResults, computeGrade } from '/js/services/results.js';
import { getAllClasses }             from '/js/services/classes.js';
import { getSubjectsByClass }        from '/js/services/subjects.js';
import { getPupilsByClass }          from '/js/services/pupils.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { setPageTitle }             from '/js/components/topbar.js';
import { toast }                    from '/js/toast.js';

let _sessions = [], _classes = [];
let _selected = { sessionId: '', termId: '', classId: '' };

export default async function render(outlet) {
  setPageTitle('Broadsheet');

  [_sessions, _classes] = await Promise.all([getAllSessions(), getAllClasses()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Broadsheet</h1>
        <p>Comprehensive class performance overview with rankings</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" id="bs-print-btn" style="display:none;">
          <i class="ph-bold ph-printer"></i> Print
        </button>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="bs-session">
            <option value="">Select Session</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="bs-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="bs-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary mt-4" id="bs-load-btn">
        <i class="ph-bold ph-table"></i> Generate Broadsheet
      </button>
    </div>

    <div id="bs-area"></div>
  `;

  document.getElementById('bs-session').addEventListener('change', async e => {
    _selected.sessionId = e.target.value;
    const terms   = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('bs-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('bs-term').addEventListener('change',  e => { _selected.termId  = e.target.value; });
  document.getElementById('bs-class').addEventListener('change', e => { _selected.classId = e.target.value; });
  document.getElementById('bs-load-btn').addEventListener('click', _generateBroadsheet);
}

async function _generateBroadsheet() {
  const { sessionId, termId, classId } = _selected;
  if (!sessionId || !termId || !classId) {
    toast.warning('Please select session, term, and class.'); return;
  }

  const area = document.getElementById('bs-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    const [subjects, pupils, results] = await Promise.all([
      getSubjectsByClass(classId),
      getPupilsByClass(classId),
      getResults(_selected),
    ]);

    // Build results map
    const rMap = {};
    results.forEach(r => { rMap[`${r.pupilId}_${r.subjectId}`] = r; });

    // Compute totals and rankings
    const pupilData = pupils.map(p => {
      const scores   = subjects.map(s => {
        const r = rMap[`${p.id}_${s.id}`];
        return r ? (r.total ?? 0) : null;
      });
      const valid    = scores.filter(s => s !== null);
      const sumTotal = valid.reduce((a, b) => a + b, 0);
      const average  = valid.length ? Math.round(sumTotal / valid.length) : 0;
      return { ...p, scores, sumTotal, average };
    });

    // Rank by total descending
    pupilData.sort((a, b) => b.sumTotal - a.sumTotal);
    pupilData.forEach((p, i) => { p.rank = i + 1; });

    const clsName = _classes.find(c => c.id === classId)?.name || '';

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;" id="bs-printable">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">Broadsheet — ${clsName}</div>
            <div class="card-subtitle">${subjects.length} subjects &mdash; ${pupils.length} pupils</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <i class="ph-bold ph-printer"></i> Print
          </button>
        </div>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr style="background:var(--sidebar-bg);color:#fff;">
                <th style="position:sticky;left:0;background:var(--sidebar-bg);min-width:40px;">Rank</th>
                <th style="position:sticky;left:40px;background:var(--sidebar-bg);min-width:180px;">Pupil Name</th>
                ${subjects.map(s => `<th style="min-width:110px;text-align:center;">${s.name}</th>`).join('')}
                <th style="min-width:80px;text-align:center;">Total</th>
                <th style="min-width:80px;text-align:center;">Average</th>
                <th style="min-width:80px;text-align:center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${pupilData.map(p => {
                const { grade } = computeGrade(p.average);
                return `
                  <tr style="${p.rank <= 3 ? 'background:var(--clr-primary-light);' : ''}">
                    <td style="position:sticky;left:0;background:${p.rank <= 3 ? 'var(--clr-primary-light)' : 'var(--clr-surface)'};font-weight:700;text-align:center;">
                      ${p.rank <= 3 ? `<span class="badge badge-${p.rank === 1 ? 'warning' : p.rank === 2 ? 'neutral' : 'primary'}">${p.rank}</span>` : p.rank}
                    </td>
                    <td style="position:sticky;left:40px;background:${p.rank <= 3 ? 'var(--clr-primary-light)' : 'var(--clr-surface)'};font-weight:600;">
                      ${p.surname} ${p.firstName}
                    </td>
                    ${p.scores.map((score, i) => {
                      if (score === null) return `<td style="text-align:center;color:var(--clr-text-faint);">—</td>`;
                      const { grade: g } = computeGrade(score);
                      return `<td style="text-align:center;">
                        <div style="font-weight:600;">${score}</div>
                        <div style="font-size:0.7rem;color:var(--clr-text-muted);">${g}</div>
                      </td>`;
                    }).join('')}
                    <td style="text-align:center;font-weight:700;font-size:1rem;">${p.sumTotal}</td>
                    <td style="text-align:center;font-weight:700;">${p.average}%</td>
                    <td style="text-align:center;">
                      <span class="badge badge-${_gradeBadge(grade)}">${grade}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to generate broadsheet. ${err.message}</div>`;
  }
}

function _gradeBadge(grade) {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  if (grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
}
