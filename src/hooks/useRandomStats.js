import { useCallback, useEffect, useMemo, useState } from 'react';
import { dedupeFilms } from '../utils/films';
import { median } from '../utils/stats';
import { diffDays, parseLbDate } from '../utils/dateFormat';
import { fetchMovieCatalog, hasTmdbKey } from '../services/tmdbApi';

// how many catalog entries the perforated film strip shows
const CATALOG_WINDOW = 100;
// the ledger refuses to start before this many films, small logs get a nudge
const LEDGER_MIN = 50;
const MIN_YEAR = 1888;
// every dot plot splits the axis into this many stacking bins
const DOT_BIN_COUNT = 80;
// a stack taller than this would run out of chart, so the rest stay hidden
const DOT_MAX_STACK_SPINE = 24;
const DOT_MAX_STACK_RULER = 18;

/**
 * Builds the identity key used to match films across sources.
 *
 * Args:
 *   name (string): Film title.
 *   year (number|null): Release year.
 *
 * Returns:
 *   string: Lowercased title plus year fingerprint.
 */
function filmKey(name, year) {
  return `${String(name || '').trim().toLowerCase()}::${year ?? ''}`;
}

/**
 * Indexes every watched film by TMDB id and title fingerprint, plus its rating.
 *
 * Two indexes because TMDB can disagree with Letterboxd on the year by one,
 * and the id is the only bulletproof link when the enrichment found it. The
 * rating map rides along so the global gap strip can show the user's score,
 * not TMDB's.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: Sets of TMDB ids and title fingerprints, plus the rating map.
 */
function buildSeenIndex(rows) {
  const ids = new Set();
  const keys = new Set();
  const ratings = new Map();

  for (const movie of rows) {
    if (movie.tmdbId != null) ids.add(movie.tmdbId);
    const key = filmKey(movie.name, movie.year);
    keys.add(key);

    if (movie.rating != null) {
      if (movie.tmdbId != null) ratings.set(`id:${movie.tmdbId}`, movie.rating);
      ratings.set(`key:${key}`, movie.rating);
    }
  }

  return { ids, keys, ratings };
}

/**
 * Checks whether a catalog film is already in the user library.
 *
 * Args:
 *   item (Object): Catalog film with tmdbId, name and year.
 *   seen (Object): Seen index from buildSeenIndex.
 *
 * Returns:
 *   boolean: True when the film has been watched.
 */
function isSeen(item, seen) {
  if (item.tmdbId != null && seen.ids.has(item.tmdbId)) return true;
  return seen.keys.has(filmKey(item.name, item.year));
}

/**
 * Returns one percentile from an already sorted numeric list.
 *
 * Args:
 *   sortedValues (Array<number>): Ascending values.
 *   p (number): Percentile between 0 and 1.
 *
 * Returns:
 *   number: Interpolated percentile, or 0 for an empty list.
 */
function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;

  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Lays films out as stacked dots on a horizontal axis.
 *
 * Each dot is one film, so the chart never asks the user to read an abstract
 * bar height. Films that land in the same slice stack on top of each other,
 * which keeps dense areas visible without turning the plot into soup. The
 * densest stacks are capped so a 2,000 film export does not draw a tower.
 *
 * Args:
 *   films (Array<Object>): Films to place.
 *   xFor (Function): Maps a film to a 0..1 position on the axis.
 *   maxStack (number): Maximum dots rendered in one bin.
 *
 * Returns:
 *   Object: Dots with x and stack level, plus the count of hidden films.
 */
function layoutDots(films, xFor, maxStack) {
  const bins = new Array(DOT_BIN_COUNT).fill(0);
  const dots = [];

  for (const film of films) {
    const ratio = Math.min(1, Math.max(0, xFor(film)));
    const bin = Math.min(DOT_BIN_COUNT - 1, Math.floor(ratio * DOT_BIN_COUNT));
    const stack = bins[bin];
    bins[bin]++;

    if (stack >= maxStack) continue;

    dots.push({ film, x: ratio, stack });
  }

  return { dots, hiddenDots: films.length - dots.length };
}

/**
 * Finds the biggest missing films in the all time catalogs and scores coverage.
 *
 * The popular gap is the first unseen film in the all time vote count list.
 * The critics gap is the first unseen film in the all time top rated list,
 * unless it is the exact same film, in which case we take the next one so the
 * card is not a duplicate.
 *
 * Args:
 *   popular (Array<Object>): All time most voted catalog.
 *   topRated (Array<Object>): All time top rated catalog.
 *   seen (Object): Seen index from buildSeenIndex.
 *
 * Returns:
 *   Object: Gap films, coverage cells and counts.
 */
function buildGap(popular, topRated, seen) {
  const window = popular.slice(0, CATALOG_WINDOW);
  const cells = window.map((item) => ({
    ...item,
    seen: isSeen(item, seen),
    userRating: seen.ratings.get(`id:${item.tmdbId}`)
      ?? seen.ratings.get(`key:${filmKey(item.name, item.year)}`)
      ?? null,
  }));
  const seenCount = cells.filter((cell) => cell.seen).length;

  const popularGap = popular.find((item) => !isSeen(item, seen)) || null;
  let topRatedGap = topRated.find((item) => !isSeen(item, seen)) || null;

  if (popularGap && topRatedGap && popularGap.tmdbId === topRatedGap.tmdbId) {
    topRatedGap = topRated.find((item) => (
      !isSeen(item, seen) && item.tmdbId !== popularGap.tmdbId
    )) || null;
  }

  return {
    popular: popularGap,
    topRated: topRatedGap,
    cells,
    seenCount,
    windowSize: window.length,
  };
}

/**
 * Builds the logarithmic popularity axis, its film dots and the middle band.
 *
 * Vote counts run from a few dozen to six figures, so a linear axis would
 * flatten every niche film into the same pixel. Each dot is one film, and the
 * quartile band gives the middle of the library a concrete range in votes.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: Extremes, median, quartiles, log range and the film dots.
 */
function buildPopularity(rows) {
  const withVotes = rows.filter((m) => (
    Number.isFinite(m.voteCount) && m.voteCount > 0
  ));

  if (withVotes.length < 2) {
    return {
      available: false,
      niche: null,
      mainstream: null,
      min: 0,
      max: 0,
      median: 0,
      q1: 0,
      q3: 0,
      logMin: 0,
      logMax: 1,
      dots: [],
      hiddenDots: 0,
      flat: false,
    };
  }

  const sorted = [...withVotes].sort((a, b) => a.voteCount - b.voteCount);
  const niche = sorted[0];
  const mainstream = sorted[sorted.length - 1];
  const voteCounts = sorted.map((m) => m.voteCount);
  const logMin = Math.log10(Math.max(10, niche.voteCount));
  const logMax = Math.max(logMin + 0.001, Math.log10(Math.max(100, mainstream.voteCount)));
  const range = logMax - logMin;
  const flat = niche.voteCount === mainstream.voteCount;
  const xFor = (movie) => (
    flat ? 0.5 : (Math.log10(Math.max(10, movie.voteCount)) - logMin) / range
  );
  const { dots, hiddenDots } = layoutDots(withVotes, xFor, DOT_MAX_STACK_SPINE);

  return {
    available: true,
    niche,
    mainstream,
    min: niche.voteCount,
    max: mainstream.voteCount,
    median: Math.round(median(voteCounts)),
    q1: percentile(voteCounts, 0.25),
    q3: percentile(voteCounts, 0.75),
    logMin,
    logMax,
    dots,
    hiddenDots,
    flat,
  };
}

/**
 * Builds the release year extreme pair.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: Oldest and newest films plus the median release year.
 */
function buildEraMeasure(rows) {
  const currentYear = new Date().getFullYear();
  const eligible = rows.filter((m) => (
    Number.isFinite(m.year)
    && m.year >= MIN_YEAR
    && m.year <= currentYear + 1
  ));

  if (eligible.length < 2) {
    return {
      available: false,
      oldest: null,
      newest: null,
      min: 0,
      max: 0,
      median: 0,
      dots: [],
      hiddenDots: 0,
    };
  }

  const sorted = [...eligible].sort((a, b) => a.year - b.year);
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const min = oldest.year;
  const max = newest.year;
  const flat = min === max;
  const range = flat ? 1 : max - min;
  const { dots, hiddenDots } = layoutDots(
    eligible,
    (movie) => (flat ? 0.5 : (movie.year - min) / range),
    DOT_MAX_STACK_RULER,
  );

  return {
    available: true,
    oldest,
    newest,
    min,
    max,
    median: Math.round(median(eligible.map((m) => m.year))),
    dots,
    hiddenDots,
  };
}

/**
 * Sorts films by watch date, with undated entries last.
 *
 * The ledger and the bookends both need the same chronological order, so the
 * tie breaks live here once.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Array<Object>: A sorted copy, oldest watch first.
 */
function sortByWatchDate(rows) {
  return [...rows].sort((a, b) => {
    if (a.date && b.date) {
      return a.date.localeCompare(b.date)
        || String(a.name || '').localeCompare(String(b.name || ''));
    }
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

/**
 * Shapes one film for the bookend cards.
 *
 * Args:
 *   movie (Object): Enriched film.
 *
 * Returns:
 *   Object: The fields the bookend UI renders.
 */
function filmSnapshot(movie) {
  return {
    name: movie.name,
    year: movie.year,
    posterPath: movie.posterPath || null,
    rating: movie.rating ?? null,
    date: movie.date || null,
  };
}

/**
 * Whole days between two ISO dates, using local midnight to avoid timezone drift.
 *
 * Args:
 *   firstIso (string|null): Earlier date.
 *   lastIso (string|null): Later date.
 *
 * Returns:
 *   number: Non negative day count, or 0 when either date is unusable.
 */
function daysBetweenIso(firstIso, lastIso) {
  const first = parseLbDate(firstIso);
  const last = parseLbDate(lastIso);
  if (!first || !last) return 0;
  return Math.max(0, diffDays(first, last));
}

/**
 * Builds the first/last and best/worst bookends for the closing section.
 *
 * First and last use watch dates, best and worst use the user's own rating.
 * Ties go to the most recent watch so the results feel current instead of
 * always pointing at the oldest film in the log.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: Bookend snapshots, the span in days and the rated count.
 */
function buildBookends(rows) {
  if (rows.length === 0) {
    return {
      available: false,
      hasDates: false,
      first: null,
      last: null,
      spanDays: 0,
      best: null,
      worst: null,
      ratedCount: 0,
    };
  }

  const ordered = sortByWatchDate(rows);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const rated = rows.filter((movie) => movie.rating != null);
  const byRatingDesc = [...rated].sort((a, b) => (
    b.rating - a.rating
    || String(b.date || '').localeCompare(String(a.date || ''))
    || String(a.name || '').localeCompare(String(b.name || ''))
  ));
  const byRatingAsc = [...rated].sort((a, b) => (
    a.rating - b.rating
    || String(b.date || '').localeCompare(String(a.date || ''))
    || String(a.name || '').localeCompare(String(b.name || ''))
  ));

  const bestRow = byRatingDesc[0] || null;
  let worstRow = byRatingAsc[0] || null;

  // with a pile of equal ratings the same film can win both sides, which reads
  // like a bug, so grab the next film for the worst side when possible
  if (bestRow && worstRow
    && bestRow.name === worstRow.name
    && bestRow.year === worstRow.year) {
    worstRow = byRatingAsc.find((movie) => (
      movie.name !== bestRow.name || movie.year !== bestRow.year
    )) || worstRow;
  }

  return {
    available: true,
    hasDates: rows.some((movie) => Boolean(movie.date)),
    first: filmSnapshot(first),
    last: filmSnapshot(last),
    spanDays: daysBetweenIso(first.date, last.date),
    best: bestRow ? filmSnapshot(bestRow) : null,
    worst: worstRow ? filmSnapshot(worstRow) : null,
    ratedCount: rated.length,
  };
}

/**
 * Picks the milestone step that fits the size of the user log.
 *
 * A 450 film log gets a rung every 50, a 1500 film log every 500, and a huge
 * log scales up again. The point is a readable staircase at any library size,
 * not one fixed list of round numbers that looks empty or unreadable.
 *
 * Args:
 *   total (number): Total logged films.
 *
 * Returns:
 *   number|null: Step size, or null when the log is too small for a ledger.
 */
function ledgerStep(total) {
  if (total < LEDGER_MIN) return null;
  if (total < 500) return 50;
  if (total < 1000) return 100;
  if (total < 5000) return 500;
  if (total < 10000) return 1000;
  if (total < 20000) return 2000;
  return 5000;
}

/**
 * Builds the milestone ledger from dated watches.
 *
 * Undated films stay in the count but go after the dated ones, so the ledger
 * never silently drops a watch. The milestone film is the exact film at that
 * one based index after sorting the log. The step adapts to the log size.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: Reached milestones, adaptive step, next target, progress and date
 *     availability.
 */
function buildMilestones(rows) {
  const ordered = sortByWatchDate(rows);
  const total = ordered.length;
  const hasDates = ordered.some((m) => Boolean(m.date));
  const step = ledgerStep(total);

  if (step == null) {
    return {
      reached: [],
      next: LEDGER_MIN,
      progress: Math.min(1, total / LEDGER_MIN),
      total,
      hasDates,
      nextGap: LEDGER_MIN - total,
      step: LEDGER_MIN,
    };
  }

  const reached = [];
  for (let count = step; count <= total; count += step) {
    const film = ordered[count - 1];
    reached.push({
      count,
      film: {
        name: film.name,
        year: film.year,
        posterPath: film.posterPath || null,
        date: film.date || null,
      },
    });
  }

  const next = (Math.floor(total / step) + 1) * step;
  const previous = Math.floor(total / step) * step;
  const progress = step > 0 ? (total - previous) / step : 1;

  return {
    reached,
    next,
    progress: Math.min(1, Math.max(0, progress)),
    total,
    hasDates,
    nextGap: next - total,
    step,
  };
}

/**
 * Derives every stat for Section 08 from the enriched library and catalogs.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *   catalog (Object): Popular and top rated global catalogs.
 *
 * Returns:
 *   Object: The full Deep Cuts bundle, computed once per input change.
 */
function buildRandomStats(rows, catalog) {
  const seen = buildSeenIndex(rows);

  return {
    hasData: rows.length > 0,
    gap: buildGap(catalog.popular, catalog.topRated, seen),
    popularity: buildPopularity(rows),
    era: buildEraMeasure(rows),
    bookends: buildBookends(rows),
    milestones: buildMilestones(rows),
  };
}

/**
 * Custom hook for Section 08, The Deep Cuts.
 *
 * Loads the global TMDB catalogs once, caches them for a week, and derives
 * the gap, the extremes, the bookends and the milestone ledger. Everything
 * else stays synchronous and pure.
 *
 * Args:
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: Stats bundle plus catalog state and a retry action.
 */
export function useRandomStats(enrichedData = null) {
  const rows = useMemo(() => dedupeFilms(enrichedData || []), [enrichedData]);
  const rowCount = rows.length;
  const catalogEnabled = hasTmdbKey();
  const [catalog, setCatalog] = useState({ popular: [], topRated: [] });
  const [catalogState, setCatalogState] = useState('idle');
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  useEffect(() => {
    if (!catalogEnabled || rowCount === 0) return undefined;

    let cancelled = false;

    Promise.all([
      fetchMovieCatalog('popular'),
      fetchMovieCatalog('top_rated'),
    ])
      .then(([popular, topRated]) => {
        if (cancelled) return;
        if (popular.length === 0 && topRated.length === 0) {
          setCatalogState('error');
          return;
        }
        setCatalog({ popular, topRated });
        setCatalogState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // joder tmdb, not now
        console.warn('useRandomStats: the global catalog request failed', err);
        setCatalogState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [catalogEnabled, rowCount, catalogAttempt]);

  const stats = useMemo(() => buildRandomStats(rows, catalog), [rows, catalog]);

  const retryCatalog = useCallback(() => {
    setCatalogState('loading');
    setCatalogAttempt((attempt) => attempt + 1);
  }, []);

  const resolvedCatalogState = !catalogEnabled
    ? 'no-key'
    : rowCount === 0
      ? 'idle'
      : catalogState;

  return {
    ...stats,
    catalogState: resolvedCatalogState,
    retryCatalog,
  };
}
