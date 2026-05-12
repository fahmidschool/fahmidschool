// ============================================================
// pupils.js — Pupil service layer
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db }        from '../firebase.js';
import { logAction } from './audit.js';

const COL = 'pupils';

export async function getAllPupils() {
  const snap = await getDocs(query(collection(db, COL), orderBy('surname')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupilsByClass(classId) {
  const q    = query(collection(db, COL), where('classId', '==', classId), orderBy('surname'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupil(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createPupil(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    admissionNumber: data.admissionNumber.toUpperCase(),
    status:         'active',
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  });
  await logAction('pupil_created', { pupilId: ref.id, name: `${data.surname} ${data.firstName}` });
  return ref.id;
}

export async function updatePupil(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
  await logAction('pupil_updated', { pupilId: id });
}

export async function deletePupil(id) {
  await deleteDoc(doc(db, COL, id));
  await logAction('pupil_deleted', { pupilId: id });
}

export async function promotePupils(pupilIds, newClassId) {
  const batch = writeBatch(db);
  pupilIds.forEach(id => {
    batch.update(doc(db, COL, id), { classId: newClassId, updatedAt: serverTimestamp() });
  });
  await batch.commit();
  await logAction('pupils_promoted', { count: pupilIds.length, newClassId });
}

export async function searchPupils(term) {
  const all = await getAllPupils();
  const t   = term.toLowerCase();
  return all.filter(p =>
    `${p.surname} ${p.firstName}`.toLowerCase().includes(t) ||
    p.admissionNumber?.toLowerCase().includes(t)
  );
}
