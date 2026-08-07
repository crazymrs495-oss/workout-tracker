// Drop-in replacement for the `window.storage` API (as used in the original
// component) backed by the browser's localStorage. Every key is namespaced
// so this app doesn't collide with anything else stored on the same origin.
//
// API mirrors the original: get/set/delete/list, all async, all returning
// `null` on failure or when a key isn't found (callers already handle that).

const PREFIX = "iron-log:";

function k(key) {
  return `${PREFIX}${key}`;
}

export const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(k(key));
      if (raw === null) return null;
      return { key, value: raw, shared: false };
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    try {
      window.localStorage.setItem(k(key), value);
      return { key, value, shared: false };
    } catch (e) {
      return null;
    }
  },

  async delete(key) {
    try {
      window.localStorage.removeItem(k(key));
      return { key, deleted: true, shared: false };
    } catch (e) {
      return null;
    }
  },

  async list(prefix = "") {
    try {
      const full = k(prefix);
      const keys = Object.keys(window.localStorage)
        .filter((storedKey) => storedKey.startsWith(full))
        .map((storedKey) => storedKey.slice(PREFIX.length));
      return { keys, prefix, shared: false };
    } catch (e) {
      return null;
    }
  },
};
