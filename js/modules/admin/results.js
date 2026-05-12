// ============================================================
// admin/results.js — Results entry and management module
// ============================================================

import { getResults, saveResult, updateResultStatus, computeGrade, computeTotal } from '/js/services/results.js';
import { getAllClasses }     from '/js/services/classes.js';
import { getSubjectsByClass }from '/js/services/subjects.js';
import { getPupilsByClass }  from '/js/services/pupils.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { toast }             from '/js/toast.js';

let _classes  = [];
let _sessions = [];
let _selected = { sessionId: '', termId: '', classId: '' };
let _subjects = [];
let _pupils   = [];
let _results  = [];

export default async function render(outlet) {
  setPageTitle('Results');
  outlet.innerHTML = '';

  [_classes, _sessions] = await Promise.all([getAllClasses(), getAllSessions()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Results Management</h1>
        <p>Enter, review, and publish pupil results</p>
      </div>
    </div>

    <!-- Filters -->
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

  document.getElementById('res-session').addEventListener('change', async (e) => {
    _selected.sessionId = e.target.value;
    const terms = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('res-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('res-term').addEventListener('change', e => { _selected.termId = e.target.value; });
  document.getElementById('res-class').addEventListener('change', e => { _selected.classId = e.target.value; });

  document.getElementById('load-results-btn').addEventListener('click', _loadResultsGrid);
}

async function _loadResultsGrid() {
  const { sessionId, termId, classId } = _selected;
  if (!sessionId || !termId || !classId) {
    toast.warning('Please select session, term, and class first.');
    return;
  }

  const area = document.getElementById('results-area');
  area.innerHTML = `<div class="card"><div class="text-center text-muted"><span class="spinner spinner-dark"></span> Loading results...</div></div>`;

  try {
    [_subjects, _pupils, _results] = await Promise.all([
      getSubjectsByClass(classId),
      getPupilsByClass(classId),
      getResults(_selected),
    ]);

    const resultsMap = {};
    _results.forEach(r => {
      resultsMap[`${r.pupilId}_${r.subjectId}`] = r;
    });

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div class="card-title">Results Entry Grid</div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="publish-btn">
              <i class="ph-bold ph-paper-plane-tilt"></i> Publish
            </button>
            <button class="btn btn-primary btn-sm" id="save-results-btn">
              <i class="ph-bold ph-floppy-disk"></i> Save All
            </button>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table id="results-grid-table">
            <thead>
              <tr>
                <th style="min-width:160px;">Pupil</th>
                ${_subjects.map(s => `
                  <th style="min-width:200px;" colspan="3">
                    ${s.name}
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px;font-weight:400;font-size:0.7rem;">
                      <span>CA1</span><span>CA2</span><span>Exam</span>
                    </div>
                  </th>
                  <th>Total</th>
                  <th>Grade</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${_pupils.map(p => `
                <tr data-pupil="${p.id}">
                  <td class="font-semibold">${p.surname} ${p.firstName}</td>
                  ${_subjects.map(s => {
                    const key = `${p.id}_${s.id}`;
                    const r   = resultsMap[key] || {};
                    const total = r.ca1 !== undefined ? computeTotal(r) : '';
                    const grade = total !== '' ? computeGrade(total).grade : '';
                    return `
                      <td colspan="3">
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
                          <input type="number" class="form-control score-input" style="padding:5px 6px;font-size:0.8rem;"
                            min="0" max="20" data-pupil="${p.id}" data-subject="${s.id}" data-field="ca1"
                            value="${r.ca1 ?? ''}" placeholder="0" />
                          <input type="number" class="form-control score-input" style="padding:5px 6px;font-size:0.8rem;"
                            min="0" max="20" data-pupil="${p.id}" data-subject="${s.id}" data-field="ca2"
                            value="${r.ca2 ?? ''}" placeholder="0" />
                          <input type="number" class="form-control score-input" style="padding:5px 6px;font-size:0.8rem;"
                            min="0" max="60" data-pupil="${p.id}" data-subject="${s.id}" data-field="exam"
                            value="${r.exam ?? ''}" placeholder="0" />
                        </div>
                      </td>
                      <td class="font-bold total-cell" data-pupil="${p.id}" data-subject="${s.id}">${total}</td>
                      <td class="grade-cell" data-pupil="${p.id}" data-subject="${s.id}">${grade}</td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Live total computation
    document.querySelectorAll('.score-input').forEach(inp => {
      inp.addEventListener('input', () => _updateRowTotal(inp));
    });

    document.getElementById('save-results-btn').addEventListener('click', _saveAllResults);
    document.getElementById('publish-btn').addEventListener('click', () => _changeStatus('published'));

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load results. ${err.message}</div>`;
  }
}

function _updateRowTotal(inp) {
  const { pupil, subject } = inp.dataset;
  const inputs = document.querySelectorAll(`.score-input[data-pupil="${pupil}"][data-subject="${subject}"]`);
  const scores = {};
  inputs.forEach(i => { scores[i.dataset.field] = Number(i.value) || 0; });
  const total = scores.ca1 + scores.ca2 + scores.exam;
  const { grade } = computeGrade(total);

  const totalEl = document.querySelector(`.total-cell[data-pupil="${pupil}"][data-subject="${subject}"]`);
  const gradeEl = document.querySelector(`.grade-cell[data-pupil="${pupil}"][data-subject="${subject}"]`);
  if (totalEl) totalEl.textContent = total;
  if (gradeEl) gradeEl.textContent = grade;
}

async function _saveAllResults() {
  const btn = document.getElementById('save-results-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm" style="border-top-color:white;"></span> Saving...`;

  try {
    const promises = [];
    document.querySelectorAll('tr[data-pupil]').forEach(row => {
      const pupilId = row.dataset.pupil;
      _subjects.forEach(s => {
        const ca1  = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="ca1"]`)?.value;
        const ca2  = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="ca2"]`)?.value;
        const exam = row.querySelector(`.score-input[data-pupil="${pupilId}"][data-subject="${s.id}"][data-field="exam"]`)?.value;

        if (ca1 !== '' || ca2 !== '' || exam !== '') {
          const total = (Number(ca1)||0) + (Number(ca2)||0) + (Number(exam)||0);
          const { grade, remark } = computeGrade(total);
          promises.push(saveResult({
            ..._selected,
            pupilId, subjectId: s.id,
            ca1: Number(ca1)||0, ca2: Number(ca2)||0, exam: Number(exam)||0,
            total, grade, remark,
          }));
        }
      });
    });

    await Promise.all(promises);
    toast.success('Results saved successfully.');
  } catch {
    toast.error('Failed to save some results. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-floppy-disk"></i> Save All`;
  }
}

async function _changeStatus(status) {
  try {
    const ids = _results.map(r => r.id);
    if (ids.length === 0) { toast.warning('No saved results to publish.'); return; }
    await updateResultStatus(ids, status);
    toast.success(`Results ${status} successfully.`);
  } catch {
    toast.error('Failed to update result status.');
  }
}
