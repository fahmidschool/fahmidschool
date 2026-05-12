// ============================================================
// admin/arrears.js — Outstanding fee arrears module
// ============================================================

import { getPayments }                      from '/js/services/fees.js';
import { getAllClasses }                     from '/js/services/classes.js';
import { getAllPupils }                      from '/js/services/pupils.js';
import { getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { setPageTitle }                     from '/js/components/topbar.js';
import { toast }                            from '/js/toast.js';

let _sessions = [], _classes = [], _pupils = [];
let _filters  = { sessionId: '', termId: '' };

export default async function render(outlet) {
  setPageTitle('Arrears');

  [_sessions, _classes, _pupils] = await Promise.all([
    getAllSessions(), getAllClasses(), getAllPupils()
  ]);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Fee Arrears</h1>
        <p>Pupils with outstanding fee balances</p>
      </div>
    </div>

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="arr-session">
            <option value="">Select Session</option>
            ${_sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="arr-term" disabled>
            <option value="">Select Term</option>
          </select>
        </div>
        <div>
          <button class="btn btn-primary w-full" id="arr-load-btn">
            <i class="ph-bold ph-funnel"></i> Load Arrears
          </button>
        </div>
      </div>
    </div>

    <div id="arr-area">
      <div class="card text-center text-muted" style="padding:var(--sp-10);">
        Select a session and term to view arrears.
      </div>
    </div>
  `;

  document.getElementById('arr-session').addEventListener('change', async e => {
    _filters.sessionId = e.target.value;
    const terms   = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('arr-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSel.disabled = false;
  });

  document.getElementById('arr-term').addEventListener('change',  e => { _filters.termId = e.target.value; });
  document.getElementById('arr-load-btn').addEventListener('click', _loadArrears);
}

async function _loadArrears() {
  const { sessionId, termId } = _filters;
  if (!sessionId || !termId) { toast.warning('Please select session and term.'); return; }

  const area = document.getElementById('arr-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    const payments = await getPayments({ sessionId, termId });
    const arrears  = payments.filter(p => p.balance && Number(p.balance) > 0);

    const totalArrears = arrears.reduce((s, p) => s + Number(p.balance), 0);

    area.innerHTML = `
      <div class="stat-card mb-5">
        <div class="stat-icon red"><i class="ph-bold ph-warning-circle" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">NGN ${totalArrears.toLocaleString('en-NG', {minimumFractionDigits:2})}</div>
          <div class="stat-label">Total Outstanding — ${arrears.length} cases</div>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pupil</th>
                <th>Class</th>
                <th>Fee Type</th>
                <th>Amount Paid (NGN)</th>
                <th>Balance (NGN)</th>
                <th>Receipt No.</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${arrears.length === 0
                ? `<tr><td colspan="7" class="table-empty">
                    <i class="ph-bold ph-check-circle" style="font-size:36px;display:block;margin-bottom:8px;color:var(--clr-success);"></i>
                    No arrears found for this period.
                   </td></tr>`
                : arrears.map(p => {
                    const pupil = _pupils.find(pu => pu.id === p.pupilId);
                    const cls   = _classes.find(c  => c.id  === p.classId);
                    return `
                      <tr>
                        <td class="font-semibold">${p.pupilName || pupil?.surname + ' ' + pupil?.firstName || '-'}</td>
                        <td>${cls?.name || '-'}</td>
                        <td>${p.feeType || '-'}</td>
                        <td>${Number(p.amount).toLocaleString('en-NG', {minimumFractionDigits:2})}</td>
                        <td>
                          <span class="font-bold text-danger">
                            ${Number(p.balance).toLocaleString('en-NG', {minimumFractionDigits:2})}
                          </span>
                        </td>
                        <td class="text-sm" style="font-family:var(--font-mono);">${p.receiptNo}</td>
                        <td>${p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
                      </tr>
                    `;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load arrears. ${err.message}</div>`;
  }
}
