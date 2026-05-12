// ============================================================
// pupil/dashboard.js — Pupil portal dashboard
// ============================================================

import { store }                from '/js/store.js';
import { getPupilResults }      from '/js/services/results.js';
import { getPupilAttendance, computeAttendanceSummary } from '/js/services/attendance.js';
import { getPupilPayments }     from '/js/services/fees.js';
import { getAnnouncements }     from '/js/services/announcements.js';
import { getActiveSession, getActiveTerm } from '/js/services/sessions.js';
import { setPageTitle }         from '/js/components/topbar.js';

export default async function render(outlet) {
  setPageTitle('My Dashboard');

  const profile  = store.get('profile');
  const uid      = store.get('user')?.uid;
  const session  = await getActiveSession();
  const term     = session ? await getActiveTerm(session.id) : null;

  const [results, payments, announcements] = await Promise.all([
    session && term ? getPupilResults({ sessionId: session.id, termId: term.id, pupilId: uid }) : Promise.resolve([]),
    getPupilPayments(uid),
    getAnnouncements({ count: 4 }),
  ]);

  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const avgScore  = results.length
    ? Math.round(results.reduce((s, r) => s + (r.total || 0), 0) / results.length)
    : 0;

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Welcome, ${profile?.surname || 'Pupil'}</h1>
        <p>${session ? `${session.name}${term ? ' — ' + term.name : ''}` : 'No active session'}</p>
      </div>
    </div>

    <div class="grid-4 mb-6">
      <div class="stat-card">
        <div class="stat-icon blue"><i class="ph-bold ph-medal" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${avgScore}%</div>
          <div class="stat-label">Average Score</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="ph-bold ph-books" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${results.length}</div>
          <div class="stat-label">Subjects Recorded</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber"><i class="ph-bold ph-receipt" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">NGN ${totalPaid.toLocaleString()}</div>
          <div class="stat-label">Total Paid</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal"><i class="ph-bold ph-megaphone" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${announcements.length}</div>
          <div class="stat-label">Announcements</div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 360px;gap:var(--sp-5);">

      <!-- Results preview -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Current Term Results</div>
          <a href="#/results" class="btn btn-ghost btn-sm">View all</a>
        </div>
        ${results.length === 0
          ? '<p class="text-muted text-sm">No results available for this term.</p>'
          : `<div class="table-wrapper"><table>
              <thead><tr><th>Subject</th><th>Total</th><th>Grade</th></tr></thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td>${r.subjectName || r.subjectId}</td>
                    <td class="font-bold">${r.total}</td>
                    <td><span class="badge badge-${r.grade === 'F' ? 'danger' : r.grade === 'A' ? 'success' : 'info'}">${r.grade}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table></div>`
        }
      </div>

      <!-- Announcements -->
      <div class="card">
        <div class="card-header"><div class="card-title">Announcements</div></div>
        ${announcements.length === 0
          ? '<p class="text-muted text-sm">No announcements.</p>'
          : announcements.map(a => `
              <div class="mb-4 pb-4" style="border-bottom:1px solid var(--clr-border);">
                <div class="font-semibold text-sm">${a.title}</div>
                <p class="text-xs text-muted mt-1">${a.body?.slice(0, 80)}${a.body?.length > 80 ? '...' : ''}</p>
              </div>
            `).join('')
        }
      </div>

    </div>
  `;
}
