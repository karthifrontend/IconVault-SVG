// Tests for the Font section and the font import dialog: building with the chosen options, validation before sending, the preview and the character list, warnings, copy, download, permissions, errors, and importing a font (preview first, options, results).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fontsApi from "../../api/fonts";
import * as iconsApi from "../../api/icons";
import { ApiError } from "../../api/http";
import type { FontBuildResult, FontImportPreview, FontImportResult } from "../../api/types";
import { ToastProvider } from "../../context/ToastContext";
import { WorkspaceContext, type WorkspaceContextValue } from "../../context/workspaceContext";
import * as clipboard from "../../lib/clipboard";
import * as preview from "../../lib/fontPreview";
import { READ_ONLY, makeDetail, makeFolder, makeIcon } from "../../test/fixtures";
import * as zip from "../../utils/zipBundle";
import FontTab from "./FontTab";

vi.mock("../../api/fonts");
vi.mock("../../api/icons");
vi.mock("../../lib/clipboard");
vi.mock("../../utils/zipBundle", () => ({ triggerBrowserDownload: vi.fn() }));
vi.mock("../../lib/fontPreview", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../lib/fontPreview")>()), loadPreviewFont: vi.fn(), unloadPreviewFont: vi.fn() }));

const buildFont = vi.mocked(fontsApi.buildFont);
const importFont = vi.mocked(fontsApi.importFont);
const built = (over: Partial<FontBuildResult> = {}): FontBuildResult => ({
  fontName: "Feather",
  prefix: "fth",
  iconCount: 2,
  warnings: [],
  css: "@font-face { font-family: Feather; }",
  preview: { format: "woff2", base64: "d09GMg==" },
  sizes: { woff2: 1200, ttf: 3400 },
  codepoints: [
    { id: "a", name: "Home", slug: "home", codepoint: "E001", className: "fth-home", isNew: true },
    { id: "b", name: "Star", slug: "star", codepoint: "E002", className: "fth-star", isNew: false },
  ],
  ...over,
});

function setup(over: Partial<WorkspaceContextValue> = {}, state?: unknown) {
  const fns = { selectFolder: vi.fn(), refreshProject: vi.fn(), refreshFolders: vi.fn(), refreshIcons: vi.fn() };
  const value: WorkspaceContextValue = {
    project: makeDetail({ id: "p1", name: "Feather Icons", prefix: "fth", purpose: "font" }),
    folderList: { folders: [makeFolder({ id: "ui", name: "UI" })], uncategorizedCount: 0 },
    selectedFolder: "all",
    iconsVersion: 0,
    ...fns,
    ...over,
  };
  render(
    <MemoryRouter initialEntries={[{ pathname: "/projects/p1", state }]}>
      <ToastProvider>
        <WorkspaceContext.Provider value={value}>
          <FontTab />
        </WorkspaceContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return fns;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(clipboard.copyText).mockResolvedValue(true);
  vi.mocked(preview.loadPreviewFont).mockResolvedValue(true);
  buildFont.mockResolvedValue(built());
});

describe("building", () => {
  it("starts from the project's name and prefix with the usual formats", () => {
    setup();
    expect(screen.getByLabelText("Font name")).toHaveValue("FeatherIcons");
    expect(screen.getByLabelText("Class prefix")).toHaveValue("fth");
    expect(screen.getByLabelText("Starting codepoint (hex)")).toHaveValue("E001");
    expect(screen.getByLabelText("WOFF2")).toBeChecked();
    expect(screen.getByLabelText("TTF")).toBeChecked();
    expect(screen.getByLabelText("EOT")).not.toBeChecked();
  });

  it("sends the options, then shows the count, sizes and every character", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(buildFont).toHaveBeenCalledWith("p1", { scope: "all", formats: ["woff2", "woff", "ttf"], fontName: "FeatherIcons", prefix: "fth", startCodepoint: "E001", fontHeight: 1000, descent: 0, normalize: true });
    expect(await screen.findByText("2 icons")).toBeInTheDocument();
    expect(screen.getByText(/WOFF2 1\.2 KB, TTF 3\.3 KB/)).toBeInTheDocument();
    // One table lists every glyph: character, CSS entity, class. There is no second grid repeating the same icons.
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Characters" })).not.toBeInTheDocument();
    const home = screen.getByRole("button", { name: "Copy class fth-home" }).closest("tr") as HTMLElement;
    expect(within(home).getByRole("textbox", { name: "Codepoint for Home" })).toHaveValue("E001");
    expect(within(home).getByText("\\e001")).toBeInTheDocument();
    expect(within(home).getByText("new")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Copy class fth-star" }).closest("tr") as HTMLElement).queryByText("new")).not.toBeInTheDocument();
    expect(preview.loadPreviewFont).toHaveBeenCalledWith(expect.stringMatching(/^iconfont-preview-/), "d09GMg==");
  });

  it("sends a folder, other formats and advanced values as chosen", async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText("Icons to include"), "ui");
    await userEvent.clear(screen.getByLabelText("Font name"));
    await userEvent.type(screen.getByLabelText("Font name"), "Mine");
    await userEvent.click(screen.getByLabelText("WOFF"));
    await userEvent.click(screen.getByLabelText("EOT"));
    await userEvent.clear(screen.getByLabelText("Starting codepoint (hex)"));
    await userEvent.type(screen.getByLabelText("Starting codepoint (hex)"), "e100");
    await userEvent.click(screen.getByText("Advanced"));
    await userEvent.clear(screen.getByLabelText("Font height"));
    await userEvent.type(screen.getByLabelText("Font height"), "1200");
    await userEvent.click(screen.getByLabelText("Scale icons to fill the height"));
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(buildFont).toHaveBeenCalledWith("p1", { scope: "folder", folderId: "ui", formats: ["woff2", "ttf", "eot"], fontName: "Mine", prefix: "fth", startCodepoint: "E100", fontHeight: 1200, descent: 0, normalize: false });
  });

  it("checks the options before asking the server", async () => {
    setup();
    const build = () => userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await userEvent.clear(screen.getByLabelText("Font name"));
    await build();
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a font name.");
    await userEvent.type(screen.getByLabelText("Font name"), "X");
    await userEvent.clear(screen.getByLabelText("Starting codepoint (hex)"));
    await userEvent.type(screen.getByLabelText("Starting codepoint (hex)"), "zz");
    await build();
    expect(screen.getByRole("alert")).toHaveTextContent("4 hex digits");
    await userEvent.clear(screen.getByLabelText("Starting codepoint (hex)"));
    await userEvent.type(screen.getByLabelText("Starting codepoint (hex)"), "E001");
    for (const format of ["WOFF2", "WOFF", "TTF"]) await userEvent.click(screen.getByLabelText(format));
    await build();
    expect(screen.getByRole("alert")).toHaveTextContent("at least one format");
    expect(buildFont).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the build fails", async () => {
    buildFont.mockRejectedValue(new ApiError("There are no icons to put in the font.", 400));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("There are no icons to put in the font.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists conversion warnings", async () => {
    buildFont.mockResolvedValue(built({ warnings: [{ icon: "Line", message: "Uses strokes." }] }));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(await screen.findByText(/1 icon warning/)).toBeInTheDocument();
    expect(screen.getByText("Uses strokes.", { exact: false })).toBeInTheDocument();
  });

  it("says when the browser could not load the preview font", async () => {
    vi.mocked(preview.loadPreviewFont).mockResolvedValue(false);
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(await screen.findByRole("note")).toHaveTextContent("could not load the preview font");
  });

  it("refreshes the icon lists when new characters were saved, but not for a viewer", async () => {
    const fns = setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await screen.findByText("2 icons");
    expect(fns.refreshIcons).toHaveBeenCalled();
  });

  it("does not refresh anything for a read-only viewer, and explains that characters are not saved", async () => {
    const fns = setup({ project: makeDetail({ id: "p1", purpose: "font", access: READ_ONLY }) });
    expect(screen.getByText(/characters are not saved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import a font" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await screen.findByText("2 icons");
    expect(fns.refreshIcons).not.toHaveBeenCalled();
  });
});

describe("the codepoint mapping table", () => {
  const rebuilt = (codepoint: string) => built({ codepoints: [{ id: "a", name: "Home", slug: "home", codepoint, className: "fth-home", isNew: false }, { id: "b", name: "Star", slug: "star", codepoint: "E002", className: "fth-star", isNew: false }] });
  const open = async (over: Partial<WorkspaceContextValue> = {}) => {
    const fns = setup(over);
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await screen.findByRole("table", { name: "Stable Unicode codepoints mapping" });
    return fns;
  };

  it("lists every glyph of the build with its character and CSS entity", async () => {
    await open();
    const table = screen.getByRole("table", { name: "Stable Unicode codepoints mapping" });
    expect(within(table).getByRole("textbox", { name: "Codepoint for Home" })).toHaveValue("E001");
    expect(within(table).getByText("\\e001")).toBeInTheDocument();
    expect(within(table).getByText("\\e002")).toBeInTheDocument();
  });

  it("saves a new character on the icon, rebuilds with the same options, and shows the new value in the table, the grid and the stylesheet", async () => {
    vi.mocked(iconsApi.updateIcon).mockResolvedValue(makeIcon({ id: "a", codepoint: "E701" }) as never);
    const fns = await open();
    buildFont.mockClear();
    buildFont.mockResolvedValue(rebuilt("E701"));
    const home = screen.getByRole("textbox", { name: "Codepoint for Home" });
    await userEvent.clear(home);
    await userEvent.type(home, "e701{Enter}");
    await waitFor(() => expect(iconsApi.updateIcon).toHaveBeenCalledWith("a", { codepoint: "E701" }));
    await waitFor(() => expect(buildFont).toHaveBeenCalledTimes(1));
    expect(buildFont).toHaveBeenCalledWith("p1", expect.objectContaining({ fontName: "FeatherIcons", formats: ["woff2", "woff", "ttf"] }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Codepoint for Home" })).toHaveValue("E701"));
    expect(screen.getByText("\\e701")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy class fth-home" }).closest("tr")).toHaveTextContent("\\e701");
    expect(await screen.findByText("Home now uses U+E701. Rebuilding the font.")).toBeInTheDocument();
    expect(fns.refreshIcons).toHaveBeenCalled();
  });

  it("downloads and copies the rebuilt output, not the old one", async () => {
    vi.mocked(iconsApi.updateIcon).mockResolvedValue(makeIcon({ id: "a" }) as never);
    vi.mocked(fontsApi.downloadFont).mockResolvedValue({ blob: new Blob(["z"]), filename: "x.zip" });
    await open();
    buildFont.mockResolvedValue({ ...rebuilt("E701"), css: ".fth-home:before { content: \"\\e701\"; }" });
    const home = screen.getByRole("textbox", { name: "Codepoint for Home" });
    await userEvent.clear(home);
    await userEvent.type(home, "E701{Enter}");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Codepoint for Home" })).toHaveValue("E701"));
    await userEvent.click(screen.getByRole("button", { name: "Copy CSS" }));
    expect(clipboard.copyText).toHaveBeenCalledWith(expect.stringContaining("\\e701"));
    await userEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
    expect(fontsApi.downloadFont).toHaveBeenCalledTimes(1);
  });

  it("shows the server's reason beside the box when another icon already has the character, and does not rebuild", async () => {
    vi.mocked(iconsApi.updateIcon).mockRejectedValue(new ApiError('Codepoint E002 is already used by "Star".', 409));
    await open();
    buildFont.mockClear();
    const home = screen.getByRole("textbox", { name: "Codepoint for Home" });
    await userEvent.clear(home);
    await userEvent.type(home, "E002{Enter}");
    expect(await screen.findByText(/already used by "Star"/)).toBeInTheDocument();
    expect(buildFont).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Codepoint for Home" })).toHaveValue("E002");
  });

  it("does not send an invalid value to the server", async () => {
    await open();
    const home = screen.getByRole("textbox", { name: "Codepoint for Home" });
    await userEvent.clear(home);
    await userEvent.type(home, "0041{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("E000 to F8FF");
    expect(iconsApi.updateIcon).not.toHaveBeenCalled();
  });

  it("clears a character with an empty box", async () => {
    vi.mocked(iconsApi.updateIcon).mockResolvedValue(makeIcon({ id: "a" }) as never);
    await open();
    const home = screen.getByRole("textbox", { name: "Codepoint for Home" });
    await userEvent.clear(home);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(iconsApi.updateIcon).toHaveBeenCalledWith("a", { codepoint: null }));
    expect(await screen.findByText("Cleared the character of Home. Rebuilding the font.")).toBeInTheDocument();
  });

  it("is read-only for people who cannot edit the project", async () => {
    await open({ project: makeDetail({ id: "p1", purpose: "font", access: READ_ONLY }) });
    const table = screen.getByRole("table", { name: "Stable Unicode codepoints mapping" });
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(table).getByText("U+E001")).toBeInTheDocument();
  });
});

describe("the page layout", () => {
  it("puts the actions at the top, with Copy CSS beside Build font, and groups the controls in titled sections", () => {
    setup();
    const actions = screen.getByRole("group", { name: "Font actions" });
    expect(within(actions).getAllByRole("button").map((b) => b.textContent)).toEqual(["Build font", "Copy CSS", "Download ZIP", "Import a font"]);
    expect(within(actions).getByRole("button", { name: "Build font" }).className).toContain("bg-primary");
    for (const title of ["Icons", "Font settings", "Target formats"]) expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    // The actions come before the sections in the page.
    expect(actions.compareDocumentPosition(screen.getByRole("region", { name: "Icons" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has Copy CSS switched off until there is a build", async () => {
    setup();
    expect(screen.getByRole("button", { name: "Copy CSS" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await screen.findByText("2 icons");
    expect(screen.getByRole("button", { name: "Copy CSS" })).toBeEnabled();
  });

  it("says how many icons will be compiled for all, a folder or a choice", async () => {
    setup({ project: makeDetail({ id: "p1", prefix: "fth", purpose: "font", iconCount: 9 }), folderList: { folders: [makeFolder({ id: "ui", name: "UI", iconCount: 4 })], uncategorizedCount: 5 } });
    const icons = screen.getByRole("region", { name: "Icons" });
    expect(within(icons).getByText(/9 icons/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Icons to include"), "ui");
    expect(within(icons).getByText(/4 icons/)).toBeInTheDocument();
  });

  it("shows the target formats as toggle pills", async () => {
    setup();
    const group = screen.getByRole("group", { name: "Target formats" });
    expect(within(group).getAllByRole("checkbox").map((c) => c.closest("label")?.textContent)).toEqual(["WOFF2", "WOFF", "TTF", "EOT", "SVG"]);
    await userEvent.click(within(group).getByLabelText("EOT"));
    expect(within(group).getByLabelText("EOT")).toBeChecked();
  });
});

describe("chosen icons and the checklist", () => {
  const list = () => vi.mocked(iconsApi.listIcons).mockResolvedValue({ icons: [makeIcon({ id: "a", name: "Home", slug: "home" }), makeIcon({ id: "b", name: "Star", slug: "star" })], total: 2, page: 1, limit: 1000 });

  it("opens the checklist on arrival from the bulk bar, with the selected icons ticked and nothing built yet", async () => {
    list();
    setup({}, { iconIds: ["a"], openChecklist: true });
    const dialog = await screen.findByRole("dialog", { name: "Choose icons for the font" });
    await within(dialog).findByText(/icons selected for the font/);
    expect(within(dialog).getByRole("checkbox", { name: /Home/ })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: /Star/ })).not.toBeChecked();
    expect(buildFont).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Chosen icons (1)" })).toBeInTheDocument();
  });

  it("builds with the chosen icons when the checklist is confirmed", async () => {
    list();
    setup({}, { iconIds: ["a", "b"], openChecklist: true });
    const dialog = await screen.findByRole("dialog", { name: "Choose icons for the font" });
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: /Star/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Generate font (1 icon)" }));
    await waitFor(() => expect(buildFont).toHaveBeenCalledWith("p1", expect.objectContaining({ scope: "selected", iconIds: ["a"] })));
    expect(await screen.findByText("2 icons")).toBeInTheDocument();
    expect(buildFont).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the chosen icons on the page when the checklist is cancelled, and builds only when asked", async () => {
    list();
    setup({}, { iconIds: ["a", "b"], openChecklist: true });
    await userEvent.click(await within(await screen.findByRole("dialog")).findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(buildFont).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Icons to include")).toHaveValue("selected");
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    expect(buildFont).toHaveBeenCalledWith("p1", expect.objectContaining({ scope: "selected", iconIds: ["a", "b"] }));
  });

  it("does not open the checklist when the icons were handed over without the flag, or when nothing was", () => {
    setup({}, { iconIds: ["a"] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chosen icons (1)" })).toBeInTheDocument();
  });

  it("opens the checklist from Review / edit checklist and builds with the new choice at once", async () => {
    list();
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Review / edit checklist" }));
    const dialog = screen.getByRole("dialog", { name: "Choose icons for the font" });
    await within(dialog).findByText(/icons selected for the font/);
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Star/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Generate font (1 icon)" }));
    await waitFor(() => expect(buildFont).toHaveBeenCalledWith("p1", expect.objectContaining({ scope: "selected", iconIds: ["a"] })));
    expect(screen.getByLabelText("Icons to include")).toHaveValue("selected");
  });

  it("has no Chosen option until something is chosen", () => {
    setup();
    expect(screen.queryByRole("option", { name: /Chosen icons/ })).not.toBeInTheDocument();
  });
});

describe("the built font", () => {
  async function open() {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await screen.findByText("2 icons");
  }

  it("copies the stylesheet and a class", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Copy CSS" }));
    expect(clipboard.copyText).toHaveBeenCalledWith("@font-face { font-family: Feather; }");
    await userEvent.click(screen.getByRole("button", { name: "Copy class fth-star" }));
    expect(clipboard.copyText).toHaveBeenLastCalledWith("fth-star");
    expect(await screen.findByText("Copied the class fth-star.")).toBeInTheDocument();
  });

  it("downloads the ZIP with the same options", async () => {
    const blob = new Blob(["z"]);
    vi.mocked(fontsApi.downloadFont).mockResolvedValue({ blob, filename: "FeatherIcons-font.zip" });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
    expect(fontsApi.downloadFont).toHaveBeenCalledWith("p1", expect.objectContaining({ fontName: "FeatherIcons", formats: ["woff2", "woff", "ttf"] }));
    await waitFor(() => expect(zip.triggerBrowserDownload).toHaveBeenCalledWith(blob, "FeatherIcons-font.zip"));
  });

  it("reports a failed download", async () => {
    vi.mocked(fontsApi.downloadFont).mockRejectedValue(new ApiError("Project not found.", 404));
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
    expect(await screen.findByText("Project not found.")).toBeInTheDocument();
  });

  it("filters a long list of characters", async () => {
    buildFont.mockResolvedValue(built({ codepoints: Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, name: `N${i}`, slug: `n${i}`, codepoint: (0xe001 + i).toString(16).toUpperCase(), className: `fth-n${i}`, isNew: false })), iconCount: 12 }));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await userEvent.type(await screen.findByLabelText("Filter characters"), "n11");
    expect(screen.getAllByRole("button", { name: /^Copy class/ })).toHaveLength(1);
    await userEvent.clear(screen.getByLabelText("Filter characters"));
    await userEvent.type(screen.getByLabelText("Filter characters"), "zzz");
    expect(screen.getByText("No characters match “zzz”.")).toBeInTheDocument();
  });

  it("takes the old preview font out of the page when a new build replaces it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Build font" }));
    await waitFor(() => expect(preview.unloadPreviewFont).toHaveBeenCalled());
  });
});

describe("importing a font", () => {
  const dry = (over: Partial<FontImportPreview> = {}): FontImportPreview => ({ dryRun: true, kind: "truetype", total: 40, importable: 12, truncated: false, limit: 2000, sample: [{ name: "home", codepoint: "E001" }, { name: "star", codepoint: "E002" }], ...over });
  const final = (over: Partial<FontImportResult> = {}): FontImportResult => ({ ...dry({ dryRun: false }), created: [makeIcon({ id: "n1" }), makeIcon({ id: "n2" })], replaced: [], skipped: [], errors: [], codepointsKept: 2, codepointsDropped: 0, ...over });

  async function open(file: File | null = new File(["font"], "icons.ttf", { type: "font/ttf" })) {
    const fns = setup();
    await userEvent.click(screen.getByRole("button", { name: "Import a font" }));
    const dialog = screen.getByRole("dialog", { name: "Import a font" });
    if (file) fireEvent.change(within(dialog).getByLabelText("Font file"), { target: { files: [file] } });
    return { fns, dialog };
  }

  it("asks the server what the font holds before importing anything", async () => {
    importFont.mockResolvedValue(dry());
    const { dialog } = await open();
    expect(await within(dialog).findByText(/has 40 glyphs/)).toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent(/12 icons will be imported, for example home, star/);
    expect(importFont).toHaveBeenCalledWith("p1", expect.any(File), null, { dryRun: true, privateUseOnly: true });
    expect(within(dialog).getByRole("button", { name: "Import 12 icons" })).toBeEnabled();
  });

  it("asks again when the names file or the Private Use choice changes", async () => {
    importFont.mockResolvedValue(dry());
    const { dialog } = await open();
    await within(dialog).findByText(/has 40 glyphs/);
    const map = new File([".icon-a:before{}"], "map.css", { type: "text/css" });
    fireEvent.change(within(dialog).getByLabelText("Names (optional)"), { target: { files: [map] } });
    await waitFor(() => expect(importFont).toHaveBeenLastCalledWith("p1", expect.any(File), map, { dryRun: true, privateUseOnly: true }));
    await userEvent.click(within(dialog).getByLabelText(/Only icon characters/));
    await waitFor(() => expect(importFont).toHaveBeenLastCalledWith("p1", expect.any(File), map, { dryRun: true, privateUseOnly: false }));
  });

  it("imports with the chosen folder and options, then shows the result and refreshes", async () => {
    importFont.mockResolvedValueOnce(dry()).mockResolvedValueOnce(final());
    const { fns, dialog } = await open();
    await within(dialog).findByText(/has 40 glyphs/);
    await userEvent.selectOptions(within(dialog).getByLabelText("Folder"), "ui");
    await userEvent.selectOptions(within(dialog).getByLabelText("If an icon with that name exists"), "skip");
    await userEvent.click(within(dialog).getByLabelText("Optimize to make the icons smaller"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 12 icons" }));
    expect(await within(dialog).findByText("Imported 2 icons.")).toBeInTheDocument();
    expect(importFont).toHaveBeenLastCalledWith("p1", expect.any(File), null, { folderId: "ui", strategy: "skip", optimize: false, privateUseOnly: true });
    expect(within(dialog).getByText(/2 characters kept/)).toBeInTheDocument();
    expect(fns.refreshIcons).toHaveBeenCalled();
    expect(fns.refreshFolders).toHaveBeenCalled();
    expect(fns.refreshProject).toHaveBeenCalled();
  });

  it("lists glyphs that could not be imported and characters that were not kept", async () => {
    importFont.mockResolvedValueOnce(dry()).mockResolvedValueOnce(final({ codepointsDropped: 1, errors: [{ file: "bad", message: "Contains a script." }], skipped: [{ name: "star", reason: "Exists" }] }));
    const { dialog } = await open();
    await within(dialog).findByText(/has 40 glyphs/);
    await userEvent.click(within(dialog).getByRole("button", { name: /Import 12 icons/ }));
    expect(await within(dialog).findByText(/1 character already used here and not kept/)).toBeInTheDocument();
    expect(within(dialog).getByText("Contains a script.")).toBeInTheDocument();
    expect(within(dialog).getByText("1 icon skipped.")).toBeInTheDocument();
  });

  it("shows the reason for a file that is not a font, and cannot import it", async () => {
    importFont.mockRejectedValue(new ApiError("That is not a font file this tool can read.", 400));
    const { dialog } = await open(new File(["zip"], "pack.zip"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("not a font file");
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("keeps the dialog open with the reason when the import itself fails", async () => {
    importFont.mockResolvedValueOnce(dry()).mockRejectedValueOnce(new ApiError("You can only change projects you own.", 403));
    const { dialog, fns } = await open();
    await within(dialog).findByText(/has 40 glyphs/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 12 icons" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("only change projects you own");
    expect(fns.refreshIcons).not.toHaveBeenCalled();
  });

  it("mentions when a font was cut off at the limit", async () => {
    importFont.mockResolvedValue(dry({ truncated: true, limit: 2000 }));
    const { dialog } = await open();
    expect(await within(dialog).findByText(/Only the first 2000 are read/)).toBeInTheDocument();
  });
});
