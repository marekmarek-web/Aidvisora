/** One-time migration from legacy `weplan_*` localStorage keys to `aidvisora_*`. */

export function migrateLocalStorageKey(oldKey: string, newKey: string): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(newKey) != null) return;
    const v = localStorage.getItem(oldKey);
    if (v == null) return;
    localStorage.setItem(newKey, v);
    localStorage.removeItem(oldKey);
  } catch {
    /* ignore quota / private mode */
  }
}

export function migrateLocalStoragePrefix(oldPrefix: string, newPrefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(oldPrefix)) keys.push(k);
    }
    for (const k of keys) {
      const suffix = k.slice(oldPrefix.length);
      const newK = newPrefix + suffix;
      if (localStorage.getItem(newK) != null) continue;
      const v = localStorage.getItem(k);
      if (v != null) localStorage.setItem(newK, v);
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
