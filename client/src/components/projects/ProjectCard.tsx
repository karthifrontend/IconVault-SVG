// One project on the dashboard: accent avatar, name, badges, a few sample icons, counts, and an actions menu. The whole card opens the project (a stretched link on the name), and the menu sits above it.
import { Archive, ArchiveRestore, Copy, FolderOpen, Globe, Lock, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { ProjectSummary } from "../../api/types";
import { formatRelative, pluralize } from "../../lib/format";
import ActionMenu, { type MenuAction } from "../ui/ActionMenu";
import Badge from "../ui/Badge";
import SvgPreview from "../ui/SvgPreview";
import ProjectAvatar from "./ProjectAvatar";

export type ProjectCardActions = {
  onEdit: (project: ProjectSummary) => void;
  onDuplicate: (project: ProjectSummary) => void;
  onToggleArchive: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
};

type ProjectCardProps = ProjectCardActions & { project: ProjectSummary; currentUserId: string };

export default function ProjectCard({ project, currentUserId, onEdit, onDuplicate, onToggleArchive, onDelete }: ProjectCardProps) {
  const mine = project.owner.id === currentUserId;
  const actions: MenuAction[] = [
    { label: "Duplicate", icon: <Copy aria-hidden="true" className="h-4 w-4" />, onSelect: () => onDuplicate(project) },
  ];
  if (project.access.canManage) {
    actions.unshift({ label: "Edit details", icon: <Pencil aria-hidden="true" className="h-4 w-4" />, onSelect: () => onEdit(project) });
    actions.push(
      project.isArchived
        ? { label: "Unarchive", icon: <ArchiveRestore aria-hidden="true" className="h-4 w-4" />, onSelect: () => onToggleArchive(project) }
        : { label: "Archive", icon: <Archive aria-hidden="true" className="h-4 w-4" />, onSelect: () => onToggleArchive(project) },
      { label: "Delete", icon: <Trash2 aria-hidden="true" className="h-4 w-4" />, onSelect: () => onDelete(project), destructive: true },
    );
  }

  return (
    <li className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="flex items-start gap-3">
        <ProjectAvatar name={project.name} color={project.color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">
            <Link to={`/projects/${project.id}`} className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {project.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{mine ? "You" : project.owner.displayName}</p>
        </div>
        <ActionMenu label={`Actions for ${project.name}`} actions={actions} className="relative z-10 -mr-1 -mt-1" />
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{project.description || "No description."}</p>

      <div className="flex flex-wrap gap-1.5">
        <Badge icon={project.visibility === "public" ? <Globe aria-hidden="true" className="h-3 w-3" /> : <Lock aria-hidden="true" className="h-3 w-3" />}>{project.visibility === "public" ? "Public" : "Private"}</Badge>
        <Badge>{project.purpose === "font" ? "Font" : "Sprite"}</Badge>
        {project.isArchived && <Badge icon={<Archive aria-hidden="true" className="h-3 w-3" />}>Archived</Badge>}
      </div>

      <div className="flex h-8 items-center gap-2 overflow-hidden rounded-lg bg-muted px-2" role={project.sampleIcons.length > 0 ? "img" : undefined} aria-label={project.sampleIcons.length > 0 ? `${pluralize(project.sampleIcons.length, "sample icon")}` : undefined}>
        {project.sampleIcons.length > 0 ? (
          project.sampleIcons.map((icon) => <SvgPreview key={icon.id} svg={icon.svg} size={20} />)
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
            No icons yet
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {pluralize(project.iconCount, "icon")} · Updated {formatRelative(project.updatedAt)}
      </p>
    </li>
  );
}
