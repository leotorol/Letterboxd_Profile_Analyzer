import JSZip from 'jszip';
import Papa from 'papaparse';
import { toIsoDate, toName, toRating, toYear } from '../utils/coerce';

/**
 * Parses raw CSV text string using PapaParse under the hood.
 *
 * Args:
 *   csvText (string): Raw CSV file content string.
 *
 * Returns:
 *   Array<Object>: Parsed row objects with column headers as key names.
 */
function parseCSV(csvText) {
  if (typeof csvText !== 'string') return [];

  // some exports come with a UTF-8 BOM glued to the first header, Papa keeps it
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const result = Papa.parse(cleanText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  // a malformed export can still yield null rows or junk entries, drop them
  return (result.data || []).filter((row) => row && typeof row === 'object');
}

/**
 * Drops duplicate film rows, keeping the earliest dated copy when there is one.
 *
 * Real exports occasionally repeat the same film dozens of times after a
 * reimport or a sync hiccup. Every stats section already dedupes on title plus
 * year, so cleaning it here keeps the raw counts honest too. Rewatches still
 * live in diary.csv, which is never touched by this.
 *
 * Args:
 *   rows (Array<Object>): Normalised rows with name, year and date.
 *
 * Returns:
 *   Array<Object>: One row per film.
 */
function keepUniqueByFilm(rows) {
  const byFilm = new Map();

  for (const row of rows) {
    if (!row) continue;
    const key = `${row.name}::${row.year ?? ''}`;
    const existing = byFilm.get(key);
    if (!existing) {
      byFilm.set(key, row);
      continue;
    }
    if (row.date && (!existing.date || row.date < existing.date)) {
      byFilm.set(key, row);
    }
  }

  return [...byFilm.values()];
}

/**
 * Normalizes a movie title for better TMDB search matching.
 *
 * Handles common edge cases:
 * - Replaces middle dot (·) with hyphen (WALL·E -> WALL-E)
 * - Replaces en-dash (–) and em-dash (—) with hyphen
 *
 * Casing is left untouched: TMDB search is case-insensitive and the
 * fuzzy validation lowercases both sides, so rewriting case only
 * mangled mixed titles (e.g. "30Th").
 *
 * Args:
 *   title (string): Raw movie title from CSV.
 *
 * Returns:
 *   string: Normalized title for TMDB search.
 */
export function normalizeTitle(title) {
  if (!title) return title;

  let normalized = title;

  // replace middle dot with hyphen (WALL·E -> WALL-E)
  normalized = normalized.replace(/·/g, '-');

  // replace en-dash and em-dash with hyphen
  normalized = normalized.replace(/[–—]/g, '-');

  return normalized;
}

/**
 * Searches a JSZip instance for a specific filename regardless of folder depth.
 *
 * Args:
 *   zip (JSZip): Active JSZip object.
 *   filename (string): Target filename like 'ratings.csv'.
 *
 * Returns:
 *   ZipObject|null: Matching file entry inside the zip archive or null.
 */
function findFile(zip, filename) {
  const keys = Object.keys(zip.files);
  const match = keys.find(k => k.endsWith('/' + filename) || k === filename);
  return match ? zip.files[match] : null;
}

/**
 * Extracts and normalises Letterboxd ZIP contents entirely in-browser.
 *
 * Merges watched.csv with ratings.csv so unrated movies don't get lost in the void.
 * Validates presence of mandatory CSV files.
 *
 * Args:
 *   file (File): ZIP file object uploaded by the user.
 *
 * Returns:
 *   Promise<Object>: Structured Letterboxd data containing ratings, watched, watchlist, and profile.
 *
 * Throws:
 *   Error: If essential Letterboxd CSV files (ratings.csv or watched.csv) are missing from the archive.
 */
export async function parseLetterboxdZip(file) {
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    // deadass invalid zip archive
    throw new Error('Invalid or corrupted ZIP file. Please upload a valid archive downloaded from Letterboxd.');
  }

  /**
   * Helper to unpack a CSV entry asynchronously.
   *
   * Args:
   *   name (string): Target CSV filename.
   *
   * Returns:
   *   Promise<Array<Object>>: Array of row objects or empty array if file is missing.
   */
  async function extractCSV(name) {
    const entry = findFile(zip, name);
    if (!entry) return [];
    const text = await entry.async('string');
    return parseCSV(text);
  }

  // grab all the damn CSVs in parallel
  const [ratings, watched, watchlist, profile, diary, reviews] = await Promise.all([
    extractCSV('ratings.csv'),
    extractCSV('watched.csv'),
    extractCSV('watchlist.csv'),
    extractCSV('profile.csv'),
    extractCSV('diary.csv'),
    extractCSV('reviews.csv'),
  ]);

  // validate that this is actually a Letterboxd export zip
  const hasRatings = ratings.length > 0;
  const hasWatched = watched.length > 0;

  if (!hasRatings && !hasWatched) {
    const missingFiles = [];
    if (!findFile(zip, 'ratings.csv')) missingFiles.push('ratings.csv');
    if (!findFile(zip, 'watched.csv')) missingFiles.push('watched.csv');

    if (missingFiles.length > 0) {
      // throw custom clear error detailing what went wrong
      throw new Error(
        `Missing required Letterboxd data files (${missingFiles.join(', ')}). Make sure you uploaded the official ZIP exported from your Letterboxd account settings.`
      );
    }

    // files are there but empty, so there's literally nothing to analyse
    throw new Error(
      'Your Letterboxd export has no watched or rated films. Log a few movies first and export again.'
    );
  }

  // map out ratings by URI or Name+Year so we can pair them with watched.csv
  const ratingsMap = new Map();
  ratings.forEach(r => {
    const uri = typeof r['Letterboxd URI'] === 'string' ? r['Letterboxd URI'] : null;
    const name = toName(r['Name']);
    const year = toYear(r['Year']);
    const ratingVal = toRating(r['Rating']);
    if (uri) ratingsMap.set(uri, ratingVal);
    if (name) ratingsMap.set(`${name}::${year ?? ''}`, ratingVal);
  });

  // watched.csv is the main truth, fallback to ratings if watched is somehow empty
  const primaryWatched = watched.length > 0 ? watched : ratings;

  const normalisedWatched = primaryWatched.map(w => {
    const name = toName(w['Name']);
    if (!name) return null;

    const uri = typeof w['Letterboxd URI'] === 'string' ? w['Letterboxd URI'] : null;
    const year = toYear(w['Year']);
    const nameYear = `${name}::${year ?? ''}`;
    let rating = uri ? ratingsMap.get(uri) : undefined;
    if (rating === undefined) {
      rating = ratingsMap.get(nameYear);
    }
    if (rating === undefined) {
      rating = toRating(w['Rating']);
    }

    return {
      date: toIsoDate(w['Date']),
      name,
      year,
      uri,
      rating: rating ?? null,
      normalizedTitle: normalizeTitle(name),
    };
  }).filter(Boolean);

  // every row was malformed, so there is nothing honest to analyse
  if (normalisedWatched.length === 0) {
    throw new Error(
      'Your Letterboxd export has no usable watched or rated films. Log a few movies first and export again.'
    );
  }

  const uniqueWatched = keepUniqueByFilm(normalisedWatched);

  const normalisedWatchlist = keepUniqueByFilm(watchlist.map(w => {
    const name = toName(w['Name']);
    if (!name) return null;

    return {
      date: toIsoDate(w['Date']),
      name,
      year: toYear(w['Year']),
      uri: typeof w['Letterboxd URI'] === 'string' ? w['Letterboxd URI'] : null,
      normalizedTitle: normalizeTitle(name),
    };
  }).filter(Boolean));

  // diary.csv has one row per watch event (rewatches are separate entries),
  // unlike watched.csv which is one row per film. That's the source of truth
  // for rewatch detection, so normalise it to the same shape as the rest.
  // Exact duplicate events are dropped because a reimport can repeat the same
  // watch dozens of times and that would fake a comfort movie obsession.
  const seenDiaryEvents = new Set();
  const normalisedDiary = diary.map(d => {
    const name = toName(d['Name']);
    if (!name) return null;

    const date = toIsoDate(d['Watched Date'] || d['Date']);
    const year = toYear(d['Year']);
    const key = `${name}::${year ?? ''}::${date ?? ''}`;
    if (seenDiaryEvents.has(key)) return null;
    seenDiaryEvents.add(key);

    return {
      date,
      name,
      year,
    };
  }).filter(Boolean);

  // reviews.csv is one row per written review. The Review field can be empty
  // for spoiler only or rating only entries, so those get dropped: there is
  // nothing to analyse in an empty review. Only the fields the reviews section
  // actually reads are kept, the rest is dead weight.
  const normalisedReviews = reviews
    .map((r) => {
      const name = toName(r['Name']);
      if (!name) return null;

      return {
        date: toIsoDate(r['Date'] || r['Watched Date']),
        name,
        year: toYear(r['Year']),
        rating: toRating(r['Rating']),
        review: (r['Review'] || '').trim(),
      };
    })
    .filter((r) => r && r.review.length > 0);

  const profileData = profile[0] || {};

  return {
    watched: uniqueWatched,
    watchlist: normalisedWatchlist,
    diary: normalisedDiary,
    reviews: normalisedReviews,
    profile: {
      username: toName(profileData['Username']) || '',
    },
  };
}
