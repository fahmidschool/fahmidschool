// ============================================================
// firebase.js — Firebase initialization (modular SDK)
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyA_HM5BH_k2QJUJF8ZlZSUETRDEYyXqfGg",
  authDomain:        "fahmidschool-f1f4e.firebaseapp.com",
  projectId:         "fahmidschool-f1f4e",
  storageBucket:     "fahmidschool-f1f4e.firebasestorage.app",
  messagingSenderId: "1026838467938",
  appId:             "1:1026838467938:web:c4ec32b71599d1a28b083b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
