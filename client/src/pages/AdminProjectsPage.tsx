// Manage Projects (admins only): every project in the workspace, private and archived ones too, with its owner, a search that also matches the owner's name or email, and per project Open, Transfer ownership and Delete. Anyone else is sent to the dashboard.
import { ExternalLink, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { deleteProject, listProjects } from "../api/projects";
import type { ProjectSummary } from "../api/types";
import AdminTabs from "../components/admin/AdminTabs";
import TransferProjectDialog from "../components/admin/TransferProjectDialog";
import { PurposeBadge, VisibilityBadge } from "../components/projects/ProjectBadges";
import Badge from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounced } from "../hooks/useDebounced";
import { useResource } from "../hooks/useResource";
import { formatRelative, pluralize } from "../lib/format";

const PAGE_SIZE = 25;

export default function AdminProjectsPage() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 300);
  const [pageState, setPageState] = useState({ search: "", page: 1 });
  const page = pageState.search === search ? pageState.page : 1;
  const [transferring, setTransferring] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const isAdmin = currentUser?.role === "admin";
  const projects = useResource(isAdmin ? `admin-projects:${search}:${page}` : null, () => listProjects({ status: "all", scope: "all", sort: "updated", ...(search ? { search } : {}), page, limit: PAGE_SIZE }));

  if (!isAdmin) return <Navigate to="/" replace />;

  const rows = projects.data?.projects ?? [];
  const total = projects.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-16 pt-[calc(57px+2rem)] outline-none">
      <h1 className="text-2xl font-bold tracking-tight">Manage projects</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Every project in the workspace, including private and archived ones. Move a project to another owner or delete it for good.</p>
      <AdminTabs />

      <div className="mt-6">
        <label htmlFor="admin-project-search" className="sr-only">
          Search projects
        </label>
        <input id="admin-project-search" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by project, prefix, owner name or email" autoComplete="off" className="h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" />
      </div>

      {projects.error && !projects.data ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 p-6 text-center">
          <p className="font-medium text-destructive">{projects.error.message}</p>
          <Button className="mt-3" onClick={projects.reload}>
            Try again
          </Button>
        </div>
      ) : !projects.data ? (
        <div aria-busy="true" aria-label="Loading projects" className="mt-4 h-48 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{search ? `No projects match “${search}”.` : "There are no projects."}</p>
      ) : (
        <>
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {pluralize(total, "project")}
          </p>
          <div className={`relative mt-2 overflow-x-auto rounded-xl border border-border ${projects.loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-3xl text-left text-sm">
              <caption className="sr-only">Projects</caption>
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Project</th>
                  <th scope="col" className="px-3 py-2 font-medium">Owner</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Icons</th>
                  <th scope="col" className="px-3 py-2 font-medium">Updated</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((project) => (
                  <tr key={project.id}>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{project.name}</span>
                        <VisibilityBadge visibility={project.visibility} />
                        <PurposeBadge purpose={project.purpose} />
                        {project.isArchived && <Badge>Archived</Badge>}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{project.prefix}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{project.owner.displayName}</span>
                      {project.owner.email && <span className="block text-xs text-muted-foreground">{project.owner.email}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{project.iconCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatRelative(project.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link to={`/projects/${project.id}`} aria-label={`Open ${project.name}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          Open
                        </Link>
                        <Button size="sm" icon={<UserCog aria-hidden="true" className="h-3.5 w-3.5" />} onClick={() => setTransferring(project)} aria-label={`Transfer ${project.name}`}>
                          Transfer
                        </Button>
                        <Button size="sm" variant="destructive" icon={<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />} onClick={() => setDeleting(project)} aria-label={`Delete ${project.name}`}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Pages" className="mt-3 flex items-center justify-between text-sm">
              <Button size="sm" disabled={page <= 1} onClick={() => setPageState({ search, page: page - 1 })}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button size="sm" disabled={page >= pages} onClick={() => setPageState({ search, page: page + 1 })}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {transferring && (
        <TransferProjectDialog
          open
          project={{ ...transferring, folderCount: 0, trashCount: 0 }}
          onClose={() => setTransferring(null)}
          onTransferred={(updated) => {
            projects.reload();
            showToast(`Moved “${updated.name}” to ${updated.owner.displayName}.`, "success");
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ""}”?`}
        message={`This permanently deletes the project with its ${pluralize(deleting?.iconCount ?? 0, "icon")}, folders and history. It belongs to ${deleting?.owner.displayName ?? "its owner"}. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteProject(deleting.id);
          projects.reload();
          showToast(`Deleted “${deleting.name}”.`, "success");
        }}
      />
    </main>
  );
}
