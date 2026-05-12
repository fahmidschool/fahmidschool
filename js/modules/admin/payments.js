// ============================================================
// admin/payments.js — Payments recording module
// ============================================================

import { getPayments, recordPayment, getPupilPayments } from '/js/services/fees.js';
import { getAllSessions, getTermsBySession }             from '/js/services/sessions.js';
import { getAllClasses }                                 from '/js/services/classes.js';
import { getPupilsByClass }                             from '/js/services/pupils.js';
import { setPageTitle }                                 from '/js/components/topbar.js';
import { openModal, closeModal }                        from '/js/components/modal.js';
import { toast }                                        from '/js/toast.js';

let _sessions = [], _classes = [], _pupils = [], _payments = [];
let _filters  = { sessionId: '', termId: '', classId: '' };

export default async function render(outlet) {
  setPageTitle('Payments');

  [_sessions, _classes] = await Promise.all([getAllSessions(), getAllClasses()]);

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

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="pay-session">
            <option value="">All Sessions</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="pay-term" disabled>
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

  document.getElementById('pay-session').addEventListener('change', async e => {
    _filters.sessionId = e.target.value;
    const terms = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('pay-term');
    termSel.innerHTML = `<option value="">All Terms</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = !e.target.value;
  });

  document.getElementById('pay-term').addEventListener('change', e => { _filters.termId = e.target.value; });
  document.getElementById('pay-class').addEventListener('change', async e => {
    _filters.classId = e.target.value;
    if (e.target.value) _pupils = await getPupilsByClass(e.target.value);
  });

  document.getElementById('load-payments-btn').addEventListener('click', _loadPayments);
  document.getElementById('record-payment-btn').addEventListener('click', () => _openPaymentModal());
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
          <div class="stat-value">NGN ${total.toLocaleString('en-NG', {minimumFractionDigits:2})}</div>
          <div class="stat-label">Total Payments — ${_payments.length} records</div>
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
                <th>Amount (NGN)</th>
                <th>Date</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${_payments.length === 0
                ? `<tr><td colspan="7" class="table-empty">No payments found for these filters.</td></tr>`
                : _payments.map(p => `
                    <tr>
                      <td class="font-mono text-sm">${p.receiptNo}</td>
                      <td class="font-semibold">${p.pupilName || '-'}</td>
                      <td>${p.feeType || '-'}</td>
                      <td class="font-bold">${Number(p.amount).toLocaleString()}</td>
                      <td>${p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
                      <td>${p.method || '-'}</td>
                      <td><span class="badge badge-success">${p.status}</span></td>
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

function _openPaymentModal() {
  openModal({
    title: 'Record Payment',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Session <span class="required">*</span></label>
          <select class="form-control" id="rp-session">
            <option value="">Select</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Term</label>
          <select class="form-control" id="rp-term">
            <option value="">First Term</option>
            <option>Second Term</option>
            <option>Third Term</option>
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
          <select class="form-control" id="rp-pupil">
            <option value="">Select Class first</option>
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Fee Type <span class="required">*</span></label>
          <input class="form-control" id="rp-feetype" placeholder="e.g. School Fees" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount (NGN) <span class="required">*</span></label>
          <input type="number" class="form-control" id="rp-amount" placeholder="0.00" />
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
          <label class="form-label">Balance (if any)</label>
          <input type="number" class="form-control" id="rp-balance" placeholder="0.00" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-control" id="rp-notes" placeholder="Optional note" />
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="rp-cancel">Cancel</button>
      <button class="btn btn-primary" id="rp-save">Record Payment</button>
    `,
  });

  // Load pupils when class changes
  document.getElementById('rp-class').addEventListener('change', async e => {
    const pupils = await getPupilsByClass(e.target.value);
    const sel = document.getElementById('rp-pupil');
    sel.innerHTML = `<option value="">Select Pupil</option>` +
      pupils.map(p => `<option value="${p.id}" data-name="${p.surname} ${p.firstName}">${p.surname} ${p.firstName}</option>`).join('');
  });

  document.getElementById('rp-cancel').addEventListener('click', closeModal);
  document.getElementById('rp-save').addEventListener('click', async () => {
    const pupilSel = document.getElementById('rp-pupil');
    const pupilName = pupilSel.options[pupilSel.selectedIndex]?.dataset.name || '';
    const data = {
      sessionId: document.getElementById('rp-session').value,
      termId:    document.getElementById('rp-term').value,
      classId:   document.getElementById('rp-class').value,
      pupilId:   pupilSel.value,
      pupilName,
      feeType:   document.getElementById('rp-feetype').value.trim(),
      amount:    Number(document.getElementById('rp-amount').value),
      balance:   Number(document.getElementById('rp-balance').value) || 0,
      method:    document.getElementById('rp-method').value,
      notes:     document.getElementById('rp-notes').value.trim(),
    };

    if (!data.sessionId || !data.classId || !data.pupilId || !data.feeType || !data.amount) {
      toast.warning('Please fill in all required fields.'); return;
    }

    try {
      await recordPayment(data);
      closeModal();
      toast.success('Payment recorded successfully.');
      await _loadPayments();
    } catch { toast.error('Failed to record payment.'); }
  });
}
