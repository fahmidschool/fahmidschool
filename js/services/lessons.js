// ============================================================
// lessons.js — Lesson notes service layer
// ============================================================
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const COL = 'lesson_notes';

export async function getLessonNotesByTeacher(teacherId) {
  const q    = query(collection(db, COL), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return bTime - aTime;
    });
}

export async function getLessonNotesByClass(classId) {
  const q    = query(collection(db, COL), where('classId', '==', classId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return bTime - aTime;
    });
}

export async function getAllLessonNotes() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return bTime - aTime;
    });
}

export async function createLessonNote(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLessonNote(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteLessonNote(id) {
  await deleteDoc(doc(db, COL, id));
}
