// ============================================================
// cbt.js — CBT exam service
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db }        from '../firebase.js';
import { logAction } from './audit.js';

// Exams
export async function getExams({ classId, subjectId } = {}) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (classId)   constraints.unshift(where('classId',   '==', classId));
  if (subjectId) constraints.unshift(where('subjectId', '==', subjectId));
  const snap = await getDocs(query(collection(db, 'CBT_exams'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getExam(id) {
  const snap = await getDoc(doc(db, 'CBT_exams', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createExam(data) {
  const ref = await addDoc(collection(db, 'CBT_exams'), {
    ...data,
    status:    'draft',
    createdAt: serverTimestamp(),
  });
  await logAction('cbt_exam_created', { examId: ref.id });
  return ref.id;
}

export async function publishExam(id) {
  await updateDoc(doc(db, 'CBT_exams', id), { status: 'published', publishedAt: serverTimestamp() });
  await logAction('cbt_exam_published', { examId: id });
}

// CBT submissions
export async function submitExam({ examId, pupilId, answers, score, total }) {
  const ref = await addDoc(collection(db, 'CBT_results'), {
    examId, pupilId, answers, score, total,
    percentage: Math.round((score / total) * 100),
    submittedAt: serverTimestamp(),
  });
  await logAction('cbt_submitted', { examId, pupilId, score });
  return ref.id;
}

export async function getPupilCBTResults(pupilId) {
  const q    = query(collection(db, 'CBT_results'), where('pupilId', '==', pupilId), orderBy('submittedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getExamResults(examId) {
  const q    = query(collection(db, 'CBT_results'), where('examId', '==', examId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
