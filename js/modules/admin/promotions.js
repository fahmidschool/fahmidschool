// ============================================================
// admin/promotions.js — Pupil promotions using class hierarchy
// ============================================================
import { getAllClasses, getNextClass }             from '/js/services/classes.js';
import { getPupilsByClass, promotePupils, updatePupil } from '/js/services/pupils.js';
import { getActivePeriod }                         from '/js/services/sessions.js';
import { logAction }                               from '/js/services/audit.js';
import { setPageTitle }                            from '/js/components/topbar.js';
import { toast }                                   from '/js/toast.js';

let _classes      = [];
let _pupils       = [];
let _activePeriod = { session: null, term: null };
let _selectedFromClass = '';
let _selectedToClass   = '';

export default async function render(outlet) {
  setPageTitle('Promotions');
  [_classes, _activePeriod] = await Promise.all([getAllClasses(), getActivePeriod()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Promotions</h1>
        <p>Promote or graduate pupils between classes</p>
      </div>
    </div>

    <div class="alert alert-info mb-4">
      <i class="ph-bold ph-info"></i>
      <span>
        Classes are ordered hierarchically. When you select a source class and click "Auto-fill Next Class",
        the system will suggest the next class in order. You can override the destination manually.
      </span>
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
      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary" id="autofill-next-btn">
          <i class="ph-bold ph-arrows-down-up"></i> Auto-fill Next Class
        </button>
        <button class="btn btn-secondary" id="promo-load-btn">
          <i class="ph-bold ph-users"></i> Load Pupils
        </button>
      </div>
    </div>

    <div id="promo-area"></div>
  `;

  document.getElementById('promo-from').addEventListener('change', e => {
    _selectedFromClass = e.target.value;
  });
  document.getElementById('promo-to').addEventListener('change', e => {
    _selectedToClass = e.target.value;
  });

  document.getElementById('autofill-next-btn').addEventListener('click', async () => {
    if (!_selectedFromClass) { toast.warning('Select a source class first.'); return; }
    const next = await getNextClass(_selectedFromClass);
    if (!next) {
      toast.info('This is the final class — pupils in this class should be graduated, not promoted.');
      return;
    }
    const toSel = document.getElementById('promo-to');
    toSel.value = next.id;
    _selectedToClass = next.id;
    toast.success(`Destination set to "${next.name}".`);
  });

  document.getElementById('promo-load-btn').addEventListener('click', _loadPupils);
}

async function _loadPupils() {
  if (!_selectedFromClass) { toast.warning('Please select the source class.'); return; }

  const area = document.getElementById('promo-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    _pupils = await getPupilsByClass(_selectedFromClass);
    const fromClass = _classes.find(c => c.id === _selectedFromClass);
    const nextClass = await getNextClass(_selectedFromClass);

    area.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:var(--sp-5);">
          <div>
            <div class="card-title">${fromClass?.name || ''} — ${_pupils.length} pupils</div>
            <div class="card-subtitle">
              Next class in hierarchy: <strong>${nextClass ? nextClass.name : 'None (Final Year — graduate)'}</strong>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
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
              ${_pupils.length === 0
                ? `<tr><td colspan="5" class="table-empty">No active pupils in this class.</td></tr>`
                : _pupils.map(p => `
                    <tr>
                      <td><input type="checkbox" class="pupil-promo-check" data-id="${p.id}" /></td>
                      <td class="font-semibold">${p.surname} ${p.firstName}</td>
                      <td class="text-sm text-muted">${p.admissionNumber || '—'}</td>
                      <td>${p.gender || '—'}</td>
                      <td><span class="badge badge-success">${p.status || 'active'}</span></td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

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
  if (!_selectedToClass) {
    toast.warning('Please select the destination class (or use Auto-fill Next Class).');
    return;
  }
  const selected = _getSelectedIds();
  if (selected.length === 0) { toast.warning('Please select at least one pupil.'); return; }

  const toClass = _classes.find(c => c.id === _selectedToClass);
  if (!confirm(`Promote ${selected.length} pupil(s) to ${toClass?.name}?`)) return;

  try {
    await promotePupils(selected, _selectedToClass);
    await logAction('pupils_promoted', { count: selected.length, toClassId: _selectedToClass });
    toast.success(`${selected.length} pupil(s) promoted to ${toClass?.name}.`);
    await _loadPupils();
  } catch (err) {
    toast.error('Failed to promote pupils.');
    console.error(err);
  }
}

async function _graduateSelected() {
  const selected = _getSelectedIds();
  if (selected.length === 0) { toast.warning('Please select at least one pupil.'); return; }

  const fromClass = _classes.find(c => c.id === _selectedFromClass);
  const nextClass = await getNextClass(_selectedFromClass);
  if (nextClass) {
    if (!confirm(
      `Warning: ${fromClass?.name} is NOT the final class — the next class is ${nextClass.name}.\n\n` +
      `Are you sure you want to graduate these ${selected.length} pupil(s) rather than promote them?`
    )) return;
  } else {
    if (!confirm(`Graduate ${selected.length} pupil(s)? This marks them as graduated.`)) return;
  }

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
  return Array.from(
    document.querySelectorAll('.pupil-promo-check:checked')
  ).map(cb => cb.dataset.id);
}
