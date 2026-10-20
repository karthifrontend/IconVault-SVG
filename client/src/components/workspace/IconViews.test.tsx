// Tests for the icon cards, the table view, the toolbar and the bulk bar with its dialogs.
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DRAG_TYPE } from "../../lib/dragIcons";
import { makeFolder, makeIcon } from "../../test/fixtures";
import BulkBar from "./BulkBar";
import { MoveIconsDialog, TagIconsDialog } from "./BulkDialogs";
import IconCard from "./IconCard";
import IconList from "./IconList";
import IconToolbar from "./IconToolbar";

describe("IconCard", () => {
  const setup = (over: Partial<React.ComponentProps<typeof IconCard>> = {}) => {
    const props = { icon: makeIcon({ name: "Arrow Left", byteSize: 1536 }), selected: false, surface: "theme" as const, canDrag: true, dragIds: () => ["a"], onToggle: vi.fn(), onOpen: vi.fn(), ...over };
    render(
      <ul>
        <IconCard {...props} />
      </ul>,
    );
    return props;
  };

  it("shows the name and size, and opens or selects separately", async () => {
    const { onOpen, onToggle } = setup();
    expect(screen.getByText("Arrow Left")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open Arrow Left" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Arrow Left" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("reflects whether it is selected", () => {
    setup({ selected: true });
    expect(screen.getByRole("checkbox", { name: "Select Arrow Left" })).toBeChecked();
  });

  it("warns about what will not become a font glyph, in words", () => {
    setup({ icon: makeIcon({ hasStroke: true, hasText: true }) });
    expect(screen.getByText("Stroke")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.queryByText("Gradient")).not.toBeInTheDocument();
  });

  it("shows no warnings for a clean icon", () => {
    setup();
    expect(screen.queryByText("Stroke")).not.toBeInTheDocument();
  });

  it("can be dragged only when allowed, carrying the ids it is told to", () => {
    setup({ dragIds: () => ["a", "b"] });
    const item = screen.getByRole("listitem");
    expect(item).toHaveAttribute("draggable", "true");
    const setData = vi.fn();
    fireEvent.dragStart(item, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith(DRAG_TYPE, JSON.stringify(["a", "b"]));
  });

  it("is not draggable for people who cannot edit", () => {
    setup({ canDrag: false });
    expect(screen.getByRole("listitem")).toHaveAttribute("draggable", "false");
  });
});

describe("IconList", () => {
  const folders = [makeFolder({ id: "ui", name: "UI" }), makeFolder({ id: "ar", name: "Arrows", parentId: "ui" })];
  const icons = [makeIcon({ id: "i1", name: "Left", folderId: "ar", tags: ["nav", "arrow"], byteSize: 300 }), makeIcon({ id: "i2", name: "Plain", folderId: null, hasGradient: true })];

  function setup() {
    const props = { icons, folders, isSelected: (id: string) => id === "i2", surface: "theme" as const, canDrag: true, dragIds: (id: string) => [id], onToggle: vi.fn(), onOpen: vi.fn() };
    render(<IconList {...props} />);
    return props;
  }

  it("is a table with named columns and one row per icon", () => {
    setup();
    expect(screen.getByRole("table", { name: "Icons" })).toBeInTheDocument();
    // The scroll box must be positioned, or the table's hidden text widens the page on a phone.
    expect(screen.getByRole("table", { name: "Icons" }).parentElement).toHaveClass("relative", "overflow-x-auto");
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Select", "Preview", "Name", "Folder", "Size", "Tags", "Updated"]);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows folder path, size, tags and warnings", () => {
    setup();
    const row = screen.getByRole("button", { name: "Left" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("UI / Arrows")).toBeInTheDocument();
    expect(within(row).getByText("300 B")).toBeInTheDocument();
    expect(within(row).getByText("nav, arrow")).toBeInTheDocument();
    const plain = screen.getByRole("button", { name: "Plain" }).closest("tr") as HTMLElement;
    expect(within(plain).getByText("Project root")).toBeInTheDocument();
    expect(within(plain).getByText("Gradient")).toBeInTheDocument();
  });

  it("selects and opens", async () => {
    const { onToggle, onOpen } = setup();
    expect(screen.getByRole("checkbox", { name: "Select Plain" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Left" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Left" }));
    expect(onToggle).toHaveBeenCalledWith("i1");
    await userEvent.click(screen.getByRole("button", { name: "Left" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "i1" }));
  });

  it("rows can be dragged with their ids", () => {
    setup();
    const setData = vi.fn();
    fireEvent.dragStart((screen.getByRole("button", { name: "Left" }).closest("tr")) as HTMLElement, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith(DRAG_TYPE, JSON.stringify(["i1"]));
  });
});

describe("IconToolbar", () => {
  function setup(over: Partial<React.ComponentProps<typeof IconToolbar>> = {}) {
    const props = {
      search: "",
      onSearch: vi.fn(),
      sort: "newest" as const,
      onSort: vi.fn(),
      view: "grid" as const,
      onView: vi.fn(),
      surface: "theme" as const,
      onSurface: vi.fn(),
      canAdd: true,
      onAdd: vi.fn(),
      onCopyFrom: vi.fn(),
      loaded: 5,
      selected: 0,
      onSelectAll: vi.fn(),
      ...over,
    };
    render(<IconToolbar {...props} />);
    return props;
  }

  it("reports searching, sorting, background and view changes", async () => {
    const { onSearch, onSort, onSurface, onView } = setup();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search icons" }), "ar");
    expect(onSearch).toHaveBeenLastCalledWith("r");
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "name");
    expect(onSort).toHaveBeenCalledWith("name");
    await userEvent.selectOptions(screen.getByLabelText("Preview background"), "checker");
    expect(onSurface).toHaveBeenCalledWith("checker");
    await userEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(onView).toHaveBeenCalledWith("list");
  });

  it("marks the current view", () => {
    setup({ view: "list" });
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "false");
  });

  it("offers adding and copying only to people who can add", async () => {
    const { onAdd, onCopyFrom } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add icons" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy from project" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onCopyFrom).toHaveBeenCalledTimes(1);
  });

  it("hides add and copy for read-only users", () => {
    setup({ canAdd: false });
    expect(screen.queryByRole("button", { name: "Add icons" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy from project" })).not.toBeInTheDocument();
  });

  it("select all reflects none, some and all selected, and is off when nothing is shown", async () => {
    const none = setup({ selected: 0 });
    const box = screen.getByRole("checkbox", { name: "Select all 5 shown" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.indeterminate).toBe(false);
    await userEvent.click(box);
    expect(none.onSelectAll).toHaveBeenCalledWith(true);
  });

  it("shows a partial selection as indeterminate and a full one as checked", () => {
    const { unmount } = render(<IconToolbar search="" onSearch={() => {}} sort="newest" onSort={() => {}} view="grid" onView={() => {}} surface="theme" onSurface={() => {}} canAdd={false} onAdd={() => {}} onCopyFrom={() => {}} loaded={4} selected={2} onSelectAll={() => {}} />);
    expect((screen.getByRole("checkbox", { name: "Select all 4 shown" }) as HTMLInputElement).indeterminate).toBe(true);
    unmount();
    render(<IconToolbar search="" onSearch={() => {}} sort="newest" onSort={() => {}} view="grid" onView={() => {}} surface="theme" onSurface={() => {}} canAdd={false} onAdd={() => {}} onCopyFrom={() => {}} loaded={4} selected={4} onSelectAll={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Select all 4 shown" })).toBeChecked();
  });

  it("disables select all when there is nothing to select", () => {
    setup({ loaded: 0 });
    expect(screen.getByRole("checkbox", { name: "Select all 0 shown" })).toBeDisabled();
  });
});

describe("BulkBar", () => {
  function setup(over: Partial<React.ComponentProps<typeof BulkBar>> = {}) {
    const props = { count: 3, canEdit: true, busy: false, onMove: vi.fn(), onTag: vi.fn(), onOptimize: vi.fn(), onDownload: vi.fn(), onDelete: vi.fn(), onClear: vi.fn(), ...over };
    render(<BulkBar {...props} />);
    return props;
  }

  it("says how many are selected and offers every action to editors", async () => {
    const p = setup();
    expect(screen.getByRole("region", { name: "Selected icons" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 icons selected");
    for (const [name, fn] of [["Move", p.onMove], ["Tag", p.onTag], ["Optimize", p.onOptimize], ["Download", p.onDownload], ["Delete", p.onDelete], ["Clear selection", p.onClear]] as const) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("offers only Download and Clear to people who cannot edit", () => {
    setup({ canEdit: false, count: 1 });
    expect(screen.getByRole("status")).toHaveTextContent("1 icon selected");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Download", "Clear selection"]);
  });

  it("disables the actions while one is running", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeEnabled();
  });
});

describe("bulk dialogs", () => {
  const folders = [makeFolder({ id: "ui", name: "UI" }), makeFolder({ id: "ar", name: "Arrows", parentId: "ui" })];

  it("moves into a folder or the project root, and shows a failure", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("That folder does not exist in this project.")).mockResolvedValue(undefined);
    render(<MoveIconsDialog open count={2} folders={folders} onClose={vi.fn()} onSubmit={onSubmit} />);
    const dialog = screen.getByRole("dialog", { name: "Move 2 icons" });
    expect(within(within(dialog).getByLabelText("Move into")).getAllByRole("option").map((o) => o.textContent?.trim())).toEqual(["Uncategorized (project root)", "UI", "Arrows"]);
    await userEvent.selectOptions(within(dialog).getByLabelText("Move into"), "ar");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move" }));
    expect(onSubmit).toHaveBeenCalledWith("ar");
    expect(await within(dialog).findByText("That folder does not exist in this project.")).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText("Move into"), "");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move" }));
    expect(onSubmit).toHaveBeenLastCalledWith(null);
  });

  it("tags with add, remove or replace, and needs at least one tag", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TagIconsDialog open count={1} onClose={vi.fn()} onSubmit={onSubmit} />);
    const dialog = screen.getByRole("dialog", { name: "Tag 1 icon" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(within(dialog).getByText("Enter at least one tag.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText("Tags"), "UI, nav, ui");
    await userEvent.selectOptions(within(dialog).getByLabelText("Action"), "set");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(onSubmit).toHaveBeenCalledWith(["ui", "nav"], "set");
  });
});
