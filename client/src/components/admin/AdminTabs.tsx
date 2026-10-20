// The two admin screens as tabs under the page title (Users and Projects), with a link back to the dashboard.
import { ArrowLeft } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    isActive ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
  );

export default function AdminTabs() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Link to="/" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to dashboard
      </Link>
      <nav aria-label="Administration sections" className="inline-flex gap-1 rounded-xl border border-border bg-muted p-1">
        <NavLink to="/admin" end className={linkClass}>
          Users
        </NavLink>
        <NavLink to="/admin/projects" className={linkClass}>
          Projects
        </NavLink>
      </nav>
    </div>
  );
}
