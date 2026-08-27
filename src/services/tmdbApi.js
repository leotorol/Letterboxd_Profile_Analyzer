const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_KEY_PREFIX = 'lbxd_tmdb_cache_';
const CACHE_VERSION = 'v3';
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 300;

// fuzzy ratio needed to accept a title, 0.6 was letting some nasty almost-titles through
const FUZZY_ACCEPT = 0.85;
// letterboxd and tmdb sometimes disagree by a year (festival premiere vs wide release shit)
const YEAR_MAX_DIFF = 1;
// min chars for the prefix rule so we don't match garbage like "M" or "Up"
const AFFIX_MIN_LEN = 8;
const MAX_RETRIES = 3;
const BACKOFF_MS = 1000;

const enrichmentReport = {
  total: 0,
  matched: 0,
  failed: [],
  tvMatches: 0,
  fallbackUsed: 0,
};

/**
 * Resets the enrichment report counters.
 *
 * Returns:
 *   void
 */
export function resetEnrichmentReport() {
  enrichmentReport.total = 0;
  enrichmentReport.matched = 0;
  enrichmentReport.failed = [];
  enrichmentReport.tvMatches = 0;
  enrichmentReport.fallbackUsed = 0;
}

/**
 * Returns a snapshot of the enrichment report.
 *
 * Returns:
 *   Object: Report with total, matched, failed, tvMatches, fallbackUsed.
 */
export function getEnrichmentReport() {
  return { ...enrichmentReport };
}

/**
 * Computes a compact djb2 hash of a string.
 *
 * Args:
 *   str (string): Input string to hash.
 *
 * Returns:
 *   string: Base36 representation of the hash.
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Builds a deterministic local storage cache key from a movie list.
 *
 * Hashes the full name+year fingerprint of every entry so two different
 * exports that happen to share their first titles never collide.
 *
 * Args:
 *   movies (Array<Object>): List of movie objects with name and year.
 *
 * Returns:
 *   string: Versioned hashed fingerprint cache key.
 */
function buildCacheKey(movies) {
  const fingerprint = movies
    .map(m => `${m.name}:${m.year}`)
    .join('|');
  return CACHE_KEY_PREFIX + CACHE_VERSION + '_' + hashString(fingerprint);
}

/**
 * Retrieves cached TMDB enrichment data from localStorage.
 *
 * Args:
 *   key (string): Target cache key string.
 *
 * Returns:
 *   Array<Object>|null: Enriched movie objects array or null if missed.
 */
function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persists TMDB enrichment data to localStorage.
 *
 * Args:
 *   key (string): Cache key string.
 *   data (Array<Object>): Enriched movie data array to cache.
 *
 * Returns:
 *   void
 */
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('tmdbApi: storage full or failed to save cache', e);
  }
}

/**
 * Pauses execution for batch pacing and retry backoff.
 *
 * Args:
 *   ms (number): Sleep duration in milliseconds.
 *
 * Returns:
 *   Promise<void>
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Strips accents from a string for comparison purposes.
 *
 * Args:
 *   str (string): Input string with possible accents.
 *
 * Returns:
 *   string: String with accents removed.
 */
function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a string for fuzzy comparison.
 *
 * Args:
 *   str (string): Input string.
 *
 * Returns:
 *   string: Lowercased, stripped of accents and punctuation.
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return stripAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein distance between two strings.
 *
 * pufff is the classic dynamic programming edit distance algorithm.
 * it builds a matrix where each cell [i][j] holds the minimum number of
 * single-character edits needed to transform the first i chars of string a
 * into the first j chars of string b. the final answer lives in the bottom-right
 * corner. don't touch the matrix indexing or shit breaks.
 *
 * Args:
 *   a (string): First string.
 *   b (string): Second string.
 *
 * Returns:
 *   number: Edit distance.
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Computes fuzzy similarity ratio between two strings (0 to 1).
 *
 * Args:
 *   a (string): First string.
 *   b (string): Second string.
 *
 * Returns:
 *   number: Similarity ratio (1 = identical, 0 = completely different).
 */
function fuzzyMatch(a, b) {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return 1;
  if (!normA || !normB) return 0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

/**
 * Collects every title variant a TMDB search result can carry.
 *
 * Args:
 *   result (Object): TMDB search result object.
 *
 * Returns:
 *   Array<string>: Non-empty title variants (title, original, name...).
 */
function getResultTitles(result) {
  return [
    result.title,
    result.original_title,
    result.name,
    result.original_name,
  ].filter(Boolean);
}

/**
 * Extracts the release year from a movie or tv search result.
 *
 * Args:
 *   result (Object): TMDB search result object.
 *
 * Returns:
 *   number|null: Release or first air year, null when TMDB has no date.
 */
function getResultYear(result) {
  const date = result.release_date || result.first_air_date;
  return date ? parseInt(date.substring(0, 4), 10) : null;
}

/**
 * Checks whether one normalized title is a word-boundary prefix of the other.
 *
 * Saves our ass when letterboxd logs the full ass-long title but tmdb only
 * knows the short one, like "the french dispatch of the liberty kansas
 * evening sun" vs "the french dispatch".
 *
 * Args:
 *   normA (string): Already normalized first title.
 *   normB (string): Already normalized second title.
 *
 * Returns:
 *   boolean: True when either title prefixes the other at a word boundary.
 */
function isAffixMatch(normA, normB) {
  if (!normA || !normB) return false;
  if (normA.length < AFFIX_MIN_LEN || normB.length < AFFIX_MIN_LEN) return false;

  const startsAtWordBoundary = (long, short) =>
    long.startsWith(short) && (long.length === short.length || long.charAt(short.length) === ' ');

  return startsAtWordBoundary(normA, normB) || startsAtWordBoundary(normB, normA);
}

/**
 * Scores one TMDB candidate against the expected titles of a letterboxd entry.
 *
 * NO TOQUES ESTO POR TU PUTA VIDA
 * 
 * this function is the brain of the whole matching system. it runs
 * a fuzzy title comparison AND a word-boundary prefix check, then rejects anything
 * with a year diff bigger than YEAR_MAX_DIFF because that's a different film deadass.
 *
 * A candidate is accepted when the fuzzy title score clears FUZZY_ACCEPT, or
 * when it's a word-boundary prefix match AND the year lines up exactly. Year
 * differences beyond YEAR_MAX_DIFF are an instant hard reject because that's
 * a different film with the same name, deadass.
 *
 * Args:
 *   result (Object): TMDB search result with a valid media_type.
 *   expectedTitles (Array<string>): Acceptable title variants for the entry.
 *   expectedYear (number|null): Expected release year from the CSV.
 *
 * Returns:
 *   Object|null: Scored candidate { result, mediaType, titleScore, yearDiff }
 *   or null when the candidate is clearly not our movie.
 */
function scoreCandidate(result, expectedTitles, expectedYear) {
  const mediaType = result.media_type === 'tv' ? 'tv' : result.media_type === 'movie' ? 'movie' : null;
  if (!mediaType) return null;

  const candidateTitles = getResultTitles(result);
  const resultYear = getResultYear(result);

  let titleScore = 0;
  let affix = false;

  for (const expected of expectedTitles) {
    const normExpected = normalizeForComparison(expected);
    if (!normExpected) continue;
    for (const candidate of candidateTitles) {
      titleScore = Math.max(titleScore, fuzzyMatch(expected, candidate));
      if (isAffixMatch(normExpected, normalizeForComparison(candidate))) affix = true;
    }
  }

  let yearDiff = null;
  if (expectedYear && resultYear) {
    yearDiff = Math.abs(expectedYear - resultYear);
    if (yearDiff > YEAR_MAX_DIFF) return null;
  }

  const accepted = titleScore >= FUZZY_ACCEPT || (affix && yearDiff === 0);
  if (!accepted) return null;

  return { result, mediaType, titleScore, yearDiff };
}

/**
 * Picks the best candidate among scored results.
 *
 * Sorts by title score first, then closest year, then TMDB popularity as the
 * tiebreaker, because when two candidates look identical the popular one is
 * almost always the real deal.
 *
 * Args:
 *   candidates (Array<Object>): Scored candidates from scoreCandidate.
 *
 * Returns:
 *   Object|null: Best candidate or null when the list is empty.
 */
function pickBestCandidate(candidates) {
  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    (b.titleScore - a.titleScore)
    || ((a.yearDiff ?? YEAR_MAX_DIFF + 1) - (b.yearDiff ?? YEAR_MAX_DIFF + 1))
    || ((b.result.popularity || 0) - (a.result.popularity || 0))
  );

  return candidates[0];
}

/**
 * Fetches a TMDB endpoint with retries on rate limits and server errors.
 *
 * The old code silently skipped failed responses, so every 429 just made
 * movies vanish into the failed list for no damn reason. now we back off
 * and retry, honoring the retry-after header when tmdb bothers to send one.
 *
 * Args:
 *   path (string): Endpoint path like '/search/multi'.
 *   params (Object): Query params, nullish values are skipped.
 *   apiKey (string): TMDB API v3 key.
 *
 * Returns:
 *   Promise<Object|null>: Parsed JSON response or null on unrecoverable failure.
 */
async function fetchTmdb(path, params, apiKey) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(url.toString());
    } catch (err) {
      // network hiccup, give it another shot with backoff
      if (attempt === MAX_RETRIES) throw err;
      await sleep(BACKOFF_MS * 2 ** attempt);
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) return null;
      const retryAfter = parseFloat(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BACKOFF_MS * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) return null;
    return res.json();
  }

  return null;
}

/**
 * Builds the list of query variants to throw at TMDB for a letterboxd entry.
 *
 * Titles with a colon usually hide the real tmdb title after it, like
 * "Neon Genesis Evangelion: The End of Evangelion" -> "The End of
 * Evangelion", so the subtitle gets its own fallback query. this generic
 * rule replaces what used to be a hand-maintained edge case map.
 *
 * Args:
 *   movie (Object): Movie object with name and normalizedTitle.
 *
 * Returns:
 *   Array<string>: Unique query variants, main query always first.
 */
function buildSearchQueries(movie) {
  const main = movie.normalizedTitle || movie.name;
  const queries = [main];

  const colonIndex = main.indexOf(':');
  if (colonIndex !== -1) {
    const subtitle = main.substring(colonIndex + 1).trim();
    if (subtitle.length >= AFFIX_MIN_LEN) queries.push(subtitle);
  }

  return [...new Set(queries)];
}

/**
 * Runs a TMDB multi search, returning only movie and tv candidates.
 *
 * One single request covers both media types and each result already carries
 * its media_type, which is what kills the old hardcoded tv overrides.
 *
 * Args:
 *   query (string): Title to search.
 *   apiKey (string): TMDB API key.
 *
 * Returns:
 *   Promise<Array<Object>>: Movie and tv search results.
 */
async function searchMulti(query, apiKey) {
  const data = await fetchTmdb('/search/multi', { query }, apiKey);
  return (data?.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
}

/**
 * Runs movie and tv endpoint searches in parallel, tagging each result with
 * the media type it came from.
 *
 * Args:
 *   query (string): Title to search.
 *   year (number|null): Optional year filter (release year / first air year).
 *   apiKey (string): TMDB API key.
 *
 * Returns:
 *   Promise<Array<Object>>: Combined movie and tv search results.
 */
async function searchMovieAndTv(query, year, apiKey) {
  const [movieData, tvData] = await Promise.all([
    fetchTmdb('/search/movie', { query, year }, apiKey),
    fetchTmdb('/search/tv', { query, first_air_date_year: year }, apiKey),
  ]);

  const movies = (movieData?.results || []).map(r => ({ ...r, media_type: 'movie' }));
  const shows = (tvData?.results || []).map(r => ({ ...r, media_type: 'tv' }));
  return [...movies, ...shows];
}

/**
 * Finds the best TMDB match for a letterboxd entry by scoring every
 * candidate across cascading search strategies instead of grabbing the
 * first decent-looking result.
 *
 * this cascading strategy is a fucking maze but it works. it tries
 * four different approaches in order: multi search with normalized title,
 * multi search with subtitle after colon, movie+tv endpoints with year filter,
 * and finally movie+tv endpoints without year as a last resort.
 *
 * Strategy order:
 * 1. multi search with the normalized title (movies and tv in one request)
 * 2. multi search with the subtitle after the colon when the title has one
 * 3. movie and tv endpoint searches filtered by year
 * 4. movie and tv endpoint searches without year as the last resort
 *
 * Args:
 *   movie (Object): Movie object with name, year, normalizedTitle.
 *   apiKey (string): TMDB API key.
 *
 * Returns:
 *   Promise<Object|null>: Best match { result, mediaType, titleScore,
 *   yearDiff, attempts, strategy } or null when nothing passed validation.
 */
async function findBestMatch(movie, apiKey) {
  const mainQuery = movie.normalizedTitle || movie.name;
  const expectedBase = [...new Set([movie.name, movie.normalizedTitle].filter(Boolean))];
  const queries = buildSearchQueries(movie);

  const attempts = [
    ...queries.map((query, i) => ({ label: i === 0 ? 'multi' : 'multi-subtitle', query, year: null, endpoints: false })),
    { label: 'movie+tv-year', query: mainQuery, year: movie.year, endpoints: true },
    { label: 'movie+tv', query: mainQuery, year: null, endpoints: true },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    // the query itself counts as an acceptable title so subtitle attempts
    // can still validate against what we actually searched for
    const expectedTitles = [...new Set([attempt.query, ...expectedBase])];

    const results = attempt.endpoints
      ? await searchMovieAndTv(attempt.query, attempt.year, apiKey)
      : await searchMulti(attempt.query, apiKey);

    const scored = [];
    for (const result of results) {
      const candidate = scoreCandidate(result, expectedTitles, movie.year);
      if (candidate) scored.push(candidate);
    }

    const best = pickBestCandidate(scored);
    if (best) {
      if (i > 0) enrichmentReport.fallbackUsed++;
      return { ...best, attempts: i + 1, strategy: attempt.label };
    }
  }

  return null;
}

/**
 * Fetches details and credits for a single movie or show from TMDB.
 *
 * Args:
 *   movie (Object): Movie object containing name, year and normalizedTitle.
 *   apiKey (string): TMDB API v3 key.
 *
 * Returns:
 *   Promise<Object>: Enriched movie object with runtime, directors and genres.
 */
async function fetchMovieDetails(movie, apiKey) {
  const baseResult = {
    ...movie,
    runtime: null,
    directors: [],
    genres: [],
    tmdbId: null,
    mediaType: null,
    matchStrategy: null,
  };

  try {
    const match = await findBestMatch(movie, apiKey);

    if (!match) {
      enrichmentReport.failed.push({ name: movie.name, year: movie.year });
      return baseResult;
    }

    const { result, mediaType, strategy } = match;

    if (mediaType === 'tv') enrichmentReport.tvMatches++;

    const detail = await fetchTmdb(`/${mediaType}/${result.id}`, { append_to_response: 'credits' }, apiKey);
    if (!detail) {
      return {
        ...baseResult,
        tmdbId: result.id,
        mediaType,
        matchStrategy: strategy,
      };
    }

    const directors = (detail.credits?.crew || [])
      .filter(c => c.job === 'Director')
      .map(c => c.name);

    const genres = (detail.genres || []).map(g => g.name);

    let runtime = null;
    if (mediaType === 'movie') {
      runtime = detail.runtime || null;
    } else if (mediaType === 'tv') {
      const episodeRunTime = detail.episode_run_time || [];
      const avgEpisodeRuntime = episodeRunTime.length > 0
        ? episodeRunTime.reduce((a, b) => a + b, 0) / episodeRunTime.length
        : null;
      const episodeCount = detail.number_of_episodes || null;
      runtime = avgEpisodeRuntime && episodeCount
        ? Math.round(avgEpisodeRuntime * episodeCount)
        : avgEpisodeRuntime
          ? Math.round(avgEpisodeRuntime)
          : null;
    }

    return {
      ...movie,
      tmdbId: detail.id,
      mediaType,
      runtime,
      directors,
      genres,
      popularity: detail.popularity || null,
      voteAverage: detail.vote_average || null,
      voteCount: detail.vote_count || null,
      overview: detail.overview || '',
      posterPath: detail.poster_path || null,
      budget: detail.budget || null,
      revenue: detail.revenue || null,
      originalLanguage: detail.original_language || null,
      productionCountries: (detail.production_countries || []).map(c => c.iso_3166_1),
      matchStrategy: strategy,
    };
  } catch (err) {
    console.warn(`tmdbApi: failed to fetch tmdb data for "${movie.name}"`, err);
    enrichmentReport.failed.push({ name: movie.name, year: movie.year });
    return baseResult;
  }
}

/**
 * Enriches an array of movies with runtime, directors and genres from the
 * TMDB API in batches.
 *
 * Rewatched movies get deduped before hitting the api because watched.csv
 * has one row per watch and hammering tmdb five times for the same film is
 * pure stupidity. results are mapped back so the output keeps the original
 * row order, rewatches included.
 *
 * Args:
 *   movies (Array<Object>): Array of parsed movie objects.
 *   apiKey (string): TMDB API key.
 *   onProgress (Function): Callback invoked after each batch (processed, total, batchResults).
 *
 * Returns:
 *   Promise<Array<Object>>: Enriched movie objects array.
 */
export async function enrichMovies(movies, apiKey, onProgress) {
  if (!apiKey || apiKey === 'your_tmdb_api_key_here') {
    onProgress?.(movies.length, movies.length);
    return movies.map(m => ({
      ...m,
      runtime: null,
      directors: [],
      genres: [],
      tmdbId: null,
      mediaType: null,
      matchStrategy: null,
    }));
  }

  const cacheKey = buildCacheKey(movies);
  const cached = getCache(cacheKey);
  if (cached && cached.length === movies.length) {
    onProgress?.(movies.length, movies.length);
    return cached;
  }

  resetEnrichmentReport();
  enrichmentReport.total = movies.length;

  const movieKey = m => `${m.name}::${m.year}`;

  const uniqueMovies = [];
  const seenKeys = new Set();
  const rowCountByKey = new Map();
  for (const movie of movies) {
    const key = movieKey(movie);
    rowCountByKey.set(key, (rowCountByKey.get(key) || 0) + 1);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueMovies.push(movie);
    }
  }

  const enrichedByKey = new Map();
  let coveredRows = 0;

  for (let i = 0; i < uniqueMovies.length; i += BATCH_SIZE) {
    const batch = uniqueMovies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(movie => fetchMovieDetails(movie, apiKey))
    );
    results.forEach((result, idx) => {
      const key = movieKey(batch[idx]);
      enrichedByKey.set(key, result);
      coveredRows += rowCountByKey.get(key) || 0;
    });
    onProgress?.(coveredRows, movies.length, results);

    if (i + BATCH_SIZE < uniqueMovies.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const enriched = movies.map(m => enrichedByKey.get(movieKey(m)));

  enrichmentReport.matched = enriched.filter(m => m.tmdbId !== null).length;

  setCache(cacheKey, enriched);
  return enriched;
}
