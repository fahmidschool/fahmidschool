// ============================================================
// results.js — Academic results service
// Lifecycle: draft → review → published → locked
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db }        from '../firebase.js';
import { logAction } from './audit.js';

const COL = 'results';

export async function getResults({ sessionId, termId, classId }) {
  const q    = query(collection(db, COL),
    where('sessionId', '==', sessionId),
    where('termId',    '==', termId),
    where('classId',   '==', classId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupilResults({ sessionId, termId, pupilId }) {
  const q    = query(collection(db, COL),
    where('sessionId', '==', sessionId),
    where('termId',    '==', termId),
    where('pupilId',   '==', pupilId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveResult(data) {
  // Upsert: find existing first
  const q    = query(collection(db, COL),
    where('sessionId',  '==', data.sessionId),
    where('termId',     '==', data.termId),
    where('pupilId',    '==', data.pupilId),
    where('subjectId',  '==', data.subjectId)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    return snap.docs[0].id;
  } else {
    const ref = await addDoc(collection(db, COL), {
      ...data,
      status:    'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }
}

export async function batchSaveResults(resultsArray) {
  const batch = writeBatch(db);
  const now   = serverTimestamp();
  resultsArray.forEach(r => {
    const ref = doc(collection(db, COL));
    batch.set(ref, { ...r, status: 'draft', createdAt: now, updatedAt: now });
  });
  await batch.commit();
  await logAction('results_batch_saved', { count: resultsArray.length });
}

export async function updateResultStatus(ids, status) {
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.update(doc(db, COL, id), { status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
  await logAction('results_status_changed', { status, count: ids.length });
}

// Compute grade from score
export function computeGrade(score) {
  if (score >= 75) return { grade: 'A',  remark: 'Excellent' };
  if (score >= 60) return { grade: 'B',  remark: 'Very Good' };
  if (score >= 50) return { grade: 'C',  remark: 'Good' };
  if (score >= 40) return { grade: 'D',  remark: 'Pass' };
  return             { grade: 'F',  remark: 'Fail' };
}

// Compute total score
export function computeTotal(result) {
  const ca1  = Number(result.ca1  || 0);
  const ca2  = Number(result.ca2  || 0);
  const exam  = Number(result.exam || 0);
  return ca1 + ca2 + exam;
}
