// The icon size, colour and style chosen in the toolbar, remembered in this browser. Falls back to the defaults when nothing valid is saved or storage is blocked.
import { useRef, useState } from "react";
import { ICON_STYLES, DEFAULT_APPEARANCE, clampIconSize, isIconColor, type IconAppearance } from "../lib/iconAppearance";

const KEY = "iconAppearance";

function load(): IconAppearance {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<IconAppearance> | null;
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

export function useIconAppearance(): [IconAppearance, (change: Partial<IconAppearance>) => void] {
  const [appearance, setAppearance] = useState<IconAppearance>(load);
  // The latest value, so two changes made before a re-render (a drag on the slider, then a click) do not undo each other.
  const latest = useRef(appearance);

  function update(change: Partial<IconAppearance>) {
    const next = { ...latest.current, ...change };
    latest.current = next;
    setAppearance(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // The choice still applies until the page is closed.
    }
  }

  return [appearance, update];
}
