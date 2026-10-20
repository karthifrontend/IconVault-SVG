// The totals at the top of both admin screens: users (and how many are admins), projects (private, public, draft), icons, font packages kept and active API tokens.
import { Box, FolderKanban, KeyRound, Package, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { getAdminStats } from "../../api/admin";
import { useResource } from "../../hooks/useResource";

function Card({ icon, label, value, note }: { icon: ReactNode; label: string; value: number; note?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}

// `version` changes after something was deleted or moved, so the numbers are fetched again.
export default function AdminStats({ version = 0 }: { version?: number }) {
  const stats = useResource(`admin-stats:${version}`, getAdminStats);
  if (stats.error && !stats.data) return null;
  const data = stats.data;
  return (
    <section aria-label="Workspace totals" className={`mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${stats.loading && data ? "opacity-60" : ""}`}>
      {data ? (
        <>
          <Card icon={<Users aria-hidden="true" className="h-5 w-5" />} label="Users" value={data.users} note={`${data.admins} admin${data.admins === 1 ? "" : "s"}`} />
          <Card icon={<FolderKanban aria-hidden="true" className="h-5 w-5" />} label="Projects" value={data.projects} note={`${data.privateProjects} private, ${data.publicProjects} public, ${data.draftProjects} draft`} />
          <Card icon={<Box aria-hidden="true" className="h-5 w-5" />} label="Icons" value={data.icons} />
          <Card icon={<Package aria-hidden="true" className="h-5 w-5" />} label="Font packages kept" value={data.fontBuilds} />
          <Card icon={<KeyRound aria-hidden="true" className="h-5 w-5" />} label="Active API tokens" value={data.activeTokens} />
          <Card icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />} label="Admins" value={data.admins} note="set in ADMIN_EMAILS" />
        </>
      ) : (
        Array.from({ length: 6 }, (_, i) => <div key={i} aria-hidden="true" className="h-[4.25rem] animate-pulse rounded-xl bg-muted" />)
      )}
    </section>
  );
}
