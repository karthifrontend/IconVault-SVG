// Controls above the icon list: search, sort, grid or list view, the preview background, and (for editors) the Upload icons menu. Also the "select all" checkbox.
import { Copy, LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { SURFACES, SURFACE_LABELS, type Surface } from "../../lib/previewSurface";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/Fields";
import UploadMenu, { type UploadKind } from "./UploadMenu";

export type IconSort = "newest" | "oldest" | "name" | "name-desc" | "largest";
export type IconView = "grid" | "list";

type IconToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  sort: IconSort;
  onSort: (sort: IconSort) => void;
  view: IconView;
  onView: (view: IconView) => void;
  surface: Surface;
  onSurface: (surface: Surface) => void;
  canAdd: boolean;
  onUpload: (kind: UploadKind) => void;
  // Select all: how many are loaded and how many are selected.
  loaded: number;
  selected: number;
  onSelectAll: (checked: boolean) => void;
};

export default function IconToolbar({ search, onSearch, sort, onSort, view, onView, surface, onSurface, canAdd, onUpload, loaded, selected, onSelectAll }: IconToolbarProps) {
  const allRef = useRef<HTMLInputElement | null>(null);
  const all = loaded > 0 && selected === loaded;
  const some = selected > 0 && selected < loaded;

  // "Indeterminate" is a property of the element, not an attribute.
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <label htmlFor="icon-search" className="sr-only">
            Search icons
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="icon-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by name or tag"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          />
        </div>
        <SelectField label="Sort by" hideLabel value={sort} onChange={(event) => onSort(event.target.value as IconSort)} className="h-10 w-auto">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="largest">Largest</option>
        </SelectField>
        <SelectField label="Preview background" hideLabel value={surface} onChange={(event) => onSurface(event.target.value as Surface)} className="h-10 w-auto">
          {SURFACES.map((value) => (
            <option key={value} value={value}>
              {`Background: ${SURFACE_LABELS[value]}`}
            </option>
          ))}
        </SelectField>
        <div role="group" aria-label="View" className="inline-flex rounded-lg border border-input bg-muted p-0.5">
          {(
            [
              ["grid", "Grid view", LayoutGrid],
              ["list", "List view", List],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              title={label}
              onClick={() => onView(value)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                view === value && "bg-background text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input ref={allRef} type="checkbox" checked={all} disabled={loaded === 0} onChange={(event) => onSelectAll(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Select all {loaded} shown
        </label>
        {canAdd && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Copy aria-hidden="true" className="h-4 w-4" />} onClick={() => onUpload("copy")}>
              Copy from project
            </Button>
            <UploadMenu onSelect={onUpload} />
          </div>
        )}
      </div>
    </div>
  );
}
