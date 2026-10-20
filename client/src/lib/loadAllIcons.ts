// Every active icon of a project (or of one folder with its subfolders), fetched page by page because the server returns at most 1000 per request. Used by the Sprite and Font sections and by the icon checklist.
import { listIcons } from "../api/icons";
import type { IconItem } from "../api/types";

const PAGE = 1000;

// `scope` is "all" or a folder id.
export async function loadAllIcons(projectId: string, scope = "all"): Promise<IconItem[]> {
  const out: IconItem[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listIcons(projectId, { sort: "name", limit: PAGE, page, ...(scope === "all" ? {} : { folderId: scope, includeSubfolders: true }) });
    out.push(...result.icons);
    if (out.length >= result.total || result.icons.length === 0) return out;
  }
}

// What the icon checklist hands to the Sprite or Font section through the address (router state): the chosen icons, and whether to start building straight away.
export type BuildSelectionState = { iconIds: string[]; autoBuild?: boolean };

export function readBuildSelection(state: unknown): BuildSelectionState | null {
  if (typeof state !== "object" || state === null) return null;
  const { iconIds, autoBuild } = state as Partial<BuildSelectionState>;
  if (!Array.isArray(iconIds) || iconIds.length === 0 || !iconIds.every((id) => typeof id === "string")) return null;
  return { iconIds, autoBuild: autoBuild === true };
}
