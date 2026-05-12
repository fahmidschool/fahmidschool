// ============================================================
// auth.js — Authentication service layer
// Handles: email login, admission-number login, logout, state
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

import {
  doc, getDoc, query, collection, where, getDocs, serverTimestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

import { auth, db }  from './firebase.js';
import { store }     from './store.js';
import { toast }     from './toast.js';

// ── Resolve admission number → email ─────────────────────
async function resolveAdmissionNumber(admissionNumber) {
  try {
    const q = query(
      collection(db, 'pupils'),
      where('admissionNumber', '==', admissionNumber.trim().toUpperCase())
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return data.email || null;
  } catch (err) {
    console.error('resolveAdmissionNumber:', err);
    return null;
  }
}

// ── Sign in ───────────────────────────────────────────────
async function signIn({ identifier, password }) {
  let email = identifier.trim();

  // If it doesn't look like an email, treat it as admission number
  if (!email.includes('@')) {
    const resolved = await resolveAdmissionNumber(email);
    if (!resolved) throw new Error('Admission number not found. Please check and try again.');
    email = resolved;
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Fetch user profile
  const profileSnap = await getDoc(doc(db, 'users', cred.user.uid));
  if (!profileSnap.exists()) throw new Error('User profile not found. Contact the administrator.');

  const profile = profileSnap.data();
  store.set('user',    cred.user);
  store.set('profile', profile);
  store.set('role',    profile.role);

  // Audit log
  await logAudit('login', { uid: cred.user.uid, email });

  return { user: cred.user, profile };
}

// ── Sign out ──────────────────────────────────────────────
async function logOut() {
  const uid = auth.currentUser?.uid;
  if (uid) await logAudit('logout', { uid });
  store.clear();
  await signOut(auth);
}

// ── Auth state observer ───────────────────────────────────
function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          store.set('user',    user);
          store.set('profile', profile);
          store.set('role',    profile.role);
          callback({ user, profile });
        } else {
          callback({ user: null, profile: null });
        }
      } catch {
        callback({ user: null, profile: null });
      }
    } else {
      store.clear();
      callback({ user: null, profile: null });
    }
  });
}

// ── Change password ───────────────────────────────────────
async function changePassword({ currentPassword, newPassword }) {
  const user       = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  await logAudit('password_change', { uid: user.uid });
}

// ── Audit logging ─────────────────────────────────────────
async function logAudit(action, data = {}) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      ...data,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
    });
  } catch { /* non-critical */ }
}

// ── Role guard helper ─────────────────────────────────────
function requireRole(...roles) {
  const role = store.get('role');
  if (!role || !roles.includes(role)) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

export const authService = {
  signIn, logOut, onAuthChange, changePassword, requireRole, logAudit
};
