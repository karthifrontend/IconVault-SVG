// Top of a project, in one bar: where you are (back to Projects), the project's name with its type and visibility (each in its own colour), the sections as a pill menu (Icons, Icon Font or Sprite, Settings, Trash), and a slot on the right where the Icons screen places Upload icons and From Another Project. Under the bar: the prefix, whether it is archived, the description and a note when it is read-only for you.
import { Archive, ArrowLeft, Settings, Trash2, Type, Layers, Shapes } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import type { ProjectDetail } from "../../api/types";
import { cn } from "../../lib/cn";
import Badge from "../ui/Badge";
import ProjectAvatar from "../projects/ProjectAvatar";
import { PurposeBadge, VisibilityBadge } from "../projects/ProjectBadges";

const pillClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    isActive ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
  );

const countClass = "rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground";

export default function ProjectHeader({ project, actionsRef }: { project: ProjectDetail; actionsRef?: (node: HTMLDivElement | null) => void }) {
  const isFont = project.purpose === "font";
  return (
    <header>
      <Link to="/" className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Projects
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <ProjectAvatar name={project.name} color={project.color} />
          <h1 className="max-w-64 truncate text-xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <VisibilityBadge visibility={project.visibility} />
            <PurposeBadge purpose={project.purpose} long />
          </div>
        </div>

        <nav aria-label="Project sections" className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted p-1">
          {/* Absolute paths: relative links would resolve against the current section. */}
          <NavLink to={`/projects/${project.id}`} end className={pillClass}>
            <Layers aria-hidden="true" className="h-4 w-4" />
            Icons
            <span className={countClass}>{project.iconCount}</span>
          </NavLink>
          <NavLink to={`/projects/${project.id}/${isFont ? "font" : "sprite"}`} className={pillClass}>
            {isFont ? <Type aria-hidden="true" className="h-4 w-4" /> : <Shapes aria-hidden="true" className="h-4 w-4" />}
            {isFont ? "Icon Font" : "Sprite"}
          </NavLink>
          <NavLink to={`/projects/${project.id}/settings`} className={pillClass}>
            <Settings aria-hidden="true" className="h-4 w-4" />
            Settings
          </NavLink>
          <NavLink to={`/projects/${project.id}/trash`} className={pillClass}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Trash</span>
            {project.trashCount > 0 && <span className={countClass}>{project.trashCount}</span>}
          </NavLink>
        </nav>

        <div ref={actionsRef} className="ml-auto flex flex-wrap items-center gap-2 empty:hidden" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {project.prefix && <Badge className="font-mono uppercase">{`Prefix: ${project.prefix}`}</Badge>}
        {project.isArchived && <Badge icon={<Archive aria-hidden="true" className="h-3 w-3" />}>Archived</Badge>}
        {project.description && <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>}
      </div>

      {!project.access.canEdit && (
        <p role="note" className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          You are viewing this project. Only its owner can change it, but you can download icons or copy them into your own projects.
        </p>
      )}
    </header>
  );
}
