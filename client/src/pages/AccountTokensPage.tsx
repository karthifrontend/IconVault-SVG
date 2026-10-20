// Personal API tokens for the command line and scripts: create one (the secret is shown once, with a copy button), see when each was last used, and revoke. A revoked token stops working at once.
import { Copy, KeyRound, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createToken, listTokens, revokeToken } from "../api/tokens";
import type { ApiTokenItem, CreatedApiToken } from "../api/types";
import { Button } from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Dialog from "../components/ui/Dialog";
import DialogFooter from "../components/ui/DialogFooter";
import { TextField } from "../components/ui/Fields";
import Badge from "../components/ui/Badge";
import { useToast } from "../context/ToastContext";
import { useResource } from "../hooks/useResource";
import { copyText } from "../lib/clipboard";
import { formatDate, formatRelative } from "../lib/format";

export default function AccountTokensPage() {
  const { showToast } = useToast();
  const tokens = useResource("api-tokens", listTokens);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [revoking, setRevoking] = useState<ApiTokenItem | null>(null);
  const list = tokens.data?.tokens ?? [];
  const active = list.filter((token) => !token.revokedAt).length;
  const max = tokens.data?.maxActive ?? 10;

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-16 pt-[calc(57px+2rem)] outline-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">API tokens</h1>
        <Button variant="primary" icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={() => setCreating(true)} disabled={active >= max}>
          New token
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A token lets the command line or a script act as you: read and change your own projects and download public ones. It never has admin rights and cannot create other tokens. Treat it like a password, and revoke it if it leaks.
      </p>

      {tokens.error && !tokens.data ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 p-6 text-center">
          <p className="font-medium text-destructive">{tokens.error.message}</p>
          <Button className="mt-3" onClick={tokens.reload}>
            Try again
          </Button>
        </div>
      ) : !tokens.data ? (
        <div aria-busy="true" aria-label="Loading tokens" className="mt-4 h-32 animate-pulse rounded-xl bg-muted" />
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center">
          <KeyRound aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-base font-semibold">No tokens yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to use the command line.</p>
        </div>
      ) : (
        <>
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {active} of {max} active tokens in use
          </p>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {list.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {token.name}
                    {token.revokedAt && <Badge>Revoked</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{token.prefix}…</span> · created {formatDate(token.createdAt)} · {token.lastUsedAt ? `last used ${formatRelative(token.lastUsedAt)}` : "never used"}
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button size="sm" variant="destructive" onClick={() => setRevoking(token)} aria-label={`Revoke ${token.name}`}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <CreateTokenDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(token) => {
          setCreated(token);
          tokens.reload();
        }}
      />
      <ShownOnceDialog token={created} onClose={() => setCreated(null)} />
      <ConfirmDialog
        open={revoking !== null}
        title={`Revoke “${revoking?.name ?? ""}”?`}
        message="Anything using this token stops working immediately. This cannot be undone; you can create a new token."
        confirmLabel="Revoke token"
        destructive
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await revokeToken(revoking.id);
          tokens.reload();
          showToast(`Revoked “${revoking.name}”.`, "success");
        }}
      />
    </main>
  );
}

function CreateTokenDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (token: CreatedApiToken) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="New API token" size="sm">
      <CreateForm onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (token: CreatedApiToken) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a name, for example the machine or script that will use it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createToken(name.trim()));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Name" value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} hint="Helps you recognise it later, e.g. “CI server”." />
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Create token
        </Button>
      </DialogFooter>
    </form>
  );
}

// The secret is only available now; closing this dialog is the last chance to copy it.
function ShownOnceDialog({ token, onClose }: { token: CreatedApiToken | null; onClose: () => void }) {
  const { showToast } = useToast();
  return (
    <Dialog open={token !== null} onClose={onClose} title="Copy your new token" description="This is the only time it is shown." size="md">
      {token && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input readOnly aria-label="Your new token" value={token.token} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-input bg-muted px-3 py-2 font-mono text-xs" />
            <Button
              icon={<Copy aria-hidden="true" className="h-4 w-4" />}
              onClick={async () => showToast((await copyText(token.token)) ? "Copied the token." : "Could not copy. Select it and copy by hand.", "success")}
            >
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Use it with the command line: <code className="rounded bg-muted px-1 py-0.5 text-xs">svgsprite login</code> and paste it when asked, or set <code className="rounded bg-muted px-1 py-0.5 text-xs">SVGSPRITE_TOKEN</code>.
          </p>
          <DialogFooter>
            <Button variant="primary" onClick={onClose}>
              I have copied it
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}
