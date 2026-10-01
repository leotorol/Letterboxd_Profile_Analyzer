import { useMemo } from 'react';
import { TMDB_POSTER_MEDIUM } from '../utils/tmdbImages';
import { GRAVEYARD_LIMIT, selectOldestWatchlist } from '../utils/watchlist';
import { MONTH_LABELS, parseLbDate, diffDays, monthIndex } from '../utils/dateFormat';

// months to look back when computing the recent pace
const PACE_MONTHS = 6;


/**
 * Builds the graveyard: the oldest movies still sitting in the watchlist.
 *
 * Sorted by how long ago they were added, oldest first, so the user sees
 * the films they have been neglecting the hardest.
 *
 * Args:
 *   watchlist (Array<Object>): Normalised watchlist rows.
 *   enrichedWatchlist (Map<string, Object>): name::year to enriched data.
 *   today (Date): Reference date for age calculation.
 *
 * Returns:
 *   Array<Object>: Graveyard entries with name, year, addedDate, ageDays, posterPath.
 */
function buildGraveyard(watchlist, enrichedWatchlist, today) {
  return selectOldestWatchlist(watchlist, GRAVEYARD_LIMIT, today).map((item) => {
    const enriched = enrichedWatchlist.get(`${item.name}::${item.year}`);
    return {
      name: item.name,
      year: item.year,
      addedDate: item.date,
      ageDays: item.ageDays,
      posterPath: enriched?.posterPath ? TMDB_POSTER_MEDIUM + enriched.posterPath : null,
    };
  });
}

/**
 * Formats a day count into a human readable age string.
 *
 * Args:
 *   days (number): Total days.
 *
 * Returns:
 *   Object: { value, unit } for display.
 */
export function formatAge(days) {
  if (days >= 365) {
    const years = Math.round((days / 365) * 10) / 10;
    return { value: years, unit: years === 1 ? 'year' : 'years' };
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return { value: months, unit: months === 1 ? 'month' : 'months' };
  }
  return { value: days, unit: days === 1 ? 'day' : 'days' };
}

/**
 * Computes average age in days of items currently in the watchlist.
 *
 * Args:
 *   watchlist (Array<Object>): Normalised watchlist rows with dates.
 *   today (Date): Reference date.
 *
 * Returns:
 *   number: Average age in days, 0 when there are no dated entries.
 */
function computeAverageAge(watchlist, today) {
  let total = 0;
  let count = 0;
  for (const item of watchlist) {
    const added = parseLbDate(item.date);
    if (!added) continue;
    const age = diffDays(added, today);
    if (age >= 0) {
      total += age;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Builds a month-by-month timeline of watchlist additions vs films watched.
 *
 * Both series share the same month axis so the area chart can overlay them
 * and show whether the user is gaining or losing ground over time.
 *
 * Args:
 *   watchlist (Array<Object>): Normalised watchlist rows.
 *   watched (Array<Object>): Normalised watched rows.
 *
 * Returns:
 *   Object: { series, addedPerMonth, watchedPerMonth, verdict }
 */
function buildGrowthTimeline(watchlist, watched) {
  const addedByMonth = new Map();
  const watchedByMonth = new Map();
  let minIdx = Infinity;
  let maxIdx = -Infinity;

  for (const item of watchlist) {
    const d = parseLbDate(item.date);
    if (!d) continue;
    const idx = monthIndex(d);
    addedByMonth.set(idx, (addedByMonth.get(idx) || 0) + 1);
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
  }

  for (const item of watched) {
    const d = parseLbDate(item.date);
    if (!d) continue;
    const idx = monthIndex(d);
    watchedByMonth.set(idx, (watchedByMonth.get(idx) || 0) + 1);
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
  }

  if (minIdx > maxIdx) {
    return { series: [], addedPerMonth: 0, watchedPerMonth: 0, verdict: 'none' };
  }

  const series = [];
  for (let i = minIdx; i <= maxIdx; i++) {
    series.push({
      year: Math.floor(i / 12),
      month: i % 12,
      label: `${MONTH_LABELS[i % 12]} ${Math.floor(i / 12)}`,
      shortLabel: MONTH_LABELS[i % 12],
      added: addedByMonth.get(i) || 0,
      watched: watchedByMonth.get(i) || 0,
    });
  }

  // recent pace: last N months
  const today = new Date();
  const recentStart = monthIndex(today) - PACE_MONTHS;
  let recentAdded = 0;
  let recentWatched = 0;
  let recentCount = 0;
  for (const point of series) {
    const idx = point.year * 12 + point.month;
    if (idx > recentStart) {
      recentAdded += point.added;
      recentWatched += point.watched;
      recentCount++;
    }
  }

  const addedPerMonth = recentCount > 0 ? Math.round((recentAdded / recentCount) * 10) / 10 : 0;
  const watchedPerMonth = recentCount > 0 ? Math.round((recentWatched / recentCount) * 10) / 10 : 0;

  let verdict = 'none';
  if (addedPerMonth > 0 && watchedPerMonth > 0) {
    const ratio = addedPerMonth / watchedPerMonth;
    if (ratio > 1.3) verdict = 'losing';
    else if (ratio < 0.7) verdict = 'winning';
    else verdict = 'even';
  } else if (addedPerMonth > 0) {
    verdict = 'losing';
  } else if (watchedPerMonth > 0) {
    verdict = 'winning';
  }

  return { series, addedPerMonth, watchedPerMonth, verdict };
}

/**
 * Builds a lookup of the enriched watchlist keyed by name::year.
 *
 * The enrichment array order is not guaranteed to match the watchlist order,
 * so we index it and match each watchlist film by title+year.
 *
 * Args:
 *   enrichedWatchlist (Array<Object>|null): Enriched watchlist rows from TMDB.
 *
 * Returns:
 *   Map<string, Object>: name::year to enriched movie data.
 */
function buildEnrichedLookup(enrichedWatchlist) {
  const map = new Map();
  if (!enrichedWatchlist) return map;
  for (const movie of enrichedWatchlist) {
    if (!movie?.name) continue;
    const key = `${movie.name}::${movie.year}`;
    if (!map.has(key)) map.set(key, movie);
  }
  return map;
}

/**
 * Custom hook that derives every stat for the Section 07 Watchlist section.
 *
 * Pure and memoised on the raw data plus the enriched rows. Returns a
 * ready-to-render shape so the component stays dumb and presentational.
 *
 * Args:
 *   rawData (Object|null): Parsed Letterboxd export from context.
 *   enrichedWatchlist (Array<Object>|null): Enriched rows for the watchlist.
 *
 * Returns:
 *   Object: Watchlist stats bundle with graveyard, growth, averageAge, and hasData flag.
 */
export function useWatchlistStats(rawData, enrichedWatchlist = null) {
  return useMemo(() => {
    const watchlist = rawData?.watchlist || [];
    const watched = rawData?.watched || [];

    if (watchlist.length === 0) {
      return {
        hasData: false,
        watchlistSize: 0,
        graveyard: [],
        growth: { series: [], addedPerMonth: 0, watchedPerMonth: 0, verdict: 'none' },
        averageAgeDays: 0,
      };
    }

    const today = new Date();
    const enrichedLookup = buildEnrichedLookup(enrichedWatchlist);
    const graveyard = buildGraveyard(watchlist, enrichedLookup, today);
    const growth = buildGrowthTimeline(watchlist, watched);
    const averageAgeDays = computeAverageAge(watchlist, today);

    return {
      hasData: true,
      watchlistSize: watchlist.length,
      graveyard,
      growth,
      averageAgeDays,
    };
  }, [rawData, enrichedWatchlist]);
}
