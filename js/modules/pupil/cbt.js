// ============================================================
// pupil/cbt.js — Pupil CBT exam interface
// ============================================================

import { store }                                        from '/js/store.js';
import { getExams, getExam, submitExam, getPupilCBTResults } from '/js/services/cbt.js';
import { setPageTitle }                                 from '/js/components/topbar.js';
import { toast }                                        from '/js/toast.js';

let _currentExam   = null;
let _answers       = {};
let _timerInterval = null;
let _timeLeft      = 0;

export default async function render(outlet) {
  setPageTitle('CBT Exams');

  const profile = store.get('profile');
  const uid     = store.get('user')?.uid;
  const classId = profile?.classId;

  let exams       = [];
  let pastResults = [];

  try {
    [exams, pastResults] = await Promise.all([
      classId ? getExams({ classId }) : Promise.resolve([]),
      getPupilCBTResults(uid),
    ]);
    exams = exams.filter(e => e.status === 'published');
  } catch { /* ignore */ }

  // Map past results by examId for quick lookup
  const takenMap = {};
  pastResults.forEach(r => { takenMap[r.examId] = r; });

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>CBT Exams</h1>
        <p>Online examinations available to you</p>
      </div>
    </div>

    ${pastResults.length > 0 ? `
      <div class="card mb-5">
        <div class="card-header"><div class="card-title">Past Results</div></div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Score</th>
                <th>Total</th>
                <th>Percentage</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${pastResults.map(r => `
                <tr>
                  <td class="font-semibold">${r.examTitle || r.examId}</td>
                  <td>${r.score}</td>
                  <td>${r.total}</td>
                  <td>
                    <span class="badge badge-${r.percentage >= 50 ? 'success' : 'danger'}">
                      ${r.percentage}%
                    </span>
                  </td>
                  <td>${r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div id="cbt-list">
      ${exams.length === 0
        ? `<div class="card text-center" style="padding:var(--sp-12);">
            <i class="ph-bold ph-monitor-play" style="font-size:52px;color:var(--clr-text-faint);display:block;margin-bottom:var(--sp-4);"></i>
            <h3 style="color:var(--clr-text-muted);">No Exams Available</h3>
            <p class="text-muted mt-2">There are no published exams for your class at this time.</p>
           </div>`
        : `<div class="grid-3">
            ${exams.map(e => {
              const taken  = !!takenMap[e.id];
              const result = takenMap[e.id];
              return `
                <div class="card">
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <div class="font-bold text-lg">${e.title}</div>
                      <div class="text-sm text-muted mt-1">${e.subjectName || e.subjectId || 'General'}</div>
                    </div>
                    <span class="badge badge-${taken ? 'neutral' : 'success'}">${taken ? 'Taken' : 'Open'}</span>
                  </div>
                  <div class="text-sm text-muted mb-1">
                    <i class="ph-bold ph-list-numbers" style="font-size:14px;"></i>
                    ${e.questions?.length || 0} questions
                  </div>
                  <div class="text-sm text-muted mb-4">
                    <i class="ph-bold ph-clock" style="font-size:14px;"></i>
                    ${e.duration || 30} minutes
                  </div>
                  ${taken
                    ? `<div class="alert alert-info text-sm" style="padding:var(--sp-2) var(--sp-3);">
                        Score: ${result.score}/${result.total} — ${result.percentage}%
                       </div>`
                    : `<button class="btn btn-primary btn-block start-exam-btn" data-id="${e.id}">
                        <i class="ph-bold ph-play"></i> Start Exam
                       </button>`
                  }
                </div>
              `;
            }).join('')}
           </div>`
      }
    </div>

    <div id="cbt-exam-area" style="display:none;"></div>
  `;

  document.querySelectorAll('.start-exam-btn').forEach(btn => {
    btn.addEventListener('click', () => _startExam(btn.dataset.id));
  });
}

async function _startExam(examId) {
  try {
    _currentExam = await getExam(examId);
    if (!_currentExam) { toast.error('Exam not found.'); return; }

    _answers  = {};
    _timeLeft = (_currentExam.duration || 30) * 60;

    document.getElementById('cbt-list').style.display      = 'none';
    document.getElementById('cbt-exam-area').style.display = 'block';

    _renderExam();
    _startTimer();
  } catch (err) {
    toast.error('Failed to load exam. Please try again.');
    console.error(err);
  }
}

function _renderExam() {
  const area = document.getElementById('cbt-exam-area');
  const qs   = _currentExam.questions || [];

  area.innerHTML = `
    <div class="card mb-4" style="position:sticky;top:calc(var(--topbar-height) + 12px);z-index:50;border-bottom:2px solid var(--clr-border);">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-bold text-lg">${_currentExam.title}</div>
          <div class="text-sm text-muted">${qs.length} questions</div>
        </div>
        <div class="flex items-center gap-5">
          <div class="text-center">
            <div id="cbt-timer" class="font-bold" style="font-size:1.75rem;font-variant-numeric:tabular-nums;letter-spacing:0.05em;color:var(--clr-text);"></div>
            <div class="text-xs text-muted">Time Remaining</div>
          </div>
          <button class="btn btn-primary" id="submit-exam-btn">
            <i class="ph-bold ph-paper-plane-tilt"></i> Submit Exam
          </button>
        </div>
      </div>
    </div>

    <div id="questions-area">
      ${qs.map((q, i) => `
        <div class="card mb-4" id="q-${i}">
          <div class="flex gap-3 mb-4">
            <div style="width:28px;height:28px;border-radius:var(--radius-full);background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8125rem;font-weight:700;flex-shrink:0;">
              ${i + 1}
            </div>
            <div class="font-semibold" style="padding-top:4px;">${q.question}</div>
          </div>
          <div class="flex flex-col gap-2">
            ${(q.options || []).map((opt, j) => `
              <label class="cbt-option" data-q="${i}" data-opt="${j}"
                style="display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);border:1.5px solid var(--clr-border);border-radius:var(--radius-md);cursor:pointer;transition:all var(--transition-fast);">
                <input type="radio" name="q_${i}" value="${j}" style="margin-top:2px;accent-color:var(--clr-primary);" />
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card mt-4 text-center">
      <button class="btn btn-primary btn-lg" id="submit-exam-btn-bottom">
        <i class="ph-bold ph-paper-plane-tilt"></i> Submit Exam
      </button>
    </div>
  `;

  // Radio change handler
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', e => {
      const qIdx = parseInt(e.target.name.split('_')[1]);
      _answers[qIdx] = parseInt(e.target.value);

      // Visual feedback — reset all options in that question
      document.querySelectorAll(`.cbt-option[data-q="${qIdx}"]`).forEach(label => {
        label.style.borderColor  = 'var(--clr-border)';
        label.style.background   = 'transparent';
      });
      // Highlight selected
      const selected = document.querySelector(`.cbt-option[data-q="${qIdx}"][data-opt="${e.target.value}"]`);
      if (selected) {
        selected.style.borderColor = 'var(--clr-primary)';
        selected.style.background  = 'var(--clr-primary-light)';
      }
    });
  });

  document.getElementById('submit-exam-btn').addEventListener('click', _submitExam);
  document.getElementById('submit-exam-btn-bottom').addEventListener('click', _submitExam);
}

function _startTimer() {
  _updateTimerDisplay();
  _timerInterval = setInterval(() => {
    _timeLeft--;
    _updateTimerDisplay();
    if (_timeLeft <= 0) {
      clearInterval(_timerInterval);
      toast.warning('Time is up. Your exam is being submitted automatically.', 'Time Up');
      _submitExam();
    }
  }, 1000);
}

function _updateTimerDisplay() {
  const mins    = Math.floor(_timeLeft / 60);
  const secs    = _timeLeft % 60;
  const timerEl = document.getElementById('cbt-timer');
  if (timerEl) {
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    timerEl.style.color = _timeLeft <= 300
      ? 'var(--clr-danger)'
      : _timeLeft <= 600
        ? 'var(--clr-warning)'
        : 'var(--clr-text)';
  }
}

async function _submitExam() {
  clearInterval(_timerInterval);

  const uid = store.get('user')?.uid;
  const qs  = _currentExam.questions || [];

  // Disable submit buttons
  ['submit-exam-btn', 'submit-exam-btn-bottom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; el.innerHTML = `<span class="spinner"></span> Submitting...`; }
  });

  let score = 0;
  qs.forEach((q, i) => {
    if (_answers[i] !== undefined && _answers[i] === q.correctOption) {
      score++;
    }
  });

  try {
    await submitExam({
      examId:    _currentExam.id,
      examTitle: _currentExam.title,
      pupilId:   uid,
      answers:   _answers,
      score,
      total:     qs.length,
    });

    const pct     = qs.length > 0 ? Math.round((score / qs.length) * 100) : 0;
    const passed  = pct >= 50;

    document.getElementById('cbt-exam-area').innerHTML = `
      <div style="max-width:520px;margin:var(--sp-12) auto;">
        <div class="card text-center" style="padding:var(--sp-10);">
          <div class="stat-icon ${passed ? 'green' : 'red'}" style="width:72px;height:72px;margin:0 auto var(--sp-5);border-radius:var(--radius-full);">
            <i class="ph-bold ph-${passed ? 'check-circle' : 'x-circle'}" style="font-size:36px;"></i>
          </div>
          <h2 class="mb-2">Exam Submitted</h2>
          <p class="text-muted mb-6">Your answers have been recorded successfully.</p>
          <div style="font-size:3rem;font-weight:700;color:var(--clr-${passed ? 'success' : 'danger'});line-height:1;margin-bottom:var(--sp-2);">${pct}%</div>
          <div class="text-muted mb-1">${score} out of ${qs.length} correct</div>
          <div class="badge badge-${passed ? 'success' : 'danger'} mt-2" style="font-size:0.875rem;padding:6px 16px;">
            ${passed ? 'Passed' : 'Failed'}
          </div>
          <button class="btn btn-primary btn-lg mt-8" onclick="window.location.hash='/cbt'">
            <i class="ph-bold ph-arrow-left"></i> Back to Exams
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    toast.error('Failed to submit exam. Please contact the administrator.');
    console.error(err);
    ['submit-exam-btn', 'submit-exam-btn-bottom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = false; el.innerHTML = `<i class="ph-bold ph-paper-plane-tilt"></i> Submit Exam`; }
    });
  }
}
