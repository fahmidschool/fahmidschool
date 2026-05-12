// ============================================================
// admin/sessions.js — Session & term management module
// ============================================================

import {
  getAllSessions, createSession, setActiveSession,
  getTermsBySession, createTerm
} from '/js/services/sessions.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _sessions = [];
let _selectedSessionId = null;
let _terms    = [];

export default async function render(outlet) {
  setPageTitle('Sessions & Terms');
  _sessions = await getAllSessions();
  outlet.innerHTML = _pageHTML();
  _attachListeners();
}

function _pageHTML() {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Sessions &amp; Terms</h1>
        <p>Manage academic sessions and their terms</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-session-btn">
          <i class="ph-bold ph-plus"></i> New Session
        </button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:300px 1fr;gap:var(--sp-5);align-items:start;">
      <!-- Sessions list -->
      <div class="card">
        <div class="card-header"><div class="card-title">Sessions</div></div>
        <div id="sessions-list">
          ${_sessions.length === 0
            ? '<p class="text-muted text-sm">No sessions yet.</p>'
            : _sessions.map(s => `
                <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid var(--clr-border);">
                  <div>
                    <div class="font-semibold cursor-pointer session-select" data-id="${s.id}">${s.name}</div>
                    ${s.isActive ? '<span class="badge badge-success" style="margin-top:4px;">Active</span>' : ''}
                  </div>
                  <div class="flex gap-1">
                    ${!s.isActive ? `<button class="btn btn-ghost btn-sm activate-session-btn" data-id="${s.id}" title="Set Active"><i class="ph-bold ph-check-circle"></i></button>` : ''}
                    <button class="btn btn-ghost btn-sm session-select" data-id="${s.id}" title="View Terms"><i class="ph-bold ph-list"></i></button>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </div>

      <!-- Terms panel -->
      <div class="card" id="terms-panel">
        <div class="text-center text-muted" style="padding:var(--sp-8);">
          Select a session to manage its terms.
        </div>
      </div>
    </div>
  `;
}

function _termsHTML(session) {
  return `
    <div class="card-header">
      <div>
        <div class="card-title">${session.name} — Terms</div>
        <div class="card-subtitle">${session.isActive ? 'Active Session' : ''}</div>
      </div>
      <button class="btn btn-primary btn-sm" id="add-term-btn">
        <i class="ph-bold ph-plus"></i> Add Term
      </button>
    </div>
    <div id="terms-list">
      ${_terms.length === 0
        ? '<p class="text-muted text-sm">No terms for this session.</p>'
        : _terms.map(t => `
            <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid var(--clr-border);">
              <div>
                <div class="font-semibold">${t.name}</div>
                <div class="text-xs text-muted">${t.startDate || ''} — ${t.endDate || ''}</div>
              </div>
              ${t.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}
            </div>
          `).join('')
      }
    </div>
  `;
}

function _attachListeners() {
  document.getElementById('add-session-btn').addEventListener('click', _openSessionModal);

  document.querySelectorAll('.session-select').forEach(el => {
    el.addEventListener('click', async () => {
      _selectedSessionId = el.dataset.id;
      const session = _sessions.find(s => s.id === _selectedSessionId);
      _terms = await getTermsBySession(_selectedSessionId);
      document.getElementById('terms-panel').innerHTML = _termsHTML(session);
      document.getElementById('add-term-btn').addEventListener('click', () => _openTermModal(session));
    });
  });

  document.querySelectorAll('.activate-session-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await setActiveSession(btn.dataset.id);
        _sessions = await getAllSessions();
        document.getElementById('sessions-list').innerHTML = document.getElementById('sessions-list').innerHTML; // re-render
        toast.success('Session set as active.');
        document.querySelector('.app-shell').innerHTML = ''; // force re-render
        window.location.reload();
      } catch { toast.error('Failed to activate session.'); }
    });
  });
}

function _openSessionModal() {
  openModal({
    title: 'New Academic Session',
    size: 'sm',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Session Name <span class="required">*</span></label>
        <input class="form-control" id="sess-name" placeholder="e.g. 2024/2025" />
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Start Year</label>
          <input type="number" class="form-control" id="sess-start" placeholder="2024" />
        </div>
        <div class="form-group">
          <label class="form-label">End Year</label>
          <input type="number" class="form-control" id="sess-end" placeholder="2025" />
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="sess-cancel">Cancel</button>
      <button class="btn btn-primary" id="sess-save">Create Session</button>
    `,
  });

  document.getElementById('sess-cancel').addEventListener('click', closeModal);
  document.getElementById('sess-save').addEventListener('click', async () => {
    const name  = document.getElementById('sess-name').value.trim();
    const start = document.getElementById('sess-start').value;
    const end   = document.getElementById('sess-end').value;
    if (!name) { toast.warning('Session name is required.'); return; }
    try {
      const id = await createSession({ name, startYear: Number(start), endYear: Number(end) });
      _sessions.unshift({ id, name, startYear: Number(start), endYear: Number(end), isActive: false });
      closeModal();
      toast.success('Session created.');
      document.getElementById('sessions-list').innerHTML = document.getElementById('sessions-list').innerHTML;
    } catch { toast.error('Failed to create session.'); }
  });
}

function _openTermModal(session) {
  openModal({
    title: `Add Term to ${session.name}`,
    size: 'sm',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Term Name <span class="required">*</span></label>
        <select class="form-control" id="term-name">
          <option value="First Term">First Term</option>
          <option value="Second Term">Second Term</option>
          <option value="Third Term">Third Term</option>
        </select>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Start Date</label>
          <input type="date" class="form-control" id="term-start" />
        </div>
        <div class="form-group">
          <label class="form-label">End Date</label>
          <input type="date" class="form-control" id="term-end" />
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="term-cancel">Cancel</button>
      <button class="btn btn-primary" id="term-save">Add Term</button>
    `,
  });

  document.getElementById('term-cancel').addEventListener('click', closeModal);
  document.getElementById('term-save').addEventListener('click', async () => {
    const name  = document.getElementById('term-name').value;
    const start = document.getElementById('term-start').value;
    const end   = document.getElementById('term-end').value;
    try {
      const id = await createTerm({ name, startDate: start, endDate: end, sessionId: session.id, order: _terms.length + 1 });
      _terms.push({ id, name, startDate: start, endDate: end, sessionId: session.id, isActive: false });
      closeModal();
      toast.success('Term added.');
      document.getElementById('terms-list').innerHTML = _terms.map(t => `
        <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid var(--clr-border);">
          <div>
            <div class="font-semibold">${t.name}</div>
            <div class="text-xs text-muted">${t.startDate || ''} — ${t.endDate || ''}</div>
          </div>
          ${t.isActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}
        </div>
      `).join('');
    } catch { toast.error('Failed to add term.'); }
  });
}
