// ============================================================
// teacher/results.js — Teacher results entry module
// ============================================================

import { store }                                          from '/js/store.js';
import { getResults, saveResult, computeGrade, computeTotal } from '/js/services/results.js';
import { getSubjectsByClass }                             from '/js/services/subjects.js';
import { getPupilsByClass }                               from '/js/services/pupils.js';
import { getAllSessions, getTermsBySession }               from '/js/services/sessions.js';
import { getAllClasses }                                   from '/js/services/classes.js';
import { setPageTitle }                                   from '/js/components/topbar.js';
import { toast }                                          from '/js/toast.js';

let _sessions = [];
let _classes  = [];
let _subjects = [];
let _pupils   = [];
let _results  = [];
let _selected = { sessionId: '', termId: '', classId: '' };

export default async function render(outlet) {
  setPageTitle('Results Entry');

  const profile = store.get('profile');
  [_sessions, _classes] = await Promise.all([getAllSessions(), getAllClasses()]);

  // Pre-select teacher's own class if set
  const myClass = _classes.find(c => c.classTeacherId === store.get('user')?.uid);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Results Entry</h1>
        <p>Enter scores for your class</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="tr-session">
            <option value="">Select Session</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="tr-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="tr-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}" ${myClass?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary mt-4" id="tr-load-btn">
        <i class="ph-bold ph-arrow-clockwise"></i> Load Grid
      </button>
    </div>

    <div id="tr-results-area"></div>
  `;

  if (myClass) _selected.classId = myClass.id;

  document.getElementById('tr-session').addEventListener('change', async e => {
    _selected.sessionId = e.target.value;
    const terms   = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('tr-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('tr-term').addEventListener('change',  e => { _selected.termId  = e.target.value; });
  document.getElementById('tr-class').addEventListener('change', e => { _selected.classId = e.target.value; });

  document.getElementById('tr-load-btn').addEventListener('click', _loadGrid);
}

async function _loadGrid() {
  const { sessionId, termId, classId } = _selected;
  if (!sessionId || !termId || !classId) {
    toast.warning('Please select session, term, and class.'); return;
  }

  const area = document.getElementById('tr-results-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    [_subjects, _pupils, _results] = await Promise.all([
      getSubjectsByClass(classId),
      getPupilsByClass(classId),
      getResults(_selected),
    ]);

    const resultsMap = {};
    _results.forEach(r => { resultsMap[`${r.pupilId}_${r.subjectId}`] = r; });

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">Results Entry Grid</div>
            <div class="card-subtitle">${_pupils.length} pupils &mdash; ${_subjects.length} subjects</div>
          </div>
          <button class="btn btn-primary" id="tr-save-btn">
            <i class="ph-bold ph-floppy-disk"></i> Save All
          </button>
        </div>
        <div style="overflow-x:auto;">
          <table id="tr-grid-table">
            <thead>
              <tr>
                <th style="min-width:180px;position:sticky;left:0;background:var(--clr-surface-2);z-index:2;">Pupil</th>
                ${_subjects.map(s => `
                  <th colspan="4" style="min-width:240px;text-align:center;">
                    ${s.name}
                    <div style="display:grid;grid-template-columns:repeat(3,1fr) 80px;gap:4px;margin-top:6px;font-weight:400;font-size:0.7rem;color:var(--clr-text-muted);">
                      <span>CA1</span><span>CA2</span><span>Exam</span><span>Total</span>
                    </div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${_pupils.map(p => `
                <tr data-pupil="${p.id}">
                  <td style="position:sticky;left:0;background:var(--clr-surface);z-index:1;" class="font-semibold">
                    ${p.surname} ${p.firstName}
                  </td>
                  ${_subjects.map(s => {
                    const r     = resultsMap[`${p.id}_${s.id}`] || {};
                    const total = r.total ?? (r.ca1 !== undefined ? computeTotal(r) : '');
                    const grade = total !== '' ? computeGrade(Number(total)).grade : '';
                    return `
                      <td colspan="4">
                        <div style="display:grid;grid-template-columns:repeat(3,1fr) 80px;gap:4px;align-items:center;">
                          <input type="number" class="form-control score-input"
                            style="padding:5px 6px;font-size:0.8125rem;"
                            min="0" max="20"
                            data-pupil="${p.id}" data-subject="${s.id}" data-field="ca1"
                            value="${r.ca1 ?? ''}" placeholder="0" />
                          <input type="number" class="form-control score-input"
                            style="padding:5px 6px;font-size:0.8125rem;"
                            min="0" max="20"
                            data-pupil="${p.id}" data-subject="${s.id}" data-field="ca2"
                            value="${r.ca2 ?? ''}" placeholder="0" />
                          <input type="number" class="form-control score-input"
                            style="padding:5px 6px;font-size:0.8125rem;"
                            min="0" max="60"
                            data-pupil="${p.id}" data-subject="${s.id}" data-field="exam"
                            value="${r.exam ?? ''}" placeholder="0" />
                          <div style="font-size:0.8125rem;text-align:center;">
                            <span class="total-cell font-bold" data-pupil="${p.id}" data-subject="${s.id}">${total}</span>
                            <span class="badge badge-${_gradeBadge(grade)} grade-badge" data-pupil="${p.id}" data-subject="${s.id}" style="margin-top:3px;display:block;">${grade}</span>
                          </div>
                        </div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.score-input').forEach(inp => {
      inp.addEventListener('input', () => _updateTotal(inp));
    });

    document.getElementById('tr-save-btn').addEventListener('click', _saveAll);

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load results grid. ${err.message}</div>`;
  }
}

function _updateTotal(inp) {
  const { pupil, subject } = inp.dataset;
  const inputs = document.querySelectorAll(`.score-input[data-pupil="${pupil}"][data-subject="${subject}"]`);
  const scores = {};
  inputs.forEach(i => { scores[i.dataset.field] = Number(i.value) || 0; });
  const total       = scores.ca1 + scores.ca2 + scores.exam;
  const { grade }   = computeGrade(total);

  const totalEl = document.querySelector(`.total-cell[data-pupil="${pupil}"][data-subject="${subject}"]`);
  const gradeEl = document.querySelector(`.grade-badge[data-pupil="${pupil}"][data-subject="${subject}"]`);
  if (totalEl) totalEl.textContent    = total;
  if (gradeEl) {
    gradeEl.textContent  = grade;
    gradeEl.className    = `badge badge-${_gradeBadge(grade)} grade-badge`;
  }
}

async function _saveAll() {
  const btn = document.getElementById('tr-save-btn');
  btn.disabled    = true;
  btn.innerHTML   = `<span class="spinner"></span> Saving...`;

  const promises = [];

  document.querySelectorAll('tr[data-pupil]').forEach(row => {
    const pupilId = row.dataset.pupil;
    _subjects.forEach(s => {
      const ca1Input  = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="ca1"]`);
      const ca2Input  = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="ca2"]`);
      const examInput = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="exam"]`);

      if (!ca1Input) return;

      const ca1  = Number(ca1Input.value)  || 0;
      const ca2  = Number(ca2Input.value)  || 0;
      const exam = Number(examInput.value) || 0;

      if (ca1Input.value === '' && ca2Input.value === '' && examInput.value === '') return;

      const total         = ca1 + ca2 + exam;
      const { grade, remark } = computeGrade(total);

      promises.push(saveResult({
        ..._selected,
        pupilId,
        subjectId:   s.id,
        subjectName: s.name,
        ca1, ca2, exam, total, grade, remark,
      }));
    });
  });

  try {
    await Promise.all(promises);
    toast.success(`${promises.length} result records saved successfully.`);
  } catch (err) {
    toast.error('Some results could not be saved. Please try again.');
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<i class="ph-bold ph-floppy-disk"></i> Save All`;
  }
}

function _gradeBadge(grade) {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'info';
  if (grade === 'C') return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
}
