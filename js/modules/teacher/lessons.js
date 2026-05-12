// ============================================================
// teacher/lessons.js — Lesson notes upload and management
// ============================================================

import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }                from '/js/firebase.js';
import { store }             from '/js/store.js';
import { getAllClasses }      from '/js/services/classes.js';
import { getSubjectsByClass } from '/js/services/subjects.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _classes  = [];
let _subjects = [];
let _sessions = [];
let _notes    = [];
let _selectedClass = '';

export default async function render(outlet) {
  setPageTitle('Lesson Notes');

  const uid = store.get('user')?.uid;
  [_classes, _sessions] = await Promise.all([getAllClasses(), getAllSessions()]);

  const myClass = _classes.find(c => c.classTeacherId === uid);
  if (myClass) {
    _selectedClass = myClass.id;
    _subjects      = await getSubjectsByClass(myClass.id);
  }

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Lesson Notes</h1>
        <p>Upload and manage your lesson notes</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="upload-note-btn">
          <i class="ph-bold ph-upload-simple"></i> Upload Lesson Note
        </button>
      </div>
    </div>

    <div class="filter-bar mb-4">
      <select class="form-control" id="ln-class-filter" style="width:180px;">
        <option value="">All Classes</option>
        ${_classes.map(c => `<option value="${c.id}" ${myClass?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>

    <div id="ln-area">
      <div class="text-center"><span class="spinner spinner-dark"></span></div>
    </div>
  `;

  document.getElementById('upload-note-btn').addEventListener('click', () => _openUploadModal());
  document.getElementById('ln-class-filter').addEventListener('change', async e => {
    _selectedClass = e.target.value;
    if (_selectedClass) _subjects = await getSubjectsByClass(_selectedClass);
    await _loadNotes();
  });

  await _loadNotes();
}

async function _loadNotes() {
  const area = document.getElementById('ln-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    const uid   = store.get('user')?.uid;
    const constraints = [where('teacherId', '==', uid), orderBy('createdAt', 'desc')];
    if (_selectedClass) constraints.unshift(where('classId', '==', _selectedClass));
    const snap  = await getDocs(query(collection(db, 'lesson_notes'), ...constraints));
    _notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    area.innerHTML = _notes.length === 0
      ? `<div class="card text-center text-muted" style="padding:var(--sp-12);">
          <i class="ph-bold ph-book-open" style="font-size:48px;display:block;margin-bottom:var(--sp-4);color:var(--clr-text-faint);"></i>
          No lesson notes uploaded yet.
         </div>`
      : `<div class="grid-3">
          ${_notes.map(n => `
            <div class="card">
              <div class="flex items-start justify-between mb-3">
                <div class="stat-icon green" style="width:40px;height:40px;">
                  <i class="ph-bold ph-file-text" style="font-size:18px;"></i>
                </div>
                <button class="btn btn-ghost btn-sm text-danger delete-note-btn" data-id="${n.id}">
                  <i class="ph-bold ph-trash"></i>
                </button>
              </div>
              <div class="font-bold mb-1">${n.title}</div>
              <div class="text-sm text-muted mb-1">${n.subjectName || n.subjectId}</div>
              <div class="text-xs text-muted mb-3">${n.className || ''} &mdash; Week ${n.week || '-'}</div>
              ${n.description ? `<p class="text-sm text-muted mb-3">${n.description}</p>` : ''}
              <div class="text-xs text-faint">${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('en-GB') : ''}</div>
            </div>
          `).join('')}
         </div>`;

    document.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this lesson note?')) return;
        try {
          await deleteDoc(doc(db, 'lesson_notes', btn.dataset.id));
          toast.success('Lesson note deleted.');
          await _loadNotes();
        } catch { toast.error('Failed to delete lesson note.'); }
      });
    });

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load lesson notes. ${err.message}</div>`;
  }
}

function _openUploadModal() {
  openModal({
    title: 'Upload Lesson Note',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input class="form-control" id="ln-title" placeholder="e.g. Introduction to Fractions" />
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class <span class="required">*</span></label>
          <select class="form-control" id="ln-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}" ${_selectedClass === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subject <span class="required">*</span></label>
          <select class="form-control" id="ln-subject">
            <option value="">Select Subject</option>
            ${_subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Week</label>
          <input type="number" class="form-control" id="ln-week" placeholder="e.g. 3" min="1" max="14" />
        </div>
        <div class="form-group">
          <label class="form-label">Session</label>
          <select class="form-control" id="ln-session">
            <option value="">Select</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description / Objectives</label>
        <textarea class="form-control" id="ln-desc" rows="3" placeholder="What pupils will learn in this lesson..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Content / Body</label>
        <textarea class="form-control" id="ln-content" rows="5" placeholder="Main lesson content here..."></textarea>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="ln-cancel">Cancel</button>
      <button class="btn btn-primary" id="ln-save">Upload Note</button>
    `,
    size: 'lg',
  });

  // Update subjects when class changes in modal
  document.getElementById('ln-class').addEventListener('change', async e => {
    const subs = e.target.value ? await getSubjectsByClass(e.target.value) : [];
    const sel  = document.getElementById('ln-subject');
    sel.innerHTML = `<option value="">Select Subject</option>` +
      subs.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });

  document.getElementById('ln-cancel').addEventListener('click', closeModal);
  document.getElementById('ln-save').addEventListener('click', async () => {
    const classSel   = document.getElementById('ln-class');
    const subjectSel = document.getElementById('ln-subject');
    const data = {
      title:       document.getElementById('ln-title').value.trim(),
      classId:     classSel.value,
      className:   classSel.options[classSel.selectedIndex]?.text || '',
      subjectId:   subjectSel.value,
      subjectName: subjectSel.options[subjectSel.selectedIndex]?.text || '',
      week:        document.getElementById('ln-week').value,
      sessionId:   document.getElementById('ln-session').value,
      description: document.getElementById('ln-desc').value.trim(),
      content:     document.getElementById('ln-content').value.trim(),
      teacherId:   store.get('user')?.uid,
    };

    if (!data.title || !data.classId || !data.subjectId) {
      toast.warning('Title, class and subject are required.'); return;
    }

    try {
      await addDoc(collection(db, 'lesson_notes'), { ...data, createdAt: serverTimestamp() });
      closeModal();
      toast.success('Lesson note uploaded successfully.');
      await _loadNotes();
    } catch (err) {
      toast.error('Failed to upload lesson note.');
      console.error(err);
    }
  });
}
