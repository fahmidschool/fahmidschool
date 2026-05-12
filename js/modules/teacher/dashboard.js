// ============================================================
// teacher/dashboard.js — Teacher dashboard
// ============================================================

import { store }              from '/js/store.js';
import { getAnnouncements }   from '/js/services/announcements.js';
import { setPageTitle }       from '/js/components/topbar.js';
import { getActiveSession }   from '/js/services/sessions.js';
import { getAllClasses }       from '/js/services/classes.js';

export default async function render(outlet) {
  setPageTitle('Dashboard');

  const profile  = store.get('profile');
  const [session, announcements, classes] = await Promise.all([
    getActiveSession(),
    getAnnouncements({ count: 5 }),
    getAllClasses(),
  ]);

  const myClass = classes.find(c => c.classTeacherId === store.get('user')?.uid);

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Welcome, ${profile?.surname || profile?.displayName || 'Teacher'}</h1>
        <p>${session ? `Session: ${session.name}` : 'No active session'}</p>
      </div>
    </div>

    <div class="grid-3 mb-6">
      <div class="stat-card">
        <div class="stat-icon green"><i class="ph-bold ph-chalkboard" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${myClass?.name || 'N/A'}</div>
          <div class="stat-label">Assigned Class</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="ph-bold ph-books" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${profile?.subjects?.length || 0}</div>
          <div class="stat-label">Subjects</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber"><i class="ph-bold ph-megaphone" style="font-size:22px;"></i></div>
        <div class="stat-body">
          <div class="stat-value">${announcements.length}</div>
          <div class="stat-label">Announcements</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Recent Announcements</div></div>
      ${announcements.length === 0
        ? '<p class="text-muted">No announcements.</p>'
        : announcements.map(a => `
            <div class="mb-4 pb-4" style="border-bottom:1px solid var(--clr-border);">
              <div class="font-semibold">${a.title}</div>
              <p class="text-sm text-muted mt-1">${a.body?.slice(0, 120)}${a.body?.length > 120 ? '...' : ''}</p>
            </div>
          `).join('')
      }
    </div>

    <div class="card mt-5">
      <div class="card-header"><div class="card-title">Quick Actions</div></div>
      <div class="flex flex-wrap gap-3">
        <a href="#/results"     class="btn btn-secondary"><i class="ph-bold ph-medal"></i> Enter Results</a>
        <a href="#/attendance"  class="btn btn-secondary"><i class="ph-bold ph-user-check"></i> Take Attendance</a>
        <a href="#/lessons"     class="btn btn-secondary"><i class="ph-bold ph-book-open"></i> Upload Lesson Note</a>
        <a href="#/assignments" class="btn btn-secondary"><i class="ph-bold ph-clipboard-text"></i> Create Assignment</a>
      </div>
    </div>
  `;
}
