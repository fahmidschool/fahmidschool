// ============================================================
// admin/settings.js — School settings + Sessions & Terms
// ============================================================
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '/js/firebase.js';
import {
  getAllSessions, createSession, setActiveSession,
  getTermsBySession, createTerm, setActiveTerm
} from '/js/services/sessions.js';
import { setPageTitle }          from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }                 from '/js/toast.js';

const SETTINGS_DOC = 'school_settings';

let _sessions          = [];
let _selectedSessionId = null;
let _terms             = [];

export default async function render(outlet) {
  setPageTitle('Settings');
  outlet.innerHTML = '<div class="skeleton skeleton-title mb-4"></div>';

  let settings = {};
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
    if (snap.exists()) settings = snap.data();
  } catch { /* use defaults */ }

  _sessions = await getAllSessions();

  outlet.innerHTML = `
    <style>
      .settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--sp-5);
        align-items: start;
      }
      .sessions-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: var(--sp-4);
        align-items: start;
      }
      @media (max-width: 768px) {
        .settings-grid   { grid-template-columns: 1fr; }
        .sessions-layout { grid-template-columns: 1fr; }
      }
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h1>Settings</h1>
        <p>Configure school information, grading, and academic sessions</p>
      </div>
    </div>

    <div class="settings-grid">

      <!-- School Information -->
      <div class="card">
        <div class="card-header"><div class="card-title">School Information</div></div>
        <div class="form-group">
          <label class="form-label">School Name</label>
          <input class="form-control" id="s-name" value="${settings.schoolName || 'Fahmid Nursery & Primary School'}" />
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="s-address" rows="3">${settings.address || ''}</textarea>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="s-phone" value="${settings.phone || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="s-email" value="${settings.email || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Motto</label>
          <input class="form-control" id="s-motto" value="${settings.motto || ''}" placeholder="School motto" />
        </div>
        <button class="btn btn-primary" id="save-school-settings">
          <i class="ph-bold ph-floppy-disk"></i> Save School Info
        </button>
      </div>

      <!-- Grading System -->
      <div class="card">
        <div class="card-header"><div class="card-title">Grading System</div></div>
        <div class="alert alert-info mb-4">
          <i class="ph-bold ph-info"></i>
          <span>Default grading: A (75–100), B (60–74), C (50–59), D (40–49), F (0–39).</span>
        </div>
        <div class="form-row cols-3 mb-3">
          <div class="form-group">
            <label class="form-label">CA 1 (Max)</label>
            <input type="number" class="form-control" id="max-ca1" value="${settings.maxCA1 || 20}" />
          </div>
          <div class="form-group">
            <label class="form-label">CA 2 (Max)</label>
            <input type="number" class="form-control" id="max-ca2" value="${settings.maxCA2 || 20}" />
          </div>
          <div class="form-group">
            <label class="form-label">Exam (Max)</label>
            <input type="number" class="form-control" id="max-exam" value="${settings.maxExam || 60}" />
          </div>
        </div>
        <div class="alert alert-info">
          <i class="ph-bold ph-sigma"></i>
          <span>Total = CA1 + CA2 + Exam = 100 marks</span>
        </div>
        <button class="btn btn-primary mt-4" id="save-grading">
          <i class="ph-bold ph-floppy-disk"></i> Save Grading Config
        </button>
      </div>

      <!-- Report Card Settings -->
      <div class="card">
        <div class="card-header"><div class="card-title">Report Card</div></div>
        <div class="form-group">
          <label class="form-label">Next Term Begins</label>
          <input type="date" class="form-control" id="next-term" value="${settings.nextTermDate || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Principal's Remark Template</label>
          <textarea class="form-control" id="principal-remark" rows="3">${settings.principalRemarkTemplate || 'Well done. Keep it up.'}</textarea>
        </div>
        <button class="btn btn-primary" id="save-report-settings">
          <i class="ph-bold ph-floppy-disk"></i> Save Report Settings
        </button>
      </div>

    </div>

    <!-- Sessions & Terms (full width below) -->
    <div class="card mt-5">
      <div class="card-header">
        <div class="card-title">Sessions &amp; Terms</div>
        <button class="btn btn-primary btn-sm" id="add-session-btn">
          <i class="ph-bold ph-plus"></i> New Session
        </button>
      </div>

      <div class="sessions-layout mt-4">
        <div>
          <div class="section-title mb-3">Academic Sessions</div>
          <div id="sessions-list">${_renderSessionsList()}</div>
        </div>
        <div id="terms-panel">
          <div class="text-muted text-sm" style="padding:var(--sp-4);">
            Select a session to view and manage its terms.
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Save handlers ──────────────────────────────────────────────────────────

  document.getElementById('save-school-settings').addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC), {
        schoolName: document.getElementById('s-name').value.trim(),
        address:    document.getElementById('s-address').value.trim(),
        phone:      document.getElementById('s-phone').value.trim(),
        email:      document.getElementById('s-email').value.trim(),
        motto:      document.getElementById('s-motto').value.trim(),
        updatedAt:  serverTimestamp(),
      }, { merge: true });
      toast.success('School information saved.');
    } catch { toast.error('Failed to save settings.'); }
  });

  document.getElementById('save-grading').addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC), {
        maxCA1:    Number(document.getElementById('max-ca1').value),
        maxCA2:    Number(document.getElementById('max-ca2').value),
        maxExam:   Number(document.getElementById('max-exam').value),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success('Grading configuration saved.');
    } catch { toast.error('Failed to save grading config.'); }
  });

  document.getElementById('save-report-settings').addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC), {
        nextTermDate:            document.getElementById('next-term').value,
        principalRemarkTemplate: document.getElementById('principal-remark').value.trim(),
        updatedAt:               serverTimestamp(),
      }, { merge: true });
      toast.success('Report card settings saved.');
    } catch { toast.error('Failed to save report settings.'); }
  });

  // ── Sessions & Terms handlers ──────────────────────────────────────────────

  document.getElementById('add-session-btn').addEventListener('click', _openSessionModal);
  _attachSessionListeners();
}

// ── Render helpers ─────────────────────────────────────────

function _renderSessionsList() {
  if (_sessions.length === 0) {
    return '<p class="text-muted text-sm">No sessions yet.</p>';
  }
  return _sessions.map(s => `
    <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid var(--clr-border);">
      <div style="min-width:0;">
        <div class="font-semibold cursor-pointer session-select" data-id="${s.id}"
             style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
        ${s.isActive ? '<span class="badge badge-success" style="margin-top:4px;">Active</span>' : ''}
      </div>
      <div class="flex gap-1" style="flex-shrink:0;">
        ${!s.isActive
          ? `<button class="btn btn-ghost btn-sm activate-session-btn" data-id="${s.id}" title="Set as Active Session">
               <i class="ph-bold ph-check-circle"></i>
             </button>`
          : ''}
        <button class="btn btn-ghost btn-sm session-select" data-id="${s.id}" title="View Terms">
          <i class="ph-bold ph-list"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function _attachSessionListeners() {
  document.querySelectorAll('.session-select').forEach(el => {
    el.addEventListener('click', () => _loadTermsPanel(el.dataset.id));
  });
  document.querySelectorAll('.activate-session-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Set this as the active session? This will affect all users.')) return;
      try {
        await setActiveSession(btn.dataset.id);
        toast.success('Session set as active.');
        _sessions = await getAllSessions();
        document.getElementById('sessions-list').innerHTML = _renderSessionsList();
        _attachSessionListeners();
      } catch { toast.error('Failed to activate session.'); }
    });
  });
}

// ── Terms panel ────────────────────────────────────────────

async function _loadTermsPanel(sessionId) {
  _selectedSessionId = sessionId;
  const session = _sessions.find(s => s.id === sessionId);
  _terms = await getTermsBySession(sessionId);
  _renderTermsPanel(session);
}

function _renderTermsPanel(session) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  document.getElementById('terms-panel').innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="section-title">${session.name} — Terms</div>
      <button class="btn btn-secondary btn-sm" id="add-term-btn">
        <i class="ph-bold ph-plus"></i> Add Term
      </button>
    </div>
    <div id="terms-list">
      ${_terms.length === 0
        ? '<p class="text-muted text-sm">No terms for this session yet.</p>'
        : _terms.map(t => {
            const start     = t.startDate ? new Date(t.startDate) : null;
            const end       = t.endDate   ? new Date(t.endDate)   : null;
            const inWindow  = start && end && today >= start && today <= end;
            const dateMismatch = inWindow && !t.isActive;

            return `
              <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid var(--clr-border);">
                <div style="min-width:0;flex:1;">
                  <div class="font-semibold">${t.name}</div>
                  <div class="text-xs text-muted">${t.startDate || '—'} to ${t.endDate || '—'}</div>
                  ${dateMismatch ? `
                    <div class="text-xs" style="color:var(--clr-warning);margin-top:2px;">
                      <i class="ph-bold ph-warning"></i> Dates suggest this should be active — click Activate to confirm.
                    </div>` : ''}
                </div>
                <div class="flex gap-1 items-center" style="flex-shrink:0;">
                  ${t.isActive
                    ? '<span class="badge badge-success">Active</span>'
                    : `<button class="btn btn-ghost btn-sm activate-term-btn"
                               data-id="${t.id}"
                               data-session="${session.id}"
                               title="Set as Active Term">
                         <i class="ph-bold ph-check-circle"></i> Activate
                       </button>`
                  }
                </div>
              </div>
            `;
          }).join('')
      }
    </div>
  `;

  document.getElementById('add-term-btn').addEventListener('click', () => _openTermModal(session));

  document.querySelectorAll('.activate-term-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Set this as the active term? This will affect all fee calculations and records.')) return;
      try {
        await setActiveTerm(btn.dataset.session, btn.dataset.id);
        toast.success('Term set as active.');
        _terms = await getTermsBySession(btn.dataset.session);
        _renderTermsPanel(session);
      } catch { toast.error('Failed to activate term.'); }
    });
  });
}

// ── Modals ─────────────────────────────────────────────────

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
      <button class="btn btn-primary"   id="sess-save">Create Session</button>
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
      closeModal();
      toast.success('Session created.');
      _sessions.unshift({ id, name, startYear: Number(start), endYear: Number(end), isActive: false });
      document.getElementById('sessions-list').innerHTML = _renderSessionsList();
      _attachSessionListeners();
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
      <div class="alert alert-info mt-3">
        <i class="ph-bold ph-info"></i>
        <span>After creating, click "Activate" on the term when it begins. The system will alert you if a term's dates suggest it should be active.</span>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="term-cancel">Cancel</button>
      <button class="btn btn-primary"   id="term-save">Add Term</button>
    `,
  });

  document.getElementById('term-cancel').addEventListener('click', closeModal);
  document.getElementById('term-save').addEventListener('click', async () => {
    const name  = document.getElementById('term-name').value;
    const start = document.getElementById('term-start').value;
    const end   = document.getElementById('term-end').value;
    const order = { 'First Term': 1, 'Second Term': 2, 'Third Term': 3 }[name] || _terms.length + 1;
    try {
      const id = await createTerm({
        name, startDate: start, endDate: end,
        sessionId: session.id, order,
      });
      _terms.push({ id, name, startDate: start, endDate: end, sessionId: session.id, isActive: false, order });
      closeModal();
      toast.success('Term added.');
      _renderTermsPanel(session);
    } catch { toast.error('Failed to add term.'); }
  });
}
