// ============================================================
// announcements.js — Announcements service
// ============================================================

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

const COL = 'announcements';

export async function getAnnouncements({ audience, count = 20 } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(count)];
  if (audience) constraints.unshift(where('audience', 'array-contains', audience));
  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createAnnouncement(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    audience:  data.audience || ['all'],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAnnouncement(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, COL, id));
}
