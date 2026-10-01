import { parseLbDate, diffDays } from './dateFormat';

// how many old movies the graveyard shows (and how many get enriched)
export const GRAVEYARD_LIMIT = 16;

/**
 * Selects the films that have been sitting in the watchlist the longest.
 *
 * Parses each row's date, drops invalid or future dates, deduplicates
 * repeated titles (keeping the oldest copy), sorts oldest first and caps
 * the result at `limit`. Shared by the graveyard stats and the poster
 * enrichment pass so the two never drift apart.
 *
 * Args:
 *   watchlist (Array<Object>): Normalised watchlist rows.
 *   limit (number): Maximum number of films to return.
 *   today (Date): Reference date for age calculation.
 *
 * Returns:
 *   Array<Object>: Watchlist rows with `ageDays`, oldest first.
 */
export function selectOldestWatchlist(watchlist, limit, today = new Date()) {
  const byFilm = new Map();
  for (const item of watchlist || []) {
    const added = parseLbDate(item.date);
    if (!added) continue;
    const ageDays = diffDays(added, today);
    if (ageDays < 0) continue;

    const key = `${item.name}::${item.year}`;
    const existing = byFilm.get(key);
    if (!existing || ageDays > existing.ageDays) {
      byFilm.set(key, { ...item, ageDays });
    }
  }

  return [...byFilm.values()]
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, limit);
}
