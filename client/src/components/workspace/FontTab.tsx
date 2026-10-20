// The Font section: builds an icon font from the project's icons (all, or one folder with its subfolders) on the server, shows a live preview of every glyph with its class and character, lists conversion warnings, and downloads a ZIP with the font files, stylesheet, SCSS, glyph map and a specimen page. New characters are saved on the icons for editors, so rebuilding later keeps every glyph on the same character. Editors can also import an existing font.
import { Copy, Download, FileUp, Hammer, ListChecks } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { buildFont, downloadFont } from "../../api/fonts";
import { updateIcon } from "../../api/icons";
import type { BuildFontInput, FontBuildResult, FontCodepoint, FontFormat } from "../../api/types";
import { useToast } from "../../context/ToastContext";
import { useWorkspace } from "../../context/workspaceContext";
import { copyText } from "../../lib/clipboard";
import { buildFolderTree, flattenFolderTree } from "../../lib/folderTree";
import { formatBytes, pluralize } from "../../lib/format";
import { readBuildSelection } from "../../lib/loadAllIcons";
import { glyphChar, loadPreviewFont, nextPreviewFamily, unloadPreviewFont } from "../../lib/fontPreview";
import { triggerBrowserDownload } from "../../utils/zipBundle";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Fields";
import CodepointTable from "./CodepointTable";
import IconChecklistDialog from "./IconChecklistDialog";
import ImportFontDialog from "./ImportFontDialog";

const FORMATS: { value: FontFormat; label: string; hint: string }[] = [
  { value: "woff2", label: "WOFF2", hint: "smallest, all modern browsers" },
  { value: "woff", label: "WOFF", hint: "older browsers" },
  { value: "ttf", label: "TTF", hint: "desktop and apps" },
  { value: "eot", label: "EOT", hint: "very old Internet Explorer" },
  { value: "svg", label: "SVG font", hint: "legacy" },
];

export default function FontTab() {
  const { project, folderList, refreshIcons, refreshFolders, refreshProject } = useWorkspace();
  const { showToast } = useToast();
  const canEdit = project.access.canEdit;
  const folderOptions = flattenFolderTree(buildFolderTree(folderList.folders));

  // Icons chosen in the checklist (from the bulk bar on the Icons screen, or here) are carried in the address.
  const location = useLocation();
  const handed = readBuildSelection(location.state);
  const [chosen, setChosen] = useState<string[] | null>(handed?.iconIds ?? null);
  const [choosing, setChoosing] = useState(false);
  const [scope, setScope] = useState(handed ? "selected" : "all");
  const [buildOnOpen] = useState(handed?.autoBuild === true);
  const [fontName, setFontName] = useState(() => project.name.replace(/[^a-zA-Z0-9_-]/g, "") || "IconFont");
  const [prefix, setPrefix] = useState(project.prefix || "icon");
  const [startCodepoint, setStartCodepoint] = useState("E001");
  const [formats, setFormats] = useState<FontFormat[]>(["woff2", "woff", "ttf"]);
  const [fontHeight, setFontHeight] = useState("1000");
  const [descent, setDescent] = useState("0");
  const [normalize, setNormalize] = useState(true);
  const [building, setBuilding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ build: FontBuildResult; family: string; loaded: boolean } | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState(false);

  // Take the preview font out of the page again when it is replaced or the section closes.
  useEffect(() => {
    const family = result?.family;
    return () => {
      if (family) unloadPreviewFont(family);
    };
  }, [result?.family]);

  function options(override?: string[]): BuildFontInput | string {
    const picked = override ?? chosen;
    const effectiveScope = override ? "selected" : scope;
    const height = Number(fontHeight);
    const down = Number(descent);
    if (!fontName.trim()) return "Enter a font name.";
    if (formats.length === 0) return "Choose at least one format.";
    if (!/^[0-9a-fA-F]{4}$/.test(startCodepoint.trim())) return "The first character must be 4 hex digits, for example E001.";
    if (!Number.isInteger(height) || height < 300 || height > 2048) return "Font height must be a whole number from 300 to 2048.";
    if (!Number.isInteger(down) || down < -1000 || down > 1000) return "Descent must be a whole number from -1000 to 1000.";
    if (effectiveScope === "selected" && (!picked || picked.length === 0)) return "Choose at least one icon.";
    if (effectiveScope === "selected" && picked && picked.length > 1000) return "A font can hold 1000 icons at most. Choose fewer.";
    return {
      scope: effectiveScope === "all" ? "all" : effectiveScope === "selected" ? "selected" : "folder",
      ...(effectiveScope === "all" ? {} : effectiveScope === "selected" ? { iconIds: picked as string[] } : { folderId: effectiveScope }),
      formats,
      fontName: fontName.trim(),
      prefix: prefix.trim(),
      startCodepoint: startCodepoint.trim().toUpperCase(),
      fontHeight: height,
      descent: down,
      normalize,
    };
  }

  async function runBuild(override?: string[]) {
    const input = options(override);
    if (typeof input === "string") return setError(input);
    setBuilding(true);
    setError(null);
    try {
      const built = await buildFont(project.id, input);
      const family = nextPreviewFamily();
      const loaded = await loadPreviewFont(family, built.preview.base64);
      setResult({ build: built, family, loaded });
      setFilter("");
      // New characters were saved on the icons: show them in the other lists too.
      if (canEdit && built.codepoints.some((glyph) => glyph.isNew)) {
        refreshIcons();
        refreshProject();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the font.");
    } finally {
      setBuilding(false);
    }
  }

  function build(event: FormEvent) {
    event.preventDefault();
    void runBuild();
  }

  // Arriving from the checklist ("Generate font") builds straight away, once: the form submits itself the first time it appears, which goes through the same handler as the Build font button.
  const autoStarted = useRef(false);
  const formRef = (node: HTMLFormElement | null) => {
    if (node && buildOnOpen && !autoStarted.current) {
      autoStarted.current = true;
      queueMicrotask(() => node.requestSubmit());
    }
  };

  async function download() {
    const input = options();
    if (typeof input === "string") return setError(input);
    setDownloading(true);
    try {
      const { blob, filename } = await downloadFont(project.id, input);
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not download the font.", "error");
    } finally {
      setDownloading(false);
    }
  }

  // Saves a new character on the icon, then rebuilds with the same options so the preview, the stylesheet and the download all use it. Rejects with the server's reason (for example that another icon has that character) so the table can show it next to the box.
  async function saveCodepoint(glyph: FontCodepoint, codepoint: string | null) {
    await updateIcon(glyph.id, { codepoint });
    refreshIcons();
    showToast(codepoint ? `${glyph.name} now uses U+${codepoint}. Rebuilding the font.` : `Cleared the character of ${glyph.name}. Rebuilding the font.`, "success");
    await runBuild();
  }

  async function copy(text: string, what: string) {
    const ok = await copyText(text);
    showToast(ok ? `Copied ${what}.` : "Could not copy to the clipboard.", ok ? "success" : "error");
  }

  const toggleFormat = (format: FontFormat) => setFormats((current) => (current.includes(format) ? current.filter((f) => f !== format) : [...current, format]));
  const built = result?.build;
  const shown = built ? built.codepoints.filter((glyph) => `${glyph.name} ${glyph.className} ${glyph.codepoint}`.toLowerCase().includes(filter.trim().toLowerCase())) : [];

  return (
    <div>
      <form ref={formRef} onSubmit={build} className="rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Icon font</h2>
            <p className="text-sm text-muted-foreground">Every icon becomes one character. Icons keep their character between builds.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<ListChecks aria-hidden="true" className="h-4 w-4" />} onClick={() => setChoosing(true)}>
              Choose icons
            </Button>
            {canEdit && (
              <Button icon={<FileUp aria-hidden="true" className="h-4 w-4" />} onClick={() => setImporting(true)}>
                Import a font
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Icons to include" value={scope} onChange={(event) => setScope(event.target.value)}>
            {chosen && <option value="selected">{`Chosen icons (${chosen.length})`}</option>}
            <option value="all">All icons in the project</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${"  ".repeat(folder.depth)}${folder.name}`}
              </option>
            ))}
          </SelectField>
          <TextField label="Font name" value={fontName} maxLength={50} autoComplete="off" onChange={(event) => setFontName(event.target.value)} />
          <TextField label="Class prefix" value={prefix} maxLength={20} autoComplete="off" hint="Classes look like prefix-name." onChange={(event) => setPrefix(event.target.value)} />
          <TextField label="First character" value={startCodepoint} maxLength={4} autoComplete="off" hint="New icons count up from here (E000 to F8FF)." onChange={(event) => setStartCodepoint(event.target.value)} />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Formats</legend>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
            {FORMATS.map((format) => (
              <label key={format.value} className="flex cursor-pointer items-center gap-2 text-sm" title={format.hint}>
                <input type="checkbox" checked={formats.includes(format.value)} onChange={() => toggleFormat(format.value)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                {format.label}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Advanced</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <TextField label="Font height" value={fontHeight} inputMode="numeric" autoComplete="off" hint="300 to 2048; 1000 suits most icons." onChange={(event) => setFontHeight(event.target.value)} />
            <TextField label="Descent" value={descent} inputMode="numeric" autoComplete="off" hint="How far glyphs sit below the baseline." onChange={(event) => setDescent(event.target.value)} />
            <label className="flex cursor-pointer items-center gap-2 self-center text-sm">
              <input type="checkbox" checked={normalize} onChange={(event) => setNormalize(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Scale icons to fill the height
            </label>
          </div>
        </details>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" variant="primary" icon={<Hammer aria-hidden="true" className="h-4 w-4" />} loading={building}>
            Build font
          </Button>
          {built && (
            <Button icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={download} loading={downloading}>
              Download ZIP
            </Button>
          )}
        </div>
        {!canEdit && <p className="mt-2 text-xs text-muted-foreground">You can build and download this font. The characters are not saved on the project because you cannot change it.</p>}
      </form>

      {built && (
        <section aria-label="Built font" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm">
              <span className="font-semibold">{pluralize(built.iconCount, "icon")}</span>
              <span className="text-muted-foreground">
                {" "}
                in {built.fontName}
                {Object.entries(built.sizes).length > 0 ? `: ${Object.entries(built.sizes).map(([format, size]) => `${format.toUpperCase()} ${formatBytes(size)}`).join(", ")}` : ""}
              </span>
            </p>
            <Button icon={<Copy aria-hidden="true" className="h-4 w-4" />} onClick={() => copy(built.css, "the stylesheet")}>
              Copy CSS
            </Button>
          </div>

          {built.warnings.length > 0 && (
            <details className="rounded-lg border border-amber-500/40 bg-muted px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">{pluralize(built.warnings.length, "icon warning")}: some icons may not convert cleanly</summary>
              <ul className="mt-2 space-y-1">
                {built.warnings.map((warning, index) => (
                  <li key={`${warning.icon}-${index}`}>
                    <span className="font-medium">{warning.icon}:</span> {warning.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!result?.loaded && (
            <p role="note" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Your browser could not load the preview font, so only the names and characters are shown. The download is not affected.
            </p>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Characters</h3>
              {built.codepoints.length > 10 && <input type="search" aria-label="Filter characters" placeholder="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />}
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {shown.slice(0, 300).map((glyph) => (
                <li key={glyph.id} className="rounded-xl border border-border">
                  <button type="button" onClick={() => copy(glyph.className, `the class ${glyph.className}`)} aria-label={`Copy class ${glyph.className}`} className="flex w-full flex-col items-center gap-1 rounded-t-xl p-3 pb-1 text-center hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                    <span aria-hidden="true" className="flex h-10 items-center text-3xl leading-none" style={result?.loaded ? { fontFamily: `"${result.family}"` } : undefined}>
                      {result?.loaded ? glyphChar(glyph.codepoint) : "▢"}
                    </span>
                    <span className="w-full truncate text-xs font-medium">{glyph.className}</span>
                  </button>
                  {/* Outside the button so its visible text matches its accessible name. */}
                  <p className="px-3 pb-3 text-center font-mono text-[11px] text-muted-foreground">
                    {glyph.codepoint}
                    {glyph.isNew && <span className="ml-1 rounded bg-primary/10 px-1 text-primary">new</span>}
                  </p>
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No characters match “{filter}”.</p>}
            {shown.length > 300 && <p className="mt-2 text-sm text-muted-foreground">Showing the first 300 of {shown.length}. Use the filter to find others.</p>}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Stable Unicode codepoints mapping</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Each icon keeps its character when the font is rebuilt, so CSS you already published keeps working.{canEdit ? " Change a value (E000 to F8FF) and the font is rebuilt with it." : ""}</p>
            <div className="mt-2">
              <CodepointTable glyphs={shown.slice(0, 300)} family={result?.loaded ? result.family : null} canEdit={canEdit} busy={building} onSave={saveCodepoint} />
            </div>
          </div>
        </section>
      )}

      <IconChecklistDialog
        open={choosing}
        mode="font"
        projectId={project.id}
        folders={folderList.folders}
        initialIds={scope === "selected" ? chosen : null}
        onClose={() => setChoosing(false)}
        onConfirm={(iconIds) => {
          setChosen(iconIds);
          setScope("selected");
          setChoosing(false);
          // Build with the new choice right away (the state above is not visible to this call yet).
          void runBuild(iconIds);
        }}
      />
      <ImportFontDialog
        open={importing}
        projectId={project.id}
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
