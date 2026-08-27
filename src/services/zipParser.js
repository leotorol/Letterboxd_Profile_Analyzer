import JSZip from 'jszip';
import Papa from 'papaparse';

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
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return result.data;
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
  const [ratings, watched, watchlist, profile, diary] = await Promise.all([
    extractCSV('ratings.csv'),
    extractCSV('watched.csv'),
    extractCSV('watchlist.csv'),
    extractCSV('profile.csv'),
    extractCSV('diary.csv'),
  ]);

  // validate that this is actually a Letterboxd export zip
  const hasRatings = ratings.length > 0;
  const hasWatched = watched.length > 0;

  if (!hasRatings && !hasWatched) {
    const missingFiles = [];
    if (!findFile(zip, 'ratings.csv')) missingFiles.push('ratings.csv');
    if (!findFile(zip, 'watched.csv')) missingFiles.push('watched.csv');

    // throw custom clear error detailing what went wrong
    throw new Error(
      `Missing required Letterboxd data files (${missingFiles.join(', ')}). Make sure you uploaded the official ZIP exported from your Letterboxd account settings.`
    );
  }

  // map out ratings by URI or Name+Year so we can pair them with watched.csv
  const ratingsMap = new Map();
  ratings.forEach(r => {
    const uri = r['Letterboxd URI'];
    const nameYear = `${r['Name']}::${r['Year']}`;
    const ratingVal = r['Rating'] ? parseFloat(r['Rating']) : null;
    if (uri) ratingsMap.set(uri, ratingVal);
    ratingsMap.set(nameYear, ratingVal);
  });

  // watched.csv is the main truth, fallback to ratings if watched is somehow empty
  const primaryWatched = watched.length > 0 ? watched : ratings;

  const normalisedWatched = primaryWatched.map(w => {
    const uri = w['Letterboxd URI'];
    const nameYear = `${w['Name']}::${w['Year']}`;
    let rating = uri ? ratingsMap.get(uri) : undefined;
    if (rating === undefined) {
      rating = ratingsMap.get(nameYear);
    }
    if (rating === undefined && w['Rating']) {
      rating = parseFloat(w['Rating']);
    }

    return {
      date: w['Date'],
      name: w['Name'],
      year: w['Year'] ? parseInt(w['Year'], 10) : null,
      uri: w['Letterboxd URI'],
      rating: rating !== undefined ? rating : null,
      normalizedTitle: normalizeTitle(w['Name']),
    };
  });

  const normalisedRatings = ratings.map(r => ({
    date: r['Date'],
    name: r['Name'],
    year: r['Year'] ? parseInt(r['Year'], 10) : null,
    uri: r['Letterboxd URI'],
    rating: r['Rating'] ? parseFloat(r['Rating']) : null,
    normalizedTitle: normalizeTitle(r['Name']),
  }));

  const normalisedWatchlist = watchlist.map(w => ({
    date: w['Date'],
    name: w['Name'],
    year: w['Year'] ? parseInt(w['Year'], 10) : null,
    uri: w['Letterboxd URI'],
    normalizedTitle: normalizeTitle(w['Name']),
  }));

  // diary.csv has one row per watch event (rewatches are separate entries),
  // unlike watched.csv which is one row per film. That's the source of truth
  // for rewatch detection, so normalise it to the same shape as the rest.
  const normalisedDiary = diary.map(d => ({
    date: d['Watched Date'] || d['Date'] || null,
    name: d['Name'],
    year: d['Year'] ? parseInt(d['Year'], 10) : null,
    uri: d['Letterboxd URI'],
    rating: d['Rating'] ? parseFloat(d['Rating']) : null,
    rewatch: d['Rewatch'] === true || d['Rewatch'] === 'true' || d['Rewatch'] === 'Yes',
    tags: d['Tags'] || '',
  }));

  const profileData = profile[0] || {};

  return {
    ratings: normalisedRatings,
    watched: normalisedWatched,
    watchlist: normalisedWatchlist,
    diary: normalisedDiary,
    profile: {
      username: profileData['Username'] || '',
      givenName: profileData['Given Name'] || '',
      dateJoined: profileData['Date Joined'] || '',
      bio: profileData['Bio'] || '',
      favoriteFilms: profileData['Favorite Films'] || '',
    },
  };
}
