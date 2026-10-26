// The icon size, colour and style chosen in the toolbar, remembered in this browser. Falls back to the defaults when nothing valid is saved or storage is blocked.
import { useEffect, useRef, useState } from "react";
import { ICON_STYLES, DEFAULT_APPEARANCE, clampIconSize, isIconColor, type IconAppearance } from "../lib/iconAppearance";

function load(key: string): IconAppearance {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<IconAppearance> | null;
    if (!saved || typeof saved !== "object") return DEFAULT_APPEARANCE;
    return {
      size: typeof saved.size === "number" ? clampIconSize(saved.size) : DEFAULT_APPEARANCE.size,
      color: isIconColor(saved.color) ? saved.color : DEFAULT_APPEARANCE.color,
      style: ICON_STYLES.includes(saved.style as never) ? (saved.style as IconAppearance["style"]) : DEFAULT_APPEARANCE.style,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function useIconAppearance(projectId: string): [IconAppearance, (change: Partial<IconAppearance>) => void] {
  const key = `project:${projectId}:iconAppearance`;
  const [stored, setStored] = useState(() => ({ key, appearance: load(key) }));
  const appearance = stored.key === key ? stored.appearance : load(key);
  // Tracks the current project's latest value so quick successive controls do not overwrite each other.
  const latest = useRef({ key, appearance });

  useEffect(() => {
    const next = load(key);
    latest.current = { key, appearance: next };
    setStored({ key, appearance: next });
  }, [key]);

  function update(change: Partial<IconAppearance>) {
    const current = latest.current.key === key ? latest.current.appearance : appearance;
    const next = { ...current, ...change };
    latest.current = { key, appearance: next };
    setStored({ key, appearance: next });
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The choice still applies until the page is closed.
    }
  }

  return [appearance, update];
}
