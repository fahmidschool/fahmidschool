// ============================================================
// teacher/assignments.js — Assignments management
// ============================================================

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }                from '/js/firebase.js';
import { store }             from '/js/store.js';
import { getAllClasses }      from '/js/services/classes.js';
import { getSubjectsByClass } from '/js/services/subjects.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _classes  = [];
let _subjects = [];
let _assignments = [];
let _selectedClass = '';

export default async function render(outlet) {
  setPageTitle('Assignments');

  const uid = store.get('user')?.uid;
  _classes  = await getAllClasses();

  const myClass = _classes.find(c => c.classTeacherId === uid);
  if (myClass) {
    _selectedClass = myClass.id;
    _subjects      = await getSubjectsByClass(myClass.id);
  }

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Assignments</h1>
        <p>Create and manage class assignments</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="create-assignment-btn">
          <i class="ph-bold ph-plus"></i> Create Assignment
        </button>
      </div>
    </div>

    <div class="filter-bar mb-4">
      <select class="form-control" id="asgn-class-filter" style="width:180px;">
        <option value="">All Classes</option>
        ${_classes.map(c => `<option value="${c.id}" ${myClass?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>

    <div id="asgn-area">
      <div class="text-center"><span class="spinner spinner-dark"></span></div>
    </div>
  `;

  document.getElementById('create-assignment-btn').addEventListener('click', () => _openModal());
  document.getElementById('asgn-class-filter').addEventListener('change', async e => {
    _selectedClass = e.target.value;
    if (_selectedClass) _subjects = await getSubjectsByClass(_selectedClass);
    await _loadAssignments();
  });

  await _loadAssignments();
}

async function _loadAssignments() {
  const area = document.getElementById('asgn-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    const uid = store.get('user')?.uid;
    const constraints = [where('teacherId', '==', uid), orderBy('createdAt', 'desc')];
    if (_selectedClass) constraints.unshift(where('classId', '==', _selectedClass));
    const snap = await getDocs(query(collection(db, 'assignments'), ...constraints));
    _assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    area.innerHTML = _assignments.length === 0
      ? `<div class="card text-center text-muted" style="padding:var(--sp-12);">
          <i class="ph-bold ph-clipboard-text" style="font-size:48px;display:block;margin-bottom:var(--sp-4);color:var(--clr-text-faint);"></i>
          No assignments yet. Create one to get started.
         </div>`
      : `<div class="grid" style="gap:var(--sp-4);">
          ${_assignments.map(a => {
            const due        = a.dueDate ? new Date(a.dueDate) : null;
            const isOverdue  = due && due < new Date() && a.status !== 'closed';
            return `
              <div class="card">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                      <span class="font-bold text-lg">${a.title}</span>
                      <span class="badge badge-${a.status === 'open' ? 'success' : isOverdue ? 'danger' : 'neutral'}">${isOverdue && a.status !== 'closed' ? 'Overdue' : a.status}</span>
                    </div>
                    <div class="text-sm text-muted mb-2">${a.subjectName || a.subjectId} &mdash; ${a.className || ''}</div>
                    <p class="text-sm">${a.description || ''}</p>
                    ${due ? `<div class="text-sm text-muted mt-2"><i class="ph-bold ph-calendar" style="font-size:13px;"></i> Due: ${due.toLocaleDateString('en-GB')}</div>` : ''}
                  </div>
                  <div class="flex gap-2 flex-shrink-0">
                    ${a.status === 'open'
                      ? `<button class="btn btn-secondary btn-sm close-asgn-btn" data-id="${a.id}">Close</button>`
                      : ''
                    }
                    <button class="btn btn-ghost btn-sm text-danger delete-asgn-btn" data-id="${a.id}">
                      <i class="ph-bold ph-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
         </div>`;

    document.querySelectorAll('.close-asgn-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await updateDoc(doc(db, 'assignments', btn.dataset.id), { status: 'closed', updatedAt: serverTimestamp() });
          toast.success('Assignment closed.');
          await _loadAssignments();
        } catch { toast.error('Failed to close assignment.'); }
      });
    });

    document.querySelectorAll('.delete-asgn-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this assignment?')) return;
        try {
          await deleteDoc(doc(db, 'assignments', btn.dataset.id));
          toast.success('Assignment deleted.');
          await _loadAssignments();
        } catch { toast.error('Failed to delete assignment.'); }
      });
    });

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load assignments. ${err.message}</div>`;
  }
}

function _openModal() {
  openModal({
    title: 'Create Assignment',
    size:  'lg',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input class="form-control" id="asgn-title" placeholder="e.g. Chapter 5 Exercise" />
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class <span class="required">*</span></label>
          <select class="form-control" id="asgn-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}" ${_selectedClass === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subject <span class="required">*</span></label>
          <select class="form-control" id="asgn-subject">
            <option value="">Select Subject</option>
            ${_subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="asgn-due" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Score</label>
          <input type="number" class="form-control" id="asgn-score" placeholder="100" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description / Instructions <span class="required">*</span></label>
        <textarea class="form-control" id="asgn-desc" rows="4" placeholder="Describe the assignment tasks clearly..."></textarea>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="asgn-cancel">Cancel</button>
      <button class="btn btn-primary" id="asgn-save">Create Assignment</button>
    `,
  });

  document.getElementById('asgn-class').addEventListener('change', async e => {
    const subs = e.target.value ? await getSubjectsByClass(e.target.value) : [];
    const sel  = document.getElementById('asgn-subject');
    sel.innerHTML = `<option value="">Select Subject</option>` +
      subs.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });

  document.getElementById('asgn-cancel').addEventListener('click', closeModal);
  document.getElementById('asgn-save').addEventListener('click', async () => {
    const classSel   = document.getElementById('asgn-class');
    const subjectSel = document.getElementById('asgn-subject');
    const data = {
      title:       document.getElementById('asgn-title').value.trim(),
      classId:     classSel.value,
      className:   classSel.options[classSel.selectedIndex]?.text || '',
      subjectId:   subjectSel.value,
      subjectName: subjectSel.options[subjectSel.selectedIndex]?.text || '',
      dueDate:     document.getElementById('asgn-due').value,
      maxScore:    Number(document.getElementById('asgn-score').value) || 100,
      description: document.getElementById('asgn-desc').value.trim(),
      teacherId:   store.get('user')?.uid,
      status:      'open',
    };

    if (!data.title || !data.classId || !data.subjectId || !data.description) {
      toast.warning('Please fill in all required fields.'); return;
    }

    try {
      await addDoc(collection(db, 'assignments'), { ...data, createdAt: serverTimestamp() });
      closeModal();
      toast.success('Assignment created successfully.');
      await _loadAssignments();
    } catch (err) {
      toast.error('Failed to create assignment.');
      console.error(err);
    }
  });
}
