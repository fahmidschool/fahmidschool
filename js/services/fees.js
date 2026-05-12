// ============================================================
// fees.js — Fees & payments service
// ============================================================

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db }        from '../firebase.js';
import { logAction } from './audit.js';

// ── Fee structures ────────────────────────────────────────
export async function getFeeStructures(sessionId) {
  const q    = query(collection(db, 'fees'), where('sessionId', '==', sessionId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFeeStructure(data) {
  const ref = await addDoc(collection(db, 'fees'), { ...data, createdAt: serverTimestamp() });
  await logAction('fee_structure_created', { feeId: ref.id });
  return ref.id;
}

// ── Payments ──────────────────────────────────────────────
export async function getPayments({ sessionId, termId, classId } = {}) {
  let q = collection(db, 'payments');
  const constraints = [];
  if (sessionId) constraints.push(where('sessionId', '==', sessionId));
  if (termId)    constraints.push(where('termId',    '==', termId));
  if (classId)   constraints.push(where('classId',   '==', classId));
  if (constraints.length) {
    q = query(q, ...constraints, orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupilPayments(pupilId) {
  const q    = query(collection(db, 'payments'), where('pupilId', '==', pupilId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function recordPayment(data) {
  const ref = await addDoc(collection(db, 'payments'), {
    ...data,
    status:    'completed',
    receiptNo: _generateReceiptNo(),
    createdAt: serverTimestamp(),
  });
  await logAction('payment_recorded', { paymentId: ref.id, amount: data.amount, pupilId: data.pupilId });
  return ref.id;
}

export async function getArrears({ sessionId, termId }) {
  const payments = await getPayments({ sessionId, termId });
  return payments.filter(p => p.balance && p.balance > 0);
}

function _generateReceiptNo() {
  const now = new Date();
  return `RCP${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
