# AGENTS.md

Letterboxd Stats Analyser: a client-side React 19 + Vite app. User drops their
official Letterboxd export `.zip`, everything is parsed and rendered in-browser
(zip parsing via `jszip`, CSV via `papaparse`, maps via `topojson-client` +
`world-atlas`). No backend.

## Commands

- `npm run dev` — Vite dev server. Defaults to `http://localhost:5173`; if that
  port is taken it prints the next free port (check the output).
- `npm run lint` — oxlint.
- `npm run build` — production build.

Run `npm run lint` after code changes. There is no typecheck or test suite.

## Testing the app in the browser (Playwright MCP)

Playwright MCP's `browser_file_upload` **only accepts files inside the
workspace root** (`C:\Users\usuario\Desktop\letterboxd stats`). The example
zips live outside the workspace, so copy one in first.

1. Copy an example zip into the workspace (e.g. `.playwright-mcp\sample.zip`):
   ```powershell
   Copy-Item "C:\Users\usuario\Downloads\ejemplos zip lbx\letterboxd1500-leotorol-2026-08-23-17-05-utc.zip" "C:\Users\usuario\Desktop\letterboxd stats\.playwright-mcp\sample.zip" -Force
   ```
   (`test-data.zip` and `test-420.zip` in the repo root also work.)
2. Start the dev server (run it detached, e.g.
   `Start-Process npm.cmd -ArgumentList "run","dev","--","--port","5175"`), then
   check the port with `Invoke-WebRequest http://localhost:5175/`.
3. `browser_navigate` to the app URL.
4. Click the button named **"Upload Letterboxd ZIP file"** (the dropzone).
5. When the file chooser opens, call `browser_file_upload` with the
   workspace-local zip path. If a second file chooser appears, call
   `browser_file_upload` with no `paths` to cancel it.
6. Wait a few seconds for parsing, then `browser_snapshot` / `browser_find` to
   inspect. Sections are all on one scrollable page (e.g. Section 07 /
   Watchlist contains "The Graveyard").

Note: port 5173 may already be served by a dev server another agent/session
started; navigating there is fine and Vite reflects the current files.

## Example data (reference `ejemplos_lbx`)

Path: `C:\Users\usuario\Downloads\ejemplos zip lbx`

- `letterboxd-leotorol-2026-08-26-18-48-utc.zip` — fullest export, includes
  `profile.csv`, `watchlist.csv`, `likes/`, `lists/`, `deleted/`, `orphaned/`.
- `letterboxd1500-leotorol-...zip` — ~1500 films (ratings/watched/diary/watchlist/reviews).
- `letterboxd420real-leotorol-...zip` — real ~420 films, includes `comments.csv`.
- `letterboxd30-leotorol-...zip` — small ~30-film dataset.
- `vacio-leotorol-...zip` — empty watchlist; use for empty states.

## Project layout

- `src/components/<Section>/` — one folder per stats section, each with a
  `.jsx` and matching `.css`.
- `src/hooks/` — stats derivation (e.g. `useWatchlistStats.js`).
- `src/context/DataContext.jsx` — parsed data + TMDB enriched lookup.
- `src/styles/global.css` — design tokens and shared helpers (`lb-hl-green`,
  `lb-hl-orange`, etc.).
