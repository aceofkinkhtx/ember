// Small wrapper around localStorage. Reads and writes can fail (private
// browsing, storage cleared or blocked), so every call is guarded and the app
// falls back to defaults instead of crashing.

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: the setting lives in memory for this session only.
  }
}

/** Erases everything Ember stored on this device. */
export function eraseAll(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('ember.')) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing was saved.
  }
}
