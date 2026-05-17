// ============================================================
// sessions.js — Session and term management service
// ============================================================
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

// ── Sessions ──────────────────────────────────────────────

export async function getAllSessions() {
  const snap = await getDocs(
    query(collection(db, 'sessions'), orderBy('startYear', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveSession() {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('isActive', '==', true))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createSession(data) {
  const ref = await addDoc(collection(db, 'sessions'), {
    ...data,
    isActive:  false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setActiveSession(id) {
  const all = await getAllSessions();
  await Promise.all(
    all.map(s => updateDoc(doc(db, 'sessions', s.id), { isActive: s.id === id }))
  );
}

// ── Terms ─────────────────────────────────────────────────

export async function getTermsBySession(sessionId) {
  if (!sessionId) return [];
  const snap = await getDocs(
    query(
      collection(db, 'terms'),
      where('sessionId', '==', sessionId),
      orderBy('order')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveTerm(sessionId) {
  if (!sessionId) return null;
  const snap = await getDocs(
    query(
      collection(db, 'terms'),
      where('sessionId', '==', sessionId),
      where('isActive', '==', true)
    )
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Sets one term as active within a session, deactivates all others in that session.
 */
export async function setActiveTerm(sessionId, termId) {
  const terms = await getTermsBySession(sessionId);
  await Promise.all(
    terms.map(t =>
      updateDoc(doc(db, 'terms', t.id), { isActive: t.id === termId })
    )
  );
}

export async function createTerm(data) {
  const ref = await addDoc(collection(db, 'terms'), {
    ...data,
    isActive:  false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Returns the currently active session + active term together.
 * Every module that needs "current period" should call this.
 */
export async function getActivePeriod() {
  const session = await getActiveSession();
  if (!session) return { session: null, term: null };
  const term = await getActiveTerm(session.id);
  return { session, term };
}
