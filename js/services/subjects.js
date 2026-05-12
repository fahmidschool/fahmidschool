// ============================================================
// subjects.js — Subject service layer
// ============================================================

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

const COL = 'subjects';

export async function getAllSubjects() {
  const snap = await getDocs(query(collection(db, COL), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSubjectsByClass(classId) {
  const q    = query(collection(db, COL), where('classId', '==', classId), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createSubject(data) {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateSubject(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteSubject(id) {
  await deleteDoc(doc(db, COL, id));
}
