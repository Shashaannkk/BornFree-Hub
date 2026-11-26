/**
 * BONFREE-HUB Ephemeral In-Memory UI State Store
 *
 * Security rule:
 * - Holds transient UI state only (active filters, drawer open state, active modal).
 * - Never persists domain records, stamps, rewards, or credentials in localStorage.
 */

export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return { ...state };
    },
    setState(patch) {
      const nextPatch = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...nextPatch };
      for (const listener of listeners) {
        listener(state);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
