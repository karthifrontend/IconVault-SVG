// A choice (such as grid or list view) remembered separately for each project in this browser.
import { useEffect, useState } from "react";

function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return allowed.includes(saved as T) ? (saved as T) : fallback;
  } catch {
    return fallback;
  }
}

export function usePersistentChoice<T extends string>(projectId: string, storageKey: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const key = `project:${projectId}:${storageKey}`;
  const [stored, setStored] = useState(() => ({ key, value: readChoice(key, allowed, fallback) }));

  useEffect(() => setStored({ key, value: readChoice(key, allowed, fallback) }), [key, allowed, fallback]);
  const value = stored.key === key ? stored.value : readChoice(key, allowed, fallback);

  function update(next: T) {
    setStored({ key, value: next });
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // The choice still applies until the page is closed.
    }
  }

  return [value, update];
}
