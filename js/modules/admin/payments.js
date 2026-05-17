// ============================================================
// admin/payments.js — Payment recording with full fee logic
// ============================================================
import {
  getPayments, recordPayment, getPupilFeeRecord,
  upsertPupilFeeRecord, calculatePupilFee
} from '/js/services/fees.js';
import { getActivePeriod, getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { getAllClasses }        from '/js/services/classes.js';
import { getPupilsByClass }    from '/js/services/pupils.js';
import { setPageTitle }        from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }               from '/js/toast.js';

let _sessions     = [], _classes = [], _payments = [];
let _activePeriod = { session: null, term: null };
let _filters      = { sessionId: '', termId: '', classId: '' };

export default async function render(outlet) {
  setPageTitle('Payments');

  [_sessions, _classes, _activePeriod] = await Promise.all([
    getAllSessions(), getAllClasses(), getActivePeriod()
  ]);

  // Pre-fill filters with active period
  _filters.sessionId = _activePeriod.session?.id || '';
  _filters.termId    = _activePeriod.term?.id    || '';

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Payments</h1>
        <p>Record and manage fee payments</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="record-payment-btn">
          <i class="ph-bold ph-plus"></i> Record Payment
        </button>
      </div>
    </div>

    ${_activePeriod.session
      ? `<div class="alert alert-info mb-4">
           <i class="ph-bold ph-info"></i>
           <span>Active: <strong>${_activePeriod.session.name}</strong>
           ${_activePeriod.term ? ' — <strong>' + _activePeriod.term.name + '</strong>' : ''}</span>
         </div>`
      : `<div class="alert alert-warning mb-4">
           <i class="ph-bold ph-warning"></i>
           <span>No active session. Please set one in Settings.</span>
         </div>`
    }

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="pay-session">
            <option value="">All Sessions</option>
            ${_sessions.map(s =>
              `<option value="${s.id}" ${s.id === _filters.sessionId ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="pay-term">
            <option value="">All Terms</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Class</label>
          <select class="form-control" id="pay-class">
            <option value="">All Classes</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-secondary mt-4" id="load-payments-btn">
        <i class="ph-bold ph-funnel"></i> Filter
      </button>
    </div>

    <div id="payments-area">
      <div class="card text-muted text-center" style="padding:var(--sp-10);">Apply filters to view payments.</div>
    </div>
  `;

  // Pre-populate terms dropdown if active session exists
  if (_filters.sessionId) {
    const terms = await getTermsBySession(_filters.sessionId);
    const termSel = document.getElementById('pay-term');
    termSel.innerHTML = `<option value="">All Terms</option>` +
      terms.map(t =>
        `<option value="${t.id}" ${t.id === _filters.termId ? 'selected' : ''}>${t.name}</option>`
      ).join('');
  }

  document.getElementById('pay-session').addEventListener('change', async e => {
    _filters.sessionId = e.target.value;
    _filters.termId    = '';
    const terms    = await getTermsBySession(e.target.value);
    const termSel  = document.getElementById('pay-term');
    termSel.innerHTML = `<option value="">All Terms</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  });

  document.getElementById('pay-term').addEventListener('change',  e => { _filters.termId  = e.target.value; });
  document.getElementById('pay-class').addEventListener('change', e => { _filters.classId = e.target.value; });
  document.getElementById('load-payments-btn').addEventListener('click', _loadPayments);
  document.getElementById('record-payment-btn').addEventListener('click', _openPaymentModal);

  if (_filters.sessionId && _filters.termId) await _loadPayments();
}

async function _loadPayments() {
  const area = document.getElementById('payments-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;
  try {
    _payments = await getPayments(_filters);
    const total = _payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    area.innerHTML = `
      <div class="stat-card mb-5">
        <div class="stat-icon amber"><i class="ph-bold ph-money" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">₦${total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
          <div class="stat-label">Total Collected — ${_payments.length} records</div>
        </div>
      </div>
      <div class="card" style="padding:0;">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Pupil</th>
                <th>Fee Type</th>
                <th>Amount (₦)</th>
                <th>Arrears Cleared (₦)</th>
                <th>Balance (₦)</th>
                <th>Date</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${_payments.length === 0
                ? `<tr><td colspan="9" class="table-empty">No payments found.</td></tr>`
                : _payments.map(p => `
                    <tr>
                      <td style="font-family:var(--font-mono);font-size:0.8rem;">${p.receiptNo}</td>
                      <td class="font-semibold">${p.pupilName || '—'}</td>
                      <td>${p.feeType || '—'}</td>
                      <td class="font-bold">₦${Number(p.amount).toLocaleString()}</td>
                      <td>${p.arrearsCleared > 0
                            ? `<span class="text-danger">₦${Number(p.arrearsCleared).toLocaleString()}</span>`
                            : '—'}</td>
                      <td>${p.balance > 0
                            ? `<span class="text-danger font-semibold">₦${Number(p.balance).toLocaleString()}</span>`
                            : '<span class="text-success">Nil</span>'}</td>
                      <td>${p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-GB') : '—'}</td>
                      <td>${p.method || '—'}</td>
                      <td><span class="badge badge-${p.status === 'completed' ? 'success' : 'warning'}">
                        ${p.status === 'completed' ? 'Completed' : 'Part Payment'}
                      </span></td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch {
    area.innerHTML = `<div class="alert alert-danger">Failed to load payments.</div>`;
  }
}

async function _openPaymentModal() {
  if (!_activePeriod.session) {
    toast.warning('No active session. Please set one in Settings.');
    return;
  }

  const terms = await getTermsBySession(_activePeriod.session.id);

  openModal({
    title: 'Record Payment',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Session</label>
          <input class="form-control" value="${_activePeriod.session.name}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Term <span class="required">*</span></label>
          <select class="form-control" id="rp-term">
            <option value="">Select Term</option>
            ${terms.map(t =>
              `<option value="${t.id}" ${t.id === _activePeriod.term?.id ? 'selected' : ''}>${t.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class <span class="required">*</span></label>
          <select class="form-control" id="rp-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Pupil <span class="required">*</span></label>
          <select class="form-control" id="rp-pupil" disabled>
            <option value="">Select Class first</option>
          </select>
        </div>
      </div>

      <!-- Fee breakdown — shown after pupil is selected -->
      <div id="rp-breakdown" class="mb-3" style="display:none;">
        <div class="card" style="background:var(--clr-surface-2,#f8f9fa);padding:var(--sp-3);">
          <div class="section-title mb-2">Fee Breakdown</div>
          <div class="flex justify-between text-sm mb-1">
            <span>Base Fee</span><span id="bd-base">—</span>
          </div>
          <div class="flex justify-between text-sm mb-1" id="bd-adj-row" style="display:none!important;">
            <span id="bd-adj-label">Adjustment</span><span id="bd-adj">—</span>
          </div>
          <div class="flex justify-between text-sm mb-1">
            <span>Adjusted Fee</span><span id="bd-adjusted">—</span>
          </div>
          <div class="flex justify-between text-sm mb-1 font-semibold" id="bd-arrears-row">
            <span style="color:var(--clr-danger);">Arrears</span>
            <span id="bd-arrears" style="color:var(--clr-danger);">—</span>
          </div>
          <div class="flex justify-between text-sm mb-1">
            <span>Total Owed</span><span id="bd-owed" class="font-bold">—</span>
          </div>
          <div class="flex justify-between text-sm mb-1">
            <span>Already Paid</span><span id="bd-paid">—</span>
          </div>
          <div class="flex justify-between font-bold" style="border-top:1px solid var(--clr-border);padding-top:var(--sp-2);margin-top:var(--sp-2);">
            <span>Outstanding</span><span id="bd-outstanding" style="color:var(--clr-danger);">—</span>
          </div>
        </div>
      </div>

      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Fee Type <span class="required">*</span></label>
          <input class="form-control" id="rp-feetype" placeholder="e.g. School Fees" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₦) <span class="required">*</span></label>
          <input type="number" class="form-control" id="rp-amount" placeholder="0.00" min="0" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select class="form-control" id="rp-method">
            <option>Cash</option>
            <option>Bank Transfer</option>
            <option>POS</option>
            <option>Cheque</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-control" id="rp-notes" placeholder="Optional" />
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="rp-cancel">Cancel</button>
      <button class="btn btn-primary"   id="rp-save">Record Payment</button>
    `,
  });

  let _selectedPupil = null;
  let _selectedTermObj = null;
  let _allTerms = terms;

  // Load pupils when class changes
  document.getElementById('rp-class').addEventListener('change', async e => {
    const pupils = await getPupilsByClass(e.target.value);
    const sel = document.getElementById('rp-pupil');
    sel.innerHTML = `<option value="">Select Pupil</option>` +
      pupils.map(p => `<option value="${p.id}">${p.surname} ${p.firstName}</option>`).join('');
    sel.disabled = false;
    _selectedPupil = null;
    document.getElementById('rp-breakdown').style.display = 'none';
  });

  // Load fee breakdown when pupil is selected
  document.getElementById('rp-pupil').addEventListener('change', async e => {
    const termId  = document.getElementById('rp-term').value;
    const classId = document.getElementById('rp-class').value;
    if (!e.target.value || !termId || !classId) return;

    const pupils = await getPupilsByClass(classId);
    _selectedPupil = pupils.find(p => p.id === e.target.value);
    _selectedTermObj = _allTerms.find(t => t.id === termId);
    if (!_selectedPupil || !_selectedTermObj) return;

    try {
      const record = await getPupilFeeRecord(_selectedPupil.id, _activePeriod.session.id, termId);
      const calc   = await calculatePupilFee(
        _selectedPupil,
        _activePeriod.session.id,
        termId,
        _selectedTermObj.order,
        _allTerms
      );
      const totalPaid   = record?.totalPaid || 0;
      const outstanding = Math.max(0, calc.totalOwed - totalPaid);

      document.getElementById('rp-breakdown').style.display = 'block';
      document.getElementById('bd-base').textContent      = `₦${calc.baseFee.toLocaleString()}`;
      document.getElementById('bd-adjusted').textContent  = `₦${calc.adjustedFee.toLocaleString()}`;
      document.getElementById('bd-arrears').textContent   = `₦${calc.arrears.toLocaleString()}`;
      document.getElementById('bd-owed').textContent      = `₦${calc.totalOwed.toLocaleString()}`;
      document.getElementById('bd-paid').textContent      = `₦${totalPaid.toLocaleString()}`;
      document.getElementById('bd-outstanding').textContent = `₦${outstanding.toLocaleString()}`;

      document.getElementById('rp-amount').max = outstanding;
    } catch (err) {
      console.error(err);
    }
  });

  document.getElementById('rp-cancel').addEventListener('click', closeModal);

  document.getElementById('rp-save').addEventListener('click', async () => {
    const termId  = document.getElementById('rp-term').value;
    const classId = document.getElementById('rp-class').value;
    const pupilEl = document.getElementById('rp-pupil');
    const pupilId = pupilEl.value;
    const amount  = Number(document.getElementById('rp-amount').value);
    const feeType = document.getElementById('rp-feetype').value.trim();
    const method  = document.getElementById('rp-method').value;
    const notes   = document.getElementById('rp-notes').value.trim();

    if (!termId || !classId || !pupilId || !feeType || !amount) {
      toast.warning('Please fill in all required fields.');
      return;
    }

    const pupilName = pupilEl.options[pupilEl.selectedIndex]?.text || '';

    try {
      // Ensure fee record exists (upsert)
      const termObj = _allTerms.find(t => t.id === termId);
      if (_selectedPupil && termObj) {
        await upsertPupilFeeRecord(
          _selectedPupil,
          _activePeriod.session.id,
          termId,
          termObj.order,
          _allTerms
        );
      }

      const result = await recordPayment(
        {
          sessionId: _activePeriod.session.id,
          termId,
          classId,
          pupilId,
          pupilName,
          feeType,
          amount,
          method,
          notes,
        },
        _selectedPupil,
        termObj?.order,
        _allTerms
      );

      closeModal();
      toast.success(`Payment recorded. Receipt: ${result.receiptNo}. Balance: ₦${result.newBalance.toLocaleString()}`);
      await _loadPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment.');
    }
  });
}
