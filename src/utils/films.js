/**
 * Builds the identity key used to match a film across sources.
 *
 * Args:
 *   name (string): Film title.
 *   year (number|null): Release year.
 *
 * Returns:
 *   string: Lowercased title plus year fingerprint.
 */
export function filmKey(name, year) {
  return `${String(name || '').trim().toLowerCase()}::${year ?? ''}`;
}

/**
 * Drops duplicate logs of the same film.
 *
 * Letterboxd happily piles the same film up dozens of times (rewatches,
 * reimports, accidental double logs) and repeated entries double count every
 * average we build. Keyed on the normalised title plus year, since that is what
 * actually identifies a film, and we keep the first entry we see. Confirmed
 * against a real export with 29 copies of Inception in it, so this is not a
 * theoretical worry.
 *
 * Args:
 *   rows (Array<Object>): Enriched movies.
 *
 * Returns:
 *   Array<Object>: Rows with a single entry per film.
 */
export function dedupeFilms(rows) {
  const seen = new Set();
  const unique = [];

  for (const movie of rows) {
    if (!movie) continue;
    const key = filmKey(movie.name, movie.year);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(movie);
  }

  return unique;
}
