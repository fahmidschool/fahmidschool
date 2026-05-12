// ============================================================
// sessions.js — Session and term management service
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

// Sessions
export async function getAllSessions() {
  const snap = await getDocs(query(collection(db, 'sessions'), orderBy('startYear', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveSession() {
  const q    = query(collection(db, 'sessions'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createSession(data) {
  const ref = await addDoc(collection(db, 'sessions'), { ...data, isActive: false, createdAt: serverTimestamp() });
  return ref.id;
}

export async function setActiveSession(id) {
  // Deactivate all first
  const all = await getAllSessions();
  const promises = all.map(s => updateDoc(doc(db, 'sessions', s.id), { isActive: s.id === id }));
  await Promise.all(promises);
}

// Terms
export async function getTermsBySession(sessionId) {
  const q    = query(collection(db, 'terms'), where('sessionId', '==', sessionId), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveTerm(sessionId) {
  const q    = query(collection(db, 'terms'), where('sessionId', '==', sessionId), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createTerm(data) {
  const ref = await addDoc(collection(db, 'terms'), { ...data, isActive: false, createdAt: serverTimestamp() });
  return ref.id;
}
