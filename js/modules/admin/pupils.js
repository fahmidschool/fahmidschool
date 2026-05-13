// ============================================================
// admin/pupils.js — Pupils management with account creation
// ============================================================

import { getAllPupils, updatePupil, deletePupil } from '/js/services/pupils.js';
import { createPupilAccount, sendPasswordReset }  from '/js/services/auth-admin.js';
import { getAllClasses }                           from '/js/services/classes.js';
import { setPageTitle }                           from '/js/components/topbar.js';
import { openModal, closeModal }                  from '/js/components/modal.js';
import { toast }                                  from '/js/toast.js';

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
  } catch (err) {
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load pupils. ${err.message}</div>`;
  }
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Pupils</h1>
        <p>${_pupils.length} pupil${_pupils.length !== 1 ? 's' : ''} enrolled</p>
      </div>
      <div class="page-header-right">
        <button type="button" class="btn btn-primary" id="add-pupil-btn">
          <i class="ph-bold ph-user-plus"></i> Add Pupil
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-bar" style="flex:1;max-width:340px;">
        <i class="ph-bold ph-magnifying-glass" style="font-size:16px;color:var(--clr-text-muted);"></i>
        <input type="text" id="pupil-search"
          placeholder="Search by name or admission number..." />
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

    <div class="card" style="padding:0;">
      <div class="table-wrapper" id="pupils-table-wrap">
        ${_tableHTML(_filtered())}
      </div>
    </div>
  `;
}

function _tableHTML(list) {
  if (list.length === 0) {
    return `
      <div class="table-empty">
        <i class="ph-bold ph-student" style="font-size:40px;display:block;margin-bottom:8px;"></i>
        <p>No pupils found.</p>
      </div>`;
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
          const cls      = _classes.find(c => c.id === p.classId);
          const initials = `${(p.surname||'')[0]||''}${(p.firstName||'')[0]||''}`.toUpperCase();
          return `
            <tr>
              <td>
                <span class="font-medium" style="font-family:var(--font-mono);font-size:0.8125rem;">
                  ${p.admissionNumber || '-'}
                </span>
              </td>
              <td>
                <div class="flex items-center gap-3">
                  <div class="user-avatar" style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0;">
                    ${initials}
                  </div>
                  <div>
                    <div class="font-semibold">${p.surname} ${p.firstName}</div>
                    <div class="text-xs text-muted">${p.email || 'No email'}</div>
                  </div>
                </div>
              </td>
              <td>${cls?.name || '-'}</td>
              <td>${p.gender || '-'}</td>
              <td>
                <span class="badge badge-${p.status === 'active' ? 'success' : 'neutral'}">
                  ${p.status || 'active'}
                </span>
              </td>
              <td>
                <div class="flex gap-1">
                  <button type="button" class="btn btn-ghost btn-sm edit-pupil-btn"
                    data-id="${p.id}" title="Edit">
                    <i class="ph-bold ph-pencil-simple"></i>
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm reset-pw-btn"
                    data-id="${p.id}" data-email="${p.email || ''}" title="Send Password Reset">
                    <i class="ph-bold ph-key"></i>
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm text-danger delete-pupil-btn"
                    data-id="${p.id}" title="Delete">
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
  let html = `<div class="pagination" style="padding:var(--sp-4);">`;
  html += `<button type="button" class="page-btn" id="prev-page" ${_page === 1 ? 'disabled' : ''}>
    <i class="ph-bold ph-caret-left"></i>
  </button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button type="button" class="page-btn ${i === _page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button type="button" class="page-btn" id="next-page" ${_page === total ? 'disabled' : ''}>
    <i class="ph-bold ph-caret-right"></i>
  </button>`;
  html += `</div>`;
  return html;
}

function _filtered() {
  const search  = document.getElementById('pupil-search')?.value?.toLowerCase()  || '';
  const cls     = document.getElementById('class-filter')?.value  || '';
  const status  = document.getElementById('status-filter')?.value || '';
  return _pupils.filter(p => {
    const name       = `${p.surname} ${p.firstName}`.toLowerCase();
    const adm        = (p.admissionNumber || '').toLowerCase();
    const matchSearch = !search || name.includes(search) || adm.includes(search);
    const matchClass  = !cls    || p.classId === cls;
    const matchStatus = !status || p.status  === status;
    return matchSearch && matchClass && matchStatus;
  });
}

function _attachListeners(outlet) {
  ['pupil-search', 'class-filter', 'status-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      _page = 1;
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
    });
  });

  document.getElementById('add-pupil-btn')
    .addEventListener('click', () => _openPupilModal());

  _bindTableActions();
}

function _bindTableActions() {
  document.querySelectorAll('.edit-pupil-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = _pupils.find(p => p.id === btn.dataset.id);
      if (p) _openPupilModal(p);
    });
  });

  document.querySelectorAll('.reset-pw-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      if (!email) { toast.warning('No email address found for this pupil.'); return; }
      try {
        btn.disabled = true;
        await sendPasswordReset(email);
        toast.success(`Password reset email sent to ${email}.`);
      } catch (err) {
        toast.error(err.message || 'Failed to send password reset.');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.delete-pupil-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = _pupils.find(p => p.id === btn.dataset.id);
      if (!confirm(`Delete ${p?.surname} ${p?.firstName}? This cannot be undone.`)) return;
      try {
        await deletePupil(btn.dataset.id);
        _pupils = _pupils.filter(p => p.id !== btn.dataset.id);
        document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
        _bindTableActions();
        toast.success('Pupil record deleted.');
      } catch {
        toast.error('Failed to delete pupil record.');
      }
    });
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

  openModal({
    title:  isEdit ? 'Edit Pupil Record' : 'Add New Pupil',
    size:   'lg',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Surname <span class="required">*</span></label>
          <input class="form-control" id="m-surname"
            value="${pupil?.surname || ''}" placeholder="Last name" />
        </div>
        <div class="form-group">
          <label class="form-label">First Name <span class="required">*</span></label>
          <input class="form-control" id="m-firstname"
            value="${pupil?.firstName || ''}" placeholder="First name" />
        </div>
      </div>

      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Admission Number <span class="required">*</span></label>
          <input class="form-control" id="m-adm"
            value="${pupil?.admissionNumber || ''}"
            placeholder="e.g. FPS/2024/001"
            ${isEdit ? 'readonly style="background:var(--clr-bg);color:var(--clr-text-muted);"' : ''} />
        </div>
        <div class="form-group">
          <label class="form-label">Email Address <span class="required">*</span></label>
          <input type="email" class="form-control" id="m-email"
            value="${pupil?.email || ''}"
            placeholder="pupil@email.com"
            ${isEdit ? 'readonly style="background:var(--clr-bg);color:var(--clr-text-muted);"' : ''} />
          ${isEdit ? '<div class="form-hint">Email cannot be changed after account creation.</div>' : ''}
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
          <input type="date" class="form-control" id="m-dob"
            value="${pupil?.dateOfBirth || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Class</label>
          <select class="form-control" id="m-class">
            <option value="">None</option>
            ${_classes.map(c =>
              `<option value="${c.id}" ${pupil?.classId === c.id ? 'selected' : ''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Guardian Name</label>
          <input class="form-control" id="m-guardian"
            value="${pupil?.guardianName || ''}"
            placeholder="Parent or guardian full name" />
        </div>
        <div class="form-group">
          <label class="form-label">Guardian Phone</label>
          <input type="tel" class="form-control" id="m-phone"
            value="${pupil?.guardianPhone || ''}"
            placeholder="08012345678" />
        </div>
      </div>

      ${!isEdit ? `
        <div class="divider"></div>
        <div class="section-title">Login Credentials</div>
        <div class="alert alert-info mb-4">
          <i class="ph-bold ph-info" style="font-size:16px;flex-shrink:0;"></i>
          <span>
            A login account will be created with this temporary password.
            A password reset link will also be sent to the pupil's email
            so they or their parent can set a permanent password.
          </span>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Temporary Password <span class="required">*</span></label>
            <div class="input-wrapper icon-right">
              <span class="input-icon" id="pp-toggle" style="pointer-events:all;cursor:pointer;">
                <i class="ph-bold ph-eye" id="pp-eye" style="font-size:15px;"></i>
              </span>
              <input type="password" class="form-control" id="m-temppass"
                placeholder="Min. 6 characters"
                style="padding-left:12px;padding-right:36px;" />
            </div>
            <div class="form-hint">Pupil can log in immediately with this password.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password <span class="required">*</span></label>
            <input type="password" class="form-control" id="m-confirmpass"
              placeholder="Repeat password" />
          </div>
        </div>
      ` : ''}

      <div id="pupil-form-error" class="alert alert-danger mt-3" style="display:none;">
        <i class="ph-bold ph-warning-circle" style="font-size:15px;flex-shrink:0;"></i>
        <span id="pupil-error-msg"></span>
      </div>
    `,
    footerHTML: `
      <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary"   id="modal-save-btn">
        <span id="modal-save-label">${isEdit ? 'Save Changes' : 'Create Account'}</span>
        <span id="modal-save-spinner" class="spinner" style="display:none;"></span>
      </button>
    `,
  });

  // Password toggle
  if (!isEdit) {
    document.getElementById('pp-toggle')?.addEventListener('click', () => {
      const inp = document.getElementById('m-temppass');
      const eye = document.getElementById('pp-eye');
      const show = inp.type === 'password';
      inp.type      = show ? 'text' : 'password';
      eye.className = `ph-bold ${show ? 'ph-eye-slash' : 'ph-eye'}`;
    });
  }

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', () => _savePupil(pupil, isEdit));
}

async function _savePupil(pupil, isEdit) {
  const errEl  = document.getElementById('pupil-form-error');
  const errMsg = document.getElementById('pupil-error-msg');
  errEl.style.display = 'none';

  const showError = (msg) => {
    errMsg.textContent  = msg;
    errEl.style.display = 'flex';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

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

  if (!data.surname || !data.firstName) {
    showError('Surname and first name are required.'); return;
  }
  if (!data.admissionNumber) {
    showError('Admission number is required.'); return;
  }
  if (!data.email) {
    showError('Email address is required.'); return;
  }

  if (!isEdit) {
    const tempPass    = document.getElementById('m-temppass').value;
    const confirmPass = document.getElementById('m-confirmpass').value;

    if (!tempPass) {
      showError('Please set a temporary password.'); return;
    }
    if (tempPass.length < 6) {
      showError('Password must be at least 6 characters long.'); return;
    }
    if (tempPass !== confirmPass) {
      showError('Passwords do not match. Please check and try again.'); return;
    }

    _setModalLoading(true, 'Creating account...');

    try {
      const uid = await createPupilAccount(data, tempPass);
      _pupils.unshift({ id: uid, ...data, status: 'active' });
      closeModal();
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
      toast.success(
        `Account created for ${data.surname} ${data.firstName}. ` +
        `A password reset email has been sent to ${data.email}.`,
        'Pupil Added'
      );
    } catch (err) {
      _setModalLoading(false);
      showError(err.message || 'Failed to create pupil account.');
    }

  } else {
    _setModalLoading(true, 'Saving...');
    try {
      await updatePupil(pupil.id, data);
      const idx = _pupils.findIndex(p => p.id === pupil.id);
      if (idx !== -1) _pupils[idx] = { ..._pupils[idx], ...data };
      closeModal();
      document.getElementById('pupils-table-wrap').innerHTML = _tableHTML(_filtered());
      _bindTableActions();
      toast.success('Pupil record updated successfully.');
    } catch (err) {
      _setModalLoading(false);
      showError(err.message || 'Failed to update pupil record.');
    }
  }
}

function _setModalLoading(loading, label = '') {
  const btn     = document.getElementById('modal-save-btn');
  const lbl     = document.getElementById('modal-save-label');
  const spinner = document.getElementById('modal-save-spinner');
  const cancel  = document.getElementById('modal-cancel-btn');
  if (!btn) return;
  btn.disabled          = loading;
  cancel.disabled       = loading;
  lbl.textContent       = loading ? label : 'Save';
  spinner.style.display = loading ? 'inline-block' : 'none';
}

function _skeletonHTML() {
  return Array(5).fill(`
    <div class="skeleton-row">
      <div class="skeleton skeleton-circle"></div>
      <div class="skeleton-lines">
        <div class="skeleton skeleton-text" style="width:55%;"></div>
        <div class="skeleton skeleton-text" style="width:35%;"></div>
      </div>
    </div>
  `).join('');
}
