// ============================================================
// fees.js — Fee & payment service (full logic implementation)
// ============================================================
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }        from '../firebase.js';
import { logAction } from './audit.js';

// ── Fee Structures (base fee per class/session/term) ──────

export async function getFeeStructures(sessionId) {
  if (!sessionId) return [];
  const snap = await getDocs(
    query(collection(db, 'fees'), where('sessionId', '==', sessionId))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFeeStructure(data) {
  const ref = await addDoc(collection(db, 'fees'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await logAction('fee_structure_created', { feeId: ref.id });
  return ref.id;
}

export async function updateFeeStructure(id, data) {
  await updateDoc(doc(db, 'fees', id), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Get the base fee amount for a specific class/session/term combination.
 * Returns 0 if no structure exists.
 */
export async function getBaseFee(classId, sessionId, termId) {
  const snap = await getDocs(
    query(
      collection(db, 'fees'),
      where('sessionId', '==', sessionId),
      where('classId',   '==', classId),
      where('termId',    '==', termId),
      where('isActive',  '==', true)
    )
  );
  if (snap.empty) return 0;
  return Number(snap.docs[0].data().amount) || 0;
}

// ── Pupil Fee Records (running summary per pupil/term) ────
// Collection: pupil_fee_records
// Document ID: `${pupilId}_${sessionId}_${termId}`
// Fields: pupilId, classId, sessionId, termId,
//         baseFee, adjustmentType, adjustmentValue, adjustmentFlat,
//         arrears, totalOwed, totalPaid, updatedAt

function _feeRecordId(pupilId, sessionId, termId) {
  return `${pupilId}_${sessionId}_${termId}`;
}

export async function getPupilFeeRecord(pupilId, sessionId, termId) {
  const snap = await getDoc(
    doc(db, 'pupil_fee_records', _feeRecordId(pupilId, sessionId, termId))
  );
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Core calculation: compute what a pupil owes for a given term.
 *
 * Steps:
 *   1. Get base fee for their class/session/term
 *   2. Apply discount/surcharge (both applied independently to base fee, not compounded)
 *   3. Fetch arrears (see spec for first-term vs mid-session logic)
 *   4. Return full breakdown
 */
export async function calculatePupilFee(pupil, sessionId, termId, termOrder, allTerms) {
  const baseFee = await getBaseFee(pupil.classId, sessionId, termId);

  // ── Adjustments ──────────────────────────────────────────
  let discountAmount  = 0;
  let surchargeAmount = 0;

  if (pupil.adjustment) {
    const { type, value, flat } = pupil.adjustment;
    if (type === 'discount') {
      if (value)  discountAmount  += (baseFee * value / 100);
      if (flat)   discountAmount  += flat;
    } else if (type === 'surcharge') {
      if (value)  surchargeAmount += (baseFee * value / 100);
      if (flat)   surchargeAmount += flat;
    }
  }

  const adjustedFee = Math.max(0, baseFee + surchargeAmount - discountAmount);

  // ── Arrears ───────────────────────────────────────────────
  let arrears = 0;

  // Only add arrears if pupil was enrolled before this term
  const admissionDate = pupil.admissionDate ? new Date(pupil.admissionDate) : null;

  if (termOrder === 1) {
    // First term of a new session: look at previous session's total outstanding
    arrears = await _getPreviousSessionOutstanding(pupil.id, sessionId);
  } else {
    // 2nd or 3rd term: only look at the immediately preceding term
    const prevTerm = allTerms.find(t => t.order === termOrder - 1);
    if (prevTerm) {
      const prevRecord = await getPupilFeeRecord(pupil.id, sessionId, prevTerm.id);
      if (prevRecord) {
        arrears = Math.max(0, (prevRecord.totalOwed || 0) - (prevRecord.totalPaid || 0));
      }
    }
  }

  const totalOwed = adjustedFee + arrears;

  return {
    baseFee,
    discountAmount,
    surchargeAmount,
    adjustedFee,
    arrears,
    totalOwed,
  };
}

async function _getPreviousSessionOutstanding(pupilId, currentSessionId) {
  // Find all sessions ordered by year desc, pick the one before current
  const snap = await getDocs(
    query(collection(db, 'sessions'), orderBy('startYear', 'desc'))
  );
  const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const currentIdx = sessions.findIndex(s => s.id === currentSessionId);
  if (currentIdx === -1 || currentIdx === sessions.length - 1) return 0;

  const prevSession = sessions[currentIdx + 1];

  // Get all terms for previous session ordered by order desc, pick last
  const termSnap = await getDocs(
    query(
      collection(db, 'terms'),
      where('sessionId', '==', prevSession.id),
      orderBy('order', 'desc')
    )
  );
  if (termSnap.empty) return 0;

  const lastTerm = { id: termSnap.docs[0].id, ...termSnap.docs[0].data() };
  const record   = await getPupilFeeRecord(pupilId, prevSession.id, lastTerm.id);
  if (!record) return 0;

  return Math.max(0, (record.totalOwed || 0) - (record.totalPaid || 0));
}

/**
 * Create or refresh a pupil's fee record for the current term.
 * Safe to call multiple times — it recalculates from scratch.
 */
export async function upsertPupilFeeRecord(pupil, sessionId, termId, termOrder, allTerms) {
  const calc = await calculatePupilFee(pupil, sessionId, termId, termOrder, allTerms);
  const id   = _feeRecordId(pupil.id, sessionId, termId);

  const existing = await getPupilFeeRecord(pupil.id, sessionId, termId);
  const totalPaid = existing?.totalPaid || 0;

  await setDoc(doc(db, 'pupil_fee_records', id), {
    pupilId:    pupil.id,
    classId:    pupil.classId,
    sessionId,
    termId,
    baseFee:    calc.baseFee,
    arrears:    calc.arrears,
    totalOwed:  calc.totalOwed,
    totalPaid,                   // never reduced — only increases
    updatedAt:  serverTimestamp(),
  });

  return { ...calc, totalPaid, outstanding: Math.max(0, calc.totalOwed - totalPaid) };
}

// ── Payments (immutable receipts) ─────────────────────────

export async function getPayments({ sessionId, termId, classId, pupilId } = {}) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (sessionId) constraints.unshift(where('sessionId', '==', sessionId));
  if (termId)    constraints.unshift(where('termId',    '==', termId));
  if (classId)   constraints.unshift(where('classId',   '==', classId));
  if (pupilId)   constraints.unshift(where('pupilId',   '==', pupilId));

  const snap = await getDocs(query(collection(db, 'payments'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPupilPayments(pupilId) {
  return getPayments({ pupilId });
}

/**
 * Record a payment. Validates against what is actually owed.
 * Applies to arrears first, then current fee.
 * Saves an immutable receipt AND updates the running summary.
 */
export async function recordPayment(data, pupil, termOrder, allTerms) {
  const { sessionId, termId, classId, pupilId, feeType, amount, method, notes } = data;

  // 1. Recalculate everything fresh
  const record = await getPupilFeeRecord(pupilId, sessionId, termId);
  if (!record) {
    throw new Error('Fee record not found. Please ensure fee structures are set up for this term.');
  }

  const totalPaid   = record.totalPaid || 0;
  const outstanding = Math.max(0, record.totalOwed - totalPaid);

  // 2. Validate: payment cannot exceed outstanding
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (amount > outstanding) {
    throw new Error(
      `Payment of ₦${amount.toLocaleString()} exceeds outstanding balance of ₦${outstanding.toLocaleString()}. ` +
      `Maximum acceptable payment is ₦${outstanding.toLocaleString()}.`
    );
  }

  // 3. Determine how payment is split (arrears first, then current fee)
  const arrearsCleared = Math.min(amount, record.arrears || 0);
  const feeCleared     = amount - arrearsCleared;

  const receiptNo   = _generateReceiptNo();
  const newTotalPaid = totalPaid + amount;
  const newBalance   = Math.max(0, record.totalOwed - newTotalPaid);

  // 4. Write receipt (immutable) + update running summary atomically
  const batch = writeBatch(db);

  const receiptRef = doc(collection(db, 'payments'));
  batch.set(receiptRef, {
    receiptNo,
    pupilId,
    pupilName:      data.pupilName || '',
    classId,
    sessionId,
    termId,
    feeType,
    amount,
    arrearsCleared,
    feeCleared,
    totalOwed:      record.totalOwed,
    totalPaidAfter: newTotalPaid,
    balance:        newBalance,
    method:         method || 'Cash',
    notes:          notes  || '',
    status:         newBalance === 0 ? 'completed' : 'part_payment',
    createdAt:      serverTimestamp(),
  });

  const recordRef = doc(db, 'pupil_fee_records', _feeRecordId(pupilId, sessionId, termId));
  batch.update(recordRef, {
    totalPaid:  newTotalPaid,
    updatedAt:  serverTimestamp(),
  });

  await batch.commit();
  await logAction('payment_recorded', { paymentId: receiptRef.id, amount, pupilId });

  return { receiptNo, newBalance, receiptId: receiptRef.id };
}

// ── Arrears report ────────────────────────────────────────

export async function getArrearsReport(sessionId, termId) {
  const snap = await getDocs(
    query(
      collection(db, 'pupil_fee_records'),
      where('sessionId', '==', sessionId),
      where('termId',    '==', termId)
    )
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.totalOwed - r.totalPaid > 0)
    .map(r => ({ ...r, outstanding: r.totalOwed - r.totalPaid }))
    .sort((a, b) => b.outstanding - a.outstanding);
}

// ── Helpers ───────────────────────────────────────────────

function _generateReceiptNo() {
  const now = new Date();
  return `RCP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
