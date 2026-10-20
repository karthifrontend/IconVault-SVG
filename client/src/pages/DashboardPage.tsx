// The signed-in home screen: every project the user can see, with filters (kept in the address, so Back works and links can be shared), create, edit, duplicate, archive and delete, plus a search that also finds icons across projects and can copy them into one of the user's projects.
import { Plus, Search, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { searchIcons } from "../api/icons";
import { deleteProject, duplicateProject, importProject, listProjects, updateProject } from "../api/projects";
import type { IconSearchResult, ListProjectsParams, ProjectSummary } from "../api/types";
import CopyToProjectDialog from "../components/projects/CopyToProjectDialog";
import ProjectCard from "../components/projects/ProjectCard";
import ProjectFormDialog from "../components/projects/ProjectFormDialog";
import { Button } from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { SelectField } from "../components/ui/Fields";
import SvgPreview from "../components/ui/SvgPreview";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebounced } from "../hooks/useDebounced";
import { useResource } from "../hooks/useResource";
import { cn } from "../lib/cn";
import { pluralize } from "../lib/format";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "public", label: "Public" },
] as const;

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

type FormState = { mode: "create" } | { mode: "edit"; project: ProjectSummary } | null;

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const scope = oneOf(params.get("scope"), ["all", "mine", "public"], "all");
  const status = oneOf(params.get("status"), ["active", "archived", "all"], "active");
  const purpose = oneOf(params.get("type"), ["all", "sprite", "font"], "all");
  const sort = oneOf(params.get("sort"), ["updated", "created", "name", "icons"], "updated");

  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 300);

  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [copying, setCopying] = useState<IconSearchResult | null>(null);

  const query: ListProjectsParams = { scope, status, purpose, sort, limit: 100, ...(search ? { search } : {}) };
  const projects = useResource(`projects:${JSON.stringify(query)}`, () => listProjects(query));
  const iconResults = useResource(search.length >= 2 ? `icons:${search}` : null, () => searchIcons(search, { limit: 24 }));

  function setFilter(name: string, value: string, fallback: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === fallback) next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );
  }

  const importRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // Creates a new private project from an export ZIP and says what was left out.
  async function handleImportChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const result = await importProject(file);
      projects.reload();
      const skipped = result.problems.length > 0 ? ` ${pluralize(result.problems.length, "icon")} could not be imported.` : "";
      showToast(`Imported “${result.project.name}” with ${pluralize(result.imported, "icon")}.${skipped}`, result.problems.length > 0 ? "warning" : "success", [{ label: "Open", type: "primary", onClick: () => navigate(`/projects/${result.project.id}`) }]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not import the project.", "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleDuplicate(project: ProjectSummary) {
    try {
      const copy = await duplicateProject(project.id);
      projects.reload();
      showToast(`Created “${copy.name}”.`, "success", [{ label: "Open", type: "primary", onClick: () => navigate(`/projects/${copy.id}`) }]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not duplicate the project.", "error");
    }
  }

  async function handleToggleArchive(project: ProjectSummary) {
    try {
      await updateProject(project.id, { isArchived: !project.isArchived });
      projects.reload();
      showToast(project.isArchived ? `Marked “${project.name}” as active.` : `Marked “${project.name}” as draft.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the project.", "error");
    }
  }

  const list = projects.data?.projects ?? [];
  const filtersActive = scope !== "all" || status !== "active" || purpose !== "all" || search !== "";
  const showIcons = search.length >= 2;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-16 pt-[calc(57px+2rem)] outline-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept=".zip,application/zip" aria-label="Project export file" className="hidden" onChange={handleImportChosen} />
          <Button icon={<Upload aria-hidden="true" className="h-4 w-4" />} onClick={() => importRef.current?.click()} loading={importing}>
            Import project
          </Button>
          <Button variant="primary" icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => setForm({ mode: "create" })}>
            New project
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="dashboard-search" className="sr-only">
            Search projects and icons
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="dashboard-search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search projects and icons"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </div>

        <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-input bg-muted p-0.5">
          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => setFilter("scope", option.value, "all")}
              className={cn(
                "h-9 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                scope === option.value && "bg-background text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <SelectField label="Type" hideLabel value={purpose} onChange={(event) => setFilter("type", event.target.value, "all")} className="h-10 w-auto">
          <option value="all">All types</option>
          <option value="sprite">Sprites</option>
          <option value="font">Icon fonts</option>
        </SelectField>
        <SelectField label="Status" hideLabel value={status} onChange={(event) => setFilter("status", event.target.value, "active")} className="h-10 w-auto">
          <option value="active">Active</option>
          <option value="archived">Draft</option>
          <option value="all">Both</option>
        </SelectField>
        <SelectField label="Sort by" hideLabel value={sort} onChange={(event) => setFilter("sort", event.target.value, "updated")} className="h-10 w-auto">
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
          <option value="name">Name</option>
          <option value="icons">Most icons</option>
        </SelectField>
      </div>

      {showIcons && (
        <section aria-labelledby="icon-results-title" className="mt-8">
          <h2 id="icon-results-title" className="text-lg font-semibold">
            Icons matching “{search}”
          </h2>
          <div role="status" aria-live="polite" className="mt-1 text-sm text-muted-foreground">
            {iconResults.error ? <span className="text-destructive">{iconResults.error.message}</span> : iconResults.loading && !iconResults.data ? "Searching…" : pluralize(iconResults.data?.total ?? 0, "icon") + " found"}
          </div>
          {(iconResults.data?.icons.length ?? 0) > 0 && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {iconResults.data?.icons.map((icon) => (
                <li key={icon.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <SvgPreview svg={icon.svg ?? ""} size={36} className="rounded-md bg-muted p-1.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{icon.name}</p>
                    {icon.project && (
                      <Link to={`/projects/${icon.project.id}`} className="block truncate rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                        {icon.project.name}
                      </Link>
                    )}
                  </div>
                  <Button size="sm" onClick={() => setCopying(icon)} aria-label={`Copy ${icon.name} to a project`}>
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="projects-title" className="mt-8">
        {showIcons && (
          <h2 id="projects-title" className="mb-3 text-lg font-semibold">
            Projects
          </h2>
        )}
        {!showIcons && (
          <h2 id="projects-title" className="sr-only">
            Project list
          </h2>
        )}

        {projects.error && !projects.data ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
            <p className="font-medium text-destructive">{projects.error.message}</p>
            <Button className="mt-3" onClick={projects.reload}>
              Try again
            </Button>
          </div>
        ) : projects.loading && !projects.data ? (
          <ul aria-busy="true" aria-label="Loading projects" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-muted" />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-base font-semibold">{filtersActive ? "No projects match." : "You have no projects yet."}</p>
            <p className="mt-1 text-sm text-muted-foreground">{filtersActive ? "Try a different search or filter." : "Create a project to start collecting icons."}</p>
            {!filtersActive && (
              <Button variant="primary" className="mt-4" onClick={() => setForm({ mode: "create" })}>
                New project
              </Button>
            )}
          </div>
        ) : (
          <>
            <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", projects.loading && "opacity-60")}>
              {list.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  currentUserId={currentUser?.id ?? ""}
                  onEdit={(p) => setForm({ mode: "edit", project: p })}
                  onDuplicate={handleDuplicate}
                  onToggleArchive={handleToggleArchive}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
            {(projects.data?.total ?? 0) > list.length && <p className="mt-4 text-center text-sm text-muted-foreground">Showing the first {list.length} of {projects.data?.total} projects. Use the search to narrow them down.</p>}
          </>
        )}
      </section>

      <ProjectFormDialog
        open={form !== null}
        mode={form?.mode ?? "create"}
        project={form?.mode === "edit" ? form.project : undefined}
        onClose={() => setForm(null)}
        onSaved={(saved) => {
          projects.reload();
          showToast(form?.mode === "edit" ? `Saved “${saved.name}”.` : `Created “${saved.name}”.`, "success", form?.mode === "edit" ? undefined : [{ label: "Open", type: "primary", onClick: () => navigate(`/projects/${saved.id}`) }]);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ""}”?`}
        message={`This permanently deletes the project with its ${pluralize(deleting?.iconCount ?? 0, "icon")}, folders and history. This cannot be undone.`}
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
      <CopyToProjectDialog
        open={copying !== null}
        icon={copying}
        onClose={() => setCopying(null)}
        onCopied={(result, destination) => {
          projects.reload();
          if (result.created.length + result.replaced.length > 0) showToast(`Copied to ${destination}.`, "success");
          else if (result.skipped.length > 0) showToast(`Skipped: ${result.skipped[0]?.reason ?? "already there"}`, "warning");
          else showToast(result.errors[0]?.message ?? "Nothing was copied.", "error");
        }}
      />
    </main>
  );
}
