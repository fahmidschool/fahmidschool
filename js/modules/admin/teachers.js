// ============================================================
// admin/teachers.js — Teachers management module
// ============================================================

import { getAllTeachers, createTeacher, updateTeacher, deleteTeacher } from '/js/services/teachers.js';
import { getAllClasses }      from '/js/services/classes.js';
import { getAllSubjects }     from '/js/services/subjects.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _teachers = [];
let _classes  = [];

export default async function render(outlet) {
  setPageTitle('Teachers');
  outlet.innerHTML = '<div class="skeleton skeleton-title mb-4"></div>';

  [_teachers, _classes] = await Promise.all([getAllTeachers(), getAllClasses()]);
  outlet.innerHTML = _pageHTML();
  _attachListeners();
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Teachers</h1>
        <p>${_teachers.length} staff members</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-teacher-btn">
          <i class="ph-bold ph-user-plus"></i> Add Teacher
        </button>
      </div>
    </div>

    <div class="grid-3">
      ${_teachers.map(t => _teacherCard(t)).join('') || '<p class="text-muted">No teachers found.</p>'}
    </div>
  `;
}

function _teacherCard(t) {
  const cls = _classes.find(c => c.id === t.classId);
  return `
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="user-avatar" style="width:48px;height:48px;font-size:1rem;border-radius:var(--radius-md);">
          ${_initials(t.surname, t.firstName)}
        </div>
        <div>
          <div class="font-semibold">${t.surname} ${t.firstName}</div>
          <div class="text-xs text-muted">${t.subject || 'No subject assigned'}</div>
        </div>
      </div>
      <div class="text-sm mb-1"><span class="text-muted">Email:</span> ${t.email || '-'}</div>
      <div class="text-sm mb-1"><span class="text-muted">Class:</span> ${cls?.name || '-'}</div>
      <div class="text-sm mb-3"><span class="text-muted">Phone:</span> ${t.phone || '-'}</div>
      <span class="badge badge-${t.status === 'active' ? 'success' : 'neutral'}">${t.status || 'active'}</span>
      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary btn-sm flex-1 edit-teacher-btn" data-id="${t.id}">
          <i class="ph-bold ph-pencil-simple"></i> Edit
        </button>
        <button class="btn btn-ghost btn-sm text-danger delete-teacher-btn" data-id="${t.id}">
          <i class="ph-bold ph-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function _attachListeners() {
  document.getElementById('add-teacher-btn').addEventListener('click', () => _openModal());

  document.querySelectorAll('.edit-teacher-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = _teachers.find(t => t.id === btn.dataset.id);
      if (t) _openModal(t);
    });
  });

  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this teacher? This cannot be undone.')) return;
      try {
        await deleteTeacher(btn.dataset.id);
        _teachers = _teachers.filter(t => t.id !== btn.dataset.id);
        document.querySelector('.grid-3').innerHTML = _teachers.map(t => _teacherCard(t)).join('');
        _attachListeners();
        toast.success('Teacher record deleted.');
      } catch { toast.error('Failed to delete teacher.'); }
    });
  });
}

function _openModal(teacher = null) {
  const isEdit = !!teacher;
  const modal  = openModal({
    title:    isEdit ? 'Edit Teacher' : 'Add Teacher',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Surname <span class="required">*</span></label>
          <input class="form-control" id="t-surname" value="${teacher?.surname || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">First Name <span class="required">*</span></label>
          <input class="form-control" id="t-firstname" value="${teacher?.firstName || ''}" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Email <span class="required">*</span></label>
          <input type="email" class="form-control" id="t-email" value="${teacher?.email || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="tel" class="form-control" id="t-phone" value="${teacher?.phone || ''}" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Assigned Class</label>
          <select class="form-control" id="t-class">
            <option value="">None</option>
            ${_classes.map(c => `<option value="${c.id}" ${teacher?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Qualification</label>
          <input class="form-control" id="t-qual" value="${teacher?.qualification || ''}" placeholder="e.g. B.Ed, NCE" />
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="t-cancel">Cancel</button>
      <button class="btn btn-primary" id="t-save">${isEdit ? 'Save Changes' : 'Add Teacher'}</button>
    `,
  });

  document.getElementById('t-cancel').addEventListener('click', closeModal);
  document.getElementById('t-save').addEventListener('click', async () => {
    const data = {
      surname:       document.getElementById('t-surname').value.trim(),
      firstName:     document.getElementById('t-firstname').value.trim(),
      email:         document.getElementById('t-email').value.trim(),
      phone:         document.getElementById('t-phone').value.trim(),
      classId:       document.getElementById('t-class').value,
      qualification: document.getElementById('t-qual').value.trim(),
    };
    if (!data.surname || !data.firstName || !data.email) {
      toast.warning('Please fill in required fields.'); return;
    }
    try {
      if (isEdit) {
        await updateTeacher(teacher.id, data);
        Object.assign(_teachers.find(t => t.id === teacher.id), data);
        toast.success('Teacher updated.');
      } else {
        const id = await createTeacher(data);
        _teachers.push({ id, ...data, status: 'active' });
        toast.success('Teacher added.');
      }
      closeModal();
      document.querySelector('.grid-3').innerHTML = _teachers.map(t => _teacherCard(t)).join('');
      _attachListeners();
    } catch { toast.error('Failed to save teacher.'); }
  });
}

function _initials(s, f) {
  return `${(s||'')[0]||''}${(f||'')[0]||''}`.toUpperCase();
}
