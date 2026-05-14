// ============================================================
// teacher/cbt.js — CBT exam creation and management
// ============================================================

import { getExams, createExam, publishExam, getExamResults } from '/js/services/cbt.js';
import { getAllClasses }      from '/js/services/classes.js';
import { getSubjectsByClass } from '/js/services/subjects.js';
import { setPageTitle }      from '/js/components/topbar.js';
import { openModal, closeModal } from '/js/components/modal.js';
import { toast }             from '/js/toast.js';

let _classes  = [];
let _exams    = [];
let _questions = [];

export default async function render(outlet) {
  setPageTitle('CBT Exams');
  _classes = await getAllClasses();

  outlet.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>CBT Exams</h1>
        <p>Create and manage computer-based test examinations</p>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" id="create-exam-btn">
          <i class="ph-bold ph-plus"></i> Create Exam
        </button>
      </div>
    </div>

    <div id="cbt-exams-area">
      <div class="text-center mt-4"><span class="spinner spinner-dark"></span></div>
    </div>
  `;

  document.getElementById('create-exam-btn').addEventListener('click', () => _openExamModal());
  await _loadExams();
}

async function _loadExams() {
  const area = document.getElementById('cbt-exams-area');
  try {
    _exams = await getExams();
    area.innerHTML = _exams.length === 0
      ? `<div class="card text-center text-muted" style="padding:var(--sp-12);">
          <i class="ph-bold ph-monitor-play" style="font-size:52px;display:block;margin-bottom:var(--sp-4);color:var(--clr-text-faint);"></i>
          No exams created yet.
         </div>`
      : `<div class="grid" style="gap:var(--sp-4);">
          ${_exams.map(e => `
            <div class="card">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-1">
                    <span class="font-bold text-lg">${e.title}</span>
                    <span class="badge badge-${e.status === 'published' ? 'success' : e.status === 'locked' ? 'danger' : 'neutral'}">${e.status}</span>
                  </div>
                  <div class="text-sm text-muted">${e.subjectName || e.subjectId} &mdash; ${e.className || ''}</div>
                  <div class="text-sm text-muted mt-1">${e.questions?.length || 0} questions &mdash; ${e.duration || 30} minutes</div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  ${e.status === 'draft'
                    ? `<button class="btn btn-primary btn-sm publish-exam-btn" data-id="${e.id}">
                        <i class="ph-bold ph-paper-plane-tilt"></i> Publish
                       </button>`
                    : ''
                  }
                  <button class="btn btn-secondary btn-sm view-results-btn" data-id="${e.id}">
                    <i class="ph-bold ph-chart-bar"></i> Results
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
         </div>`;

    document.querySelectorAll('.publish-exam-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Publish this exam? Pupils will be able to take it.')) return;
        try {
          await publishExam(btn.dataset.id);
          toast.success('Exam published. Pupils can now take it.');
          await _loadExams();
        } catch { toast.error('Failed to publish exam.'); }
      });
    });

    document.querySelectorAll('.view-results-btn').forEach(btn => {
      btn.addEventListener('click', () => _viewResults(btn.dataset.id));
    });

  } catch (err) {
    area.innerHTML = `<div class="alert alert-danger">Failed to load exams. ${err.message}</div>`;
  }
}

function _openExamModal() {
  _questions = [];

  openModal({
    title: 'Create CBT Exam',
    size:  'xl',
    bodyHTML: `
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Exam Title <span class="required">*</span></label>
          <input class="form-control" id="exam-title" placeholder="e.g. First Term Mathematics Exam" />
        </div>
        <div class="form-group">
          <label class="form-label">Duration (minutes)</label>
          <input type="number" class="form-control" id="exam-duration" value="30" min="5" max="180" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Class <span class="required">*</span></label>
          <select class="form-control" id="exam-class">
            <option value="">Select Class</option>
            ${_classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Subject <span class="required">*</span></label>
          <select class="form-control" id="exam-subject">
            <option value="">Select Subject</option>
          </select>
        </div>
      </div>

      <div class="divider"></div>

      <div class="flex items-center justify-between mb-4">
        <div class="card-title">Questions</div>
        <button class="btn btn-secondary btn-sm" id="add-question-btn" type="button">
          <i class="ph-bold ph-plus"></i> Add Question
        </button>
      </div>
      <div id="questions-list">
        <p class="text-muted text-sm">No questions added yet. Click "Add Question" to start.</p>
      </div>
    `,
    footerHTML: `
      <button class="btn btn-secondary" id="exam-cancel">Cancel</button>
      <button class="btn btn-primary" id="exam-save">Save as Draft</button>
    `,
  });

  document.getElementById('exam-class').addEventListener('change', async e => {
    const subs = e.target.value ? await getSubjectsByClass(e.target.value) : [];
    const sel  = document.getElementById('exam-subject');
    sel.innerHTML = `<option value="">Select Subject</option>` +
      subs.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });

  document.getElementById('add-question-btn').addEventListener('click', () => _addQuestion());
  document.getElementById('exam-cancel').addEventListener('click', closeModal);

  document.getElementById('exam-save').addEventListener('click', async () => {
    const classSel   = document.getElementById('exam-class');
    const subjectSel = document.getElementById('exam-subject');

    const data = {
      title:       document.getElementById('exam-title').value.trim(),
      duration:    Number(document.getElementById('exam-duration').value) || 30,
      classId:     classSel.value,
      className:   classSel.options[classSel.selectedIndex]?.text || '',
      subjectId:   subjectSel.value,
      subjectName: subjectSel.options[subjectSel.selectedIndex]?.text || '',
      questions:   _questions,
    };

    if (!data.title || !data.classId || !data.subjectId) {
      toast.warning('Title, class and subject are required.'); return;
    }
    if (data.questions.length === 0) {
      toast.warning('Please add at least one question.'); return;
    }

    try {
      await createExam(data);
      closeModal();
      toast.success('Exam created as draft. You can publish it when ready.');
      await _loadExams();
    } catch (err) {
      toast.error('Failed to create exam.');
      console.error(err);
    }
  });
}

function _addQuestion() {
  const idx  = _questions.length;
  _questions.push({ question: '', options: ['', '', '', ''], correctOption: 0 });

  const list = document.getElementById('questions-list');
  if (list.querySelector('p')) list.innerHTML = '';

  const qDiv = document.createElement('div');
  qDiv.className = 'card mb-3';
  qDiv.id        = `qblock-${idx}`;
  qDiv.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="font-semibold">Question ${idx + 1}</div>
      <button class="btn btn-ghost btn-sm text-danger remove-q-btn" data-idx="${idx}">
        <i class="ph-bold ph-trash"></i>
      </button>
    </div>
    <div class="form-group">
      <input class="form-control q-text" data-idx="${idx}" placeholder="Type your question here..." />
    </div>
    <div class="section-title mt-3 mb-2">Options (mark the correct answer)</div>
    ${['A','B','C','D'].map((letter, j) => `
      <div class="flex items-center gap-3 mb-2">
        <input type="radio" name="correct_${idx}" value="${j}"
          ${j === 0 ? 'checked' : ''}
          style="width:16px;height:16px;accent-color:var(--clr-success);cursor:pointer;" />
        <span class="font-bold text-sm" style="min-width:18px;">${letter}.</span>
        <input class="form-control q-option" data-idx="${idx}" data-opt="${j}"
          placeholder="Option ${letter}" style="flex:1;" />
      </div>
    `).join('')}
  `;

  list.appendChild(qDiv);

  // Bind events
  qDiv.querySelector('.q-text').addEventListener('input', e => {
    _questions[idx].question = e.target.value;
  });

  qDiv.querySelectorAll('.q-option').forEach(inp => {
    inp.addEventListener('input', e => {
      _questions[idx].options[Number(e.target.dataset.opt)] = e.target.value;
    });
  });

  qDiv.querySelectorAll(`[name="correct_${idx}"]`).forEach(radio => {
    radio.addEventListener('change', e => {
      _questions[idx].correctOption = Number(e.target.value);
    });
  });

  qDiv.querySelector('.remove-q-btn').addEventListener('click', () => {
    _questions.splice(idx, 1);
    qDiv.remove();
    if (document.getElementById('questions-list').children.length === 0) {
      document.getElementById('questions-list').innerHTML =
        '<p class="text-muted text-sm">No questions added yet.</p>';
    }
  });
}

async function _viewResults(examId) {
  const exam    = _exams.find(e => e.id === examId);
  const results = await getExamResults(examId);

  if (results.length === 0) {
    toast.info('No submissions for this exam yet.', 'No Results');
    return;
  }

  const avg = Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length);

  openModal({
    title: `${exam?.title || 'Exam'} — Results`,
    size:  'lg',
    bodyHTML: `
      <div class="flex gap-5 mb-5">
        <div class="stat-card flex-1">
          <div class="stat-icon blue"><i class="ph-bold ph-users" style="font-size:20px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${results.length}</div>
            <div class="stat-label">Submissions</div>
          </div>
        </div>
        <div class="stat-card flex-1">
          <div class="stat-icon green"><i class="ph-bold ph-chart-line-up" style="font-size:20px;"></i></div>
          <div class="stat-body">
            <div class="stat-value">${avg}%</div>
            <div class="stat-label">Average Score</div>
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Pupil ID</th><th>Score</th><th>Total</th><th>Percentage</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td class="text-sm text-muted">${r.pupilId}</td>
                <td class="font-bold">${r.score}</td>
                <td>${r.total}</td>
                <td><span class="badge badge-${r.percentage >= 50 ? 'success' : 'danger'}">${r.percentage}%</span></td>
                <td>${r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('en-GB') : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `,
    footerHTML: `<button class="btn btn-primary" id="exam-results-close">Close</button>`,
  });

  document.getElementById('exam-results-close').addEventListener('click', closeModal);
}
