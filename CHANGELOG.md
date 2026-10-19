# Changelog

Log of changes made to this project during Claude Code sessions. Newest date last; append new entries below after each completed task.

**How this was verified:** the project folder is **not a Git repository**, so there is no Git history. Entries come from the session transcript and file modification times. Anything uncertain is marked **(unverified)**.

---

## 2026-10-16

### Setup / configuration
- **Created `server/.env`** with `MONGODB_URI`, `SESSION_SECRET` and `PORT=5000`, using values supplied by the user. Reason: the server will not start without `MONGODB_URI`.
- **Created `../.claude/launch.json`** (in `compiler project/`, one level above this project) with a `server` entry. Reason: lets the Claude desktop app start and stop the API with `npm run dev`.

### Dependencies
- **Ran `npm install` in `server/`** (197 packages). Touched `server/package-lock.json` (modified 2026-10-16). `server/package.json` unchanged. `npm audit` reported 6 vulnerabilities (1 critical in `proxy-addr`, 4 high, 1 moderate); none fixed.

### Validation
- Server started on port 5000. `GET /` returned 200, `GET /api/sprites` returned 401 without a token, an unknown path returned 404.
- MongoDB Atlas rejected the login ("bad auth") for every URI tried, so the server ran without a database connection. Cause: the password in `.env` did not match Atlas. Resolved on 2026-10-19 (see below).

---

## 2026-10-19

### Configuration
- **`server/.env`**: joined a `MONGODB_URI` that had been split across two lines; later replaced the URI with the correct user (`svg-compiler`, no `@admin` suffix) plus a placeholder password, which the user then replaced and corrected themselves in Atlas. Added `GOOGLE_CLIENT_ID`. Reason: the previous credentials were rejected and Google sign-in was not configured.
- **Created `client/.env`** with `VITE_API_URL=http://localhost:5000` and `VITE_GOOGLE_CLIENT_ID`. Reason: the client reads the Google client id at build/dev start.
- **`../.claude/launch.json`**: added a `client` entry (`npm run dev`, port 5173, `--strictPort`).
- **Google Cloud (outside the repo, user's account, approved in chat):** created project "SVG Sprite Compiler" (`svg-sprite-compiler-512106`); configured the Google Auth Platform (External audience, support/contact email and test user `ganeshwarigk@gmail.com`, accepted the API Services User Data Policy); created Web OAuth client "SVG Sprite Compiler Web" with authorized JavaScript origins `http://localhost:5173` and `http://localhost`. The client secret was not saved (the sign-in flow does not use it).
- **MongoDB Atlas (outside the repo):** inspected database users and the connection string. The `svg-compiler` user's password was reset by the user, not by Claude.

### New features / UI
- **`client/src/components/LoginModal.tsx`**: re-enabled the "Sign in with Google" button and the `GoogleLogo` component, which were commented out (the dialog previously offered Microsoft only). Reason: needed for Google sign-in to the library. Original file kept in the session scratchpad only (not in the project).

### Dependencies
- **Ran `npm install` in `client/`** (312 packages). `client/package-lock.json` was touched (modified 2026-10-19); `client/package.json` unchanged. `npm audit` reported 10 vulnerabilities (9 high, 1 moderate); none fixed.

### Validation
- Direct Mongoose connect + ping succeeded after the password was fixed. Server logged `[db] Connected to MongoDB Atlas` and created the `users`, `sprites` and `sprite_versions` collections.
- `POST /api/auth/google` with a bad token returned 401 "Invalid Compact JWS" (server has the client id). Before this it returned 500 "missing GOOGLE_CLIENT_ID".
- `npx tsc -b` in `client/` passed after the LoginModal change.
- Client loaded at `http://localhost:5173` with no console errors.
- Google sign-in could not be completed inside the app's browser pane (the pane blocks the Google popup). The user signed in in their own browser; afterwards MongoDB showed 1 user, 2 bundles and 2 sprite versions, which indicates sign-in and saving to the library worked. Sprite contents were not inspected by Claude **(unverified)**.

---

---

## 2026-10-19: Phase 0, baseline and safety (Icon Vault integration)

Logged separately from the earlier setup entries. First phase of the Icon Vault integration; no feature work yet. Git history now exists, so everything below is verified against commits. Each item is its own commit on `main` (local only, nothing pushed).

### Decisions recorded for the integration (from the user, in chat)
- **Hosting:** a normal always-on Node server (not Vercel). `server/vercel.json` becomes obsolete later; the host is still to be chosen.
- **Layout:** "Projects" workspace only. No separate Quick Compile page, so **signing in is required to use the app** (guest compiling goes away).
- **Admins:** listed in `ADMIN_EMAILS` in `server/.env` (checked per request, not stored in the database). User management = list users, delete a user (their projects are moved or removed), transfer projects. No passwords.
- **Public projects:** read-only for other users; they may copy icons into their own projects.
- **Themes:** light, dark and system, with a three-way toggle.
- **Scope:** include font builder, font import, project export/import; the CLI is rewritten and signs in with a revocable API token created in the web app.
- **Cutover:** the old UI is replaced directly (no switch). Git initialized.
- **Test data:** back up, then start clean (the two test bundles are not copied into projects).

### Changes
| Commit | Change | Files | Reason |
|---|---|---|---|
| `4f6622e` | Initialized Git on `main` and committed the project exactly as it was (69 files). `.gitignore` gained `backups/`. `.env` files, `node_modules` and `dist` are ignored. | `.gitignore` | Gives a rollback point before any integration work |
| `63eb4c8` | Applied the fixes from `SVG-sprite-react-db-fixed.zip` (taken from `astro tool/`, where the user moved it): corrected npm script names; `MONGODB_URI` read lazily so a missing value no longer crashes at import and a failed connection can be retried; sessions accept every provider the User model allows; version allocation retries up to 5 times, returns 409 when exhausted, and updates `currentVersion` atomically with `$max`; corrected README (removed `README.suggested.md`); added `.env.example` files. | `server/package.json`, `server/src/config/db.ts`, `server/src/lib/session.ts`, `server/src/routes/spriteRoutes.ts`, `README.md`, `client/.env.example`, `server/.env.example` | The folder lacked fixes that the zip already had |
| | **Not** taken from the zip: its `server/.env` (old credentials) and its `LoginModal.tsx` (our copy has the Google button re-enabled). | | Avoid old secrets; keep the 2026-10-19 UI change |
| `aec37e1` | Added `npm run backup:db`, which dumps every collection to `backups/<timestamp>/` (MongoDB Extended JSON; types restore exactly). | `server/src/scripts/backup-db.ts`, `server/package.json` | Safe copy of the test data before the data model changes |
| `d55e0d2` | Added `typecheck` scripts (server and client) and `npm test` in `server/` (Node's built-in runner via tsx, no new dependencies): 8 API smoke tests plus 5 session-token tests. Added `"include": ["src"]` to the server tsconfig so `tests/` does not break `npm run build`. README documents the commands. | `server/tests/smoke.test.ts`, `server/tests/session.test.ts`, `server/package.json`, `client/package.json`, `server/tsconfig.json`, `README.md` | A regression net before the large UI and data changes |

### Backup taken
- `backups/2026-10-19T11-28-33-474Z/` (project root, git-ignored, contains a user email and sprite XML): `users` 1, `sprites` 2 (`gg-new` public, `gg-2` private), `sprite_versions` 2 (11 and 12 symbols).
- Not yet discarded: the test data stays in the database until the new data model replaces it (Phase 1).

### Validation (verified)
- `server`: `npm run typecheck` passes; `npm run build` passes; `npm test` passes 13 of 13.
- Server starts with an empty `MONGODB_URI`, logs "Starting without DB connection" and still answers (`/` 200, `/api/sprites` 401). Before the fix it crashed at import.
- Regression run against the real database through a throwaway server instance (valid session token for the existing user): `/api/auth/me` 200; library list returned the 2 existing versions; saving a temporary bundle gave v1 then v2; two simultaneous saves got distinct v3 and v4 (the race fix); latest-by-name returned v4; deleting the bundle removed all 4 versions; the database ended at its original size (2 bundles, 2 versions).
- Backup restore format: re-parsing the backup files returned `ObjectId` and `Date` types for 2 + 2 + 1 documents.
- `client`: `tsc -b` passes; `vite build` succeeds (JS 463.6 kB, 135.5 kB gzipped; CSS 59.1 kB).
- `git check-ignore` confirms `server/.env`, `client/.env` and `node_modules` are ignored; no `.env` file is tracked; no secrets found in tracked files by a pattern scan.

### Baseline recorded, not fixed
- `client`: `npm run lint` fails with **31 problems (25 errors, 6 warnings) in 15 files that were there before this phase**: 15 `react-hooks/set-state-in-effect`, 4 `react-hooks/refs`, 4 `react-hooks/exhaustive-deps` (warnings), 2 `react-refresh/only-export-components`, 2 unnamed warnings, and 1 each of `no-unused-vars`, `preserve-manual-memoization`, `immutability` and `no-empty`. Later phases compare against these numbers.

### Not tested in this phase
- Google sign-in in the browser and compiling in the browser were **not re-run**. No client source file was changed in this phase (only a `package.json` script), so the client behaves as before, but that is an inference.
- The auth smoke tests do not cover a successful Microsoft sign-in or a real Google credential.
- The server's earlier dev instance was already running during these changes; behavior was verified on separate instances on ports 5055 and 5056.

### Next
- Phase 1 (backend foundation): admin allowlist, new Project, Folder, Icon and IconVersion models, permissions, validation.

---

## Known issues
- `server/.env` holds the database password and session secret in plain text. `SVG-sprite-react-db-fixed.zip` (in `compiler project/`) contains an older `.env` with the previous credentials; do not share it. (The zip has since been moved to `astro tool/`, together with an extracted copy that also holds that `.env`.)
- Folder `server/package.json` scripts `backfill:owner`, `backfill:version-updated-at` and `cleanup:orphans` point to files that do not exist; the zip has the corrected names. **Resolved in Phase 0 (`63eb4c8`).**
- `server/src/config/db.ts` throws at import when `MONGODB_URI` is missing (crashes instead of starting without a DB). The zip has a fix. **Resolved in Phase 0 (`63eb4c8`).**
- `GET /api/sprites/:name` looks up bundles across all users although names are unique per owner, so a duplicate name can return 403 or another user's bundle (`server/src/routes/spriteRoutes.ts`).
- `README.md` documents `MONGO_URI` (code reads `MONGODB_URI`) and omits `SESSION_SECRET`; `README.suggested.md` is correct. **Resolved in Phase 0 (`63eb4c8`).**
- Client lists unused dependencies: `svgo`, `svgson`, `svgstore`, `zustand`, `react-router-dom`, `react-dropzone`.
- `npm audit` vulnerabilities remain in both `server/` and `client/`.
- Google app is in "Testing" mode: only listed test users can sign in. Microsoft sign-in is not configured (`MS_CLIENT_ID` / `MS_TENANT_ID` unset).
- No client tests (the server now has 13, added in Phase 0). The project is under Git since Phase 0, with local commits only and no remote.

## Pending work
- ~~Decide whether to apply the fixes in the zip~~ Done in Phase 0.
- Fix the `GET /api/sprites/:name` ownership lookup.
- Rotate the database password and `SESSION_SECRET` if the zip or `.env` was ever shared.
- Add more test users or publish the Google app if others need access; configure Microsoft sign-in if wanted.
- ~~Initialize Git~~ Done in Phase 0. Still open: add a remote and push if wanted.
