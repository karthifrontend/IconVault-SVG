// The Icons section of a project: browse, search, sort, select, add (upload, paste, copy from another project), open an icon, and act on a selection (move, tag, optimize, download, move to the trash with an Undo). Everything that changes data refreshes the list, the folder counts and the project's totals.
import { Layers } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { batchDeleteIcons, batchMoveIcons, batchOptimizeIcons, batchRestoreIcons, batchTagIcons, downloadIcons, listIcons } from "../../api/icons";
import type { ListIconsParams, UploadSummary } from "../../api/types";
import { useToast } from "../../context/ToastContext";
import { useWorkspace } from "../../context/workspaceContext";
import { useDebounced } from "../../hooks/useDebounced";
import { usePersistentChoice } from "../../hooks/usePersistentChoice";
import { useResource } from "../../hooks/useResource";
import { useSelection } from "../../hooks/useSelection";
import { pluralize, savingsPercent } from "../../lib/format";
import { SURFACES, type Surface } from "../../lib/previewSurface";
import { triggerBrowserDownload } from "../../utils/zipBundle";
import { Button } from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import BulkBar from "./BulkBar";
import { MoveIconsDialog, TagIconsDialog } from "./BulkDialogs";
import CopyFromProjectDialog from "./CopyFromProjectDialog";
import IconCard from "./IconCard";
import IconChecklistDialog from "./IconChecklistDialog";
import IconDrawer from "./IconDrawer";
import IconList from "./IconList";
import IconToolbar, { type IconSort, type IconView } from "./IconToolbar";
import UploadDialog from "./UploadDialog";

const SORTS: readonly IconSort[] = ["newest", "oldest", "name", "name-desc", "largest"];
const VIEWS: readonly IconView[] = ["grid", "list"];
const PAGE = 200;
// The server returns at most this many in one request.
const MAX_SHOWN = 1000;

type Dialog = "add" | "copy" | "move" | "tag" | "delete" | "generate" | null;

export default function IconsTab() {
  const { project, folderList, selectedFolder, refreshProject, refreshFolders, refreshIcons, iconsVersion } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canEdit = project.access.canEdit;

  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 300);
  const [sort, setSort] = usePersistentChoice<IconSort>("iconSort", SORTS, "newest");
  const [view, setView] = usePersistentChoice<IconView>("iconView", VIEWS, "grid");
  const [surface, setSurface] = usePersistentChoice<Surface>("iconSurface", SURFACES, "theme");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // "Show more" only lasts while the filters stay the same.
  const filterKey = [project.id, selectedFolder, search, sort].join("|");
  const [limitState, setLimitState] = useState({ key: "", value: PAGE });
  const limit = limitState.key === filterKey ? limitState.value : PAGE;

  const params: ListIconsParams = {
    sort,
    limit,
    ...(selectedFolder === "all" ? {} : { folderId: selectedFolder, includeSubfolders: selectedFolder !== "root" }),
    ...(search ? { search } : {}),
  };
  const icons = useResource(`icons:${filterKey}:${limit}:${iconsVersion}`, () => listIcons(project.id, params));
  const shown = icons.data?.icons ?? [];
  const total = icons.data?.total ?? 0;
  const selection = useSelection(`${filterKey}:${iconsVersion}`);
  const currentFolderId = selectedFolder === "all" || selectedFolder === "root" ? null : selectedFolder;

  const refreshAll = () => {
    refreshIcons();
    refreshFolders();
    refreshProject();
  };

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      showToast(err instanceof Error ? err.message : failure, "error");
    } finally {
      setBusy(false);
    }
  }

  const optimizeSelected = () =>
    run(async () => {
      const result = await batchOptimizeIcons(project.id, selection.ids);
      refreshAll();
      if (result.failed.length > 0) showToast(`${pluralize(result.failed.length, "icon")} could not be optimized.`, "warning");
      else if (result.optimized === 0) showToast("They are already as small as they can be.", "success");
      else showToast(`Optimized ${result.optimized} of ${pluralize(result.matched, "icon")}, ${savingsPercent(result.bytesBefore, result.bytesAfter)}% smaller.`, "success");
    }, "Could not optimize the icons.");

  const downloadSelected = () =>
    run(async () => {
      const { blob, filename } = await downloadIcons(project.id, selection.ids);
      triggerBrowserDownload(blob, filename);
    }, "Could not download the icons.");

  function describeAdded(summary: UploadSummary): string {
    const parts = [summary.created.length > 0 ? `added ${pluralize(summary.created.length, "icon")}` : null, summary.replaced.length > 0 ? `replaced ${pluralize(summary.replaced.length, "icon")}` : null, summary.skipped.length > 0 ? `skipped ${pluralize(summary.skipped.length, "icon")}` : null].filter(Boolean);
    return parts.length > 0 ? `${parts.join(", ")}.`.replace(/^./, (c) => c.toUpperCase()) : "Nothing was added.";
  }

  const emptyProject = !icons.loading && total === 0 && !search && selectedFolder === "all";

  return (
    <div>
      <IconToolbar
        search={searchText}
        onSearch={setSearchText}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
        surface={surface}
        onSurface={setSurface}
        canAdd={project.access.canAddIcons}
        onAdd={() => setDialog("add")}
        onCopyFrom={() => setDialog("copy")}
        loaded={shown.length}
        selected={selection.size}
        onSelectAll={(checked) => (checked ? selection.selectAll(shown.map((icon) => icon.id)) : selection.clear())}
      />

      <div className="mt-4">
        {icons.error && !icons.data ? (
          <div role="alert" className="rounded-xl border border-destructive/40 p-6 text-center">
            <p className="font-medium text-destructive">{icons.error.message}</p>
            <Button className="mt-3" onClick={icons.reload}>
              Try again
            </Button>
          </div>
        ) : icons.loading && !icons.data ? (
          <ul aria-busy="true" aria-label="Loading icons" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <li key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Layers aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-base font-semibold">
              {search ? `No icons match “${search}”.` : emptyProject ? "No icons yet." : selectedFolder === "root" ? "No uncategorized icons." : "This folder is empty."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search." : project.access.canAddIcons ? "Add some by uploading SVG files, pasting code, or copying from another project." : "The owner has not added any here yet."}</p>
            {!search && project.access.canAddIcons && (
              <Button variant="primary" className="mt-4" onClick={() => setDialog("add")}>
                Add icons
              </Button>
            )}
          </div>
        ) : (
          <>
            <p role="status" className="mb-2 text-sm text-muted-foreground">
              Showing {shown.length} of {pluralize(total, "icon")}
            </p>
            {view === "grid" ? (
              <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 ${icons.loading ? "opacity-60" : ""}`}>
                {shown.map((icon) => (
                  <IconCard key={icon.id} icon={icon} selected={selection.has(icon.id)} surface={surface} canDrag={canEdit} dragIds={() => (selection.has(icon.id) ? selection.ids : [icon.id])} onToggle={() => selection.toggle(icon.id)} onOpen={() => setOpenId(icon.id)} />
                ))}
              </ul>
            ) : (
              <IconList icons={shown} folders={folderList.folders} isSelected={selection.has} surface={surface} canDrag={canEdit} dragIds={(id) => (selection.has(id) ? selection.ids : [id])} onToggle={selection.toggle} onOpen={(icon) => setOpenId(icon.id)} />
            )}
            {total > shown.length && (
              <div className="mt-4 text-center">
                {shown.length < MAX_SHOWN ? (
                  <Button onClick={() => setLimitState({ key: filterKey, value: Math.min(limit + PAGE, MAX_SHOWN) })}>Show more</Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Only the first {MAX_SHOWN} are shown. Use search or folders to narrow it down.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selection.size > 0 && (
        <BulkBar
          count={selection.size}
          canEdit={canEdit}
          busy={busy}
          onMove={() => setDialog("move")}
          onTag={() => setDialog("tag")}
          generate={project.purpose}
          onGenerate={() => setDialog("generate")}
          onOptimize={optimizeSelected}
          onDownload={downloadSelected}
          onDelete={() => setDialog("delete")}
          onClear={selection.clear}
        />
      )}

      <IconChecklistDialog
        open={dialog === "generate"}
        mode={project.purpose}
        projectId={project.id}
        folders={folderList.folders}
        initialIds={selection.ids}
        onClose={() => setDialog(null)}
        onConfirm={(iconIds) => {
          setDialog(null);
          // The Sprite section builds as soon as it opens; the Font section starts its build too.
          navigate(`/projects/${project.id}/${project.purpose === "font" ? "font" : "sprite"}`, { state: { iconIds, autoBuild: true } });
        }}
      />
      <UploadDialog
        open={dialog === "add"}
        projectId={project.id}
        folders={folderList.folders}
        defaultFolderId={currentFolderId}
        onClose={() => setDialog(null)}
        onUploaded={(summary) => {
          if (summary.created.length + summary.replaced.length > 0) refreshAll();
        }}
        onPasted={(result) => {
          refreshAll();
          if (result.outcome !== "skipped") showToast(`${result.outcome === "created" ? "Added" : "Replaced"} “${result.icon.name}”.`, "success");
        }}
      />
      <CopyFromProjectDialog
        open={dialog === "copy"}
        targetProjectId={project.id}
        targetFolders={folderList.folders}
        defaultFolderId={currentFolderId}
        onClose={() => setDialog(null)}
        onCopied={(summary) => {
          refreshAll();
          showToast(describeAdded(summary), summary.created.length + summary.replaced.length > 0 ? "success" : "warning");
        }}
      />
      <MoveIconsDialog
        open={dialog === "move"}
        count={selection.size}
        folders={folderList.folders}
        onClose={() => setDialog(null)}
        onSubmit={async (folderId) => {
          const result = await batchMoveIcons(project.id, selection.ids, folderId);
          refreshAll();
          showToast(`Moved ${pluralize(result.matched, "icon")}.`, "success");
        }}
      />
      <TagIconsDialog
        open={dialog === "tag"}
        count={selection.size}
        onClose={() => setDialog(null)}
        onSubmit={async (tags, mode) => {
          const result = await batchTagIcons(project.id, selection.ids, tags, mode);
          refreshAll();
          showToast(`Updated tags on ${pluralize(result.matched, "icon")}.`, "success");
        }}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Move ${pluralize(selection.size, "icon")} to the trash?`}
        message="You can restore them from the Trash section."
        confirmLabel="Move to trash"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          const ids = selection.ids;
          const result = await batchDeleteIcons(project.id, ids);
          refreshAll();
          showToast(`Moved ${pluralize(result.matched, "icon")} to the trash.`, "success", [
            {
              label: "Undo",
              type: "primary",
              onClick: () => {
                batchRestoreIcons(project.id, ids).then(refreshAll, (err: unknown) => showToast(err instanceof Error ? err.message : "Could not restore the icons.", "error"));
              },
            },
          ]);
        }}
      />

      <IconDrawer iconId={openId} canEdit={canEdit} folders={folderList.folders} idPrefix={project.prefix} onClose={() => setOpenId(null)} onChanged={refreshAll} />
    </div>
  );
}
