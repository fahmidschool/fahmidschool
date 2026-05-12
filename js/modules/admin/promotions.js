// ============================================================
// admin/promotions.js — Pupil promotions and graduation module
// ============================================================

import { getAllClasses }              from '/js/services/classes.js';
import { getPupilsByClass, promotePupils, updatePupil } from '/js/services/pupils.js';
import { logAction }                  from '/js/services/audit.js';
import { setPageTitle }               from '/js/components/topbar.js';
import { toast }                      from '/js/toast.js';

let _classes = [];
let _pupils  = [];
let _selectedFromClass = '';
let _selectedToClass   = '';

export default async function render(outlet) {
  setPageTitle('Promotions');
  _classes = await getAllClasses();

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Promotions</h1>
        <p>Promote or graduate pupils between classes</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="card-header"><div class="card-title">Promote Pupils</div></div>
      <div class="form-row cols-2" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">From Class <span class="required">*</span></label>
          <select class="form-control" id="promo-from">
            <option value="">Select Source Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">To Class <span class="required">*</span></label>
          <select class="form-control" id="promo-to">
            <option value="">Select Destination Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-secondary mt-4" id="promo-load-btn">
        <i class="ph-bold ph-users"></i> Load Pupils
      </button>
    </div>

    <div id="promo-area"></div>
  `;

  document.getElementById('promo-from').addEventListener('change', e => { _selectedFromClass = e.target.value; });
  document.getElementById('promo-to').addEventListener('change',   e => { _selectedToClass   = e.target.value; });
  document.getElementById('promo-load-btn').addEventListener('click', _loadPupils);
}

async function _loadPupils() {
  if (!_selectedFromClass) { toast.warning('Please select the source class.'); return; }

  const area = document.getElementById('promo-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    _pupils = await getPupilsByClass(_selectedFromClass);
    const fromName = _classes.find(c => c.id === _selectedFromClass)?.name || '';

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">${fromName} — ${_pupils.length} pupils</div>
            <div class="card-subtitle">Select pupils to promote</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="select-all-btn">Select All</button>
            <button class="btn btn-primary btn-sm" id="promote-btn">
              <i class="ph-bold ph-arrow-up-right"></i> Promote Selected
            </button>
            <button class="btn btn-danger btn-sm" id="graduate-btn">
              <i class="ph-bold ph-graduation-cap"></i> Graduate Selected
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width:40px;"><input type="checkbox" id="check-all-pupils" /></th>
                <th>Name</th>
                <th>Admission No.</th>
                <th>Gender</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${_pupils.map(p => `
                <tr>
                  <td><input type="checkbox" class="pupil-promo-check" data-id="${p.id}" /></td>
                  <td class="font-semibold">${p.surname} ${p.firstName}</td>
                  <td class="text-sm text-muted">${p.admissionNumber || '-'}</td>
                  <td>${p.gender || '-'}</td>
                  <td><span class="badge badge-success">${p.status || 'active'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Select all toggle
    document.getElementById('check-all-pupils').addEventListener('change', e => {
      document.querySelectorAll('.pupil-promo-check').forEach(cb => { cb.checked = e.target.checked; });
    });

    document.getElementById('select-all-btn').addEventListener('click', () => {
      document.querySelectorAll('.pupil-promo-check').forEach(cb => { cb.checked = true; });
    });

    document.getElementById('promote-btn').addEventListener('click', _promoteSelected);
    document.getElementById('graduate-btn').addEventListener('click', _graduateSelected);

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load pupils. ${err.message}</div>`;
  }
}

async function _promoteSelected() {
  if (!_selectedToClass) { toast.warning('Please select the destination class.'); return; }

  const selected = _getSelectedIds();
  if (selected.length === 0) { toast.warning('Please select at least one pupil.'); return; }

  if (!confirm(`Promote ${selected.length} pupil(s) to the selected class?`)) return;

  try {
    await promotePupils(selected, _selectedToClass);
    const toName = _classes.find(c => c.id === _selectedToClass)?.name || '';
    toast.success(`${selected.length} pupil(s) promoted to ${toName}.`);
    await _loadPupils();
  } catch (err) {
    toast.error('Failed to promote pupils. Please try again.');
    console.error(err);
  }
}

async function _graduateSelected() {
  const selected = _getSelectedIds();
  if (selected.length === 0) { toast.warning('Please select at least one pupil.'); return; }

  if (!confirm(`Graduate ${selected.length} pupil(s)? This marks them as graduated.`)) return;

  try {
    await Promise.all(selected.map(id => updatePupil(id, { status: 'graduated', classId: '' })));
    await logAction('pupils_graduated', { count: selected.length });
    toast.success(`${selected.length} pupil(s) graduated successfully.`);
    await _loadPupils();
  } catch (err) {
    toast.error('Failed to graduate pupils.');
    console.error(err);
  }
}

function _getSelectedIds() {
  return Array.from(document.querySelectorAll('.pupil-promo-check:checked')).map(cb => cb.dataset.id);
}
