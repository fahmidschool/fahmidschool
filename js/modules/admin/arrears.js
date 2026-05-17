// ============================================================
// admin/arrears.js — Outstanding fee arrears
// ============================================================
import { getArrearsReport }                         from '/js/services/fees.js';
import { getActivePeriod, getAllSessions, getTermsBySession } from '/js/services/sessions.js';
import { getAllClasses }                             from '/js/services/classes.js';
import { getAllPupils }                              from '/js/services/pupils.js';
import { setPageTitle }                             from '/js/components/topbar.js';
import { toast }                                    from '/js/toast.js';

let _sessions = [], _classes = [], _pupils = [];
let _activePeriod = { session: null, term: null };
let _filters  = { sessionId: '', termId: '' };

export default async function render(outlet) {
  setPageTitle('Fee Arrears');

  [_sessions, _classes, _pupils, _activePeriod] = await Promise.all([
    getAllSessions(), getAllClasses(), getAllPupils(), getActivePeriod()
  ]);

  _filters.sessionId = _activePeriod.session?.id || '';
  _filters.termId    = _activePeriod.term?.id    || '';

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Fee Arrears</h1>
        <p>Pupils with outstanding fee balances</p>
      </div>
    </div>

    ${_activePeriod.session
      ? `<div class="alert alert-info mb-4">
           <i class="ph-bold ph-info"></i>
           <span>Pre-filtered to active period: <strong>${_activePeriod.session.name}</strong>
           ${_activePeriod.term ? ' — <strong>' + _activePeriod.term.name + '</strong>' : ''}</span>
         </div>`
      : ''
    }

    <div class="card mb-5">
      <div class="form-row cols-3" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Session</label>
          <select class="form-control" id="arr-session">
            <option value="">Select Session</option>
            ${_sessions.map(s =>
              `<option value="${s.id}" ${s.id === _filters.sessionId ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Term</label>
          <select class="form-control" id="arr-term">
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

  // Pre-populate terms if active session
  if (_filters.sessionId) {
    const terms = await getTermsBySession(_filters.sessionId);
    const termSel = document.getElementById('arr-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t =>
        `<option value="${t.id}" ${t.id === _filters.termId ? 'selected' : ''}>${t.name}</option>`
      ).join('');
  }

  document.getElementById('arr-session').addEventListener('change', async e => {
    _filters.sessionId = e.target.value;
    _filters.termId    = '';
    const terms   = await getTermsBySession(e.target.value);
    const termSel = document.getElementById('arr-term');
    termSel.innerHTML = `<option value="">Select Term</option>` +
      terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  });

  document.getElementById('arr-term').addEventListener('change', e => { _filters.termId = e.target.value; });
  document.getElementById('arr-load-btn').addEventListener('click', _loadArrears);

  if (_filters.sessionId && _filters.termId) await _loadArrears();
}

async function _loadArrears() {
  const { sessionId, termId } = _filters;
  if (!sessionId || !termId) { toast.warning('Please select session and term.'); return; }

  const area = document.getElementById('arr-area');
  area.innerHTML = `<div class="text-center"><span class="spinner spinner-dark"></span></div>`;

  try {
    const arrears      = await getArrearsReport(sessionId, termId);
    const totalArrears = arrears.reduce((s, r) => s + r.outstanding, 0);

    area.innerHTML = `
      <div class="stat-card mb-5">
        <div class="stat-icon red">
          <i class="ph-bold ph-warning-circle" style="font-size:22px;"></i>
        </div>
        <div class="stat-body">
          <div class="stat-value">₦${totalArrears.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
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
                <th>Total Owed (₦)</th>
                <th>Total Paid (₦)</th>
                <th>Outstanding (₦)</th>
                <th>Arrears Portion (₦)</th>
              </tr>
            </thead>
            <tbody>
              ${arrears.length === 0
                ? `<tr><td colspan="6" class="table-empty">
                    <i class="ph-bold ph-check-circle" style="font-size:36px;display:block;margin-bottom:8px;color:var(--clr-success);"></i>
                    No arrears found for this period.
                   </td></tr>`
                : arrears.map(r => {
                    const pupil = _pupils.find(p => p.id === r.pupilId);
                    const cls   = _classes.find(c => c.id === r.classId);
                    return `
                      <tr>
                        <td class="font-semibold">${pupil ? `${pupil.surname} ${pupil.firstName}` : r.pupilId}</td>
                        <td>${cls?.name || '—'}</td>
                        <td>₦${Number(r.totalOwed).toLocaleString()}</td>
                        <td>₦${Number(r.totalPaid).toLocaleString()}</td>
                        <td>
                          <span class="font-bold text-danger">
                            ₦${Number(r.outstanding).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td>${r.arrears > 0
                          ? `<span class="text-danger">₦${Number(r.arrears).toLocaleString()}</span>`
                          : '—'}</td>
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
