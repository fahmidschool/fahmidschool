// ============================================================
// print.js — Proper iframe-based print utility
// Exports: printReportCard(), printClassResults()
// ============================================================

import {
  doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '/js/firebase.js';

async function _getSchoolSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'school_settings'));
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
}

function _printHTML(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(htmlContent);
  iDoc.close();

  iframe.contentWindow.focus();

  // Wait for any images / fonts to settle
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 400);
}

function _baseStyles() {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        color: #111;
        background: #fff;
        padding: 0;
      }
      @page {
        size: A4 portrait;
        margin: 18mm 14mm 14mm 14mm;
      }
      h1 { font-size: 20px; }
      h2 { font-size: 15px; font-weight: 600; }
      h3 { font-size: 13px; font-weight: 600; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #999;
        padding: 6px 8px;
        text-align: left;
        font-size: 12px;
      }
      th {
        background: #1e3a5f;
        color: #fff;
        font-weight: 600;
        text-align: center;
      }
      td { text-align: center; }
      td.left { text-align: left; }
      .school-header {
        text-align: center;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 2px solid #1e3a5f;
      }
      .school-name {
        font-size: 20px;
        font-weight: 700;
        color: #1e3a5f;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .school-sub {
        font-size: 12px;
        color: #555;
        margin-top: 2px;
      }
      .report-title {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 6px;
        color: #1e3a5f;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 20px;
        margin: 12px 0;
        padding: 10px 12px;
        background: #f4f7fb;
        border: 1px solid #d0dae8;
        border-radius: 4px;
      }
      .meta-row { display: flex; gap: 6px; font-size: 12px; }
      .meta-label { font-weight: 600; color: #444; min-width: 90px; }
      .meta-value { color: #111; }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin: 12px 0;
      }
      .summary-box {
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        text-align: center;
      }
      .summary-box .val {
        font-size: 20px;
        font-weight: 700;
        color: #1e3a5f;
      }
      .summary-box .lbl {
        font-size: 10px;
        color: #666;
        margin-top: 2px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .grade-A { color: #166534; font-weight: 700; }
      .grade-B { color: #1e40af; font-weight: 700; }
      .grade-C { color: #92400e; font-weight: 700; }
      .grade-D { color: #b45309; font-weight: 700; }
      .grade-F { color: #991b1b; font-weight: 700; }
      .remark-box {
        margin-top: 14px;
        padding: 10px 12px;
        border: 1px solid #d0dae8;
        border-radius: 4px;
        background: #f9fbff;
        font-size: 12px;
      }
      .remark-box strong { display: block; margin-bottom: 3px; }
      .signature-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 28px;
      }
      .sig-line {
        border-top: 1px solid #555;
        padding-top: 4px;
        font-size: 11px;
        color: #444;
        text-align: center;
      }
      .page-break { page-break-after: always; }
      tr:nth-child(even) td { background: #f8faff; }
      .rank-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 11px;
      }
      .rank-1 { background: #fef3c7; color: #92400e; }
      .rank-2 { background: #e5e7eb; color: #374151; }
      .rank-3 { background: #fde8d8; color: #9a3412; }
    </style>
  `;
}

function _schoolHeaderHTML(settings, reportTitle) {
  return `
    <div class="school-header">
      <div class="school-name">${settings.schoolName || 'Fahmid Nursery & Primary School'}</div>
      ${settings.address ? `<div class="school-sub">${settings.address}</div>` : ''}
      ${settings.phone || settings.email
        ? `<div class="school-sub">${[settings.phone, settings.email].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>`
        : ''}
      ${settings.motto ? `<div class="school-sub" style="font-style:italic;margin-top:2px;">"${settings.motto}"</div>` : ''}
      <div class="report-title">${reportTitle}</div>
    </div>
  `;
}

// ── Report Card (single pupil) ────────────────────────────────────────────────
export async function printReportCard({ pupil, results, subjects, meta }) {
  // meta: { sessionName, termName, className, classSize, principalRemark, nextTermDate }
  const settings = await _getSchoolSettings();

  const subjectMap = {};
  subjects.forEach(s => { subjectMap[s.id] = s; });

  const resultMap = {};
  results.forEach(r => { resultMap[r.subjectId] = r; });

  const scored   = results.filter(r => r.total !== undefined);
  const totalSum = scored.reduce((a, r) => a + (r.total || 0), 0);
  const average  = scored.length ? Math.round(totalSum / scored.length) : 0;

  // Compute grade from average
  function grade(score) {
    if (score >= 75) return { grade: 'A', remark: 'Excellent' };
    if (score >= 60) return { grade: 'B', remark: 'Very Good' };
    if (score >= 50) return { grade: 'C', remark: 'Good' };
    if (score >= 40) return { grade: 'D', remark: 'Pass' };
    return { grade: 'F', remark: 'Fail' };
  }

  const { grade: overallGrade, remark: overallRemark } = grade(average);

  const rows = subjects.map(s => {
    const r = resultMap[s.id];
    if (!r) {
      return `<tr>
        <td class="left">${s.name}</td>
        <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
      </tr>`;
    }
    const { grade: g, remark: rem } = grade(r.total || 0);
    return `<tr>
      <td class="left">${s.name}</td>
      <td>${r.ca1 ?? '—'}</td>
      <td>${r.ca2 ?? '—'}</td>
      <td>${r.exam ?? '—'}</td>
      <td><strong>${r.total ?? '—'}</strong></td>
      <td class="grade-${g}">${g}</td>
      <td>${rem}</td>
    </tr>`;
  }).join('');

  const nextTermLine = meta.nextTermDate
    ? `<div class="meta-row"><span class="meta-label">Next Term:</span><span class="meta-value">${meta.nextTermDate}</span></div>`
    : '';

  const principalRemark = meta.principalRemark || settings.principalRemarkTemplate || 'Well done. Keep it up.';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Card</title>${_baseStyles()}</head><body>
    ${_schoolHeaderHTML(settings, 'Student Report Card')}

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">Name:</span><span class="meta-value">${pupil.surname} ${pupil.firstName}</span></div>
      <div class="meta-row"><span class="meta-label">Session:</span><span class="meta-value">${meta.sessionName}</span></div>
      <div class="meta-row"><span class="meta-label">Adm. No:</span><span class="meta-value">${pupil.admissionNumber || '—'}</span></div>
      <div class="meta-row"><span class="meta-label">Term:</span><span class="meta-value">${meta.termName}</span></div>
      <div class="meta-row"><span class="meta-label">Class:</span><span class="meta-value">${meta.className}</span></div>
      <div class="meta-row"><span class="meta-label">Class Size:</span><span class="meta-value">${meta.classSize || '—'}</span></div>
      ${nextTermLine}
    </div>

    <div class="summary-grid">
      <div class="summary-box"><div class="val">${totalSum}</div><div class="lbl">Total Score</div></div>
      <div class="summary-box"><div class="val">${average}%</div><div class="lbl">Average</div></div>
      <div class="summary-box"><div class="val grade-${overallGrade}">${overallGrade}</div><div class="lbl">Grade</div></div>
      <div class="summary-box"><div class="val">${meta.position || '—'}</div><div class="lbl">Position</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left;min-width:140px;">Subject</th>
          <th>CA 1<br><small style="font-weight:400;font-size:10px;">/20</small></th>
          <th>CA 2<br><small style="font-weight:400;font-size:10px;">/20</small></th>
          <th>Exam<br><small style="font-weight:400;font-size:10px;">/60</small></th>
          <th>Total<br><small style="font-weight:400;font-size:10px;">/100</small></th>
          <th>Grade</th>
          <th>Remark</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="remark-box">
      <strong>Principal's Remark:</strong>
      ${principalRemark}
    </div>

    <div class="signature-row">
      <div class="sig-line">Class Teacher's Signature &amp; Date</div>
      <div class="sig-line">Principal's Signature &amp; Date</div>
    </div>
  </body></html>`;

  _printHTML(html);
}

// ── Class Results (all pupils, one page per pupil) ────────────────────────────
export async function printClassResults({ pupils, results, subjects, meta }) {
  // meta: { sessionName, termName, className, principalRemark, nextTermDate }
  const settings = await _getSchoolSettings();

  // Build result map: pupilId_subjectId → result
  const rMap = {};
  results.forEach(r => { rMap[`${r.pupilId}_${r.subjectId}`] = r; });

  function grade(score) {
    if (score >= 75) return { grade: 'A', remark: 'Excellent' };
    if (score >= 60) return { grade: 'B', remark: 'Very Good' };
    if (score >= 50) return { grade: 'C', remark: 'Good' };
    if (score >= 40) return { grade: 'D', remark: 'Pass' };
    return { grade: 'F', remark: 'Fail' };
  }

  // Pre-compute totals to get positions
  const pupilSummaries = pupils.map(p => {
    const scored = subjects.map(s => rMap[`${p.id}_${s.id}`]).filter(Boolean);
    const totalSum = scored.reduce((a, r) => a + (r.total || 0), 0);
    const average  = scored.length ? Math.round(totalSum / scored.length) : 0;
    return { id: p.id, totalSum, average };
  });
  pupilSummaries.sort((a, b) => b.totalSum - a.totalSum);
  const positionMap = {};
  pupilSummaries.forEach((p, i) => { positionMap[p.id] = i + 1; });

  const principalRemark = meta.principalRemark || settings.principalRemarkTemplate || 'Well done. Keep it up.';
  const nextTermLine = meta.nextTermDate
    ? `<div class="meta-row"><span class="meta-label">Next Term:</span><span class="meta-value">${meta.nextTermDate}</span></div>`
    : '';

  const pages = pupils.map((p, idx) => {
    const summary  = pupilSummaries.find(s => s.id === p.id);
    const { grade: overallGrade } = grade(summary.average);

    const rows = subjects.map(s => {
      const r = rMap[`${p.id}_${s.id}`];
      if (!r) {
        return `<tr><td class="left">${s.name}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
      }
      const { grade: g, remark: rem } = grade(r.total || 0);
      return `<tr>
        <td class="left">${s.name}</td>
        <td>${r.ca1 ?? '—'}</td>
        <td>${r.ca2 ?? '—'}</td>
        <td>${r.exam ?? '—'}</td>
        <td><strong>${r.total ?? '—'}</strong></td>
        <td class="grade-${g}">${g}</td>
        <td>${rem}</td>
      </tr>`;
    }).join('');

    const isLast = idx === pupils.length - 1;

    return `
      ${idx > 0 ? '<div class="page-break"></div>' : ''}
      ${_schoolHeaderHTML(settings, 'Student Report Card')}
      <div class="meta-grid">
        <div class="meta-row"><span class="meta-label">Name:</span><span class="meta-value">${p.surname} ${p.firstName}</span></div>
        <div class="meta-row"><span class="meta-label">Session:</span><span class="meta-value">${meta.sessionName}</span></div>
        <div class="meta-row"><span class="meta-label">Adm. No:</span><span class="meta-value">${p.admissionNumber || '—'}</span></div>
        <div class="meta-row"><span class="meta-label">Term:</span><span class="meta-value">${meta.termName}</span></div>
        <div class="meta-row"><span class="meta-label">Class:</span><span class="meta-value">${meta.className}</span></div>
        <div class="meta-row"><span class="meta-label">Class Size:</span><span class="meta-value">${pupils.length}</span></div>
        ${nextTermLine}
      </div>
      <div class="summary-grid">
        <div class="summary-box"><div class="val">${summary.totalSum}</div><div class="lbl">Total Score</div></div>
        <div class="summary-box"><div class="val">${summary.average}%</div><div class="lbl">Average</div></div>
        <div class="summary-box"><div class="val grade-${overallGrade}">${overallGrade}</div><div class="lbl">Grade</div></div>
        <div class="summary-box"><div class="val">${positionMap[p.id]}</div><div class="lbl">Position</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;min-width:140px;">Subject</th>
            <th>CA 1<br><small style="font-weight:400;font-size:10px;">/20</small></th>
            <th>CA 2<br><small style="font-weight:400;font-size:10px;">/20</small></th>
            <th>Exam<br><small style="font-weight:400;font-size:10px;">/60</small></th>
            <th>Total<br><small style="font-weight:400;font-size:10px;">/100</small></th>
            <th>Grade</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="remark-box">
        <strong>Principal's Remark:</strong>
        ${principalRemark}
      </div>
      <div class="signature-row">
        <div class="sig-line">Class Teacher's Signature &amp; Date</div>
        <div class="sig-line">Principal's Signature &amp; Date</div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Class Report Cards</title>${_baseStyles()}</head><body>${pages}</body></html>`;
  _printHTML(html);
}

// ── Broadsheet print ──────────────────────────────────────────────────────────
export async function printBroadsheet({ pupils, results, subjects, meta }) {
  // meta: { sessionName, termName, className }
  const settings = await _getSchoolSettings();

  const rMap = {};
  results.forEach(r => { rMap[`${r.pupilId}_${r.subjectId}`] = r; });

  function grade(score) {
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  const pupilData = pupils.map(p => {
    const scores   = subjects.map(s => { const r = rMap[`${p.id}_${s.id}`]; return r ? (r.total ?? 0) : null; });
    const valid    = scores.filter(s => s !== null);
    const sumTotal = valid.reduce((a, b) => a + b, 0);
    const average  = valid.length ? Math.round(sumTotal / valid.length) : 0;
    return { ...p, scores, sumTotal, average };
  });
  pupilData.sort((a, b) => b.sumTotal - a.sumTotal);
  pupilData.forEach((p, i) => { p.rank = i + 1; });

  const subjectHeaders = subjects.map(s =>
    `<th style="min-width:70px;font-size:10px;">${s.name}</th>`
  ).join('');

  const rows = pupilData.map(p => {
    const g = grade(p.average);
    const rankClass = p.rank <= 3 ? `rank-${p.rank}` : '';
    const scoreCells = p.scores.map(score =>
      score === null
        ? `<td style="color:#999;">—</td>`
        : `<td><strong>${score}</strong><br><span style="font-size:10px;color:#666;">${grade(score)}</span></td>`
    ).join('');
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${p.rank}</span></td>
      <td class="left"><strong>${p.surname} ${p.firstName}</strong></td>
      ${scoreCells}
      <td><strong>${p.sumTotal}</strong></td>
      <td>${p.average}%</td>
      <td class="grade-${g}"><strong>${g}</strong></td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Broadsheet</title>
    ${_baseStyles()}
    <style>
      @page { size: A4 landscape; margin: 12mm 10mm; }
      th, td { font-size: 11px; padding: 5px 6px; }
    </style>
  </head><body>
    ${_schoolHeaderHTML(settings, 'Class Broadsheet')}
    <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="meta-row"><span class="meta-label">Class:</span><span class="meta-value">${meta.className}</span></div>
      <div class="meta-row"><span class="meta-label">Session:</span><span class="meta-value">${meta.sessionName}</span></div>
      <div class="meta-row"><span class="meta-label">Term:</span><span class="meta-value">${meta.termName}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="min-width:36px;">Rank</th>
          <th style="text-align:left;min-width:150px;">Pupil Name</th>
          ${subjectHeaders}
          <th>Total</th>
          <th>Avg</th>
          <th>Grade</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  _printHTML(html);
}
