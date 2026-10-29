# Letterboxd Stats

Turn your Letterboxd account history into a rich, scrollable stats dashboard. Drop in your exported ZIP and get an interactive, visual breakdown of everything you've ever watched.

## What is Letterboxd?

[Letterboxd](https://letterboxd.com) is a social platform for film lovers. It lets you track every movie you've seen, rate it (out of 5 stars), write reviews, and keep a watchlist of films you want to watch. Think of it as a diary + rating site for movies.

Letterboxd lets you **export your entire account** as a ZIP file containing CSV files like `ratings.csv`, `watched.csv`, `reviews.csv`, and `watchlist.csv`. This app takes that export and turns it into something visual and fun.

## What this app does

Everything is parsed and computed in your browser. Account data never leaves your machine; only movie titles and years go to TMDB for enrichment. It:

1. Unzips and parses your Letterboxd export locally (via JSZip + PapaParse).
2. Enriches each movie with extra data (runtime, directors, genres, budget, posters, etc.) from the TMDB API. Section 08 also pulls two public all-time TMDB lists (most rated and top rated) for the global gap, cached for a week.
3. Renders nine scroll chapters wrapped in an animated space background with twinkling stars and nebula effects.

## Sections

| # | Chapter | What it shows |
| - | ------- | ------------- |
| 01 | Quick Facts | Watch time, film count, directors, average rating and watchlist size. |
| 02 | Rhythm | GitHub style activity heatmap, streaks, weekday and month patterns, pace and comfort rewatches. |
| 03 | Cinephile Profile | Taste spectrum, genre distribution, taste evolution, duration and year correlations, diversity and world map. |
| 04 | Ratings | Your ratings against the Letterboxd consensus, contrarian level and highest rated decades. |
| 05 | Cast and Money | Most watched faces, favourite director and actor duo, studios and budget vs box office. |
| 06 | Reviews | Word cloud, review length over time and your most substantial reviews. |
| 07 | Watchlist | The graveyard of films waiting the longest, growth vs watches and average wait. |
| 08 | The Deep Cuts | The global gap, popularity and release year extremes, first and last bookends, best and worst calls, and the milestone ledger. |
| 09 | A to Z | An interactive letter rosco with five record holders per letter, keyboard navigation and a next letter control. |

TMDB's free rate limit is generous but not unlimited, so enrichment requests are batched, results are cached in `localStorage` and the loading screen shows live progress. The all-time lists used by section 08 are cached separately for seven days.

Section 10 (exporting the report as an image or PDF, plus vertical share cards) is still planned.

## Chapter system

The scroll is built as nine chapters, each with its own editorial format, joined by a fixed chapter rail (a vertical spine on desktop, a swipeable strip on mobile). Three shared pieces keep them coherent without making them identical:

- `ChapterHeading`: the number, the chapter name, the title and an optional aside. Each section picks a variant (masthead, split, center, narrow, credit, manuscript).
- `PanelHead`: the icon, label and micro note used by every panel.
- A progressive panel surface ramp, from the light hook in `01` to the dark dossier in `08`. Flat panels stay transparent so the page keeps some air and variety.

## Tech stack

- **Vite** — build tool and dev server
- **React 19** — UI
- **JSZip** — reading the ZIP export
- **PapaParse** — parsing the CSVs
- **TMDB API** — movie metadata enrichment
- **topojson-client** + **world-atlas** — country geometry for the world map
- **Oxlint** — linting

## Prerequisites

- [Node.js](https://nodejs.org) (v18+ recommended, along with npm)
- A (free) [TMDB API key](https://www.themoviedb.org/settings/api) — needed for the TMDB powered sections (metadata enrichment, the all-time gap, popularity extremes and bookends ratings). Without it the app still works, but those stats fall back gracefully.

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

   You can grab a free key from <https://www.themoviedb.org/settings/api>. If you skip this, the app won't crash. The TMDB powered sections show their fallback states instead.

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually <http://localhost:5173>).

## How to use it

1. Go to Letterboxd → **Settings → Export Data** and download your ZIP.
2. Open the app and drag-and-drop the ZIP file (or pick it with the file selector) onto the upload zone.
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
│   ├── context/
│   │   └── DataContext.jsx    # Global app state + parsed/enriched data store
│   ├── hooks/
│   │   ├── useActiveSection.js # Tracks the chapter crossing the viewport middle
│   │   ├── useCastStats.js    # Derives all stats for the Cast & Money section
│   │   ├── useCinephileStats.js # Derives all stats for the Cinephile Profile section
│   │   ├── useCountUp.js      # Animated number counter hook
│   │   ├── useLetterboxdData.js # Orchestrates ZIP parse → TMDB enrichment
│   │   ├── useRatingStats.js  # Derives all stats for the Ratings section
│   │   ├── useReviewStats.js  # Derives all stats for the Reviews section
│   │   ├── useRhythmStats.js  # Derives all temporal stats for the Rhythm section
│   │   ├── usePasapalabraStats.js # Derives the A to Z record cards for the final game
│   │   ├── useRandomStats.js  # Derives the gap, extremes, bookends & milestone stats
│   │   ├── useSectionMotion.js # Scroll reveals plus offscreen loop pausing
│   │   └── useWatchlistStats.js # Derives stats for the Watchlist section
│   ├── services/
│   │   ├── zipParser.js       # Unzips export and parses the CSVs
│   │   └── tmdbApi.js         # TMDB search/enrichment, all-time catalogs, scored matching + cache
│   ├── utils/
│   │   ├── dateFormat.js      # Date formatting + shared month/day labels
│   │   ├── films.js           # Film identity key and rewatch dedupe
│   │   ├── geometry.js        # Polar to cartesian helpers for SVG charts
│   │   ├── positionTip.js     # Shared hover tooltip positioning for charts
│   │   ├── ratingColor.js     # Shared 0..5 rating to emerald fill mapping
│   │   ├── stats.js           # Shared mean / median / pearson helpers
│   │   ├── tmdbImages.js      # TMDB poster, profile and logo URL constants
│   │   └── watchlist.js       # Shared oldest watchlist selection and age window
│   ├── components/
│   │   ├── Cast/                 # Section 05: credits sheet (faces, duo, studios, money)
│   │   ├── ChapterRail/          # Sticky chapter index (spine on desktop, strip on mobile)
│   │   ├── CinematicBackground/  # Animated space background with stars and nebula
│   │   ├── CinephileProfile/     # Section 03: atlas (spectrum, genres, taste, world map)
│   │   ├── DropZone/             # Drag-and-drop ZIP upload screen
│   │   ├── ErrorBoundary.jsx     # Catches render errors so the UI never breaks
│   │   ├── icons/                # Shared inline SVG icons
│   │   ├── LoadingScreen/        # Enrichment progress + live poster strip
│   │   ├── Pasapalabra/          # Section 09: black stage, letter rosco and answer card
│   │   ├── PosterTip/            # Shared hover card used by the chart sections
│   │   ├── QuickFacts/           # Section 01: compact masthead with five fact cards
│   │   ├── Random/               # Section 08: the deep cuts (gap, extremes, bookends, ledger)
│   │   ├── Ratings/              # Section 04: review page (consensus, contrarian, decades)
│   │   ├── Reviews/              # Section 06: manuscript (word cloud, length, best reviews)
│   │   ├── Rhythm/               # Section 02: instrument panel (heatmap, streaks, pace)
│   │   ├── shared/               # ChapterHeading + PanelHead shared primitives
│   │   └── Watchlist/            # Section 07: vault (graveyard, growth chart, wait)
│   └── styles/
│       ├── tokens.css         # Design tokens + progressive chapter surface ramp
│       ├── sections.css       # Shared chapter layout, headings, panels, ambient tint
│       └── global.css         # Global base styles + animated space background
```

## Data privacy

Your Letterboxd export is parsed and enriched entirely in the browser. Raw movie metadata (title + year) is sent to TMDB to fetch extra details, but no personal account data is transmitted or stored anywhere. Enrichment results are cached in your browser's `localStorage` only. The section 08 all-time lists are public TMDB catalog data, cached separately for seven days.