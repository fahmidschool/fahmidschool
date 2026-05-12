// ============================================================
// admin/attendance.js — Attendance management module
// ============================================================

import { getAttendanceByDate, saveAttendanceBatch, computeAttendanceSummary } from '/js/services/attendance.js';
import { getAllClasses }     from '/js/services/classes.js';
import { getPupilsByClass }  from '/js/services/pupils.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { toast }             from '/js/toast.js';

let _classes = [];
let _pupils  = [];
let _selectedClass = '';
let _selectedDate  = new Date().toISOString().slice(0, 10);

export default async function render(outlet) {
  setPageTitle('Attendance');
  _classes = await getAllClasses();

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Attendance</h1>
        <p>Record and monitor daily attendance</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="att-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="att-date" value="${_selectedDate}" />
        </div>
        <div>
          <button class="btn btn-primary w-full" id="load-att-btn">
            <i class="ph-bold ph-arrow-clockwise"></i> Load Attendance
          </button>
        </div>
      </div>
    </div>

    <div id="attendance-area"></div>
  `;

  document.getElementById('att-class').addEventListener('change', e => { _selectedClass = e.target.value; });
  document.getElementById('att-date').addEventListener('change',  e => { _selectedDate  = e.target.value; });
  document.getElementById('load-att-btn').addEventListener('click', _loadAttendance);
}

async function _loadAttendance() {
  if (!_selectedClass || !_selectedDate) {
    toast.warning('Please select class and date.'); return;
  }

  const area = document.getElementById('attendance-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    [_pupils] = await Promise.all([getPupilsByClass(_selectedClass)]);
    const existing = await getAttendanceByDate({ classId: _selectedClass, date: _selectedDate });

    const existingMap = {};
    existing.forEach(r => { existingMap[r.pupilId] = r.status; });

    area.innerHTML = `
      <div class="card" style="padding:0;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">Attendance — ${new Date(_selectedDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="card-subtitle">${_pupils.length} pupils</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="mark-all-present">Mark All Present</button>
            <button class="btn btn-primary btn-sm" id="save-attendance-btn">
              <i class="ph-bold ph-floppy-disk"></i> Save
            </button>
          </div>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:40px;"><input type="checkbox" id="check-all" /></th>
                <th>Pupil</th>
                <th>Admission No.</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              ${_pupils.map(p => {
                const status = existingMap[p.id] || 'present';
                return `
                  <tr>
                    <td><input type="checkbox" class="pupil-check" data-id="${p.id}" /></td>
                    <td class="font-semibold">${p.surname} ${p.firstName}</td>
                    <td class="text-sm text-muted">${p.admissionNumber || '-'}</td>
                    <td><input type="radio" name="att_${p.id}" value="present" ${status === 'present' ? 'checked' : ''} /></td>
                    <td><input type="radio" name="att_${p.id}" value="absent"  ${status === 'absent'  ? 'checked' : ''} /></td>
                    <td><input type="radio" name="att_${p.id}" value="late"    ${status === 'late'    ? 'checked' : ''} /></td>
                    <td><input type="text" class="form-control" style="padding:4px 8px;font-size:0.8rem;" placeholder="Optional remark" /></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('mark-all-present').addEventListener('click', () => {
      document.querySelectorAll('[name^="att_"]').forEach(radio => {
        if (radio.value === 'present') radio.checked = true;
      });
    });

    document.getElementById('save-attendance-btn').addEventListener('click', _saveAttendance);

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load attendance. ${err.message}</div>`;
  }
}

async function _saveAttendance() {
  const btn = document.getElementById('save-attendance-btn');
  btn.disabled = true;

  const records = _pupils.map(p => {
    const selected = document.querySelector(`[name="att_${p.id}"]:checked`);
    return {
      pupilId:   p.id,
      classId:   _selectedClass,
      date:      _selectedDate,
      status:    selected?.value || 'present',
    };
  });

  try {
    await saveAttendanceBatch(records);
    toast.success(`Attendance saved for ${records.length} pupils.`);
  } catch {
    toast.error('Failed to save attendance.');
  } finally {
    btn.disabled = false;
  }
}
