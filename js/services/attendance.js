// ============================================================
// attendance.js — Attendance service
// ============================================================

import {
  collection, doc, getDocs, addDoc, updateDoc, writeBatch,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

const COL = 'attendance';

export async function getAttendanceByDate({ classId, date }) {
  const q    = query(collection(db, COL),
    where('classId', '==', classId),
    where('date',    '==', date)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupilAttendance({ pupilId, sessionId, termId }) {
  const q    = query(collection(db, COL),
    where('pupilId',   '==', pupilId),
    where('sessionId', '==', sessionId),
    where('termId',    '==', termId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveAttendanceBatch(records) {
  const batch = writeBatch(db);
  records.forEach(r => {
    const ref = doc(collection(db, COL));
    batch.set(ref, { ...r, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export function computeAttendanceSummary(records) {
  const present = records.filter(r => r.status === 'present').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const total   = records.length;
  const pct     = total ? Math.round((present / total) * 100) : 0;
  return { present, absent, total, percentage: pct };
}
