// ============================================================
// admin/announcements.js — Announcements module
// ============================================================

import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '/js/services/announcements.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _announcements = [];

export default async function render(outlet) {
  setPageTitle('Announcements');
  outlet.innerHTML = '<div class="skeleton skeleton-title mb-4"></div>';

  _announcements = await getAnnouncements({ count: 50 });
  outlet.innerHTML = _pageHTML();
  _attachListeners();
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Announcements</h1>
        <p>${_announcements.length} announcements</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="new-annc-btn">
          <i class="ph-bold ph-megaphone"></i> New Announcement
        </button>
      </div>
    </div>

    <div id="annc-list">
      ${_announcementsHTML()}
    </div>
  `;
}

function _announcementsHTML() {
  if (_announcements.length === 0) {
    return `<div class="card text-center text-muted" style="padding:var(--sp-12);">No announcements yet.</div>`;
  }
  return _announcements.map(a => `
    <div class="card mb-3" data-id="${a.id}">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <span class="font-bold">${a.title}</span>
            ${(a.audience || []).map(aud => `<span class="badge badge-primary">${aud}</span>`).join('')}
          </div>
          <p class="text-sm text-muted">${a.body}</p>
          <div class="text-xs text-faint mt-2">${a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString('en-GB') : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm text-danger delete-annc-btn" data-id="${a.id}">
          <i class="ph-bold ph-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function _attachListeners() {
  document.getElementById('new-annc-btn').addEventListener('click', _openModal);

  document.querySelectorAll('.delete-annc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this announcement?')) return;
      try {
        await deleteAnnouncement(btn.dataset.id);
        _announcements = _announcements.filter(a => a.id !== btn.dataset.id);
        document.getElementById('annc-list').innerHTML = _announcementsHTML();
        _attachListeners();
        toast.success('Announcement deleted.');
      } catch { toast.error('Failed to delete announcement.'); }
    });
  });
}

function _openModal() {
  openModal({
    title: 'New Announcement',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input class="form-control" id="ann-title" placeholder="Announcement title" />
      </div>
      <div class="form-group">
        <label class="form-label">Message <span class="required">*</span></label>
        <textarea class="form-control" id="ann-body" rows="4" placeholder="Type your message here..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Audience</label>
        <div class="flex gap-3 flex-wrap">
          <label class="form-check"><input type="checkbox" value="all"     id="aud-all" checked /> All</label>
          <label class="form-check"><input type="checkbox" value="pupils"  id="aud-pupils" /> Pupils</label>
          <label class="form-check"><input type="checkbox" value="teachers" id="aud-teachers" /> Teachers</label>
          <label class="form-check"><input type="checkbox" value="parents" id="aud-parents" /> Parents</label>
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="ann-cancel">Cancel</button>
      <button class="btn btn-primary" id="ann-save">Post Announcement</button>
    `,
  });

  document.getElementById('ann-cancel').addEventListener('click', closeModal);
  document.getElementById('ann-save').addEventListener('click', async () => {
    const title = document.getElementById('ann-title').value.trim();
    const body  = document.getElementById('ann-body').value.trim();
    if (!title || !body) { toast.warning('Title and message are required.'); return; }

    const audience = [];
    ['all','pupils','teachers','parents'].forEach(id => {
      const el = document.getElementById(`aud-${id}`);
      if (el?.checked) audience.push(el.value);
    });

    try {
      const id = await createAnnouncement({ title, body, audience });
      _announcements.unshift({ id, title, body, audience });
      closeModal();
      toast.success('Announcement posted.');
      document.getElementById('annc-list').innerHTML = _announcementsHTML();
      _attachListeners();
    } catch { toast.error('Failed to post announcement.'); }
  });
}
