// ============================================================
// store.js — Central session state and cache
// ============================================================

const _state = {
  user:        null,   // Firebase Auth user
  profile:     null,   // Firestore user profile doc
  role:        null,   // 'admin' | 'teacher' | 'pupil'
  currentSession: null,
  currentTerm:    null,
};

const _listeners = new Map();

function get(key) {
  return _state[key];
}

function set(key, value) {
  _state[key] = value;
  if (_listeners.has(key)) {
    _listeners.get(key).forEach(fn => fn(value));
  }
}

function getAll() {
  return { ..._state };
}

function on(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(callback);
  return () => _listeners.get(key).delete(callback);
}

function clear() {
  Object.keys(_state).forEach(k => { _state[k] = null; });
}

export const store = { get, set, getAll, on, clear };
