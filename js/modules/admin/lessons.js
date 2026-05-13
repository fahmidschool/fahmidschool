// ============================================================
// admin/lessons.js — Lesson notes management for admin
// ============================================================

import { getAllClasses }           from '/js/services/classes.js';
import { getAllLessonNotes,
         deleteLessonNote }        from '/js/services/lessons.js';
import { setPageTitle }            from '/js/components/topbar.js';
import { openModal, closeModal }   from '/js/components/modal.js';
import { toast }                   from '/js/toast.js';

let _notes   = [];
let _classes = [];

export default async function render(outlet) {
  setPageTitle('Lesson Notes');

  [_notes, _classes] = await Promise.all([getAllLessonNotes(), getAllClasses()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Lesson Notes</h1>
        <p>View all lesson notes uploaded by teachers</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-2" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Filter by Class</label>
          <select class="form-control" id="ln-class-filter">
            <option value="">All Classes</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Search</label>
          <input type="text" class="form-control" id="ln-search" placeholder="Search by title or subject..." />
        </div>
      </div>
    </div>

    <div id="ln-table-area"></div>
  `;

  _renderTable(_notes);

  document.getElementById('ln-class-filter').addEventListener('change', _applyFilters);
  document.getElementById('ln-search').addEventListener('input', _applyFilters);
}

function _renderTable(notes) {
  const area = document.getElementById('ln-table-area');

  if (!notes.length) {
    area.innerHTML = `<div class="empty-state"><p>No lesson notes found.</p></div>`;
    return;
  }

  area.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Subject</th>
            <th>Class</th>
            <th>Week</th>
            <th>Date</th>
            <th style="width:120px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${notes.map(n => `
            <tr>
              <td class="font-semibold">${n.title}</td>
              <td>${n.subjectName || '—'}</td>
              <td>${n.className || '—'}</td>
              <td>${n.week || '—'}</td>
              <td>${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('en-GB') : '—'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-ghost btn-sm" data-view="${n.id}" title="View">
                    <i class="ph-bold ph-eye"></i>
                  </button>
                  <button class="btn btn-ghost btn-sm text-danger" data-delete="${n.id}" title="Delete">
                    <i class="ph-bold ph-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  area.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => _viewNote(btn.dataset.view));
  });
  area.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteNote(btn.dataset.delete));
  });
}

function _applyFilters() {
  const classId = document.getElementById('ln-class-filter').value;
  const search  = document.getElementById('ln-search').value.toLowerCase();

  const filtered = _notes.filter(n => {
    const matchClass  = !classId || n.classId === classId;
    const matchSearch = !search  ||
      n.title?.toLowerCase().includes(search) ||
      n.subjectName?.toLowerCase().includes(search);
    return matchClass && matchSearch;
  });

  _renderTable(filtered);
}

function _viewNote(id) {
  const n = _notes.find(n => n.id === id);
  if (!n) return;

  openModal({
    title: n.title,
    size:  'lg',
    bodyHTML: `
      <div class="mb-3">
        <span class="text-muted text-sm">Class:</span>
        <span class="font-semibold ml-2">${n.className || '—'}</span>
      </div>
      <div class="mb-3">
        <span class="text-muted text-sm">Subject:</span>
        <span class="font-semibold ml-2">${n.subjectName || '—'}</span>
      </div>
      <div class="mb-3">
        <span class="text-muted text-sm">Week:</span>
        <span class="font-semibold ml-2">${n.week || '—'}</span>
      </div>
      ${n.description ? `
        <div class="mb-3">
          <div class="text-muted text-sm mb-1">Description / Objectives:</div>
          <p class="text-sm">${n.description}</p>
        </div>` : ''}
      ${n.content ? `
        <div class="mb-3">
          <div class="text-muted text-sm mb-1">Content:</div>
          <p class="text-sm" style="white-space:pre-wrap;">${n.content}</p>
        </div>` : ''}
      <div class="text-xs text-faint mt-4">
        Uploaded: ${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('en-GB') : '—'}
      </div>
    `,
    footerHTML: `<button class="btn btn-ghost" id="ln-view-close">Close</button>`,
  });

  document.getElementById('ln-view-close').addEventListener('click', closeModal);
}

async function _deleteNote(id) {
  if (!confirm('Are you sure you want to delete this lesson note? This cannot be undone.')) return;

  try {
    await deleteLessonNote(id);
    _notes = _notes.filter(n => n.id !== id);
    toast.success('Lesson note deleted.');
    _applyFilters();
  } catch (err) {
    toast.error('Could not delete lesson note. Please try again.');
    console.error(err);
  }
}
