// ============================================================
// auth-admin.js — Admin user creation using secondary app
// Uses a secondary Firebase app instance so the admin session
// is NEVER disturbed when creating teacher/pupil accounts.
// ============================================================

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';

import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import {
  doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { auth, db }  from '../firebase.js';
import { logAction } from './audit.js';

// ── Secondary Firebase app instance ───────────────────────
// This is a completely separate auth context. Creating a user
// here does NOT affect the admin who is signed in on the
// primary app instance.
let _secondaryApp  = null;
let _secondaryAuth = null;

function _getSecondaryAuth() {
  if (_secondaryAuth) return _secondaryAuth;

  // Get the config from the primary app
  const primaryApp = auth.app;
  const config     = primaryApp.options;

  // Initialize a second app with a unique name
  _secondaryApp  = initializeApp(config, 'secondary-user-creation');
  _secondaryAuth = getAuth(_secondaryApp);

  return _secondaryAuth;
}

// ── Create a teacher account ──────────────────────────────
export async function createTeacherAccount(data, tempPassword) {
  _validateAccountData(data, tempPassword);

  const secondaryAuth = _getSecondaryAuth();

  try {
    // 1. Create Auth account on secondary app (admin unaffected)
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email.trim(),
      tempPassword
    );

    const newUid = credential.user.uid;

    // 2. Set display name
    await updateProfile(credential.user, {
      displayName: `${data.surname} ${data.firstName}`,
    });

    // 3. Create users profile document
    await setDoc(doc(db, 'users', newUid), {
      displayName: `${data.surname} ${data.firstName}`,
      surname:      data.surname.trim(),
      firstName:    data.firstName.trim(),
      email:        data.email.trim().toLowerCase(),
      role:         'teacher',
      status:       'active',
      createdAt:    serverTimestamp(),
    });

    // 4. Create teachers document using the UID as document ID
    await setDoc(doc(db, 'teachers', newUid), {
      uid:           newUid,
      surname:       data.surname.trim(),
      firstName:     data.firstName.trim(),
      email:         data.email.trim().toLowerCase(),
      phone:         data.phone         || '',
      classId:       data.classId       || '',
      qualification: data.qualification || '',
      status:        'active',
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });

    // 5. Send password reset email (teacher sets their own password)
    await sendPasswordResetEmail(secondaryAuth, data.email.trim());

    // 6. Sign out from secondary app (cleanup)
    await signOut(secondaryAuth);

    // 7. Audit log
    await logAction('teacher_account_created', {
      teacherUid:   newUid,
      teacherEmail: data.email,
      name:         `${data.surname} ${data.firstName}`,
    });

    return newUid;

  } catch (err) {
    // Always sign out secondary auth on error
    await signOut(secondaryAuth).catch(() => {});
    throw _friendlyError(err);
  }
}

// ── Create a pupil account ────────────────────────────────
export async function createPupilAccount(data, tempPassword) {
  _validateAccountData(data, tempPassword);

  const secondaryAuth = _getSecondaryAuth();

  try {
    // 1. Create Auth account on secondary app
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email.trim(),
      tempPassword
    );

    const newUid = credential.user.uid;

    // 2. Set display name
    await updateProfile(credential.user, {
      displayName: `${data.surname} ${data.firstName}`,
    });

    // 3. Create users profile document
    await setDoc(doc(db, 'users', newUid), {
      displayName:     `${data.surname} ${data.firstName}`,
      surname:          data.surname.trim(),
      firstName:        data.firstName.trim(),
      email:            data.email.trim().toLowerCase(),
      role:             'pupil',
      admissionNumber:  data.admissionNumber?.toUpperCase().trim(),
      classId:          data.classId || '',
      status:           'active',
      createdAt:        serverTimestamp(),
    });

    // 4. Create pupils document using the UID as document ID
    await setDoc(doc(db, 'pupils', newUid), {
      uid:             newUid,
      surname:         data.surname.trim(),
      firstName:       data.firstName.trim(),
      email:           data.email.trim().toLowerCase(),
      admissionNumber: data.admissionNumber?.toUpperCase().trim(),
      gender:          data.gender       || '',
      dateOfBirth:     data.dateOfBirth  || '',
      classId:         data.classId      || '',
      guardianName:    data.guardianName || '',
      guardianPhone:   data.guardianPhone|| '',
      status:          'active',
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp(),
    });

    // 5. Send password reset email
    await sendPasswordResetEmail(secondaryAuth, data.email.trim());

    // 6. Sign out secondary app
    await signOut(secondaryAuth);

    // 7. Audit log
    await logAction('pupil_account_created', {
      pupilUid:        newUid,
      pupilEmail:      data.email,
      admissionNumber: data.admissionNumber,
      name:            `${data.surname} ${data.firstName}`,
    });

    return newUid;

  } catch (err) {
    await signOut(secondaryAuth).catch(() => {});
    throw _friendlyError(err);
  }
}

// ── Send password reset to any existing user ──────────────
export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    await logAction('password_reset_sent', { email });
  } catch (err) {
    throw _friendlyError(err);
  }
}

// ── Validation ────────────────────────────────────────────
function _validateAccountData(data, tempPassword) {
  if (!data.email?.trim())     throw new Error('Email address is required.');
  if (!data.surname?.trim())   throw new Error('Surname is required.');
  if (!data.firstName?.trim()) throw new Error('First name is required.');
  if (!tempPassword)           throw new Error('Temporary password is required.');
  if (tempPassword.length < 6) throw new Error('Temporary password must be at least 6 characters.');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email.trim())) {
    throw new Error('Please enter a valid email address.');
  }
}

// ── Friendly Firebase error messages ─────────────────────
function _friendlyError(err) {
  const code = err?.code || '';
  const map  = {
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'The email address is not valid.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/operation-not-allowed':   'Email accounts are not enabled. Check Firebase Authentication settings.',
    'auth/network-request-failed':  'Network error. Please check your connection.',
  };
  const message = map[code] || err?.message || 'Failed to create account.';
  const error   = new Error(message);
  error.code    = code;
  return error;
}
