// ============================================================
// admin/timetable.js — Timetable management module
// ============================================================

import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }                from '/js/firebase.js';
import { getAllClasses }      from '/js/services/classes.js';
import { getSubjectsByClass } from '/js/services/subjects.js';
import { getAllTeachers }     from '/js/services/teachers.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { toast }             from '/js/toast.js';

const DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM'];

let _classes  = [];
let _teachers = [];
let _subjects = [];
let _timetable = {};  // { "Monday_8:00 AM": { subjectId, teacherId, ... } }
let _selectedClass = '';

export default async function render(outlet) {
  setPageTitle('Timetable');

  [_classes, _teachers] = await Promise.all([getAllClasses(), getAllTeachers()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Timetable</h1>
        <p>Manage class timetables</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" id="tt-print-btn" style="display:none;" onclick="window.print()">
          <i class="ph-bold ph-printer"></i> Print
        </button>
        <button class="btn btn-primary" id="tt-save-btn" style="display:none;">
          <i class="ph-bold ph-floppy-disk"></i> Save Timetable
        </button>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-2" style="align-items:flex-end;max-width:500px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="tt-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <button class="btn btn-primary w-full" id="tt-load-btn">
            <i class="ph-bold ph-calendar-dots"></i> Load Timetable
          </button>
        </div>
      </div>
    </div>

    <div id="tt-area"></div>
  `;

  document.getElementById('tt-class').addEventListener('change', e => { _selectedClass = e.target.value; });
  document.getElementById('tt-load-btn').addEventListener('click', _loadTimetable);
  document.getElementById('tt-save-btn').addEventListener('click', _saveTimetable);
}

async function _loadTimetable() {
  if (!_selectedClass) { toast.warning('Please select a class.'); return; }

  const area = document.getElementById('tt-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    _subjects  = await getSubjectsByClass(_selectedClass);
    const snap = await getDocs(query(collection(db, 'timetables'), where('classId', '==', _selectedClass)));
    _timetable = {};
    snap.docs.forEach(d => {
      const data = d.data();
      _timetable[`${data.day}_${data.period}`] = data;
    });

    const clsName = _classes.find(c => c.id === _selectedClass)?.name || '';

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div class="card-title">${clsName} — Weekly Timetable</div>
        </div>
        <div style="overflow-x:auto;">
          <table id="tt-table">
            <thead>
              <tr style="background:var(--sidebar-bg);color:#fff;">
                <th style="min-width:100px;">Period</th>
                ${DAYS.map(d => `<th style="min-width:160px;text-align:center;">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${PERIODS.map(period => `
                <tr>
                  <td class="font-semibold text-sm">${period}</td>
                  ${DAYS.map(day => {
                    const key   = `${day}_${period}`;
                    const entry = _timetable[key] || {};
                    const subj  = _subjects.find(s => s.id === entry.subjectId);
                    const teacher = _teachers.find(t => t.id === entry.teacherId);
                    return `
                      <td style="padding:var(--sp-2);">
                        <div style="display:flex;flex-direction:column;gap:4px;">
                          <select class="form-control tt-subject-sel"
                            style="font-size:0.8rem;padding:4px 6px;"
                            data-day="${day}" data-period="${period}">
                            <option value="">— Free —</option>
                            ${_subjects.map(s => `<option value="${s.id}" ${entry.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                          </select>
                          <select class="form-control tt-teacher-sel"
                            style="font-size:0.8rem;padding:4px 6px;"
                            data-day="${day}" data-period="${period}">
                            <option value="">— Teacher —</option>
                            ${_teachers.map(t => `<option value="${t.id}" ${entry.teacherId === t.id ? 'selected' : ''}>${t.surname} ${t.firstName}</option>`).join('')}
                          </select>
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

    document.getElementById('tt-save-btn').style.display  = 'inline-flex';
    document.getElementById('tt-print-btn').style.display = 'inline-flex';

    // Sync select changes to local state
    document.querySelectorAll('.tt-subject-sel, .tt-teacher-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const { day, period } = sel.dataset;
        const key = `${day}_${period}`;
        if (!_timetable[key]) _timetable[key] = {};
        if (sel.classList.contains('tt-subject-sel')) {
          _timetable[key].subjectId = sel.value;
          const s = _subjects.find(s => s.id === sel.value);
          _timetable[key].subjectName = s?.name || '';
        } else {
          _timetable[key].teacherId = sel.value;
          const t = _teachers.find(t => t.id === sel.value);
          _timetable[key].teacherName = t ? `${t.surname} ${t.firstName}` : '';
        }
      });
    });

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load timetable. ${err.message}</div>`;
  }
}

async function _saveTimetable() {
  const btn = document.getElementById('tt-save-btn');
  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Saving...`;

  try {
    const promises = [];

    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        const key   = `${day}_${period}`;
        const entry = _timetable[key] || {};
        const docId = `${_selectedClass}_${day}_${period}`.replace(/[^a-zA-Z0-9_]/g, '_');

        if (entry.subjectId) {
          promises.push(setDoc(doc(db, 'timetables', docId), {
            classId:     _selectedClass,
            day,
            period,
            subjectId:   entry.subjectId   || '',
            subjectName: entry.subjectName || '',
            teacherId:   entry.teacherId   || '',
            teacherName: entry.teacherName || '',
            updatedAt:   serverTimestamp(),
          }));
        } else {
          // Clear empty slots
          promises.push(deleteDoc(doc(db, 'timetables', docId)).catch(() => {}));
        }
      });
    });

    await Promise.all(promises);
    toast.success('Timetable saved successfully.');
  } catch (err) {
    toast.error('Failed to save timetable.');
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<i class="ph-bold ph-floppy-disk"></i> Save Timetable`;
  }
}
