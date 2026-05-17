// ============================================================
// classes.js — Class service layer with hierarchy support
// ============================================================
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }        from '../firebase.js';
import { logAction } from './audit.js';

const COL = 'classes';

export async function getAllClasses() {
  const snap = await getDocs(query(collection(db, COL), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClass(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createClass(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logAction('class_created', { classId: ref.id, name: data.name });
  return ref.id;
}

export async function updateClass(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteClass(id) {
  await deleteDoc(doc(db, COL, id));
  await logAction('class_deleted', { classId: id });
}

/**
 * Given a classId, return the next class in the hierarchy (by order).
 * Returns null if already at the top class (i.e. final year — graduate).
 */
export async function getNextClass(classId) {
  const classes = await getAllClasses();
  const current = classes.find(c => c.id === classId);
  if (!current) return null;

  const next = classes
    .filter(c => c.order > current.order)
    .sort((a, b) => a.order - b.order)[0];

  return next || null; // null means this is the final class → graduate
}

/**
 * Reorder classes in bulk. Pass an array of { id, order } objects.
 */
export async function reorderClasses(updates) {
  await Promise.all(
    updates.map(({ id, order }) =>
      updateDoc(doc(db, COL, id), { order, updatedAt: serverTimestamp() })
    )
  );
}
