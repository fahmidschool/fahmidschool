// ============================================================
// admin/fees.js — Fee structures module
// ============================================================

import { getFeeStructures, createFeeStructure } from '/js/services/fees.js';
import { getAllSessions, getTermsBySession }     from '/js/services/sessions.js';
import { getAllClasses }                         from '/js/services/classes.js';
import { setPageTitle }                         from '/js/components/topbar.js';
import { openModal, closeModal }                from '/js/components/modal.js';
import { toast }                                from '/js/toast.js';

let _sessions = [];
let _classes  = [];
let _fees     = [];
let _selectedSession = '';

export default async function render(outlet) {
  setPageTitle('Fee Structures');

  [_sessions, _classes] = await Promise.all([getAllSessions(), getAllClasses()]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Fee Structures</h1>
        <p>Manage tuition and levies per session and class</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-fee-btn">
          <i class="ph-bold ph-plus"></i> Add Fee Structure
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <select class="form-control" id="fee-session-filter" style="width:220px;">
        <option value="">Select Session</option>
        ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </div>

    <div id="fees-area">
      <div class="card text-center text-muted" style="padding:var(--sp-12);">
        Select a session to view fee structures.
      </div>
    </div>
  `;

  document.getElementById('fee-session-filter').addEventListener('change', async (e) => {
    _selectedSession = e.target.value;
    if (!_selectedSession) return;
    await _loadFees();
  });

  document.getElementById('add-fee-btn').addEventListener('click', () => _openFeeModal());
}

async function _loadFees() {
  const area = document.getElementById('fees-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;
  try {
    _fees = await getFeeStructures(_selectedSession);
    area.innerHTML = _feesHTML();
  } catch {
    area.innerHTML = `<div class="alert alert-danger">Failed to load fees.</div>`;
  }
}

function _feesHTML() {
  if (_fees.length === 0) return `<div class="card text-center text-muted" style="padding:var(--sp-10);">No fee structures for this session. Click "Add Fee Structure" to create one.</div>`;

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Fee Type</th>
            <th>Class</th>
            <th>Term</th>
            <th>Amount (NGN)</th>
            <th>Due Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${_fees.map(f => {
            const cls = _classes.find(c => c.id === f.classId);
            return `
              <tr>
                <td class="font-semibold">${f.feeType}</td>
                <td>${cls?.name || 'All Classes'}</td>
                <td>${f.term || 'All Terms'}</td>
                <td class="font-bold">${Number(f.amount).toLocaleString()}</td>
                <td>${f.dueDate || '-'}</td>
                <td><span class="badge badge-${f.isActive ? 'success' : 'neutral'}">${f.isActive ? 'Active' : 'Inactive'}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _openFeeModal() {
  if (!_selectedSession) { toast.warning('Please select a session first.'); return; }

  openModal({
    title: 'Add Fee Structure',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Fee Type <span class="required">*</span></label>
        <input class="form-control" id="fee-type" placeholder="e.g. School Fees, Development Levy" />
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Amount (NGN) <span class="required">*</span></label>
          <input type="number" class="form-control" id="fee-amount" placeholder="0.00" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Class</label>
          <select class="form-control" id="fee-class">
            <option value="">All Classes</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Term</label>
          <select class="form-control" id="fee-term">
            <option value="">All Terms</option>
            <option value="First">First Term</option>
            <option value="Second">Second Term</option>
            <option value="Third">Third Term</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="fee-due" />
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="fee-cancel">Cancel</button>
      <button class="btn btn-primary" id="fee-save">Save Fee Structure</button>
    `,
  });

  document.getElementById('fee-cancel').addEventListener('click', closeModal);
  document.getElementById('fee-save').addEventListener('click', async () => {
    const data = {
      feeType:   document.getElementById('fee-type').value.trim(),
      amount:    Number(document.getElementById('fee-amount').value),
      classId:   document.getElementById('fee-class').value,
      term:      document.getElementById('fee-term').value,
      dueDate:   document.getElementById('fee-due').value,
      sessionId: _selectedSession,
      isActive:  true,
    };
    if (!data.feeType || !data.amount) { toast.warning('Fee type and amount are required.'); return; }
    try {
      const id = await createFeeStructure(data);
      _fees.push({ id, ...data });
      closeModal();
      toast.success('Fee structure created.');
      document.getElementById('fees-area').innerHTML = _feesHTML();
    } catch { toast.error('Failed to create fee structure.'); }
  });
}
