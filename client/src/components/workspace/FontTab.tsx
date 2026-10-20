// The Font section, laid out like Icon Vault's: the actions at the top (Download font is the main action, with Copy CSS and Build font beside it), then three columns: 1. Scope selection (whole project, a folder or the chosen icons, with the icon checklist) and the target formats, 2. Font and CSS settings (name, prefix, base class, starting codepoint), 3. Font metrics and normalization. Below them the result (a summary, conversion warnings and the "Stable Unicode codepoints mapping" table with every glyph, its character (editable), CSS entity and CSS class) and the font build history. The font is built on the server; for editors, new characters are saved on the icons so rebuilding later keeps every glyph on the same character.
import { CheckSquare, Copy, Download, Hammer } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { buildFont, downloadFont } from "../../api/fonts";
import { updateIcon } from "../../api/icons";
import type { BuildFontInput, FontBuildResult, FontCodepoint, FontFormat } from "../../api/types";
import { useToast } from "../../context/ToastContext";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../../context/workspaceContext";
import { copyText } from "../../lib/clipboard";
import { clearCachedBuild, peekCachedBuild } from "../../lib/fontBuildCache";
import { defaultFontOptions } from "../../lib/fontDefaults";
import { loadPreviewFont, nextPreviewFamily, unloadPreviewFont } from "../../lib/fontPreview";
import { buildFolderTree, flattenFolderTree, totalIconCount } from "../../lib/folderTree";
import { readBuildSelection } from "../../lib/loadAllIcons";
import { formatBytes, pluralize } from "../../lib/format";
import { triggerBrowserDownload } from "../../utils/zipBundle";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Fields";
import CodepointTable from "./CodepointTable";
import FontHistory from "./FontHistory";
import IconChecklistDialog from "./IconChecklistDialog";

const FORMATS: { value: FontFormat; label: string; hint: string }[] = [
  { value: "woff2", label: "WOFF2", hint: "smallest, all modern browsers" },
  { value: "woff", label: "WOFF", hint: "older browsers" },
  { value: "ttf", label: "TTF", hint: "desktop and apps" },
  { value: "eot", label: "EOT", hint: "very old Internet Explorer" },
  { value: "svg", label: "SVG", hint: "legacy SVG font" },
];

// The small uppercase heading of one column.
const columnHeading = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export default function FontTab() {
  const { project, folderList, refreshIcons, refreshProject } = useWorkspace();
  const { showToast } = useToast();
  const canEdit = project.access.canEdit;
  const folderOptions = flattenFolderTree(buildFolderTree(folderList.folders));

  // Icons handed over by the bulk bar ("Generate font") arrive as the chosen icons; nothing is built until Build font.
  const handed = readBuildSelection(useLocation().state);
  const [chosen, setChosen] = useState<string[] | null>(handed?.iconIds ?? null);
  const [choosing, setChoosing] = useState(false);
  const [scopeKind, setScopeKind] = useState<"all" | "folder" | "selected">(handed ? "selected" : "all");
  const [folderChoice, setFolderChoice] = useState("");
  // The scope the server is asked for: "all", "selected" or a folder id.
  const scope = scopeKind === "folder" ? folderChoice : scopeKind;
  // The same starting settings the Icons screen uses when it builds a font straight from a selection.
  const [defaults] = useState(() => defaultFontOptions(project));
  const [fontName, setFontName] = useState(defaults.fontName);
  const [prefix, setPrefix] = useState(defaults.prefix);
  const [baseClass, setBaseClass] = useState(defaults.baseClass);
  // Bumped when a package was downloaded, so the build history reloads.
  const [historyVersion, setHistoryVersion] = useState(0);
  const [startCodepoint, setStartCodepoint] = useState(defaults.startCodepoint);
  const [formats, setFormats] = useState<FontFormat[]>(defaults.formats);
  const [fontHeight, setFontHeight] = useState(String(defaults.fontHeight));
  const [descent, setDescent] = useState(String(defaults.descent));
  const [normalize, setNormalize] = useState(defaults.normalize);
  const [building, setBuilding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A font that was just built on the Icons screen ("Build font" on the bulk bar) is shown at once, without building it again.
  const [result, setResult] = useState<{ build: FontBuildResult; family: string; loaded: boolean } | null>(() => (handed?.built ? peekCachedBuild(project.id) : null));
  const adopted = handed?.built === true;
  useEffect(() => {
    // The page owns the build and its preview font now.
    if (adopted) clearCachedBuild();
  }, [adopted]);
  const [filter, setFilter] = useState("");

  // Make sure the preview font of the shown build is registered (a build handed over from the Icons screen registered it there), and take it out again when the build is replaced or the section closes.
  const family = result?.family;
  const previewBase64 = result?.build.preview.base64;
  useEffect(() => {
    if (!family || !previewBase64) return undefined;
    void loadPreviewFont(family, previewBase64);
    return () => unloadPreviewFont(family);
  }, [family, previewBase64]);

  function options(override?: string[]): BuildFontInput | string {
    const picked = override ?? chosen;
    const effectiveScope = override ? "selected" : scopeKind === "folder" && !folderChoice ? "folder-empty" : scope;
    const height = Number(fontHeight);
    const down = Number(descent);
    if (!fontName.trim()) return "Enter a font name.";
    if (formats.length === 0) return "Choose at least one format.";
    if (!/^([a-zA-Z][a-zA-Z0-9_-]*)?$/.test(baseClass.trim())) return "The base class must start with a letter and use only letters, digits, - or _.";
    if (effectiveScope === "folder-empty") return "Choose a folder.";
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
      baseClass: baseClass.trim(),
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

  async function download() {
    const input = options();
    if (typeof input === "string") return setError(input);
    setDownloading(true);
    try {
      const { blob, filename } = await downloadFont(project.id, input);
      triggerBrowserDownload(blob, filename);
      // The server keeps an editor's download in the history.
      if (canEdit) setHistoryVersion((value) => value + 1);
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
  // How many icons the current choice covers, for the sentence in the Icons group.
  const folderNode = folderOptions.find((folder) => folder.id === folderChoice);
  const inScope = scopeKind === "selected" ? (chosen?.length ?? 0) : scopeKind === "all" ? project.iconCount : folderNode ? totalIconCount(folderNode) : 0;

  return (
    <div>
      <form onSubmit={build} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Icon font</h2>
            <p className="text-sm text-muted-foreground">Every icon becomes one character. Icons keep their character between builds.</p>
          </div>
          <div role="group" aria-label="Font actions" className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={download} loading={downloading}>
              Download font
            </Button>
            <Button icon={<Copy aria-hidden="true" className="h-4 w-4" />} onClick={() => built && copy(built.css, "the stylesheet")} disabled={!built}>
              Copy CSS
            </Button>
            <Button type="submit" icon={<Hammer aria-hidden="true" className="h-4 w-4" />} loading={building}>
              Build font
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {!canEdit && <p className="text-xs text-muted-foreground">You can build and download this font. The characters are not saved on the project because you cannot change it.</p>}

        <div className="grid gap-4 rounded-2xl border border-border p-4 md:grid-cols-3 md:gap-6">
          <section aria-labelledby="font-scope" className="space-y-4">
            <fieldset>
              <legend id="font-scope" className={columnHeading}>
                1. Scope selection
              </legend>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="font-scope" checked={scopeKind === "all"} onChange={() => setScopeKind("all")} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  {`Whole project (${pluralize(project.iconCount, "icon")})`}
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="font-scope" checked={scopeKind === "folder"} onChange={() => setScopeKind("folder")} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  Selected folder
                </label>
                {scopeKind === "folder" && (
                  <SelectField label="Folder" hideLabel value={folderChoice} onChange={(event) => setFolderChoice(event.target.value)}>
                    <option value="">Choose a folder…</option>
                    {folderOptions.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {`${"  ".repeat(folder.depth)}${folder.name} (${pluralize(totalIconCount(folder), "icon")})`}
                      </option>
                    ))}
                  </SelectField>
                )}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="font-scope"
                    checked={scopeKind === "selected"}
                    onChange={() => {
                      setScopeKind("selected");
                      // Nothing chosen yet: open the checklist to choose.
                      if (!chosen) setChoosing(true);
                    }}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  {`Selected icons (${chosen?.length ?? 0})`}
                </label>
              </div>
            </fieldset>

            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-1.5">
                  <CheckSquare aria-hidden="true" className="h-4 w-4 text-primary" />
                  Icon checklist
                </span>
                <span className="text-primary" aria-label={`${inScope} of ${project.iconCount} icons included`}>
                  {inScope} / {project.iconCount}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Only checked icons will be compiled into the font glyphs and CSS.</p>
              <Button className="mt-2 w-full" size="sm" onClick={() => setChoosing(true)}>
                Review / edit checklist
              </Button>
            </div>

            <fieldset>
              <legend id="font-formats" className={columnHeading}>
                Target formats
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {FORMATS.map((format) => (
                  <label key={format.value} className="cursor-pointer" title={format.hint}>
                    <input type="checkbox" checked={formats.includes(format.value)} onChange={() => toggleFormat(format.value)} className="peer sr-only" />
                    <span className="inline-flex h-9 items-center rounded-full border border-input bg-background px-4 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">{format.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="font-css" className="space-y-3">
            <h3 id="font-css" className={columnHeading}>
              2. Font &amp; CSS settings
            </h3>
            <TextField label="Font name" value={fontName} maxLength={50} autoComplete="off" onChange={(event) => setFontName(event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Class prefix" value={prefix} maxLength={20} autoComplete="off" hint="Classes look like prefix-name." onChange={(event) => setPrefix(event.target.value)} />
              <TextField label="Base class" value={baseClass} maxLength={30} autoComplete="off" hint="Optional. Then use class=&quot;base prefix-name&quot;." onChange={(event) => setBaseClass(event.target.value)} />
            </div>
            <TextField label="Starting codepoint (hex)" value={startCodepoint} maxLength={4} autoComplete="off" hint="Default: E001 (Private Use Area). New icons count up from here (E000 to F8FF)." onChange={(event) => setStartCodepoint(event.target.value)} />
          </section>

          <section aria-labelledby="font-metrics" className="space-y-3">
            <h3 id="font-metrics" className={columnHeading}>
              3. Font metrics &amp; normalization
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Font height" value={fontHeight} inputMode="numeric" autoComplete="off" hint="EM, 300 to 2048; 1000 suits most icons." onChange={(event) => setFontHeight(event.target.value)} />
              <TextField label="Descent" value={descent} inputMode="numeric" autoComplete="off" hint="How far glyphs sit below the baseline." onChange={(event) => setDescent(event.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={normalize} onChange={(event) => setNormalize(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Normalize glyph bounds to height
            </label>
          </section>
        </div>
      </form>

      {built && (
        <section aria-label="Built font" className="mt-6 space-y-4">
          <p role="status" className="text-sm">
            <span className="font-semibold">{pluralize(built.iconCount, "icon")}</span>
            <span className="text-muted-foreground">
              {" "}
              in {built.fontName}
              {Object.entries(built.sizes).length > 0 ? `: ${Object.entries(built.sizes).map(([format, size]) => `${format.toUpperCase()} ${formatBytes(size)}`).join(", ")}` : ""}
            </span>
          </p>

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

          <section aria-labelledby="font-mapping" className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 id="font-mapping" className="text-base font-semibold">
                  Stable Unicode codepoints mapping
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Each icon keeps its character when the font is rebuilt, so CSS you already published keeps working.{canEdit ? " Change a value (E000 to F8FF) and the font is rebuilt with it." : ""}</p>
              </div>
              {built.codepoints.length > 10 && <input type="search" aria-label="Filter characters" placeholder="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />}
            </div>
            <div className="mt-3">
              <CodepointTable glyphs={shown.slice(0, 300)} family={result?.loaded ? result.family : null} canEdit={canEdit} busy={building} onSave={saveCodepoint} onCopyClass={(className) => {
                  const classes = built.baseClass ? `${built.baseClass} ${className}` : className;
                  void copy(classes, `the class ${classes}`);
                }} />
            </div>
            {shown.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No characters match “{filter}”.</p>}
            {shown.length > 300 && <p className="mt-2 text-sm text-muted-foreground">Showing the first 300 of {shown.length}. Use the filter to find others.</p>}
          </section>
        </section>
      )}

      <FontHistory projectId={project.id} canEdit={canEdit} version={historyVersion} />

      <IconChecklistDialog
        open={choosing}
        mode="font"
        projectId={project.id}
        folders={folderList.folders}
        initialIds={scopeKind === "selected" ? chosen : null}
        onClose={() => setChoosing(false)}
        onConfirm={(iconIds) => {
          setChosen(iconIds);
          setScopeKind("selected");
          setChoosing(false);
          // Build with the new choice right away (the state above is not visible to this call yet).
          void runBuild(iconIds);
        }}
      />
    </div>
  );
}
