// ============================================================
// admin/classes.js — Classes management module
// ============================================================

import { getAllClasses, createClass, updateClass, deleteClass } from '/js/services/classes.js';
import { getAllTeachers }     from '/js/services/teachers.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _classes  = [];
let _teachers = [];

export default async function render(outlet) {
  setPageTitle('Classes');
  [_classes, _teachers] = await Promise.all([getAllClasses(), getAllTeachers()]);
  outlet.innerHTML = _pageHTML();
  _attachListeners();
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Classes</h1>
        <p>${_classes.length} classes configured</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-class-btn">
          <i class="ph-bold ph-plus"></i> Add Class
        </button>
      </div>
    </div>

    <div class="table-wrapper border rounded-lg">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Class Name</th>
            <th>Class Teacher</th>
            <th>Capacity</th>
            <th>Level</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="classes-tbody">
          ${_classRows()}
        </tbody>
      </table>
    </div>
  `;
}

function _classRows() {
  if (!_classes.length) {
    return `<tr><td colspan="6" class="table-empty">No classes found.</td></tr>`;
  }
  return _classes.map(c => {
    const teacher = _teachers.find(t => t.id === c.classTeacherId);
    return `
      <tr>
        <td>${c.order || '-'}</td>
        <td class="font-semibold">${c.name}</td>
        <td>${teacher ? `${teacher.surname} ${teacher.firstName}` : '-'}</td>
        <td>${c.capacity || '-'}</td>
        <td><span class="badge badge-info">${c.level || 'Primary'}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm edit-class-btn" data-id="${c.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button class="btn btn-ghost btn-sm text-danger delete-class-btn" data-id="${c.id}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function _attachListeners() {
  document.getElementById('add-class-btn').addEventListener('click', () => _openModal());

  document.querySelectorAll('.edit-class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = _classes.find(c => c.id === btn.dataset.id);
      if (cls) _openModal(cls);
    });
  });

  document.querySelectorAll('.delete-class-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this class?')) return;
      try {
        await deleteClass(btn.dataset.id);
        _classes = _classes.filter(c => c.id !== btn.dataset.id);
        document.getElementById('classes-tbody').innerHTML = _classRows();
        _attachListeners();
        toast.success('Class deleted.');
      } catch { toast.error('Failed to delete class.'); }
    });
  });
}

function _openModal(cls = null) {
  const isEdit = !!cls;
  openModal({
    title: isEdit ? 'Edit Class' : 'Add Class',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class Name <span class="required">*</span></label>
          <input class="form-control" id="cls-name" value="${cls?.name || ''}" placeholder="e.g. Primary 1A" />
        </div>
        <div class="form-group">
          <label class="form-label">Display Order</label>
          <input type="number" class="form-control" id="cls-order" value="${cls?.order || ''}" placeholder="1" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Level</label>
          <select class="form-control" id="cls-level">
            <option value="Nursery"  ${cls?.level === 'Nursery'  ? 'selected' : ''}>Nursery</option>
            <option value="Primary"  ${cls?.level === 'Primary'  ? 'selected' : ''}>Primary</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Capacity</label>
          <input type="number" class="form-control" id="cls-capacity" value="${cls?.capacity || ''}" placeholder="30" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Class Teacher</label>
        <select class="form-control" id="cls-teacher">
          <option value="">None</option>
          ${_teachers.map(t => `<option value="${t.id}" ${cls?.classTeacherId === t.id ? 'selected' : ''}>${t.surname} ${t.firstName}</option>`).join('')}
        </select>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="cls-cancel">Cancel</button>
      <button class="btn btn-primary" id="cls-save">${isEdit ? 'Save' : 'Add Class'}</button>
    `,
  });

  document.getElementById('cls-cancel').addEventListener('click', closeModal);
  document.getElementById('cls-save').addEventListener('click', async () => {
    const data = {
      name:           document.getElementById('cls-name').value.trim(),
      order:          Number(document.getElementById('cls-order').value) || 0,
      level:          document.getElementById('cls-level').value,
      capacity:       Number(document.getElementById('cls-capacity').value) || 0,
      classTeacherId: document.getElementById('cls-teacher').value,
    };
    if (!data.name) { toast.warning('Class name is required.'); return; }
    try {
      if (isEdit) {
        await updateClass(cls.id, data);
        Object.assign(_classes.find(c => c.id === cls.id), data);
        toast.success('Class updated.');
      } else {
        const id = await createClass(data);
        _classes.push({ id, ...data });
        toast.success('Class added.');
      }
      closeModal();
      document.getElementById('classes-tbody').innerHTML = _classRows();
      _attachListeners();
    } catch { toast.error('Failed to save class.'); }
  });
}
