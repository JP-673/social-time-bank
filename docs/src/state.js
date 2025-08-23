const state = {
  currentUser: null,
  isLoading: false,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const cb of listeners) {
    try { cb(state); } catch (e) { console.error('[state] listener error', e); }
  }
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
