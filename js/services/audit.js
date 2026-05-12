// ============================================================
// audit.js — Audit logging service
// ============================================================

import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db }    from '../firebase.js';
import { store } from '../store.js';

export async function logAction(action, details = {}) {
  try {
    const profile = store.get('profile');
    await addDoc(collection(db, 'audit_logs'), {
      action,
      ...details,
      actorUid:  store.get('user')?.uid || null,
      actorName: profile?.displayName || profile?.name || 'Unknown',
      actorRole: store.get('role') || 'unknown',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log failed:', err);
  }
}

export async function getAuditLogs(count = 50) {
  const q    = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
