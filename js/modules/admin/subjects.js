// ============================================================
// admin/subjects.js — Subjects management module
// ============================================================

import { store }                                              from '/js/store.js';
import { getAllSubjects, getSubjectsByClass,
         createSubject, updateSubject, deleteSubject }        from '/js/services/subjects.js';
import { getAllClasses }                                       from '/js/services/classes.js';
import { setPageTitle }                                       from '/js/components/topbar.js';
import { toast }                                              from '/js/toast.js';

let _subjects = [];
let _classes  = [];

export default async function render(outlet) {
  setPageTitle('Subjects');

  [_subjects, _classes] = await Promise.all([getAllSubjects(), getAllClasses()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Subjects</h1>
        <p>Manage subjects assigned to each class</p>
      </div>
      <button class="btn btn-primary" id="subj-add-btn">
        <i class="ph-bold ph-plus"></i> Add Subject
      </button>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-2" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Filter by Class</label>
          <select class="form-control" id="subj-class-filter">
            <option value="">All Classes</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Search</label>
          <input type="text" class="form-control" id="subj-search" placeholder="Search subject name..." />
        </div>
      </div>
    </div>

    <div id="subj-table-area"></div>

    <!-- Modal -->
    <div class="modal-overlay hidden" id="subj-modal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="subj-modal-title">Add Subject</h2>
          <button class="modal-close" id="subj-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Subject Name <span class="text-danger">*</span></label>
            <input type="text" class="form-control" id="subj-name" placeholder="e.g. Mathematics" />
          </div>
          <div class="form-group">
            <label class="form-label">Class <span class="text-danger">*</span></label>
            <select class="form-control" id="subj-class">
              <option value="">Select Class</option>
              ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input type="text" class="form-control" id="subj-desc" placeholder="Optional description" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="subj-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="subj-save-btn">Save Subject</button>
        </div>
      </div>
    </div>
  `;

  _renderTable(_subjects);

  document.getElementById('subj-add-btn').addEventListener('click', () => _openModal());
  document.getElementById('subj-modal-close').addEventListener('click', _closeModal);
  document.getElementById('subj-cancel-btn').addEventListener('click', _closeModal);
  document.getElementById('subj-save-btn').addEventListener('click', _saveSubject);

  document.getElementById('subj-class-filter').addEventListener('change', _applyFilters);
  document.getElementById('subj-search').addEventListener('input', _applyFilters);
}

function _renderTable(subjects) {
  const area = document.getElementById('subj-table-area');

  if (!subjects.length) {
    area.innerHTML = `<div class="empty-state"><p>No subjects found.</p></div>`;
    return;
  }

  area.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <table>
        <thead>
          <tr>
            <th>Subject Name</th>
            <th>Class</th>
            <th>Description</th>
            <th style="width:120px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${subjects.map(s => {
            const cls = _classes.find(c => c.id === s.classId);
            return `
              <tr>
                <td class="font-semibold">${s.name}</td>
                <td>${cls?.name ?? '—'}</td>
                <td>${s.description ?? '—'}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-sm" data-edit="${s.id}" title="Edit">
                      <i class="ph-bold ph-pencil"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm text-danger" data-delete="${s.id}" title="Delete">
                      <i class="ph-bold ph-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  area.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => _openModal(btn.dataset.edit));
  });
  area.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteSubject(btn.dataset.delete));
  });
}

function _applyFilters() {
  const classId = document.getElementById('subj-class-filter').value;
  const search  = document.getElementById('subj-search').value.toLowerCase();

  const filtered = _subjects.filter(s => {
    const matchClass  = !classId || s.classId === classId;
    const matchSearch = !search  || s.name.toLowerCase().includes(search);
    return matchClass && matchSearch;
  });

  _renderTable(filtered);
}

let _editingId = null;

function _openModal(id = null) {
  _editingId = id;
  const modal = document.getElementById('subj-modal');
  document.getElementById('subj-modal-title').textContent = id ? 'Edit Subject' : 'Add Subject';

  if (id) {
    const s = _subjects.find(s => s.id === id);
    document.getElementById('subj-name').value  = s?.name        ?? '';
    document.getElementById('subj-class').value = s?.classId     ?? '';
    document.getElementById('subj-desc').value  = s?.description ?? '';
  } else {
    document.getElementById('subj-name').value  = '';
    document.getElementById('subj-class').value = '';
    document.getElementById('subj-desc').value  = '';
  }

  modal.classList.remove('hidden');
}

function _closeModal() {
  document.getElementById('subj-modal').classList.add('hidden');
  _editingId = null;
}

async function _saveSubject() {
  const name        = document.getElementById('subj-name').value.trim();
  const classId     = document.getElementById('subj-class').value;
  const description = document.getElementById('subj-desc').value.trim();

  if (!name)    { toast.warning('Subject name is required.');  return; }
  if (!classId) { toast.warning('Please select a class.');     return; }

  const btn = document.getElementById('subj-save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  try {
    if (_editingId) {
      await updateSubject(_editingId, { name, classId, description });
      const idx = _subjects.findIndex(s => s.id === _editingId);
      if (idx !== -1) _subjects[idx] = { ..._subjects[idx], name, classId, description };
      toast.success('Subject updated successfully.');
    } else {
      const newId = await createSubject({ name, classId, description });
      _subjects.push({ id: newId, name, classId, description });
      _subjects.sort((a, b) => a.name.localeCompare(b.name));
      toast.success('Subject created successfully.');
    }
    _closeModal();
    _applyFilters();
  } catch (err) {
    toast.error('Could not save subject. Please try again.');
    console.error(err);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Subject';
  }
}

async function _deleteSubject(id) {
  if (!confirm('Are you sure you want to delete this subject? This cannot be undone.')) return;

  try {
    await deleteSubject(id);
    _subjects = _subjects.filter(s => s.id !== id);
    toast.success('Subject deleted.');
    _applyFilters();
  } catch (err) {
    toast.error('Could not delete subject. Please try again.');
    console.error(err);
  }
}
