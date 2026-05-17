// ============================================================
// admin/fees.js — Fee structures + payment recording
// ============================================================
import {
  getFeeStructures, createFeeStructure, updateFeeStructure,
  recordPayment, getPayments, getArrearsReport,
  upsertPupilFeeRecord, getPupilFeeRecord, calculatePupilFee
} from '/js/services/fees.js';
import { getActivePeriod, getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { getAllClasses }                  from '/js/services/classes.js';
import { getPupilsByClass, getAllPupils } from '/js/services/pupils.js';
import { setPageTitle }                  from '/js/components/topbar.js';
import { openModal, closeModal }         from '/js/components/modal.js';
import { toast }                         from '/js/toast.js';

let _sessions       = [];
let _classes        = [];
let _activePeriod   = { session: null, term: null };
let _selectedSessId = '';
let _fees           = [];

export default async function render(outlet) {
  setPageTitle('Fee Structures');

  [_sessions, _classes, _activePeriod] = await Promise.all([
    getAllSessions(),
    getAllClasses(),
    getActivePeriod(),
  ]);

  _selectedSessId = _activePeriod.session?.id || '';

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Fee Structures</h1>
        <p>Manage base fees per class, session, and term</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="add-fee-btn">
          <i class="ph-bold ph-plus"></i> Add Fee Structure
        </button>
      </div>
    </div>

    ${_activePeriod.session
      ? `<div class="alert alert-info mb-4">
           <i class="ph-bold ph-info"></i>
           <span>Active period: <strong>${_activePeriod.session.name}</strong>
           ${_activePeriod.term ? ' — <strong>' + _activePeriod.term.name + '</strong>' : ' (no active term)'}.
           Fee structures below are pre-filtered to this session.</span>
         </div>`
      : `<div class="alert alert-warning mb-4">
           <i class="ph-bold ph-warning"></i>
           <span>No active session is set. Go to Settings → Sessions to activate a session.</span>
         </div>`
    }

    <div class="filter-bar mb-4">
      <select class="form-control" id="fee-session-filter" style="width:220px;">
        <option value="">Select Session</option>
        ${_sessions.map(s =>
          `<option value="${s.id}" ${s.id === _selectedSessId ? 'selected' : ''}>${s.name}</option>`
        ).join('')}
      </select>
    </div>

    <div id="fees-area">
      <div class="card text-center text-muted" style="padding:var(--sp-12);">
        Select a session above to view fee structures.
      </div>
    </div>
  `;

  document.getElementById('fee-session-filter').addEventListener('change', async e => {
    _selectedSessId = e.target.value;
    if (_selectedSessId) await _loadFees();
  });

  document.getElementById('add-fee-btn').addEventListener('click', () => _openFeeModal());

  if (_selectedSessId) await _loadFees();
}

async function _loadFees() {
  const area = document.getElementById('fees-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;
  try {
    _fees = await getFeeStructures(_selectedSessId);
    area.innerHTML = _feesHTML();
    _attachFeeListeners();
  } catch {
    area.innerHTML = `<div class="alert alert-danger">Failed to load fees.</div>`;
  }
}

function _feesHTML() {
  if (!_fees.length) {
    return `<div class="card text-center text-muted" style="padding:var(--sp-10);">
      No fee structures for this session. Click "Add Fee Structure" to create one.
    </div>`;
  }
  return `
    <div class="table-wrapper border rounded-lg">
      <table>
        <thead>
          <tr>
            <th>Fee Type</th>
            <th>Class</th>
            <th>Term</th>
            <th>Amount (₦)</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${_fees.map(f => {
            const cls = _classes.find(c => c.id === f.classId);
            return `
              <tr>
                <td class="font-semibold">${f.feeType}</td>
                <td>${cls?.name || 'All Classes'}</td>
                <td>${f.termName || 'All Terms'}</td>
                <td class="font-bold">₦${Number(f.amount).toLocaleString()}</td>
                <td>${f.dueDate || '—'}</td>
                <td><span class="badge badge-${f.isActive !== false ? 'success' : 'neutral'}">${f.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm edit-fee-btn" data-id="${f.id}">
                    <i class="ph-bold ph-pencil-simple"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _attachFeeListeners() {
  document.querySelectorAll('.edit-fee-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fee = _fees.find(f => f.id === btn.dataset.id);
      if (fee) _openFeeModal(fee);
    });
  });
}

function _openFeeModal(fee = null) {
  if (!_selectedSessId) { toast.warning('Please select a session first.'); return; }
  const isEdit = !!fee;

  openModal({
    title: isEdit ? 'Edit Fee Structure' : 'Add Fee Structure',
    bodyHTML: `
      <div class="form-group">
        <label class="form-label">Fee Type <span class="required">*</span></label>
        <input class="form-control" id="fee-type" value="${fee?.feeType || ''}" placeholder="e.g. School Fees, Development Levy" />
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class <span class="required">*</span></label>
          <select class="form-control" id="fee-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}" ${fee?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Term <span class="required">*</span></label>
          <select class="form-control" id="fee-term">
            <option value="First Term"  ${fee?.termName === 'First Term'  ? 'selected' : ''}>First Term</option>
            <option value="Second Term" ${fee?.termName === 'Second Term' ? 'selected' : ''}>Second Term</option>
            <option value="Third Term"  ${fee?.termName === 'Third Term'  ? 'selected' : ''}>Third Term</option>
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Amount (₦) <span class="required">*</span></label>
          <input type="number" class="form-control" id="fee-amount" value="${fee?.amount || ''}" placeholder="0.00" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="fee-due" value="${fee?.dueDate || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="fee-active">
          <option value="true"  ${fee?.isActive !== false ? 'selected' : ''}>Active</option>
          <option value="false" ${fee?.isActive === false  ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="fee-cancel">Cancel</button>
      <button class="btn btn-primary"   id="fee-save">${isEdit ? 'Save Changes' : 'Create Fee Structure'}</button>
    `,
  });

  document.getElementById('fee-cancel').addEventListener('click', closeModal);
  document.getElementById('fee-save').addEventListener('click', async () => {
    const data = {
      feeType:   document.getElementById('fee-type').value.trim(),
      classId:   document.getElementById('fee-class').value,
      termName:  document.getElementById('fee-term').value,
      amount:    Number(document.getElementById('fee-amount').value),
      dueDate:   document.getElementById('fee-due').value,
      sessionId: _selectedSessId,
      isActive:  document.getElementById('fee-active').value === 'true',
    };
    if (!data.feeType || !data.classId || !data.amount) {
      toast.warning('Fee type, class, and amount are required.');
      return;
    }
    try {
      if (isEdit) {
        await updateFeeStructure(fee.id, data);
        Object.assign(_fees.find(f => f.id === fee.id), data);
        toast.success('Fee structure updated.');
      } else {
        const id = await createFeeStructure(data);
        _fees.push({ id, ...data });
        toast.success('Fee structure created.');
      }
      closeModal();
      document.getElementById('fees-area').innerHTML = _feesHTML();
      _attachFeeListeners();
    } catch { toast.error('Failed to save fee structure.'); }
  });
}
