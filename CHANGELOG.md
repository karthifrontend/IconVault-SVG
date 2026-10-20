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

## 2026-10-19: Phase 3, frontend platform (Icon Vault integration)

Logged separately from Phases 0 to 2. Client only; the server is untouched in this phase. The signed-in workspace is still the pre-redesign compiler screen (it is replaced in Phases 4 and 5). Six commits on `main` (`d2f8797`, `5a79813`, `76cd607`, `541aa4d`, `3e618f3`, plus this entry), local only.

### Changes
| Commit | Change | Files | Reason |
|---|---|---|---|
| `d2f8797` | Added `lucide-react`, `clsx`, `tailwind-merge`; test tooling `vitest` 5, `@testing-library/react`, `user-event`, `jest-dom`, `jsdom` (pinned to 26: version 30 needs Node 22.15+). `npm test` and `npm run test:watch` in `client/`. | `client/package.json`, `client/package-lock.json`, `client/vite.config.ts`, `client/src/test/setup.ts` | The client had no tests and the new interface needs icons and class helpers |
| `5a79813` | **Colour theme system (light, dark, system).** HSL colour tokens for both themes, a class-based dark variant and Tailwind 4 utilities (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, ...). A script in `index.html` applies the saved theme before first paint. `ThemeProvider`, `useTheme` and a three-button `ThemeToggle`; the choice is saved, follows the operating system while on System, syncs across tabs and survives blocked storage. The old light-only screens are wrapped in `.legacy-light` so they stay light. | `client/src/index.css`, `client/index.html`, `client/src/lib/theme.ts`, `client/src/lib/cn.ts`, `client/src/context/ThemeProvider.tsx`, `themeContext.ts`, `client/src/hooks/useTheme.ts`, `client/src/components/ui/ThemeToggle.tsx` | Decision: light, dark and system themes |
| `76cd607` | **Typed API client** for the Phase 1 and 2 routes: a shared axios instance that sends the signed-in user's token and turns every failure into an `ApiError` with the server's message, status and validation details (also from inside downloaded Blobs; unreachable server gets a plain message); types mirroring the server; one function per route in `projects.ts`, `folders.ts`, `icons.ts`. | `client/src/api/http.ts`, `types.ts`, `projects.ts`, `folders.ts`, `icons.ts` | The new screens need a single, tested way to talk to the server |
| `541aa4d` | **App shell and landing page.** `AppHeader` (replaces the old `Navbar`, which is deleted) with brand, theme switch, Sign in or the user menu; `UserMenu` (avatar or initials, name, email, provider, Admin badge, Sign out; Escape, outside click and Tab-away close it); `LandingPage` for signed-out visitors; `App` with loading state, skip link and landmarks; `LoginModal` restyled with tokens and reworded; `AuthContext` and `ServerUser` carry the server's `role`; `ThemeProvider` added in `main.tsx`; small `lib/navigation.ts` so tests can replace the page reload. | `client/src/App.tsx`, `main.tsx`, `client/src/components/shell/AppHeader.tsx`, `UserMenu.tsx`, `client/src/pages/LandingPage.tsx`, `client/src/components/LoginModal.tsx`, `client/src/context/AuthContext.tsx`, `client/src/api/auth.ts`, `client/src/lib/navigation.ts`, removed `client/src/components/Navbar.tsx` | Decisions: sign-in is required (no guest compile), Door 2 layout, replace the old UI |
| `3e618f3` | Ring on the selected theme button; README updated (sign-in required, theme, client tests). | `client/src/components/ui/ThemeToggle.tsx`, `README.md` | The selected state should not rely on a subtle shade alone |

### Changes in behaviour you will notice
- **Signing in is now required.** A signed-out visitor sees the landing page; **compiling without an account no longer works** (decided earlier).
- The login dialog says "Sign in" with a Cancel button (the "Continue as Guest" wording is gone).
- The header is new: theme switch, and for signed-in users an account menu with Sign out. It is exactly 57px tall because the legacy compiler positions itself below a header of that height.
- Dark mode applies to the header, landing page, sign-in dialog and menu. **The legacy compiler and library panel stay light in dark mode** until they are replaced.
- Admins get an "Admin" badge in the account menu once `ADMIN_EMAILS` is set on the server.
- Bundle size: JavaScript 463.6 kB to 506.8 kB (+43 kB), CSS 59.1 kB to 65.2 kB, because of the new libraries.

### Found along the way
- A contrast test that reads the real tokens caught two weak colour choices of my own: input borders at 1.65:1 (needs 3:1 for control edges) and the dark-mode red at 4.2:1 as text (needs 4.5:1). Both were fixed; the test now guards every text, border and focus-ring pair in both themes (WCAG AA 4.5:1 for text, 3:1 for control borders and the focus ring).
- Vitest returns an empty string for `?raw` CSS imports, so the contrast test reads the stylesheet from disk (with Node types for that one file only).
- Node's `fetch` refuses some ports (5060 earlier); not relevant to the client but noted for scripts.

### Validation (verified)
- `npm test` in `client/`: **93 of 93** pass (7 files): theme logic, provider and toggle (including keyboard and cross-tab), contrast of both themes, class helper, the API client (method, URL, query, body, headers and errors for every function), and the app shell (loading, landing, landmarks, skip link, sign-in dialog and its error and success messages, signed-in view, account menu keyboard behaviour, sign out, welcome message).
- `npx tsc -b`: passes. `npm run build`: succeeds.
- `npm run lint`: **31 problems, the same count as the Phase 0 baseline**; none are in code added since (the new files were linted separately and are clean).
- Server unit tests still pass 91 of 91 (the server was not changed).
- In the browser pane (client on 5173, server on 5000): landing page in light and dark; the sign-in dialog in dark; phone width 375px with no sideways scroll; the theme switch applies, saves and the selected button is marked (`aria-pressed`); the signed-in header, account menu and the legacy compiler with its library panel under the new header (layout intact; the library loaded through the existing `/api/sprites`); Sign out returns to the landing page, clears the session, keeps the theme and shows "Logged out successfully"; no console errors. The signed-in checks used a **throwaway test user** created in the development database for this purpose and deleted afterwards (the database is back to 1 real user and the 2 test bundles).

### Not tested, or open
- **A real Google or Microsoft sign-in was not re-run after the shell change.** The sign-in popup is blocked in the browser pane, and the signed-in checks above used a test session instead. The sign-in code path itself was not modified except for reading `role`, but please sign in once in your own browser to confirm.
- System mode was verified by unit tests and by the default (operating system light); switching the operating system to dark while the page is open was not tried in a real browser.
- Only the automated roles, labels and keyboard checks were done for accessibility; **no screen reader and no Firefox or Safari testing**. Theme buttons are 28px, which meets WCAG 2.2's 24px minimum but is smaller than the 44px often recommended on phones.
- Tablet widths were not checked.
- The API client is not used by any screen yet; the old `api/sprites.ts` is untouched and still drives the library.
- The landing page describes sprites, projects, clean uploads and sharing; fonts are not mentioned because the font builder does not exist yet.

### Next
- Phase 4 (dashboard and workspace): project dashboard, folder tree, icon grid and list, icon drawer, bulk actions, trash, upload and paste dialogs.

---

## 2026-10-20: Phase 4, dashboard and project workspace (Icon Vault integration)

Logged separately from Phases 0 to 3. Client only; the server is untouched. Signed-in users now land on a projects dashboard and open project workspaces; the pre-redesign compiler is kept at `/classic` (a "Classic compiler" link in the header, hidden on phone widths) until Phase 5 rebuilds it inside projects. Seven commits on `main` (`d638596`, `b6ed613`, `3523632`, `91084ee`, `49ca45b`, `2e3d216`, `e0ea761`, plus this entry), local only.

### Changes
| Commit | Change |
|---|---|
| `d638596` | Shared building blocks: dialog (centred or side drawer), confirm dialog, buttons, form fields, tabs, action menu, badges, toasts with Undo, safe inline SVG preview, `useResource`, debounce, selection and persistent-choice hooks |
| `b6ed613` | **Projects dashboard** (`/`): cards with icon previews, filters (mine / public, purpose, active / archived, sort; kept in the address), search that also finds icons across projects and copies them into one of your projects, create, edit, duplicate, archive, delete |
| `3523632` | **Project workspace** (`/projects/:id/*`): header with Icons, Trash and Settings sections, read-only note for projects you can only view, folder tree (nested, create, rename, delete, drag icons onto folders, collapsible on phones; selected folder kept in the address) |
| `91084ee` | Building blocks for browsing and adding icons: icon card and table rows, toolbar, bulk bar, upload (files, ZIP, paste; duplicate handling; batches of 100), copy-from-project |
| `49ca45b` | **Icons section** (search, sort, grid or table, "Show more" up to 1000, select, move, tag, optimize, download, move to trash with Undo) and the **icon drawer** (sizes and backgrounds, copy SVG / React / Vue, download, optimize, edit name, folder, tags and codepoint, edit code, version history and restore, font-conversion warnings) |
| `2e3d216` | **Trash** (list, restore one or all with a note when an id or codepoint was taken meanwhile, delete for good, empty trash, each with confirmation) and **Settings** (details, edit, archive or unarchive, delete project) |
| `e0ea761` | Routing: `BrowserRouter`; `/` dashboard, `/projects/:id/*` workspace, `/classic` legacy compiler, anything else redirects to `/`; brand link is a router link |

### Changes in behaviour you will notice
- After signing in you see **Projects**, not the old compiler. The old compiler and its library panel are at **/classic** and still work (verified loading), but they are separate from the new projects until Phase 5.
- Public projects owned by others are read-only for you: you can view, download and copy icons, not change them. Trash and Settings changes are for the owner (and admins).
- Preferences remembered in the browser: grid or table, sort order, preview background, theme.
- Bundle size: JavaScript 506.8 kB to 661.0 kB (192 kB gzip), CSS 65.2 kB to 73.9 kB.

### Validation (verified)
- `npm test` in `client/`: **367 of 367** pass (25 files), including new tests for every screen above (loading, empty, error and retry states, permissions, bulk actions and Undo, drawer edits, trash, settings, routing).
- `npx tsc -b`: passes. `npm run build`: succeeds. `npm run lint`: **31 problems, the same as the baseline**; all new files lint clean.
- In the browser pane with a throwaway test user (deleted afterwards; database back to 1 real user): dashboard; opening a project; icon grid in light and dark and at phone width (375px, no sideways scroll); opening the drawer and renaming an icon (confirmed on the server, list refreshed, focus returned); selecting icons and the bulk bar; move to trash with confirmation, counts updating and the Undo toast; Trash listing and restoring one icon; Settings with the danger zone; `/classic` loading the old compiler.

### Not tested, or open
- **Real Google or Microsoft sign-in** was not re-run (the test session was injected). Please sign in once in your own browser, as agreed.
- Not exercised in the browser: upload and paste dialogs, copy-from-project, folder create, rename and drag-and-drop, tag and move dialogs, optimize, drawer code editing and version restore, empty trash, edit project, archive and delete project. They are covered by component tests only.
- Drag and drop and the 1000-icon limit were tested with simulated events, not real ones; large projects (hundreds of icons) were not tried for speed.
- No screen reader, Firefox or Safari testing; tablet widths not checked.
- Small known rough edges: the search placeholder is cut off on phone widths; on phones the "Classic compiler" link is hidden; the legacy compiler stays light in dark mode.
- Test runs were slow and timed out while the computer was heavily loaded (load average above 200 from system processes); they pass on a quiet machine.

### Next
- Phase 5: bring the compiler into projects (Sprite tab using the existing in-browser engine), import a sprite with a conflict dialog, retire the old library routes and clear the old test bundles.

## 2026-10-20: Phase 5, compiler inside projects and retirement of the old library (Icon Vault integration)

Logged separately from Phases 0 to 4. Client and server. Commits on `main`: `c0d3a20` (Sprite section and sprite import), `02d9f52` (retirement of the old library), plus this entry; local only.

### Changes
| Commit | Change |
|---|---|
| `c0d3a20` | **Sprite section** in every project (`/projects/:id/sprite`, new "Sprite" link in the project header). It builds a sprite **in the browser** from the project's icons (all, or one folder with its subfolders; paged fetch past 1000 icons) using the existing compiler engine (`utils/buildDemo.ts`: sprite document, grid sprite, demo page; `previewPng.ts`; `zipBundle.ts`). Symbol ids are `<project prefix>-<icon id>`, the same id the icon drawer shows. Shows symbol count and size, a sandboxed live preview (the demo page), Copy sprite, Download sprite.svg, Download bundle (ZIP with the sprite, `<prefix>-grid.svg`, `demo.html`, `preview.png`), and the symbol ids with a copy-`<use>` button each (filter for long lists). Anyone who can see a project can build and download; icons whose SVG cannot be read are listed, not silently dropped. |
| `c0d3a20` | **Import a sprite** (editors): pick a sprite `.svg`; each `<symbol>` becomes a standalone SVG file and goes through the normal upload (cleaned, optimized, folder choice, Keep both / Replace / Skip when a name is taken, batches of 100, partial results kept on failure). The project's own prefix is dropped from names so a sprite exported from a project does not double it. The old per-icon conflict dialogs were replaced by the strategy choice. |
| `02d9f52` | **Old library retired.** Client: the old compiler screen (`Compiler.tsx`), all `components/helpers/*`, `useLibrary`, `useSpriteCompiler`, `useFileDropzone`, `api/sprites.ts`, `/classic` and its header link, and the light-only legacy styles are removed. Server: `/api/sprites` routes, the `Sprite` and `SpriteVersion` models, their index sync, and the two sprite maintenance scripts and npm scripts are removed. New one-off `npm run cutover:drop-legacy` (dry run by default, `-- --confirm` to act). README rewritten for the new product and API. |

### Data change (done, as decided in Phase 0)
- After checking that the Phase 0 backup (`backups/2026-10-19T11-28-33-474Z/`: `sprites` 2, `sprite_versions` 2, `users` 1) is intact, the cutover script **dropped the old `sprites` (2 documents: `gg-new`, `gg-2`) and `sprite_versions` (2) collections**. To get them back, restore from that backup folder. The `users` collection was not touched.
- Your own account's projects created since Phase 4 (`gg-pub`, `gg-private`) were not touched.

### Changes in behaviour you will notice
- **There is no stand-alone compiler any more.** To compile, add icons to a project (upload, paste, copy, or import an existing sprite) and open its Sprite section. Loose SVGs can no longer be compiled without putting them in a project first (the "Door 2 only" decision).
- Saved library bundles and their versions no longer exist as such; the two old test bundles are gone (backup kept). Icon version history is per icon now (Phase 2 and 4).
- `/api/sprites*` now answers 404. `/classic` redirects to the dashboard.
- Bundle size: JavaScript 661.0 kB to 503.2 kB (156 kB gzip), CSS 73.9 kB to 47.9 kB, from removing the old screens.
- **ESLint now reports 5 problems instead of 31**, because the files that carried the old baseline were deleted (the remaining ones are in `AuthContext.tsx`, `ToastContext.tsx`, `previewPng.ts`).

### Not carried over from the old compiler (intentional gaps)
- The old **live demo's colour and gradient controls** with copy-paste snippets for HTML, React, Vue, Angular, Svelte and Next.js. The Sprite section's preview is the generated `demo.html` (colour swatches included) and the `<use>` code per symbol. Framework snippets for sprites are not rebuilt; say if you want them.
- The old **"update an existing sprite" conflict-comparison screens** and the old **public/private library tree**. Public and private now live on projects.

### Validation (verified)
- Client `npm test`: **398 tests** in 27 files (new: sprite building and splitting, Sprite section, import dialog; App tests updated). Two timing-sensitive tests timed out in one full run while the machine was overloaded and passed when re-run on their own; earlier full runs passed completely. `npx tsc -b` and `npm run build` pass.
- Server `npm test`: **92 of 92**; `npm run test:db` against a throwaway database: **100 of 100**. Smoke tests updated (project routes answer 503 with no database; `/api/sprites` is 404).
- Browser pane with a throwaway test user (deleted afterwards): Sprite section built a 4-symbol sprite (883 B) with correct ids and a working preview; imported a 2-symbol sprite file (one new symbol, one clashing with an existing name): 2 icons added, the list refreshed to 6 symbols including the numbered duplicate (`spr-home-1`); no new console errors after reload.

### Not tested, or open
- **The downloaded ZIP and sprite file were not opened.** The download button ran without an error and the pieces are unit-tested, but the produced files were not inspected, and the preview image (`preview.png`) is rendered by existing browser code that is not covered by tests.
- Real Google or Microsoft sign-in (please confirm once in your browser, as agreed), copying a sprite to the clipboard in a real browser, import with Replace or Skip in the browser, importing into a folder, very large sprites (hundreds of symbols) and sprites with gradients or shared ids were not tried.
- Imported symbols that use `<use>` references to other symbols are not resolved. External references are removed by the sanitizer.
- Fonts: the Sprite link is shown for font projects too; a Font section arrives in Phase 7.
- Visual: in the import dialog the native control says "No file chosen" after a file was read (the name is shown underneath).

### Next
- Phase 6: admin area (users list, delete, transfer), project export and import, API token and the new CLI.

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
- Phase 5 onward: sprite and font builders, import and export, admin routes, API tokens and the CLI (see the Phase 2 section, Not tested, or open).
