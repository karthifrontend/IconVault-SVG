// A choice (such as grid or list view) that is remembered in this browser. Falls back to the default when nothing valid is saved or storage is blocked.
import { useState } from "react";

export function usePersistentChoice<T extends string>(storageKey: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return allowed.includes(saved as T) ? (saved as T) : fallback;
    } catch {
      return fallback;
    }
  });

  function update(next: T) {
    setValue(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // The choice still applies until the page is closed.
    }
  }

  return [value, update];
}
