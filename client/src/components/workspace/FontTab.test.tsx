// Tests for the Font section and the font import dialog: building with the chosen options, validation before sending, the preview and the character list, warnings, copy, download, permissions, errors, and importing a font (preview first, options, results).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fontsApi from "../../api/fonts";
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

function setup(over: Partial<WorkspaceContextValue> = {}) {
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
    <ToastProvider>
      <WorkspaceContext.Provider value={value}>
        <FontTab />
      </WorkspaceContext.Provider>
    </ToastProvider>,
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
    expect(screen.getByLabelText("First character")).toHaveValue("E001");
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
    const home = screen.getByRole("button", { name: "Copy class fth-home" });
    expect(within(home).getByText("E001")).toBeInTheDocument();
    expect(within(home).getByText("new")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Copy class fth-star" })).queryByText("new")).not.toBeInTheDocument();
    expect(preview.loadPreviewFont).toHaveBeenCalledWith(expect.stringMatching(/^iconfont-preview-/), "d09GMg==");
  });

  it("sends a folder, other formats and advanced values as chosen", async () => {
    setup();
    await userEvent.selectOptions(screen.getByLabelText("Icons to include"), "ui");
    await userEvent.clear(screen.getByLabelText("Font name"));
    await userEvent.type(screen.getByLabelText("Font name"), "Mine");
    await userEvent.click(screen.getByLabelText("WOFF"));
    await userEvent.click(screen.getByLabelText("EOT"));
    await userEvent.clear(screen.getByLabelText("First character"));
    await userEvent.type(screen.getByLabelText("First character"), "e100");
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
    await userEvent.clear(screen.getByLabelText("First character"));
    await userEvent.type(screen.getByLabelText("First character"), "zz");
    await build();
    expect(screen.getByRole("alert")).toHaveTextContent("4 hex digits");
    await userEvent.clear(screen.getByLabelText("First character"));
    await userEvent.type(screen.getByLabelText("First character"), "E001");
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
    expect(screen.queryByRole("button", { name: "Download ZIP" })).not.toBeInTheDocument();
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
