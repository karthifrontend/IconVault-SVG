// Tests for the Trash and Settings sections: listing, restoring (with notes about changes), deleting for good, emptying, editing, archiving and deleting a project, and the read-only views.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/http";
import * as iconsApi from "../../api/icons";
import * as projectsApi from "../../api/projects";
import { ToastProvider } from "../../context/ToastContext";
import { WorkspaceContext, type WorkspaceContextValue } from "../../context/workspaceContext";
import { READ_ONLY, makeDetail, makeIcon } from "../../test/fixtures";
import SettingsTab from "./SettingsTab";
import TrashTab from "./TrashTab";

vi.mock("../../api/icons");
vi.mock("../../api/projects");

const listIcons = vi.mocked(iconsApi.listIcons);
const trashed = (id: string, name: string) => makeIcon({ id, name, deletedAt: "2026-10-18T10:00:00.000Z" });

function setup(node: React.ReactNode, over: Partial<WorkspaceContextValue> = {}) {
  const fns = { selectFolder: vi.fn(), refreshProject: vi.fn(), refreshFolders: vi.fn(), refreshIcons: vi.fn() };
  const value: WorkspaceContextValue = { project: makeDetail({ id: "p1", name: "Feather", iconCount: 3 }), folderList: { folders: [], uncategorizedCount: 0 }, selectedFolder: "all", iconsVersion: 0, ...fns, ...over };
  render(
    <MemoryRouter initialEntries={["/projects/p1/x"]}>
      <ToastProvider>
        <WorkspaceContext.Provider value={value}>
          <Routes>
            <Route path="/" element={<p>Dashboard</p>} />
            <Route path="/projects/p1/x" element={node} />
          </Routes>
        </WorkspaceContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return fns;
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});

describe("Trash", () => {
  beforeEach(() => listIcons.mockResolvedValue({ icons: [trashed("a", "Alpha"), trashed("b", "Beta")], total: 2, page: 1, limit: 1000 }));

  it("lists trashed icons from the server", async () => {
    setup(<TrashTab />);
    expect(screen.getByLabelText("Loading trash")).toBeInTheDocument();
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(listIcons).toHaveBeenCalledWith("p1", { trash: true, sort: "newest", limit: 1000 });
    expect(screen.getByText("2 icons in the trash")).toBeInTheDocument();
  });

  it("says the trash is empty", async () => {
    listIcons.mockResolvedValue({ icons: [], total: 0, page: 1, limit: 1000 });
    setup(<TrashTab />);
    expect(await screen.findByText("The trash is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empty trash" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    listIcons.mockRejectedValueOnce(new ApiError("Could not reach the server."));
    setup(<TrashTab />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("restores one icon and refreshes everything", async () => {
    vi.mocked(iconsApi.restoreIcon).mockResolvedValue({ icon: makeIcon({ id: "a" }), adjusted: [] });
    const fns = setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Restore Alpha" }));
    expect(iconsApi.restoreIcon).toHaveBeenCalledWith("a");
    expect(await screen.findByText("Restored “Alpha”.")).toBeInTheDocument();
    expect(fns.refreshIcons).toHaveBeenCalled();
    expect(fns.refreshFolders).toHaveBeenCalled();
    expect(fns.refreshProject).toHaveBeenCalled();
    await waitFor(() => expect(listIcons).toHaveBeenCalledTimes(2));
  });

  it("tells what changed when a restore had to adjust the icon", async () => {
    vi.mocked(iconsApi.restoreIcon).mockResolvedValue({ icon: makeIcon({ id: "a" }), adjusted: ["Its codepoint was taken."] });
    setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Restore Alpha" }));
    expect(await screen.findByText(/Its codepoint was taken\./)).toBeInTheDocument();
  });

  it("restores everything", async () => {
    vi.mocked(iconsApi.batchRestoreIcons).mockResolvedValue({ requested: 2, matched: 2, adjusted: [] });
    setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Restore all" }));
    expect(iconsApi.batchRestoreIcons).toHaveBeenCalledWith("p1", ["a", "b"]);
    expect(await screen.findByText("Restored 2 icons.")).toBeInTheDocument();
  });

  it("reports a failed restore", async () => {
    vi.mocked(iconsApi.restoreIcon).mockRejectedValue(new ApiError("Icon not found.", 404));
    setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Restore Alpha" }));
    expect(await screen.findByText("Icon not found.")).toBeInTheDocument();
  });

  it("asks before deleting one icon for good", async () => {
    vi.mocked(iconsApi.deleteIcon).mockResolvedValue({});
    const fns = setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Alpha forever" }));
    const dialog = screen.getByRole("dialog", { name: "Delete “Alpha” forever?" });
    expect(iconsApi.deleteIcon).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete forever" }));
    expect(iconsApi.deleteIcon).toHaveBeenCalledWith("a", { permanent: true });
    expect(await screen.findByText("Deleted “Alpha” for good.")).toBeInTheDocument();
    expect(fns.refreshProject).toHaveBeenCalled();
  });

  it("can be cancelled without deleting", async () => {
    setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Empty trash" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Empty the trash?" })).getByRole("button", { name: "Cancel" }));
    expect(iconsApi.emptyTrash).not.toHaveBeenCalled();
  });

  it("empties the trash after confirmation", async () => {
    vi.mocked(iconsApi.emptyTrash).mockResolvedValue({ deleted: 2 });
    setup(<TrashTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Empty trash" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Empty the trash?" })).getByRole("button", { name: "Empty trash" }));
    expect(iconsApi.emptyTrash).toHaveBeenCalledWith("p1");
    expect(await screen.findByText("Deleted 2 icons for good.")).toBeInTheDocument();
  });

  it("is for editors only and asks the server for nothing otherwise", async () => {
    setup(<TrashTab />, { project: makeDetail({ id: "p1", access: READ_ONLY }) });
    expect(await screen.findByText("Only the owner can see this project’s trash.")).toBeInTheDocument();
    expect(listIcons).not.toHaveBeenCalled();
  });
});

describe("Settings", () => {
  it("shows the project's details", () => {
    setup(<SettingsTab />, { project: makeDetail({ id: "p1", name: "Feather", prefix: "fth", purpose: "font", visibility: "public", owner: { id: "u1", displayName: "Ada Lovelace" } }) });
    expect(screen.getByText("Feather")).toBeInTheDocument();
    expect(screen.getByText("fth")).toBeInTheDocument();
    expect(screen.getByText("Icon font")).toBeInTheDocument();
    expect(screen.getByText("Public (others can view and copy)")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("edits the details and refreshes the project", async () => {
    vi.mocked(projectsApi.updateProject).mockResolvedValue(makeDetail({ id: "p1", name: "Feather 2" }));
    const fns = setup(<SettingsTab />);
    await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    const dialog = screen.getByRole("dialog", { name: "Edit project" });
    const name = within(dialog).getByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, "Feather 2");
    await userEvent.click(within(dialog).getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Feather 2" })));
    expect(await screen.findByText("Saved “Feather 2”.")).toBeInTheDocument();
    expect(fns.refreshProject).toHaveBeenCalled();
  });

  it("archives and unarchives", async () => {
    vi.mocked(projectsApi.updateProject).mockResolvedValue(makeDetail({ id: "p1" }));
    const fns = setup(<SettingsTab />);
    await userEvent.click(screen.getByRole("button", { name: "Archive project" }));
    expect(projectsApi.updateProject).toHaveBeenCalledWith("p1", { isArchived: true });
    expect(await screen.findByText("Archived “Feather”.")).toBeInTheDocument();
    expect(fns.refreshProject).toHaveBeenCalled();
  });

  it("offers to unarchive an archived project", async () => {
    vi.mocked(projectsApi.updateProject).mockResolvedValue(makeDetail({ id: "p1" }));
    setup(<SettingsTab />, { project: makeDetail({ id: "p1", name: "Feather", isArchived: true }) });
    await userEvent.click(screen.getByRole("button", { name: "Unarchive project" }));
    expect(projectsApi.updateProject).toHaveBeenCalledWith("p1", { isArchived: false });
  });

  it("reports a failed archive", async () => {
    vi.mocked(projectsApi.updateProject).mockRejectedValue(new ApiError("Nope.", 403));
    setup(<SettingsTab />);
    await userEvent.click(screen.getByRole("button", { name: "Archive project" }));
    expect(await screen.findByText("Nope.")).toBeInTheDocument();
  });

  it("asks before deleting, then returns to the dashboard", async () => {
    vi.mocked(projectsApi.deleteProject).mockResolvedValue({ deletedIcons: 3, deletedFolders: 0 });
    setup(<SettingsTab />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("dialog", { name: "Delete “Feather”?" });
    expect(projectsApi.deleteProject).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete project" }));
    expect(projectsApi.deleteProject).toHaveBeenCalledWith("p1");
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("keeps the dialog open and shows why when deleting fails", async () => {
    vi.mocked(projectsApi.deleteProject).mockRejectedValue(new ApiError("Could not delete.", 500));
    setup(<SettingsTab />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete project" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Could not delete.");
  });

  it("is read-only for viewers", () => {
    setup(<SettingsTab />, { project: makeDetail({ id: "p1", access: READ_ONLY }) });
    expect(screen.getByText("Only the owner can change these settings.")).toBeInTheDocument();
    for (const name of ["Edit details", "Archive project", "Delete project"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });
});
