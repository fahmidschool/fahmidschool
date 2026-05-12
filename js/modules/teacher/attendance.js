// ============================================================
// teacher/attendance.js — Teacher attendance taking module
// ============================================================

import { store }                                        from '/js/store.js';
import { getAttendanceByDate, saveAttendanceBatch }     from '/js/services/attendance.js';
import { getAllClasses }                                 from '/js/services/classes.js';
import { getPupilsByClass }                             from '/js/services/pupils.js';
import { setPageTitle }                                 from '/js/components/topbar.js';
import { toast }                                        from '/js/toast.js';

let _classes       = [];
let _pupils        = [];
let _selectedClass = '';
let _selectedDate  = new Date().toISOString().slice(0, 10);

export default async function render(outlet) {
  setPageTitle('Attendance');

  _classes = await getAllClasses();
  const uid     = store.get('user')?.uid;
  const myClass = _classes.find(c => c.classTeacherId === uid);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Attendance</h1>
        <p>Record daily pupil attendance</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="ta-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}" ${myClass?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="ta-date" value="${_selectedDate}" max="${_selectedDate}" />
        </div>
        <div>
          <button class="btn btn-primary w-full" id="ta-load-btn">
            <i class="ph-bold ph-arrow-clockwise"></i> Load Pupils
          </button>
        </div>
      </div>
    </div>

    <div id="ta-area"></div>
  `;

  if (myClass) _selectedClass = myClass.id;

  document.getElementById('ta-class').addEventListener('change', e => { _selectedClass = e.target.value; });
  document.getElementById('ta-date').addEventListener('change',  e => { _selectedDate  = e.target.value; });
  document.getElementById('ta-load-btn').addEventListener('click', _loadAttendance);

  // Auto-load if class is pre-selected
  if (myClass) _loadAttendance();
}

async function _loadAttendance() {
  if (!_selectedClass || !_selectedDate) {
    toast.warning('Please select a class and date.'); return;
  }

  const area = document.getElementById('ta-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    [_pupils] = await Promise.all([getPupilsByClass(_selectedClass)]);
    const existing    = await getAttendanceByDate({ classId: _selectedClass, date: _selectedDate });
    const existingMap = {};
    existing.forEach(r => { existingMap[r.pupilId] = r; });

    const dateLabel = new Date(_selectedDate).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">${dateLabel}</div>
            <div class="card-subtitle">${_pupils.length} pupils</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="ta-all-present">All Present</button>
            <button class="btn btn-secondary btn-sm" id="ta-all-absent">All Absent</button>
            <button class="btn btn-primary btn-sm" id="ta-save-btn">
              <i class="ph-bold ph-floppy-disk"></i> Save
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:200px;">Pupil</th>
                <th>Admission No.</th>
                <th style="width:100px;text-align:center;">Present</th>
                <th style="width:100px;text-align:center;">Absent</th>
                <th style="width:100px;text-align:center;">Late</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody id="ta-tbody">
              ${_pupils.map(p => {
                const status = existingMap[p.id]?.status || 'present';
                return `
                  <tr data-id="${p.id}">
                    <td class="font-semibold">${p.surname} ${p.firstName}</td>
                    <td class="text-sm text-muted">${p.admissionNumber || '-'}</td>
                    <td style="text-align:center;">
                      <input type="radio" name="att_${p.id}" value="present" class="att-radio"
                        ${status === 'present' ? 'checked' : ''}
                        style="width:18px;height:18px;accent-color:var(--clr-success);cursor:pointer;" />
                    </td>
                    <td style="text-align:center;">
                      <input type="radio" name="att_${p.id}" value="absent" class="att-radio"
                        ${status === 'absent' ? 'checked' : ''}
                        style="width:18px;height:18px;accent-color:var(--clr-danger);cursor:pointer;" />
                    </td>
                    <td style="text-align:center;">
                      <input type="radio" name="att_${p.id}" value="late" class="att-radio"
                        ${status === 'late' ? 'checked' : ''}
                        style="width:18px;height:18px;accent-color:var(--clr-warning);cursor:pointer;" />
                    </td>
                    <td>
                      <input type="text" class="form-control remark-input"
                        style="padding:5px 8px;font-size:0.8125rem;"
                        value="${existingMap[p.id]?.remark || ''}"
                        placeholder="Optional remark" />
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('ta-all-present').addEventListener('click', () => {
      document.querySelectorAll('[name^="att_"]').forEach(r => {
        if (r.value === 'present') r.checked = true;
      });
    });

    document.getElementById('ta-all-absent').addEventListener('click', () => {
      document.querySelectorAll('[name^="att_"]').forEach(r => {
        if (r.value === 'absent') r.checked = true;
      });
    });

    document.getElementById('ta-save-btn').addEventListener('click', _save);

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load pupils. ${err.message}</div>`;
  }
}

async function _save() {
  const btn = document.getElementById('ta-save-btn');
  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Saving...`;

  const records = _pupils.map(p => {
    const checked = document.querySelector(`[name="att_${p.id}"]:checked`);
    const remark  = document.querySelector(`tr[data-id="${p.id}"] .remark-input`)?.value?.trim() || '';
    return {
      pupilId:   p.id,
      classId:   _selectedClass,
      date:      _selectedDate,
      status:    checked?.value || 'present',
      remark,
    };
  });

  try {
    await saveAttendanceBatch(records);
    toast.success(`Attendance saved for ${records.length} pupils.`);
  } catch (err) {
    toast.error('Failed to save attendance. Please try again.');
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<i class="ph-bold ph-floppy-disk"></i> Save`;
  }
}
