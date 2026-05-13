// ============================================================
// admin/teachers.js — Teachers management with account creation
// ============================================================

import { getAllTeachers, updateTeacher, deleteTeacher } from '/js/services/teachers.js';
import { createTeacherAccount, sendPasswordReset }      from '/js/services/auth-admin.js';
import { getAllClasses }                                 from '/js/services/classes.js';
import { setPageTitle }                                 from '/js/components/topbar.js';
import { openModal, closeModal }                        from '/js/components/modal.js';
import { toast }                                        from '/js/toast.js';

let _teachers = [];
let _classes  = [];

export default async function render(outlet) {
  setPageTitle('Teachers');
  outlet.innerHTML = _skeletonHTML();

  [_teachers, _classes] = await Promise.all([getAllTeachers(), getAllClasses()]);
  outlet.innerHTML = _pageHTML();
  _attachListeners();
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Teachers</h1>
        <p>${_teachers.length} staff member${_teachers.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="page-header-right">
        <button type="button" class="btn btn-primary" id="add-teacher-btn">
          <i class="ph-bold ph-user-plus"></i> Add Teacher
        </button>
      </div>
    </div>

    <div class="grid-3" id="teachers-grid">
      ${_teachers.length === 0
        ? `<div class="card text-center text-muted" style="grid-column:1/-1;padding:var(--sp-12);">
            <i class="ph-bold ph-chalkboard-teacher" style="font-size:48px;display:block;margin-bottom:var(--sp-4);color:var(--clr-text-faint);"></i>
            No teachers added yet.
           </div>`
        : _teachers.map(t => _teacherCard(t)).join('')
      }
    </div>
  `;
}

function _teacherCard(t) {
  const cls      = _classes.find(c => c.id === t.classId);
  const initials = `${(t.surname||'')[0]||''}${(t.firstName||'')[0]||''}`.toUpperCase();
  return `
    <div class="card" data-teacher-id="${t.id}">
      <div class="flex items-center gap-3 mb-4">
        <div class="user-avatar"
             style="width:48px;height:48px;font-size:1rem;border-radius:var(--radius-md);flex-shrink:0;">
          ${initials}
        </div>
        <div class="flex-1" style="min-width:0;">
          <div class="font-semibold truncate">${t.surname} ${t.firstName}</div>
          <div class="text-xs text-muted">${t.qualification || 'Teacher'}</div>
        </div>
        <span class="badge badge-${t.status === 'active' ? 'success' : 'neutral'}">
          ${t.status || 'active'}
        </span>
      </div>

      <div class="text-sm mb-1">
        <span class="text-muted">Email:</span>
        <span class="truncate" style="display:inline-block;max-width:180px;vertical-align:bottom;">
          ${t.email || '-'}
        </span>
      </div>
      <div class="text-sm mb-1">
        <span class="text-muted">Class:</span> ${cls?.name || 'Not assigned'}
      </div>
      <div class="text-sm mb-4">
        <span class="text-muted">Phone:</span> ${t.phone || '-'}
      </div>

      <div class="flex gap-2">
        <button type="button" class="btn btn-secondary btn-sm flex-1 edit-teacher-btn" data-id="${t.id}">
          <i class="ph-bold ph-pencil-simple"></i> Edit
        </button>
        <button type="button" class="btn btn-ghost btn-sm reset-pw-btn" data-id="${t.id}" data-email="${t.email}" title="Send Password Reset">
          <i class="ph-bold ph-key"></i>
        </button>
        <button type="button" class="btn btn-ghost btn-sm text-danger delete-teacher-btn" data-id="${t.id}" title="Delete">
          <i class="ph-bold ph-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function _attachListeners() {
  document.getElementById('add-teacher-btn')
    .addEventListener('click', () => _openModal());

  document.querySelectorAll('.edit-teacher-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = _teachers.find(t => t.id === btn.dataset.id);
      if (t) _openModal(t);
    });
  });

  document.querySelectorAll('.reset-pw-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      if (!email) { toast.warning('No email address found for this teacher.'); return; }
      try {
        btn.disabled = true;
        await sendPasswordReset(email);
        toast.success(`Password reset email sent to ${email}.`);
      } catch (err) {
        toast.error(err.message || 'Failed to send password reset email.');
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = _teachers.find(t => t.id === btn.dataset.id);
      if (!confirm(`Delete ${t?.surname} ${t?.firstName}? This cannot be undone.`)) return;
      try {
        await deleteTeacher(btn.dataset.id);
        _teachers = _teachers.filter(t => t.id !== btn.dataset.id);
        _refreshGrid();
        toast.success('Teacher record deleted.');
      } catch {
        toast.error('Failed to delete teacher.');
      }
    });
  });
}

function _openModal(teacher = null) {
  const isEdit = !!teacher;

  openModal({
    title:  isEdit ? 'Edit Teacher' : 'Add New Teacher',
    size:   'lg',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Surname <span class="required">*</span></label>
          <input class="form-control" id="t-surname"
            value="${teacher?.surname || ''}"
            placeholder="Last name" />
        </div>
        <div class="form-group">
          <label class="form-label">First Name <span class="required">*</span></label>
          <input class="form-control" id="t-firstname"
            value="${teacher?.firstName || ''}"
            placeholder="First name" />
        </div>
      </div>

      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Email Address <span class="required">*</span></label>
          <input type="email" class="form-control" id="t-email"
            value="${teacher?.email || ''}"
            placeholder="teacher@email.com"
            ${isEdit ? 'readonly style="background:var(--clr-bg);color:var(--clr-text-muted);"' : ''} />
          ${isEdit ? '<div class="form-hint">Email cannot be changed after account creation.</div>' : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="tel" class="form-control" id="t-phone"
            value="${teacher?.phone || ''}"
            placeholder="08012345678" />
        </div>
      </div>

      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Assigned Class</label>
          <select class="form-control" id="t-class">
            <option value="">Not assigned</option>
            ${_classes.map(c =>
              `<option value="${c.id}" ${teacher?.classId === c.id ? 'selected' : ''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Qualification</label>
          <input class="form-control" id="t-qual"
            value="${teacher?.qualification || ''}"
            placeholder="e.g. B.Ed, NCE, PGDE" />
        </div>
      </div>

      ${!isEdit ? `
        <div class="divider"></div>
        <div class="section-title">Login Credentials</div>
        <div class="alert alert-info mb-4">
          <i class="ph-bold ph-info" style="font-size:16px;flex-shrink:0;"></i>
          <span>
            A Firebase account will be created with this temporary password.
            A password reset link will automatically be emailed to the teacher
            so they can set their own password before first login.
          </span>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Temporary Password <span class="required">*</span></label>
            <div class="input-wrapper icon-right">
              <span class="input-icon" id="tp-toggle" style="pointer-events:all;cursor:pointer;">
                <i class="ph-bold ph-eye" id="tp-eye" style="font-size:15px;"></i>
              </span>
              <input type="password" class="form-control" id="t-temppass"
                placeholder="Min. 6 characters"
                style="padding-left:12px;padding-right:36px;" />
            </div>
            <div class="form-hint">Teacher will use this to log in immediately if needed.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password <span class="required">*</span></label>
            <input type="password" class="form-control" id="t-confirmpass"
              placeholder="Repeat password" />
          </div>
        </div>
      ` : ''}

      <div id="teacher-form-error" class="alert alert-danger mt-3" style="display:none;">
        <i class="ph-bold ph-warning-circle" style="font-size:15px;flex-shrink:0;"></i>
        <span id="teacher-error-msg"></span>
      </div>
    `,
    footerHTML: `
      <button type="button" class="btn btn-secondary" id="t-cancel">Cancel</button>
      <button type="button" class="btn btn-primary"   id="t-save">
        <span id="t-save-label">${isEdit ? 'Save Changes' : 'Create Account'}</span>
        <span id="t-save-spinner" class="spinner" style="display:none;"></span>
      </button>
    `,
  });

  // Password visibility toggle
  if (!isEdit) {
    document.getElementById('tp-toggle')?.addEventListener('click', () => {
      const inp = document.getElementById('t-temppass');
      const eye = document.getElementById('tp-eye');
      const show = inp.type === 'password';
      inp.type     = show ? 'text' : 'password';
      eye.className = `ph-bold ${show ? 'ph-eye-slash' : 'ph-eye'}`;
    });
  }

  document.getElementById('t-cancel').addEventListener('click', closeModal);
  document.getElementById('t-save').addEventListener('click', () => _saveTeacher(teacher, isEdit));
}

async function _saveTeacher(teacher, isEdit) {
  const errEl  = document.getElementById('teacher-form-error');
  const errMsg = document.getElementById('teacher-error-msg');
  errEl.style.display = 'none';

  const showError = (msg) => {
    errMsg.textContent  = msg;
    errEl.style.display = 'flex';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const data = {
    surname:       document.getElementById('t-surname').value.trim(),
    firstName:     document.getElementById('t-firstname').value.trim(),
    email:         document.getElementById('t-email').value.trim(),
    phone:         document.getElementById('t-phone').value.trim(),
    classId:       document.getElementById('t-class').value,
    qualification: document.getElementById('t-qual').value.trim(),
  };

  // Basic validation
  if (!data.surname || !data.firstName) {
    showError('Surname and first name are required.'); return;
  }
  if (!data.email) {
    showError('Email address is required.'); return;
  }

  // Password validation for new teachers
  if (!isEdit) {
    const tempPass    = document.getElementById('t-temppass').value;
    const confirmPass = document.getElementById('t-confirmpass').value;

    if (!tempPass) {
      showError('Please set a temporary password.'); return;
    }
    if (tempPass.length < 6) {
      showError('Password must be at least 6 characters.'); return;
    }
    if (tempPass !== confirmPass) {
      showError('Passwords do not match.'); return;
    }

    // Set loading state
    _setModalLoading(true, 'Creating account...');

    try {
      const uid = await createTeacherAccount(data, tempPass);
      _teachers.push({ id: uid, ...data, status: 'active' });
      closeModal();
      _refreshGrid();
      toast.success(
        `Account created for ${data.surname} ${data.firstName}. ` +
        `A password reset email has been sent to ${data.email}.`,
        'Account Created'
      );
    } catch (err) {
      _setModalLoading(false);
      showError(err.message || 'Failed to create teacher account.');
    }

  } else {
    // Edit existing teacher — just update Firestore, no Auth changes
    _setModalLoading(true, 'Saving...');
    try {
      await updateTeacher(teacher.id, data);
      const idx = _teachers.findIndex(t => t.id === teacher.id);
      if (idx !== -1) _teachers[idx] = { ..._teachers[idx], ...data };
      closeModal();
      _refreshGrid();
      toast.success('Teacher record updated successfully.');
    } catch (err) {
      _setModalLoading(false);
      showError(err.message || 'Failed to update teacher record.');
    }
  }
}

function _setModalLoading(loading, label = '') {
  const btn     = document.getElementById('t-save');
  const lbl     = document.getElementById('t-save-label');
  const spinner = document.getElementById('t-save-spinner');
  const cancel  = document.getElementById('t-cancel');
  if (!btn) return;
  btn.disabled          = loading;
  cancel.disabled       = loading;
  lbl.textContent       = loading ? label : 'Save';
  spinner.style.display = loading ? 'inline-block' : 'none';
}

function _refreshGrid() {
  const grid = document.getElementById('teachers-grid');
  if (!grid) return;
  grid.innerHTML = _teachers.length === 0
    ? `<div class="card text-center text-muted" style="grid-column:1/-1;padding:var(--sp-12);">No teachers added yet.</div>`
    : _teachers.map(t => _teacherCard(t)).join('');
  _attachListeners();
}

function _skeletonHTML() {
  return `
    <div class="skeleton skeleton-title mb-6" style="width:160px;"></div>
    <div class="grid-3">
      ${Array(3).fill(`<div class="skeleton skeleton-card" style="height:180px;"></div>`).join('')}
    </div>
  `;
}
