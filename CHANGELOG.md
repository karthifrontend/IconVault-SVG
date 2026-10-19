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

## Known issues
- `server/.env` holds the database password and session secret in plain text. `SVG-sprite-react-db-fixed.zip` (in `compiler project/`) contains an older `.env` with the previous credentials; do not share it.
- Folder `server/package.json` scripts `backfill:owner`, `backfill:version-updated-at` and `cleanup:orphans` point to files that do not exist; the zip has the corrected names.
- `server/src/config/db.ts` throws at import when `MONGODB_URI` is missing (crashes instead of starting without a DB). The zip has a fix; not applied here.
- `GET /api/sprites/:name` looks up bundles across all users although names are unique per owner, so a duplicate name can return 403 or another user's bundle (`server/src/routes/spriteRoutes.ts`).
- `README.md` documents `MONGO_URI` (code reads `MONGODB_URI`) and omits `SESSION_SECRET`; `README.suggested.md` is correct.
- Client lists unused dependencies: `svgo`, `svgson`, `svgstore`, `zustand`, `react-router-dom`, `react-dropzone`.
- `npm audit` vulnerabilities remain in both `server/` and `client/`.
- Google app is in "Testing" mode: only listed test users can sign in. Microsoft sign-in is not configured (`MS_CLIENT_ID` / `MS_TENANT_ID` unset).
- No automated tests; the project is not under version control.

## Pending work
- Decide whether to apply the fixes in the zip (scripts, `db.ts`, version-allocation race handling, README) to this folder.
- Fix the `GET /api/sprites/:name` ownership lookup.
- Rotate the database password and `SESSION_SECRET` if the zip or `.env` was ever shared.
- Add more test users or publish the Google app if others need access; configure Microsoft sign-in if wanted.
- Initialize Git so future changes can be tracked.
