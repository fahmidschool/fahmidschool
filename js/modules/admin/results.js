// ============================================================
// admin/results.js — Read-only results viewer with print
// ============================================================

import { getResults, computeGrade }          from '/js/services/results.js';
import { getAllClasses }                      from '/js/services/classes.js';
import { getSubjectsByClass }                from '/js/services/subjects.js';
import { getPupilsByClass }                  from '/js/services/pupils.js';
import { getAllSessions, getTermsBySession }  from '/js/services/sessions.js';
import { setPageTitle }                      from '/js/components/topbar.js';
import { openModal, closeModal }             from '/js/components/modal.js';
import { printReportCard, printClassResults } from '/js/print.js';
import { toast }                             from '/js/toast.js';

let _classes  = [];
let _sessions = [];
let _subjects = [];
let _pupils   = [];
let _results  = [];
let _selected = { sessionId: '', termId: '', classId: '' };
let _sessionName = '';
let _termName    = '';
let _className   = '';

export default async function render(outlet) {
  setPageTitle('Results');
  [_classes, _sessions] = await Promise.all([getAllClasses(), getAllSessions()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Results</h1>
        <p>View and print pupil results by class and term</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="res-session">
            <option value="">Select Session</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="res-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="res-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary mt-4" id="load-results-btn">
        <i class="ph-bold ph-arrow-clockwise"></i> Load Results
      </button>
    </div>

    <div id="results-area"></div>
  `;

  document.getElementById('res-session').addEventListener('change', async e => {
    _selected.sessionId = e.target.value;
    const sel = e.target;
    _sessionName = sel.options[sel.selectedIndex]?.text || '';
    const terms = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('res-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('res-term').addEventListener('change', e => {
    _selected.termId = e.target.value;
    const sel = e.target;
    _termName = sel.options[sel.selectedIndex]?.text || '';
  });

  document.getElementById('res-class').addEventListener('change', e => {
    _selected.classId = e.target.value;
    const sel = e.target;
    _className = sel.options[sel.selectedIndex]?.text || '';
  });

  document.getElementById('load-results-btn').addEventListener('click', _loadResults);
}

async function _loadResults() {
  const { sessionId, termId, classId } = _selected;
  if (!sessionId || !termId || !classId) {
    toast.warning('Please select session, term, and class first.');
    return;
  }

  const area = document.getElementById('results-area');
  area.innerHTML = `<div class="card"><div class="text-center text-muted"><span class="spinner spinner-dark"></span> Loading...</div></div>`;

  try {
    [_subjects, _pupils, _results] = await Promise.all([
      getSubjectsByClass(classId),
      getPupilsByClass(classId),
      getResults(_selected),
    ]);

    if (_pupils.length === 0) {
      area.innerHTML = `<div class="card text-center text-muted" style="padding:var(--sp-10);">No pupils found in this class.</div>`;
      return;
    }

    // Build result map and compute per-pupil summaries
    const rMap = {};
    _results.forEach(r => { rMap[`${r.pupilId}_${r.subjectId}`] = r; });

    const pupilRows = _pupils.map(p => {
      const scored   = _subjects.map(s => rMap[`${p.id}_${s.id}`]).filter(Boolean);
      const totalSum = scored.reduce((a, r) => a + (r.total || 0), 0);
      const average  = scored.length ? Math.round(totalSum / scored.length) : 0;
      const { grade } = computeGrade(average);
      return { ...p, totalSum, average, grade, scored: scored.length };
    });

    // Sort by total descending for position
    pupilRows.sort((a, b) => b.totalSum - a.totalSum);
    pupilRows.forEach((p, i) => { p.position = i + 1; });

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">${_className} — Results</div>
            <div class="card-subtitle">${_pupils.length} pupils &mdash; ${_subjects.length} subjects &mdash; ${_sessionName}, ${_termName}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="print-class-btn">
              <i class="ph-bold ph-printer"></i> Print All Report Cards
            </button>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th style="min-width:36px;">Pos.</th>
                <th style="text-align:left;min-width:180px;">Pupil Name</th>
                <th>Adm. No</th>
                <th>Subjects Scored</th>
                <th>Total</th>
                <th>Average</th>
                <th>Grade</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pupilRows.map(p => `
                <tr>
                  <td style="font-weight:700;text-align:center;">
                    ${p.position <= 3
                      ? `<span class="badge badge-${p.position === 1 ? 'warning' : p.position === 2 ? 'neutral' : 'primary'}">${p.position}</span>`
                      : p.position}
                  </td>
                  <td style="text-align:left;font-weight:600;">${p.surname} ${p.firstName}</td>
                  <td class="text-sm text-muted">${p.admissionNumber || '—'}</td>
                  <td class="text-center">${p.scored} / ${_subjects.length}</td>
                  <td style="font-weight:700;">${p.totalSum}</td>
                  <td>${p.average}%</td>
                  <td>
                    <span class="badge badge-${_gradeBadge(p.grade)}">${p.grade}</span>
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-sm view-pupil-btn" data-id="${p.id}" title="View Details">
                      <i class="ph-bold ph-eye"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm print-pupil-btn" data-id="${p.id}" title="Print Report Card">
                      <i class="ph-bold ph-printer"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Store sorted rows for position lookups
    window._adminResultRows = pupilRows;

    document.querySelectorAll('.view-pupil-btn').forEach(btn => {
      btn.addEventListener('click', () => _viewPupilDetail(btn.dataset.id));
    });

    document.querySelectorAll('.print-pupil-btn').forEach(btn => {
      btn.addEventListener('click', () => _printPupil(btn.dataset.id));
    });

    document.getElementById('print-class-btn').addEventListener('click', _printAll);

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load results. ${err.message}</div>`;
  }
}

function _viewPupilDetail(pupilId) {
  const pupil   = _pupils.find(p => p.id === pupilId);
  const rMap    = {};
  _results.forEach(r => { rMap[`${r.pupilId}_${r.subjectId}`] = r; });
  const posRow  = window._adminResultRows?.find(p => p.id === pupilId);

  const rows = _subjects.map(s => {
    const r = rMap[`${pupilId}_${s.id}`];
    if (!r) return `<tr><td>${s.name}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
    const { grade, remark } = computeGrade(r.total || 0);
    return `<tr>
      <td style="text-align:left;">${s.name}</td>
      <td>${r.ca1 ?? '—'}</td>
      <td>${r.ca2 ?? '—'}</td>
      <td>${r.exam ?? '—'}</td>
      <td><strong>${r.total ?? '—'}</strong></td>
      <td><span class="badge badge-${_gradeBadge(grade)}">${grade} — ${remark}</span></td>
    </tr>`;
  }).join('');

  openModal({
    title: `${pupil.surname} ${pupil.firstName} — Results`,
    size: 'lg',
    bodyHTML: `
      <div class="flex gap-4 mb-4 flex-wrap">
        <div class="stat-card flex-1">
          <div class="stat-body">
            <div class="stat-value">${posRow?.totalSum ?? '—'}</div>
            <div class="stat-label">Total Score</div>
          </div>
        </div>
        <div class="stat-card flex-1">
          <div class="stat-body">
            <div class="stat-value">${posRow?.average ?? '—'}%</div>
            <div class="stat-label">Average</div>
          </div>
        </div>
        <div class="stat-card flex-1">
          <div class="stat-body">
            <div class="stat-value">${posRow?.position ?? '—'}</div>
            <div class="stat-label">Position</div>
          </div>
        </div>
        <div class="stat-card flex-1">
          <div class="stat-body">
            <div class="stat-value">${posRow?.grade ?? '—'}</div>
            <div class="stat-label">Grade</div>
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Subject</th>
              <th>CA 1</th><th>CA 2</th><th>Exam</th><th>Total</th><th>Grade</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="detail-print-btn">
        <i class="ph-bold ph-printer"></i> Print Report Card
      </button>
      <button class="btn btn-primary" id="detail-close-btn">Close</button>
    `,
  });

  document.getElementById('detail-close-btn').addEventListener('click', closeModal);
  document.getElementById('detail-print-btn').addEventListener('click', () => {
    closeModal();
    _printPupil(pupilId);
  });
}

async function _printPupil(pupilId) {
  const pupil    = _pupils.find(p => p.id === pupilId);
  const results  = _results.filter(r => r.pupilId === pupilId);
  const posRow   = window._adminResultRows?.find(p => p.id === pupilId);

  await printReportCard({
    pupil,
    results,
    subjects: _subjects,
    meta: {
      sessionName: _sessionName,
      termName:    _termName,
      className:   _className,
      classSize:   _pupils.length,
      position:    posRow?.position,
    },
  });
}

async function _printAll() {
  if (_results.length === 0) {
    toast.warning('No results to print for this class.');
    return;
  }

  await printClassResults({
    pupils:   _pupils,
    results:  _results,
    subjects: _subjects,
    meta: {
      sessionName: _sessionName,
      termName:    _termName,
      className:   _className,
    },
  });
}

function _gradeBadge(grade) {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  if (grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
}
