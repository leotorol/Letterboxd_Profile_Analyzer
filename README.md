# Letterboxd Stats

Turn your Letterboxd account history into a rich, scrollable stats dashboard. Drop in your exported ZIP and get an interactive, visual breakdown of everything you've ever watched.

## What is Letterboxd?

[Letterboxd](https://letterboxd.com) is a social platform for film lovers. It lets you track every movie you've seen, rate it (out of 5 stars), write reviews, and keep a watchlist of films you want to watch. Think of it as a diary + rating site for movies.

Letterboxd lets you **export your entire account** as a ZIP file containing CSV files like `ratings.csv`, `watched.csv`, `reviews.csv`, and `watchlist.csv`. This app takes that export and turns it into something visual and fun.

## What this app does

Everything runs **100% in your browser** — no data ever leaves your machine. It:

1. Unzips and parses your Letterboxd export locally (via JSZip + PapaParse).
2. Enriches each movie with extra data (runtime, directors, genres, budget, posters, etc.) from the TMDB API.
3. Renders a scoreboard of scroll sections: quick facts, watch-time habits & heatmaps, your "cinephile DNA" radar, ratings vs. consensus, actors, enriched metadata, your reviews as word clouds, watchlist graveyard, random fun stats, and a Pasapalabra-style trivia game.

> Status: Sections 01 (Quick Facts) and 02 (Rhythm / heatmaps & comfort movies) are built and wired into the app. The remaining scroll sections are the next steps.

The free TMDB API rate limit is generous but not unlimited, so the app batches requests, caches results in `localStorage`, and shows a live progress screen while it enriches your films. The same export is cached to speed up future loads.

## Tech stack

- **Vite** — build tool and dev server
- **React 19** — UI
- **JSZip** — reading the ZIP export
- **PapaParse** — parsing the CSVs
- **TMDB API** — movie metadata enrichment
- **@tanstack/react-query** — data fetching (available for future use)
- **Oxlint** — linting

## Prerequisites

- [Node.js](https://nodejs.org) (v18+ recommended, along with npm)
- A (free) [TMDB API key](https://www.themoviedb.org/settings/api) — only needed for runtime/director/genre enrichment. Without it the app still works, but those stats are unavailable.

## Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure your TMDB API key. Create (or edit) a `.env` file in the project root:

   ```bash
   # .env
   VITE_TMDB_API_KEY=your_read_access_token_here
   ```

   You can grab a free key from <https://www.themoviedb.org/settings/api>. If you skip this, the app won't crash — it just won't have runtime/director/genre data.

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually <http://localhost:5173>).

## How to use it

1. Go to Letterboxd → **Settings → Export Data** and download your ZIP.
2. Open the app and drag-and-drop the ZIP file (or a single CSV) onto the upload zone.
3. Wait while your movies are enriched (you'll see live posters fill the progress strip).
4. Scroll through your stats!

## Scripts

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR             |
| `npm run build`   | Build the production bundle into `dist/`       |
| `npm run preview` | Preview the production build locally           |
| `npm run lint`    | Run Oxlint on the source                       |

## Project structure

```
letterboxd stats/
├── index.html                 # Vite entry point
├── vite.config.js             # Vite + React plugin config
├── package.json               # Scripts and dependencies
├── .env                       # Local env vars (VITE_TMDB_API_KEY)
├── src/
│   ├── main.jsx               # React root: mounts <App/> inside DataProvider
│   ├── App.jsx                # Top-level state router (upload / loading / stats)
│   ├── App.css
│   ├── index.css
│   ├── assets/                # Static images (hero, logos)
│   ├── context/
│   │   └── DataContext.jsx    # Global app state + parsed/enriched data store
│   ├── hooks/
│   │   ├── useCountUp.js      # Animated number counter hook
│   │   ├── useLetterboxdData.js # Orchestrates ZIP parse → TMDB enrichment
│   │   └── useRhythmStats.js  # Derives all temporal stats for the Rhythm section
│   ├── services/
│   │   ├── zipParser.js       # Unzips export and parses the CSVs
│   │   └── tmdbApi.js         # TMDB search/enrichment with scored matching + localStorage cache
│   ├── components/
│   │   ├── ErrorBoundary.jsx  # Catches render errors so the UI never breaks
│   │   ├── DropZone/          # Drag-and-drop ZIP/CSV upload screen
│   │   ├── LoadingScreen/     # Enrichment progress + live poster strip
│   │   ├── QuickFacts/        # Section 01: quick facts hook (Bento dashboard)
│   │   └── Rhythm/            # Section 02: heatmap, streaks, pace, comfort movies
│   └── styles/
│       ├── tokens.css         # Design tokens (colors, spacing, radii)
│       └── global.css         # Global base styles
```

## Data privacy

Your Letterboxd export is parsed and enriched entirely in the browser. Raw movie metadata (title + year) is sent to TMDB to fetch extra details, but no personal account data is transmitted or stored anywhere. Enrichment results are cached in your browser's `localStorage` only.