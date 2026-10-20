// Tests for the Sprite section and the sprite import dialog: building from the project's icons, scopes, preview, copy and downloads, the symbol id list, read-only behaviour, errors, and importing a sprite file.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/http";
import * as iconsApi from "../../api/icons";
import { ToastProvider } from "../../context/ToastContext";
import { WorkspaceContext, type WorkspaceContextValue } from "../../context/workspaceContext";
import * as clipboard from "../../lib/clipboard";
import { buildSprite } from "../../lib/spriteBuild";
import { READ_ONLY, makeDetail, makeFolder, makeIcon } from "../../test/fixtures";
import { renderSpritePreviewPng } from "../../utils/previewPng";
import * as zip from "../../utils/zipBundle";
import SpriteTab from "./SpriteTab";

vi.mock("../../api/icons");
vi.mock("../../lib/clipboard");
vi.mock("../../utils/previewPng", () => ({ renderSpritePreviewPng: vi.fn() }));
vi.mock("../../utils/zipBundle", () => ({ createZip: vi.fn(() => new Blob(["zip"])), triggerBrowserDownload: vi.fn() }));

const listIcons = vi.mocked(iconsApi.listIcons);
const SVG = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">${body}</svg>`;
const icon = (slug: string, name = slug) => ({ ...makeIcon({ id: slug, name, slug }), svg: SVG("<path d='M1 1'/>") });
const reply = (icons: ReturnType<typeof icon>[], total = icons.length) => ({ icons, total, page: 1, limit: 1000 });

function setup(over: Partial<WorkspaceContextValue> = {}, state?: unknown) {
  const fns = { selectFolder: vi.fn(), refreshProject: vi.fn(), refreshFolders: vi.fn(), refreshIcons: vi.fn() };
  const value: WorkspaceContextValue = {
    project: makeDetail({ id: "p1", prefix: "fth", iconCount: 2 }),
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
          <SpriteTab />
        </WorkspaceContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return fns;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(clipboard.copyText).mockResolvedValue(true);
  vi.mocked(zip.createZip).mockReturnValue(new Blob(["zip"]));
  vi.mocked(renderSpritePreviewPng).mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(3) } as Blob);
  listIcons.mockResolvedValue(reply([icon("home"), icon("star")]));
});

describe("building the sprite", () => {
  it("shows a busy state, then the symbol count and size", async () => {
    setup();
    expect(screen.getByLabelText("Building the sprite")).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("2 symbols")).toBeInTheDocument();
    expect(listIcons).toHaveBeenCalledWith("p1", { sort: "name", limit: 1000, page: 1 });
  });

  it("previews the sprite in a sandboxed frame", async () => {
    setup();
    const frame = await screen.findByTitle("Sprite preview");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("fth-home");
  });

  it("asks for a folder and its subfolders when one is chosen", async () => {
    setup();
    await screen.findByText("2 symbols");
    await userEvent.selectOptions(screen.getByLabelText("Icons to include"), "ui");
    await waitFor(() => expect(listIcons).toHaveBeenLastCalledWith("p1", { sort: "name", limit: 1000, page: 1, folderId: "ui", includeSubfolders: true }));
  });

  it("fetches every page when the project has more than 1000 icons", async () => {
    const first = Array.from({ length: 2 }, (_, i) => icon(`a${i}`));
    listIcons.mockResolvedValueOnce({ icons: first, total: 3, page: 1, limit: 1000 }).mockResolvedValueOnce({ icons: [icon("b0")], total: 3, page: 2, limit: 1000 });
    setup();
    expect(await screen.findByText("3 symbols")).toBeInTheDocument();
    expect(listIcons).toHaveBeenNthCalledWith(2, "p1", { sort: "name", limit: 1000, page: 2 });
  });

  it("says there is nothing to compile for an empty project", async () => {
    listIcons.mockResolvedValue(reply([]));
    setup();
    expect(await screen.findByText("There is nothing to compile yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download bundle" })).not.toBeInTheDocument();
  });

  it("notes icons whose SVG could not be read", async () => {
    listIcons.mockResolvedValue(reply([icon("home"), { ...icon("bad", "Broken"), svg: "nope" }]));
    setup();
    expect(await screen.findByRole("note")).toHaveTextContent("1 icon could not be included");
    expect(screen.getByText("1 symbol")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    listIcons.mockRejectedValueOnce(new ApiError("Could not reach the server."));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("2 symbols")).toBeInTheDocument();
  });
});

describe("chosen icons", () => {
  const four = () => [icon("home"), icon("star"), icon("dot"), icon("box")];

  it("builds only the icons handed over by the checklist, and says how many were chosen", async () => {
    listIcons.mockResolvedValue(reply(four()));
    setup({}, { iconIds: ["home", "box"], autoBuild: true });
    expect(await screen.findByText("2 symbols")).toBeInTheDocument();
    expect(screen.getByLabelText("Icons to include")).toHaveValue("selected");
    expect(screen.getByRole("option", { name: "Chosen icons (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code for fth-home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code for fth-box" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy code for fth-star" })).not.toBeInTheDocument();
  });

  it("goes back to everything when All icons is chosen again", async () => {
    listIcons.mockResolvedValue(reply(four()));
    setup({}, { iconIds: ["home"] });
    await screen.findByText("1 symbol");
    await userEvent.selectOptions(screen.getByLabelText("Icons to include"), "all");
    expect(await screen.findByText("4 symbols")).toBeInTheDocument();
  });

  it("has no Chosen option when nothing was handed over, and ignores a damaged hand-over", async () => {
    setup({}, { iconIds: "nope" });
    expect(await screen.findByText("2 symbols")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Chosen icons/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Icons to include")).toHaveValue("all");
  });

  it("opens the checklist from Choose icons and builds with the new choice", async () => {
    listIcons.mockResolvedValue(reply(four()));
    setup();
    await screen.findByText("4 symbols");
    await userEvent.click(screen.getByRole("button", { name: "Choose icons" }));
    const dialog = screen.getByRole("dialog", { name: "Choose icons for the sprite" });
    await within(dialog).findByText(/icons selected for the sprite/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Deselect all" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /home/i }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Generate sprite (1 icon)" }));
    expect(await screen.findByText("1 symbol")).toBeInTheDocument();
    expect(screen.getByLabelText("Icons to include")).toHaveValue("selected");
    expect(screen.getByRole("option", { name: "Chosen icons (1)" })).toBeInTheDocument();
  });

  it("offers Choose icons to read-only viewers", async () => {
    setup({ project: makeDetail({ id: "p1", prefix: "fth", access: READ_ONLY }) });
    await screen.findByText("2 symbols");
    expect(screen.getByRole("button", { name: "Choose icons" })).toBeInTheDocument();
  });
});

describe("copy and download", () => {
  it("copies the sprite", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Copy sprite" }));
    expect(clipboard.copyText).toHaveBeenCalledWith(expect.stringContaining('<symbol id="fth-home"'));
    expect(await screen.findByText("Copied the sprite.")).toBeInTheDocument();
  });

  it("says when the clipboard is not available", async () => {
    vi.mocked(clipboard.copyText).mockResolvedValue(false);
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Copy sprite" }));
    expect(await screen.findByText("Could not copy to the clipboard.")).toBeInTheDocument();
  });

  it("downloads the sprite file named after the prefix", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Download sprite.svg" }));
    expect(zip.triggerBrowserDownload).toHaveBeenCalledWith(expect.any(Blob), "fth.svg");
  });

  it("downloads a bundle with the sprite, demo page, grid sprite and preview image", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Download bundle" }));
    await waitFor(() => expect(zip.triggerBrowserDownload).toHaveBeenCalledWith(expect.any(Blob), "fth-bundle.zip"));
    const entries = vi.mocked(zip.createZip).mock.calls[0]![0];
    expect(entries.map((entry) => entry.name)).toEqual(["fth.svg", "demo.html", "fth-grid.svg", "preview.png"]);
    expect(await screen.findByText("Sprite bundle downloaded.")).toBeInTheDocument();
  });

  it("copies the code for one symbol", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Copy code for fth-star" }));
    expect(clipboard.copyText).toHaveBeenCalledWith('<svg width="24" height="24"><use href="#fth-star"></use></svg>');
  });

  it("filters a long id list", async () => {
    listIcons.mockResolvedValue(reply(Array.from({ length: 12 }, (_, i) => icon(`icon${i}`))));
    setup();
    await userEvent.type(await screen.findByLabelText("Filter symbol ids"), "icon11");
    expect(screen.getAllByRole("button", { name: /^Copy code for/ })).toHaveLength(1);
    await userEvent.clear(screen.getByLabelText("Filter symbol ids"));
    await userEvent.type(screen.getByLabelText("Filter symbol ids"), "zzz");
    expect(screen.getByText("No ids match “zzz”.")).toBeInTheDocument();
  });

  it("matches the symbol ids the sprite really contains", async () => {
    setup();
    await screen.findByText("2 symbols");
    const expected = buildSprite([icon("home"), icon("star")], "fth").ids;
    for (const id of expected) expect(screen.getByRole("button", { name: `Copy code for ${id}` })).toBeInTheDocument();
  });
});

describe("read-only viewers", () => {
  it("can build and download but not import", async () => {
    setup({ project: makeDetail({ id: "p1", prefix: "fth", access: READ_ONLY }) });
    expect(await screen.findByText("2 symbols")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download bundle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import a sprite" })).not.toBeInTheDocument();
  });
});

describe("importing a sprite", () => {
  const spriteText = buildSprite([icon("home"), icon("star")], "fth").xml;
  const summary = (over: Partial<Awaited<ReturnType<typeof iconsApi.uploadIcons>>> = {}) => ({ created: [makeIcon({ id: "n1" }), makeIcon({ id: "n2" })], replaced: [], skipped: [], errors: [], foldersCreated: 0, ...over });

  async function open(file: File | null = new File([spriteText], "my-sprite.svg", { type: "image/svg+xml" })) {
    const fns = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Import a sprite" }));
    const dialog = screen.getByRole("dialog", { name: "Import a sprite" });
    if (file) fireEvent.change(within(dialog).getByLabelText("Sprite file"), { target: { files: [file] } });
    return { fns, dialog };
  }

  it("reads the symbols and imports each as an icon, then refreshes", async () => {
    vi.mocked(iconsApi.uploadIcons).mockResolvedValue(summary());
    const { fns, dialog } = await open();
    expect(await within(dialog).findByText(/holds 2 symbols/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 2 icons" }));
    expect(await within(dialog).findByText("Imported 2 icons.")).toBeInTheDocument();
    const [projectId, files, options] = vi.mocked(iconsApi.uploadIcons).mock.calls[0]!;
    expect(projectId).toBe("p1");
    expect(files.map((file) => file.name)).toEqual(["home.svg", "star.svg"]);
    expect(options).toEqual({ folderId: null, strategy: "rename", optimize: true });
    expect(fns.refreshIcons).toHaveBeenCalled();
    expect(fns.refreshProject).toHaveBeenCalled();
  });

  it("sends the chosen folder and clash handling", async () => {
    vi.mocked(iconsApi.uploadIcons).mockResolvedValue(summary());
    const { dialog } = await open();
    await within(dialog).findByText(/holds 2 symbols/);
    await userEvent.selectOptions(within(dialog).getByLabelText("Folder"), "ui");
    await userEvent.selectOptions(within(dialog).getByLabelText("If an icon with that name exists"), "replace");
    await userEvent.click(within(dialog).getByLabelText("Optimize to make the icons smaller"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 2 icons" }));
    await within(dialog).findByText("Imported 2 icons.");
    expect(vi.mocked(iconsApi.uploadIcons).mock.calls[0]![2]).toEqual({ folderId: "ui", strategy: "replace", optimize: false });
  });

  it("explains a file that is not a sprite", async () => {
    const { dialog } = await open(new File([SVG("<path/>")], "single.svg", { type: "image/svg+xml" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("no symbols");
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("rejects a file that is not an svg", async () => {
    const { dialog } = await open(new File(["x"], "notes.txt"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("ending in .svg");
  });

  it("lists symbols that could not be imported and ones that were skipped", async () => {
    vi.mocked(iconsApi.uploadIcons).mockResolvedValue(summary({ created: [makeIcon({ id: "n1" })], skipped: [{ name: "star", reason: "Already exists." }], errors: [{ file: "home.svg", message: "Unsafe content." }] }));
    const { dialog } = await open();
    await within(dialog).findByText(/holds 2 symbols/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 2 icons" }));
    expect(await within(dialog).findByText("Imported 1 icon.")).toBeInTheDocument();
    expect(within(dialog).getByText("Unsafe content.")).toBeInTheDocument();
    expect(within(dialog).getByText(/star: Already exists\./)).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the import fails", async () => {
    vi.mocked(iconsApi.uploadIcons).mockRejectedValue(new ApiError("Upload failed.", 500));
    const { dialog, fns } = await open();
    await within(dialog).findByText(/holds 2 symbols/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 2 icons" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Upload failed.");
    expect(fns.refreshIcons).not.toHaveBeenCalled();
  });

  it("round trips: a sprite built from this project imports back without doubling the prefix", async () => {
    vi.mocked(iconsApi.uploadIcons).mockResolvedValue(summary());
    const { dialog } = await open();
    await within(dialog).findByText(/holds 2 symbols/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Import 2 icons" }));
    await within(dialog).findByText("Imported 2 icons.");
    expect(vi.mocked(iconsApi.uploadIcons).mock.calls[0]![1].every((file) => !file.name.startsWith("fth-"))).toBe(true);
  });
});
