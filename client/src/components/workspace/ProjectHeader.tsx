// Top of a project: where you are (back to Projects), the project's name and badges, a note when it is read-only for you, and links to its sections.
import { Archive, ArrowLeft, Globe, Lock } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import type { ProjectDetail } from "../../api/types";
import { cn } from "../../lib/cn";
import Badge from "../ui/Badge";
import ProjectAvatar from "../projects/ProjectAvatar";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
  );

export default function ProjectHeader({ project }: { project: ProjectDetail }) {
  return (
    <header>
      <Link to="/" className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Projects
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ProjectAvatar name={project.name} color={project.color} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge icon={project.visibility === "public" ? <Globe aria-hidden="true" className="h-3 w-3" /> : <Lock aria-hidden="true" className="h-3 w-3" />}>{project.visibility === "public" ? "Public" : "Private"}</Badge>
            <Badge>{project.purpose === "font" ? "Font" : "Sprite"}</Badge>
            {project.isArchived && <Badge icon={<Archive aria-hidden="true" className="h-3 w-3" />}>Archived</Badge>}
            <span className="text-xs text-muted-foreground">by {project.owner.displayName}</span>
          </div>
        </div>
      </div>

      {project.description && <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{project.description}</p>}

      {!project.access.canEdit && (
        <p role="note" className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          You are viewing this project. Only its owner can change it, but you can download icons or copy them into your own projects.
        </p>
      )}

      <nav aria-label="Project sections" className="mt-4 flex gap-1 border-b border-border">
        {/* Absolute paths: relative links would resolve against the current section. */}
        <NavLink to={`/projects/${project.id}`} end className={tabClass}>
          Icons
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{project.iconCount}</span>
        </NavLink>
        <NavLink to={`/projects/${project.id}/trash`} className={tabClass}>
          Trash
          {project.trashCount > 0 && <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{project.trashCount}</span>}
        </NavLink>
        <NavLink to={`/projects/${project.id}/settings`} className={tabClass}>
          Settings
        </NavLink>
      </nav>
    </header>
  );
}
