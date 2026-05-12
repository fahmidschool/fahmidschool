// ============================================================
// admin/settings.js — School settings module
// ============================================================

import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }           from '/js/firebase.js';
import { setPageTitle } from '/js/components/topbar.js';
import { toast }        from '/js/toast.js';

const SETTINGS_DOC = 'school_settings';

export default async function render(outlet) {
  setPageTitle('Settings');
  outlet.innerHTML = '<div class="skeleton skeleton-title mb-4"></div>';

  let settings = {};
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
    if (snap.exists()) settings = snap.data();
  } catch { /* use defaults */ }

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>School Settings</h1>
        <p>Configure school information and system preferences</p>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--sp-5);align-items:start;">

      <!-- School info -->
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

      <!-- Grading system -->
      <div class="card">
        <div class="card-header"><div class="card-title">Grading System</div></div>
        <div class="section-title">Score Breakdowns</div>
        <div class="alert alert-info mb-4">
          <i class="ph-bold ph-info"></i>
          <span>The default grading: A (75-100), B (60-74), C (50-59), D (40-49), F (0-39).</span>
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

      <!-- Report card settings -->
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
  `;

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
        nextTermDate:             document.getElementById('next-term').value,
        principalRemarkTemplate:  document.getElementById('principal-remark').value.trim(),
        updatedAt:                serverTimestamp(),
      }, { merge: true });
      toast.success('Report card settings saved.');
    } catch { toast.error('Failed to save report settings.'); }
  });
}
