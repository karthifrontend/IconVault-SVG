// The Settings section: edit the project's details, archive or unarchive it, and delete it. Only editors can change anything; everyone else sees the details.
import { Archive, ArchiveRestore, Download, Pencil, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteProject, exportProject, updateProject } from "../../api/projects";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useWorkspace } from "../../context/workspaceContext";
import { formatDate, pluralize } from "../../lib/format";
import { triggerBrowserDownload } from "../../utils/zipBundle";
import TransferProjectDialog from "../admin/TransferProjectDialog";
import ProjectFormDialog from "../projects/ProjectFormDialog";
import { Button } from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function SettingsTab() {
  const { project, refreshProject } = useWorkspace();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isAdmin = currentUser?.role === "admin";
  const canEdit = project.access.canEdit;

  async function toggleArchive() {
    setBusy(true);
    try {
      await updateProject(project.id, { isArchived: !project.isArchived });
      refreshProject();
      showToast(project.isArchived ? `Unarchived “${project.name}”.` : `Archived “${project.name}”.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change the project.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { blob, filename } = await exportProject(project.id);
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not export the project.", "error");
    } finally {
      setExporting(false);
    }
  }

  const details: Array<[string, string]> = [
    ["Name", project.name],
    ["Prefix", project.prefix],
    ["Type", project.purpose === "font" ? "Icon font" : "SVG sprite"],
    ["Visibility", project.visibility === "public" ? "Public (others can view and copy)" : "Private"],
    ["Owner", project.owner.displayName],
    ["Created", formatDate(project.createdAt)],
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <section aria-labelledby="settings-details">
        <div className="flex items-center justify-between gap-3">
          <h2 id="settings-details" className="text-lg font-semibold">
            Details
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download aria-hidden="true" className="h-4 w-4" />} onClick={handleExport} loading={exporting}>
              Export project
            </Button>
            {canEdit && (
              <Button icon={<Pencil aria-hidden="true" className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit details
              </Button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Export downloads a ZIP with the settings, folders and icons (not the trash or saved versions). Use Import project on the dashboard to create a copy from it.</p>
        <dl className="mt-3 divide-y divide-border rounded-xl border border-border">
          {details.map(([label, value]) => (
            <div key={label} className="flex gap-4 px-4 py-2 text-sm">
              <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {canEdit ? (
        <section aria-labelledby="settings-danger" className="rounded-xl border border-destructive/40 p-4">
          <h2 id="settings-danger" className="text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-sm text-muted-foreground">{project.isArchived ? "Unarchive to show this project in your active list again." : "Archiving hides the project from your active list and from others. Nothing is deleted."}</p>
            <Button onClick={toggleArchive} loading={busy} icon={project.isArchived ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : <Archive aria-hidden="true" className="h-4 w-4" />}>
              {project.isArchived ? "Unarchive project" : "Archive project"}
            </Button>
          </div>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="max-w-md text-sm text-muted-foreground">As an administrator you can move this project to another user.</p>
              <Button icon={<UserCog aria-hidden="true" className="h-4 w-4" />} onClick={() => setTransferring(true)}>
                Transfer ownership
              </Button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="max-w-md text-sm text-muted-foreground">Deleting removes the project with all its icons, folders and history for good.</p>
            <Button variant="destructive" icon={<Trash2 aria-hidden="true" className="h-4 w-4" />} onClick={() => setDeleting(true)}>
              Delete project
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Only the owner can change these settings.</p>
      )}

      <ProjectFormDialog
        open={editing}
        mode="edit"
        project={project}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          refreshProject();
          showToast(`Saved “${saved.name}”.`, "success");
        }}
      />
      <TransferProjectDialog
        open={transferring}
        project={project}
        onClose={() => setTransferring(false)}
        onTransferred={(updated) => {
          refreshProject();
          showToast(`Moved “${updated.name}” to ${updated.owner.displayName}.`, "success");
        }}
      />
      <ConfirmDialog
        open={deleting}
        title={`Delete “${project.name}”?`}
        message={`This permanently deletes the project with its ${pluralize(project.iconCount, "icon")}, folders and history. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await deleteProject(project.id);
          showToast(`Deleted “${project.name}”.`, "success");
          navigate("/");
        }}
      />
    </div>
  );
}
