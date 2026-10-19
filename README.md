# SVG Sprite Compiler

Compile individual SVG icons into a single `sprite.svg` (`<symbol>` + `<use>`), preview it, and optionally save it to a versioned library.

- **Client** (`client/`): React 19 + TypeScript + Vite + Tailwind CSS 4. All SVG processing (parsing, merging, conflict detection, demo/preview/ZIP generation) runs in the browser.
- **Server** (`server/`): Express 5 + TypeScript + MongoDB (Mongoose). Handles sign-in and stores sprite bundles and their versions.

## Features

- Add icons by drag-and-drop, by pasting SVG markup, or from your library.
- Update an existing sprite: load it, add icons, and resolve id conflicts (Replace / Skip / Keep both with a new id).
- Download a ZIP containing `sprite.svg`, `sprite-grid.svg`, `demo.html` and `preview.png`.
- Live demo with colour/gradient controls and copy-paste snippets for HTML, React, Vue, Angular, Svelte and Next.js.
- Library (requires sign-in with Google or Microsoft): save bundles, create new versions, rename, delete, and mark bundles public or private.

## Prerequisites

- Node.js 18+ and npm
- A MongoDB connection string (local or Atlas)
- OAuth client ids for Google and/or Microsoft if you want sign-in (the compiler itself works without signing in)

## Setup

```bash
cd server && npm install
cd ../client && npm install
```

### Server environment (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string. The server will not start without it. |
| `SESSION_SECRET` | Yes | Secret used to sign session JWTs (HS256). Minimum 16 characters. |
| `GOOGLE_CLIENT_ID` | For Google sign-in | Must match the client id used in the browser. |
| `MS_CLIENT_ID` | For Microsoft sign-in | Azure app (client) id. |
| `MS_TENANT_ID` | For Microsoft sign-in | Azure tenant id. |
| `ADMIN_EMAILS` | For admin features | Comma-separated emails of admins (case-insensitive). Read on every request and never stored; edit and restart to change. An email counts only if the provider verified it (always true for Google); for Microsoft work accounts only when `MS_TENANT_ID` is your own tenant id, not `common`. |
| `PORT` | No | Defaults to `5000`. |

### Client environment (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API base URL. Defaults to `http://localhost:5000`. |
| `VITE_GOOGLE_CLIENT_ID` | For Google sign-in | Same value as the server's `GOOGLE_CLIENT_ID`. |
| `VITE_MS_CLIENT_ID` | For Microsoft sign-in | Same value as the server's `MS_CLIENT_ID`. |
| `VITE_MS_TENANT_ID` | For Microsoft sign-in | Same value as the server's `MS_TENANT_ID`. |

## Run in development

```bash
# terminal 1
cd server && npm run dev      # http://localhost:5000

# terminal 2
cd client && npm run dev      # http://localhost:5173
```

## Build

```bash
cd server && npm run build && npm start
cd client && npm run build && npm run preview
```

The server also ships a `vercel.json` for deployment on Vercel.

## API

All `/api/sprites` and `/api/auth/me` routes require `Authorization: Bearer <session token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/google` | Exchange a Google ID token for a session token |
| POST | `/api/auth/microsoft` | Exchange a Microsoft ID token for a session token |
| GET | `/api/auth/me` | Current user |
| POST | `/api/sprites` | Save a bundle; always creates a new version |
| GET | `/api/sprites` | List your bundles plus public bundles |
| GET | `/api/sprites/:name` | Fetch by bundle name |
| GET | `/api/sprites/id/:id` | Fetch a specific version (includes XML) |
| PUT | `/api/sprites/:id` | Overwrite an existing version (owner only) |
| PATCH | `/api/sprites/:id/rename` | Rename a bundle |
| DELETE | `/api/sprites/:id` | Delete one version (`:id` is a version id). Add `?scope=bundle` to delete the whole bundle and all its versions. Deleting the last version removes the bundle. |

## Data model

- `users`: one per (provider, providerId).
- `sprites`: the bundle (name, owner, `isPublic`, `currentVersion`, `symbolCount`); unique per (owner, bundleName).
- `sprite_versions`: one document per (spriteId, version) holding the sprite XML and its symbol ids.

Added for the Icon Vault integration (defined and indexed, but not used by any route yet; the project, folder and icon routes arrive in Phase 2):

- `projects`: owner, name, description, prefix, colour, `purpose` (`sprite` or `font`, fixed at creation), `visibility` (`public` or `private`), `isArchived`.
- `folders`: nested through `parentId` (null = project root), ordered by `orderIndex`.
- `icons`: one SVG per document (markup stored in the database), `slug` unique per project among active icons, `codepoint` unique per project among active icons that have one, soft delete through `deletedAt`.
- `icon_versions`: earlier states of an icon, each with its own markup.

Admins are not stored: a user is an admin when their email is in `ADMIN_EMAILS`.

## Maintenance scripts

Scripts live in `server/src/scripts/` (`backfill-sprite-owner.ts`, `sprite-version-maintenance.ts`, `backup-db.ts`). Run them with `npx tsx src/scripts/<file>.ts` from `server/`.

- `npm run backup:db` (in `server/`) dumps every collection to `backups/<timestamp>/` at the project root as MongoDB Extended JSON. The folder is git-ignored because it contains user emails and sprite data.

## Checks

| Command | Where | What it does |
|---|---|---|
| `npm run typecheck` | `server/` and `client/` | TypeScript check without emitting files |
| `npm test` | `server/` | Unit and smoke tests (server boots without a database, auth gates, sessions, admin rule, permissions, validation, error mapping). No database or network needed |
| `npm run test:db` | `server/` | Model tests against a throwaway database on your cluster, dropped afterwards. Needs `MONGODB_URI` |
| `npm run build` | `server/` and `client/` | Production build |
| `npm run lint` | `client/` | ESLint. Currently reports 31 known problems; see CHANGELOG.md |
