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

## 2026-10-19: Phase 1, backend foundation (Icon Vault integration)

Logged separately from Phase 0. Server only: no route, client or old-data change yet, so users see no difference. Five commits on `main` (`b6b1bfb`, `d414115`, `6435de3`, `fb08bb7`, plus this entry), local only.

### Changes
| Commit | Change | Files | Reason |
|---|---|---|---|
| `b6b1bfb` | **Admin allowlist.** `ADMIN_EMAILS` (comma-separated, case-insensitive) is read on every call and never stored. An email counts only if the provider verified it (always true for Google), or for a Microsoft sign-in when `MS_TENANT_ID` is a specific tenant id (not `common`, `organizations` or `consumers`). `requireUser` now sets `req.isAdmin`; new `requireAdmin` middleware; `/api/auth/*` and `/api/auth/me` responses gain `role` (`admin` or `user`). A startup warning is logged when the list is empty. | `server/src/lib/admins.ts`, `server/src/middleware/requireAdmin.ts`, `server/src/middleware/requireUser.ts`, `server/src/routes/authRoutes.ts`, `server/src/routes/sessionUserRoutes.ts`, `server/src/index.ts`, `server/.env.example` | Admins come from `.env` (decision), and Microsoft work-account emails are not verified by Microsoft |
| `b6b1bfb` | **Shared error handling.** `AppError` family plus an Express error handler registered after all routes: validation errors become 400 with details, bad ids 400, duplicate keys 409, malformed or oversized JSON 400 or 413, unknown errors a generic 500 that never leaks the message. Response shape stays `{ error: string }`. Added the `zod` dependency (v4). | `server/src/lib/errors.ts`, `server/src/index.ts`, `server/package.json`, `server/package-lock.json` | The old pattern repeated try/catch in every route; Icon Vault returned 500 for validation errors |
| `d414115` | **New models:** `Project` (owner, name, description, prefix, colour, purpose fixed at creation, visibility default private, archive flag), `Folder` (nests via `parentId`), `Icon` (SVG markup stored in the document, soft delete via `deletedAt`), `IconVersion` (each version keeps its own markup). Partial unique indexes: icon slug unique per project among active icons; icon codepoint unique per project among active icons that have one. Indexes are synced at boot. | `server/src/models/Project.ts`, `Folder.ts`, `Icon.ts`, `IconVersion.ts`, `server/src/config/db.ts` | Replace the bundle-only model with projects, folders and per-icon records. Fixes two Icon Vault defects at the root: versions that could not restore old content, and slug clashes when restoring from the trash |
| `6435de3` | **Permissions:** admin and owner can do everything; another user on a public project can view it and copy icons out of it; on a private project nothing; not signed in nothing. **Validation schemas** for projects, folders, icons and batch actions; unknown keys are rejected; purpose cannot change after creation; tags lower-cased and codepoints upper-cased everywhere. | `server/src/lib/permissions.ts`, `server/src/lib/validation.ts` | Decision: public stays read-only for others; Icon Vault accepted unvalidated or inconsistent input in several places |
| `6435de3` and `d414115` | **Tests:** 41 new unit tests (admins, errors, permissions matrix of 4 actors by 2 project kinds, schemas) and 9 database model tests. New script `npm run test:db`; the database tests use a throwaway database that is dropped afterwards. | `server/tests/*.test.ts`, `server/tests/db/models.db.test.ts`, `server/package.json` | Safety net for the later phases |
| `fb08bb7` | README documents `ADMIN_EMAILS`, the new collections and `test:db`. | `README.md` | Keep docs current |

### Database effect
- Starting the server now creates four empty collections in the real database: `projects`, `folders`, `icons`, `icon_versions` (with their indexes). The old `users`, `sprites` and `sprite_versions` are untouched. No existing document was changed.
- The client does not read `role` yet.

### Validation (verified)
- `npm run typecheck` and `npm run build` in `server/`: pass.
- `npm test`: 54 of 54 pass (13 from Phase 0 plus 41 new). `npm run test:db`: 9 of 9 pass; the partial unique indexes work on this Atlas cluster; no test database was left behind.
- Real server and real database, two scenarios (test servers on ports 5057 to 5059, stopped afterwards):
  - `ADMIN_EMAILS` empty: `/api/auth/me` role `user`, startup warning logged.
  - `ADMIN_EMAILS` set to the signed-in user (set only for that test server, not in `.env`): role `admin`.
  - Malformed JSON returns a JSON 400 from the new handler; the library still returns 401 without a token; the four new collections and the icon indexes exist after boot.
  - Re-ran the Phase 0 library regression: list, save v1 and v2, concurrent saves v3 and v4, lookup by name, delete; the database ended at its original size (2 bundles, 2 versions).
- No client file changed in this phase (0 files), so the client checks from Phase 0 still apply.

### Not tested, or open
- `ADMIN_EMAILS` is **not yet set in `server/.env`**, so right now nobody is an admin. The role was verified only through a temporary environment variable.
- The Microsoft single-tenant branch of the admin rule is covered by unit tests only; no Microsoft sign-in was run.
- `requireAdmin` has no route using it yet, so it is unit-level only (it is exercised through no HTTP test).
- The new models are not used by any route yet. Project, folder and icon routes begin in Phase 2. Cascade rules (deleting a project removes its folders, icons and versions; folder cycle checks; same-project checks for folder and icon moves) are service-layer work and are **not** enforced by the database.
- A database named `test` exists on the cluster; it was not created by this work and was left alone.
- Clearing the two old test bundles (decision: start clean, backup already taken in Phase 0) is **not done yet**. The old library still runs on them, so I will clear them when the old library routes are retired at cutover, not now. This corrects the Phase 0 note that mentioned Phase 1.

### Next
- Phase 2 (icon pipeline): project and folder routes, then icon upload, paste, ZIP, sanitizing and optimizing, trash, versions, project-scoped batch actions and search.

---

## 2026-10-19: Phase 2, icon pipeline and project, folder and icon API (Icon Vault integration)

Logged separately from Phases 0 and 1. Server only: no client file changed, and the old library routes (`/api/sprites`) are untouched and still work. Six commits on `main` (`b88b95f`, `9d24318`, `656317c`, `bad6a3e`, `e460ca3`, plus this entry), local only.

### Changes
| Commit | Change | Files | Reason |
|---|---|---|---|
| `b88b95f` | Added `jsdom`, `dompurify`, `svgo` 4, `multer` 2 and `fflate` (ZIP read/write); `@types` for multer and jsdom. Split `src/app.ts` (builds the Express app) from `src/index.ts` (connects and listens). No behaviour change. | `server/package.json`, `server/package-lock.json`, `server/src/app.ts`, `server/src/index.ts` | Tests can start the app without spawning a process |
| `9d24318` | **SVG pipeline:** sanitizer, optimizer, a combined `prepareSvg`, and slug helpers. Removes scripts, event handlers, `foreignObject`, images, filters, `<style>` blocks (their rules are inlined first so colours survive), external links and external `url()` references (attributes and styles), and rejects XML entities. Size comes from width/height or the viewBox; a viewBox is added when missing. After optimizing, size and flags are re-read from the final markup. | `server/src/services/svgSanitizer.ts`, `svgOptimizer.ts`, `svgPipeline.ts`, `server/src/lib/slug.ts` | Icons are shown to other users, so everything stored must be clean |
| `656317c` | **Project and folder routes and services.** Projects: list (scope, status, purpose, search, sort, paging, icon counts and five sample icons from one aggregation), create, detail, update, delete with cascade, duplicate. Folders: list with counts, create, rename, move, delete. Private projects of others answer 404, visible-but-read-only answer 403. `requireDb` middleware (503 when the database is down). | `server/src/routes/projectRoutes.ts`, `folderRoutes.ts`, `server/src/services/projectService.ts`, `folderService.ts`, `cascade.ts`, `server/src/lib/http.ts`, `server/src/middleware/requireDb.ts`, `server/src/lib/validation.ts` | Needed before icons can live in projects |
| `bad6a3e` | **Icon routes and services:** paste, upload (SVG files and ZIPs), copy between projects, list, global search, download (one SVG or a ZIP), edit, optimize (one or many), versions (list, restore), trash (soft delete, restore, permanent delete, empty), batch move/tag/delete/restore/optimize. Also: private-use-only codepoints (`lib/codepoint.ts`), ZIP reading with limits (`zipService.ts`), multer error mapping. | `server/src/routes/iconRoutes.ts`, `server/src/services/iconService.ts`, `zipService.ts`, `server/src/lib/codepoint.ts`, `server/src/lib/validation.ts`, `server/src/lib/errors.ts`, `server/src/app.ts` | The core of the Icon Vault feature set, on MongoDB and the existing sign-in |
| `e460ca3` | README documents the new API, limits and data model. | `README.md` | Keep docs current |

### Icon Vault defects found and not carried over
Confirmed by reading the Icon Vault code and, where noted, by a test here.
- **Optimizing silently did nothing.** Its SVGO configuration (`overrides.removeViewBox`) throws under SVGO 4, and its `try/catch` fell back to the original file. Confirmed by running SVGO 4; a test now proves optimizing shrinks files.
- **Version restore could not restore.** Every version pointed at the same file. Versions now store their own markup; a test restores real old content and undoes the restore.
- **Batch actions reached other projects.** Ids were not checked against the project in the URL, so an editor of one project could move, tag, delete or optimize another project's icons. All batch queries now filter by project; tests assert other projects are untouched.
- **ZIP uploads created duplicate folders** and did not skip `__MACOSX`. Existing folders are reused; metadata and hidden entries are skipped.
- **Restoring from the trash could create a duplicate id.** The unique index now covers active icons only; a restore into a taken id gets a numbered one and the response says so.
- **Size, viewBox and flags went stale after optimizing**, and percentage sizes were read as pixels. Both fixed.
- **Colours from `<style>` blocks were lost** (the sanitizer removed the blocks). Rules are inlined first.
- **A rename could pick a random suffix.** A clash is now refused with 409.
- **Any codepoint was accepted** (even one that would replace a letter). Only Unicode private-use ranges are accepted.
- **Folder ids from other projects were accepted**, and a folder could be moved into its own subfolder. Both refused.
- **Validation errors returned 500**; they return 400 with details.

### Changes in behaviour you may notice
- **Codepoints are not assigned on upload.** They stay empty until set by hand (or by the first font build, which arrives with the font phase). Reason: avoids races and keeps codepoints stable.
- **`removeDimensions` is on by default** when optimizing, so icons scale to their container; the viewBox is kept and size is read from it.
- **Malformed SVG is rejected** (must be well-formed XML) instead of being repaired into an empty icon. Files with undefined entities such as `&nbsp;` are therefore refused.
- **`<title>` is removed** by the sanitizer allowlist (SVGO 4 would keep it).
- Sibling folder names are unique (case-insensitive); deleting a folder moves its icons to the project root.
- Permanent deletion of a single icon requires it to be in the trash first.

### Validation (verified)
- `npm run typecheck`, `npm run build`: pass.
- `npm test`: **91 of 91** pass (no database): sanitizer attacks and survivals, optimizer shrinks files, slug helpers, ZIP limits, codepoint rule, plus the earlier admin, permission, validation, error and session tests.
- `npm run test:db`: **100 of 100** pass against a throwaway database that is dropped afterwards (9 model tests, 41 project and folder tests, 50 icon tests). They cover every kind of user (guest, owner, other, admin) over HTTP, the cross-project batch cases, ZIP uploads with folders, duplicate strategies, versions, trash, copy, search and downloads. No test database was left behind.
- Real server and real database (test server on port 5070, stopped afterwards): created a project, a folder, pasted an icon (156 to 89 bytes), uploaded a ZIP (2 icons, 2 folders), edited and restored a version, trashed and restored, copied to another project, searched, downloaded 3 icons as a ZIP, duplicated and deleted a project (3 icons and 3 folders cascaded); the database ended at its original size (2 bundles, 2 versions, 1 user, no projects). The Phase 1 and Phase 0 checks were re-run and pass, so the old library is unchanged.
- One of my check scripts first failed because Node's `fetch` refuses port 5060; it was rerun on 5070. Another read a ZIP as text; the script was fixed and the affected steps rerun. Neither was a server problem.

### Not tested, or open
- **Nothing was run in a browser**; the client does not use these routes yet (Phase 3 onward).
- Large uploads are processed one file at a time on the server: 1000 icons per request is allowed but **not benchmarked**, and a proxy timeout is possible. The client should send big sets in chunks.
- ZIP size limits trust the sizes in the ZIP header first and re-check after unpacking, so a hostile ZIP can still use memory briefly before it is rejected.
- No rate limiting on any route.
- `jsdom` is pinned to 26: version 30 needs Node 22.15 or newer and failed on Node 22.14.
- Sprite import, font import, project export and import, the sprite and font builders, admin routes (user and project management), API tokens and the CLI are **not done**; they belong to later phases.
- `ADMIN_EMAILS` is still not set in `server/.env`; admin behaviour was verified through test users only.
- Deleting a user (and what happens to their projects) is not implemented yet.
- The old test bundles are still in the database; clearing them waits for the cutover.

### Next
- Phase 3 (frontend platform): Tailwind 4 theme with light, dark and system modes, new dependencies, API client, signed-out landing page and app shell.

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
- Phase 3 onward: client work, sprite and font builders, import and export, admin routes, API tokens and the CLI (see the Phase 2 section, Not tested, or open).
