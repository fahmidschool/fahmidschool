// ============================================================
// admin/pupils.js — Pupils management module
// ============================================================

import { getAllPupils, createPupil, updatePupil, deletePupil, searchPupils } from '/js/services/pupils.js';
import { getAllClasses }  from '/js/services/classes.js';
import { setPageTitle }  from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }         from '/js/toast.js';

let _pupils  = [];
let _classes = [];
let _page    = 1;
const PAGE_SIZE = 20;

export default async function render(outlet) {
  setPageTitle('Pupils');
  outlet.innerHTML = _skeletonHTML();

  try {
    [_pupils, _classes] = await Promise.all([getAllPupils(), getAllClasses()]);
    _page = 1;
    outlet.innerHTML = _pageHTML();
    _attachListeners(outlet);
  } catch {
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load pupils.</div>`;
  }
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Pupils</h1>
        <p>${_pupils.length} pupils enrolled</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-pupil-btn">
          <i class="ph-bold ph-user-plus"></i> Add Pupil
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="search-bar" style="flex:1;max-width:340px;">
        <i class="ph-bold ph-magnifying-glass" style="font-size:16px;color:var(--clr-text-muted);"></i>
        <input type="text" id="pupil-search" placeholder="Search by name or admission number..." />
      </div>
      <select class="form-control" id="class-filter" style="width:180px;">
        <option value="">All Classes</option>
        ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <select class="form-control" id="status-filter" style="width:140px;">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="graduated">Graduated</option>
      </select>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;">
      <div class="table-wrapper" id="pupils-table-wrap">
        ${_tableHTML(_filtered())}
      </div>
    </div>
  `;
}

function _tableHTML(list) {
  if (list.length === 0) {
    return `<div class="table-empty"><i class="ph-bold ph-student" style="font-size:40px;"></i><p>No pupils found.</p></div>`;
  }

  const start  = (_page - 1) * PAGE_SIZE;
  const sliced = list.slice(start, start + PAGE_SIZE);
  const total  = Math.ceil(list.length / PAGE_SIZE);

  return `
    <table>
      <thead>
        <tr>
          <th>Admission No.</th>
          <th>Name</th>
          <th>Class</th>
          <th>Gender</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${sliced.map(p => {
          const cls = _classes.find(c => c.id === p.classId);
          return `
            <tr>
              <td><span class="font-medium">${p.admissionNumber || '-'}</span></td>
              <td>
                <div class="flex items-center gap-3">
                  <div class="user-avatar" style="width:34px;height:34px;font-size:0.75rem;background:var(--clr-primary);">
                    ${_initials(p.surname, p.firstName)}
                  </div>
                  <div>
                    <div class="font-semibold">${p.surname} ${p.firstName}</div>
                    <div class="text-xs text-muted">${p.email || ''}</div>
                  </div>
                </div>
              </td>
              <td>${cls?.name || '-'}</td>
              <td>${p.gender || '-'}</td>
              <td><span class="badge badge-${p.status === 'active' ? 'success' : 'neutral'}">${p.status || 'active'}</span></td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm edit-pupil-btn" data-id="${p.id}" title="Edit">
                    <i class="ph-bold ph-pencil-simple"></i>
                  </button>
                  <button class="btn btn-ghost btn-sm text-danger delete-pupil-btn" data-id="${p.id}" title="Delete">
                    <i class="ph-bold ph-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    ${total > 1 ? _paginationHTML(total) : ''}
  `;
}

function _paginationHTML(total) {
  let html = '<div class="pagination" style="padding:var(--sp-4);">';
  html += `<button class="page-btn" id="prev-page" ${_page === 1 ? 'disabled' : ''}>
    <i class="ph-bold ph-caret-left"></i>
  </button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i === _page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" id="next-page" ${_page === total ? 'disabled' : ''}>
    <i class="ph-bold ph-caret-right"></i>
  </button>`;
  html += '</div>';
  return html;
}

function _filtered() {
  const search     = document.getElementById('pupil-search')?.value?.toLowerCase() || '';
  const classFilter = document.getElementById('class-filter')?.value || '';
  const statusFilter = document.getElementById('status-filter')?.value || '';

  return _pupils.filter(p => {
    const name  = `${p.surname} ${p.firstName}`.toLowerCase();
    const adm   = (p.admissionNumber || '').toLowerCase();
    const matchSearch  = !search || name.includes(search) || adm.includes(search);
    const matchClass   = !classFilter  || p.classId === classFilter;
    const matchStatus  = !statusFilter || p.status  === statusFilter;
    return matchSearch && matchClass && matchStatus;
  });
}

function _attachListeners(outlet) {
  // Search + filters
  ['pupil-search', 'class-filter', 'status-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      _page = 1;
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
    });
  });

  // Add pupil
  document.getElementById('add-pupil-btn').addEventListener('click', () => _openPupilModal());

  _bindTableActions();
}

function _bindTableActions() {
  document.querySelectorAll('.edit-pupil-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pupil = _pupils.find(p => p.id === btn.dataset.id);
      if (pupil) _openPupilModal(pupil);
    });
  });

  document.querySelectorAll('.delete-pupil-btn').forEach(btn => {
    btn.addEventListener('click', () => _confirmDelete(btn.dataset.id));
  });

  document.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      _page = Number(btn.dataset.page);
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
    });
  });

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (_page > 1) { _page--; document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered()); _bindTableActions(); }
  });
  document.getElementById('next-page')?.addEventListener('click', () => {
    const total = Math.ceil(_filtered().length / PAGE_SIZE);
    if (_page < total) { _page++; document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered()); _bindTableActions(); }
  });
}

function _openPupilModal(pupil = null) {
  const isEdit = !!pupil;

  const modal = openModal({
    title:    isEdit ? 'Edit Pupil' : 'Add New Pupil',
    size:     'lg',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Surname <span class="required">*</span></label>
          <input type="text" class="form-control" id="m-surname" value="${pupil?.surname || ''}" placeholder="Last name" />
        </div>
        <div class="form-group">
          <label class="form-label">First Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="m-firstname" value="${pupil?.firstName || ''}" placeholder="First name" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Admission Number <span class="required">*</span></label>
          <input type="text" class="form-control" id="m-adm" value="${pupil?.admissionNumber || ''}" placeholder="e.g. FPS/2024/001" ${isEdit ? 'readonly' : ''} />
        </div>
        <div class="form-group">
          <label class="form-label">Email <span class="required">*</span></label>
          <input type="email" class="form-control" id="m-email" value="${pupil?.email || ''}" placeholder="pupil@email.com" />
        </div>
      </div>
      <div class="form-row cols-3">
        <div class="form-group">
          <label class="form-label">Gender</label>
          <select class="form-control" id="m-gender">
            <option value="">Select</option>
            <option value="Male"   ${pupil?.gender === 'Male'   ? 'selected' : ''}>Male</option>
            <option value="Female" ${pupil?.gender === 'Female' ? 'selected' : ''}>Female</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" class="form-control" id="m-dob" value="${pupil?.dateOfBirth || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Class</label>
          <select class="form-control" id="m-class">
            <option value="">None</option>
            ${_classes.map(c => `<option value="${c.id}" ${pupil?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Parent/Guardian Name</label>
          <input type="text" class="form-control" id="m-guardian" value="${pupil?.guardianName || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Guardian Phone</label>
          <input type="tel" class="form-control" id="m-phone" value="${pupil?.guardianPhone || ''}" />
        </div>
      </div>
      <div id="pupil-form-error" class="alert alert-danger" style="display:none;"></div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">
        <span id="modal-save-text">${isEdit ? 'Save Changes' : 'Add Pupil'}</span>
        <span class="spinner" id="modal-spinner" style="display:none;"></span>
      </button>
    `,
  });

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

  document.getElementById('modal-save-btn').addEventListener('click', async () => {
    const data = {
      surname:       document.getElementById('m-surname').value.trim(),
      firstName:     document.getElementById('m-firstname').value.trim(),
      admissionNumber: document.getElementById('m-adm').value.trim(),
      email:         document.getElementById('m-email').value.trim(),
      gender:        document.getElementById('m-gender').value,
      dateOfBirth:   document.getElementById('m-dob').value,
      classId:       document.getElementById('m-class').value,
      guardianName:  document.getElementById('m-guardian').value.trim(),
      guardianPhone: document.getElementById('m-phone').value.trim(),
    };

    const errEl = document.getElementById('pupil-form-error');
    errEl.style.display = 'none';

    if (!data.surname || !data.firstName || !data.admissionNumber || !data.email) {
      errEl.textContent  = 'Please fill in all required fields.';
      errEl.style.display = 'flex';
      return;
    }

    const saveBtn     = document.getElementById('modal-save-btn');
    const saveText    = document.getElementById('modal-save-text');
    const saveSpinner = document.getElementById('modal-spinner');
    saveBtn.disabled       = true;
    saveText.style.display = 'none';
    saveSpinner.style.display = 'inline-block';

    try {
      if (isEdit) {
        await updatePupil(pupil.id, data);
        const idx = _pupils.findIndex(p => p.id === pupil.id);
        if (idx !== -1) _pupils[idx] = { ..._pupils[idx], ...data };
        toast.success('Pupil record updated successfully.');
      } else {
        const id = await createPupil(data);
        _pupils.unshift({ id, ...data, status: 'active' });
        toast.success('Pupil added successfully.');
      }
      closeModal();
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
    } catch (err) {
      errEl.textContent  = err.message || 'Failed to save pupil record.';
      errEl.style.display = 'flex';
      saveBtn.disabled       = false;
      saveText.style.display = 'inline';
      saveSpinner.style.display = 'none';
    }
  });
}

function _confirmDelete(id) {
  const pupil = _pupils.find(p => p.id === id);
  const modal = openModal({
    title:    'Delete Pupil Record',
    size:     'sm',
    bodyHTML: `<p>Are you sure you want to delete <strong>${pupil?.surname} ${pupil?.firstName}</strong>? This action cannot be undone.</p>`,
    footerHTML: `
      <button class="btn btn-secondary" id="del-cancel">Cancel</button>
      <button class="btn btn-danger" id="del-confirm">Delete</button>
    `,
  });

  document.getElementById('del-cancel').addEventListener('click', closeModal);
  document.getElementById('del-confirm').addEventListener('click', async () => {
    try {
      await deletePupil(id);
      _pupils = _pupils.filter(p => p.id !== id);
      closeModal();
      toast.success('Pupil record deleted.');
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
    } catch {
      toast.error('Failed to delete pupil.');
    }
  });
}

function _initials(s, f) {
  return `${(s || '')[0] || ''}${(f || '')[0] || ''}`.toUpperCase();
}

function _skeletonHTML() {
  return `
    <div class="skeleton skeleton-title mb-6" style="width:150px;"></div>
    ${Array(6).fill(`
      <div class="skeleton-row">
        <div class="skeleton skeleton-circle"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-text" style="width:60%;"></div>
          <div class="skeleton skeleton-text" style="width:40%;"></div>
        </div>
      </div>
    `).join('')}
  `;
}
