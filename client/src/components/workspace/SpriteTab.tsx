// The Sprite section: compiles the project's icons (all, or one folder with its subfolders) into an SVG sprite in the browser, with a live preview, copy and download, a ZIP bundle (sprite, grid sprite, demo page, preview image) and the symbol ids with their <use> code. Editors can also import an existing sprite into the project. Anyone who can see the project can build and download.
import { Copy, Download, FileArchive, FileUp, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { useWorkspace } from "../../context/workspaceContext";
import { useResource } from "../../hooks/useResource";
import { copyText } from "../../lib/clipboard";
import { buildFolderTree, flattenFolderTree } from "../../lib/folderTree";
import { formatBytes, pluralize } from "../../lib/format";
import { loadAllIcons } from "../../lib/loadAllIcons";
import { useHandedSelection } from "../../hooks/useHandedSelection";
import { buildSprite } from "../../lib/spriteBuild";
import { buildDemoHtml, buildGridSpriteXml } from "../../utils/buildDemo";
import { renderSpritePreviewPng } from "../../utils/previewPng";
import { createZip, triggerBrowserDownload } from "../../utils/zipBundle";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/Fields";
import IconChecklistDialog from "./IconChecklistDialog";
import ImportSpriteDialog from "./ImportSpriteDialog";

const MAX_LISTED_IDS = 200;

export default function SpriteTab() {
  const { project, folderList, refreshIcons, refreshFolders, refreshProject, iconsVersion } = useWorkspace();
  const { showToast } = useToast();
  // Icons handed over by the bulk bar ("Generate sprite") arrive with the checklist open.
  const handed = useHandedSelection();
  const [chosen, setChosen] = useState<string[] | null>(handed?.iconIds ?? null);
  const [choiceVersion, setChoiceVersion] = useState(0);
  const [choosing, setChoosing] = useState(handed?.openChecklist === true);
  const [scope, setScope] = useState(handed ? "selected" : "all");
  const [importing, setImporting] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const folderOptions = flattenFolderTree(buildFolderTree(folderList.folders));
  const fileName = project.prefix || "sprite";

  const loaded = useResource(`sprite:${project.id}:${scope}:${choiceVersion}:${iconsVersion}`, async () => {
    if (scope !== "selected") return loadAllIcons(project.id, scope);
    const wanted = new Set(chosen ?? []);
    return (await loadAllIcons(project.id)).filter((icon) => wanted.has(icon.id));
  });
  const built = useMemo(() => (loaded.data ? buildSprite(loaded.data.map((icon) => ({ name: icon.name, slug: icon.slug, svg: icon.svg ?? "" })), project.prefix) : null), [loaded.data, project.prefix]);
  const demo = useMemo(() => (built && built.ids.length > 0 ? buildDemoHtml(built.ids, built.xml) : null), [built]);
  const sizeBytes = built ? new Blob([built.xml]).size : 0;
  const shownIds = built ? built.ids.filter((id) => id.includes(filter.trim().toLowerCase())) : [];

  async function copyAndToast(text: string, what: string) {
    const ok = await copyText(text);
    showToast(ok ? `Copied ${what}.` : "Could not copy to the clipboard.", ok ? "success" : "error");
  }

  function downloadSprite() {
    if (!built) return;
    triggerBrowserDownload(new Blob([built.xml], { type: "image/svg+xml" }), `${fileName}.svg`);
  }

  async function downloadBundle() {
    if (!built || built.ids.length === 0) return;
    setBundleBusy(true);
    try {
      const entries: { name: string; data: string | Uint8Array }[] = [
        { name: `${fileName}.svg`, data: built.xml },
        { name: "demo.html", data: buildDemoHtml(built.ids, built.xml) },
        { name: `${fileName}-grid.svg`, data: buildGridSpriteXml(built.xml, built.ids) },
      ];
      const png = await renderSpritePreviewPng(built.xml, built.ids);
      if (png) entries.push({ name: "preview.png", data: new Uint8Array(await png.arrayBuffer()) });
      triggerBrowserDownload(createZip(entries), `${fileName}-bundle.zip`);
      showToast("Sprite bundle downloaded.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not build the bundle.", "error");
    } finally {
      setBundleBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <SelectField label="Icons to include" value={scope} onChange={(event) => setScope(event.target.value)}>
            {chosen && <option value="selected">{`Chosen icons (${chosen.length})`}</option>}
            <option value="all">All icons in the project</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${"  ".repeat(folder.depth)}${folder.name}`}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<ListChecks aria-hidden="true" className="h-4 w-4" />} onClick={() => setChoosing(true)}>
            Review / edit checklist
          </Button>
          {project.access.canAddIcons && (
            <Button icon={<FileUp aria-hidden="true" className="h-4 w-4" />} onClick={() => setImporting(true)}>
              Import a sprite
            </Button>
          )}
        </div>
      </div>

      {loaded.error && !loaded.data ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 p-6 text-center">
          <p className="font-medium text-destructive">{loaded.error.message}</p>
          <Button className="mt-3" onClick={loaded.reload}>
            Try again
          </Button>
        </div>
      ) : !built ? (
        <div aria-busy="true" aria-label="Building the sprite" className="mt-4 h-64 animate-pulse rounded-xl bg-muted" />
      ) : built.ids.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-base font-semibold">There is nothing to compile yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">{project.access.canAddIcons ? "Add icons, or import an existing sprite, and the sprite is built here." : "This project has no icons in that selection."}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm">
              <span className="font-semibold">{pluralize(built.ids.length, "symbol")}</span>
              <span className="text-muted-foreground">, {formatBytes(sizeBytes)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Copy aria-hidden="true" className="h-4 w-4" />} onClick={() => copyAndToast(built.xml, "the sprite")}>
                Copy sprite
              </Button>
              <Button icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={downloadSprite}>
                Download sprite.svg
              </Button>
              <Button variant="primary" icon={<FileArchive aria-hidden="true" className="h-4 w-4" />} onClick={downloadBundle} loading={bundleBusy}>
                Download bundle
              </Button>
            </div>
          </div>

          {built.skipped.length > 0 && (
            <p role="note" className="rounded-lg border border-amber-500/40 bg-muted px-3 py-2 text-sm">
              {pluralize(built.skipped.length, "icon")} could not be included because the SVG could not be read: {built.skipped.slice(0, 5).join(", ")}
              {built.skipped.length > 5 ? "…" : ""}
            </p>
          )}

          {demo && <iframe title="Sprite preview" srcDoc={demo} sandbox="allow-scripts" className="h-[28rem] w-full rounded-xl border border-border bg-white" />}

          <section aria-labelledby="sprite-ids">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="sprite-ids" className="text-sm font-semibold">
                Symbol ids
              </h2>
              {built.ids.length > 10 && <input type="search" aria-label="Filter symbol ids" placeholder="Filter ids" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />}
            </div>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shownIds.slice(0, MAX_LISTED_IDS).map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => copyAndToast(`<svg width="24" height="24"><use href="#${id}"></use></svg>`, `the code for ${id}`)} aria-label={`Copy code for ${id}`} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-left font-mono text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="truncate">{id}</span>
                    <Copy aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
            {shownIds.length > MAX_LISTED_IDS && <p className="mt-2 text-sm text-muted-foreground">Showing the first {MAX_LISTED_IDS} of {shownIds.length}. Use the filter to find others.</p>}
            {shownIds.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No ids match “{filter}”.</p>}
          </section>
        </div>
      )}

      <IconChecklistDialog
        open={choosing}
        mode="sprite"
        projectId={project.id}
        folders={folderList.folders}
        initialIds={scope === "selected" ? chosen : null}
        onClose={() => setChoosing(false)}
        onConfirm={(iconIds) => {
          setChoosing(false);
          setChosen(iconIds);
          setChoiceVersion((value) => value + 1);
          setScope("selected");
        }}
      />
      <ImportSpriteDialog
        open={importing}
        projectId={project.id}
        prefix={project.prefix}
        folders={folderList.folders}
        defaultFolderId={scope === "all" ? null : scope}
        onClose={() => setImporting(false)}
        onImported={(summary) => {
          if (summary.created.length + summary.replaced.length > 0) {
            refreshIcons();
            refreshFolders();
            refreshProject();
          }
        }}
      />
    </div>
  );
}
