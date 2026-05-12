// ============================================================
// pupil/payments.js — Pupil payment history
// ============================================================

import { store }            from '/js/store.js';
import { getPupilPayments } from '/js/services/fees.js';
import { setPageTitle }     from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('Payment History');
  outlet.innerHTML = `<div class="text-center mt-6"><span class="spinner spinner-dark"></span></div>`;

  const uid = store.get('user')?.uid;

  try {
    const payments  = await getPupilPayments(uid);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const arrears   = payments.filter(p => p.balance && p.balance > 0);

    outlet.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Payment History</h1>
          <p>Your fee payment records</p>
        </div>
      </div>

      <div class="grid-3 mb-5">
        <div class="stat-card">
          <div class="stat-icon green"><i class="ph-bold ph-coins" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">NGN ${totalPaid.toLocaleString('en-NG', {minimumFractionDigits:2})}</div>
            <div class="stat-label">Total Paid</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ph-bold ph-receipt" style="font-size:22px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${payments.length}</div>
            <div class="stat-label">Transactions</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${arrears.length > 0 ? 'red' : 'green'}">
            <i class="ph-bold ph-${arrears.length > 0 ? 'warning' : 'check-circle'}" style="font-size:22px;"></i>
          </div>
          <div class="stat-body">
            <div class="stat-value">${arrears.length}</div>
            <div class="stat-label">Outstanding Balances</div>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Fee Type</th>
                <th>Amount (NGN)</th>
                <th>Balance (NGN)</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length === 0
                ? `<tr><td colspan="7" class="table-empty">
                    <i class="ph-bold ph-receipt" style="font-size:36px;display:block;margin-bottom:8px;color:var(--clr-text-faint);"></i>
                    No payment records found.
                   </td></tr>`
                : payments.map(p => `
                    <tr>
                      <td>
                        <span class="font-medium" style="font-family:var(--font-mono);font-size:0.8125rem;">
                          ${p.receiptNo}
                        </span>
                      </td>
                      <td>${p.feeType || '-'}</td>
                      <td class="font-bold">${Number(p.amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</td>
                      <td>
                        ${p.balance && p.balance > 0
                          ? `<span class="text-danger font-semibold">${Number(p.balance).toLocaleString('en-NG', {minimumFractionDigits:2})}</span>`
                          : '<span class="text-success">—</span>'
                        }
                      </td>
                      <td>${p.method || '-'}</td>
                      <td>${p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
                      <td>
                        ${p.balance && p.balance > 0
                          ? '<span class="badge badge-warning">Part Payment</span>'
                          : '<span class="badge badge-success">Completed</span>'
                        }
                      </td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    outlet.innerHTML = `<div class="alert alert-danger mt-4">Failed to load payment history. ${err.message}</div>`;
  }
}
