// ============================================================
// teachers.js — Teacher service layer
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db }        from '../firebase.js';
import { logAction } from './audit.js';

const COL = 'teachers';

export async function getAllTeachers() {
  const snap = await getDocs(query(collection(db, COL), orderBy('surname')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTeacher(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTeacher(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    status:    'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAction('teacher_created', { teacherId: ref.id });
  return ref.id;
}

export async function updateTeacher(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
  await logAction('teacher_updated', { teacherId: id });
}

export async function deleteTeacher(id) {
  await deleteDoc(doc(db, COL, id));
  await logAction('teacher_deleted', { teacherId: id });
}
