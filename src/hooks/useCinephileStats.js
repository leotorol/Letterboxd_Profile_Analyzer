import { useMemo } from 'react';

// how many dots max we render per genre column in the dotplot
const GENRE_DOTPLOT_MAX_DOTS = 80;
// filter out anything longer than this – it's an anime series or tv marathon, not a film
const MAX_FILM_RUNTIME_MIN = 300;
// runtime reference points for the "short film <-> epic" axis
const RUNTIME_LOW = 85;
const RUNTIME_HIGH = 185;
// rating reference points for the "lenient <-> critical" axis
const RATING_LOW = 2;
const RATING_HIGH = 4.5;

/**
 * Maps a TMDB ISO 3166-1 country code to a coarse continent bucket.
 *
 * Args:
 *   code (string): Two letter ISO country code, eg 'US'.
 *
 * Returns:
 *   string: Continent group, or 'Other' when the country is unknown.
 */
function continentOf(code) {
  const map = {
    US: 'North America', CA: 'North America', MX: 'North America',
    AR: 'South America', BR: 'South America', CL: 'South America', CO: 'South America',
    PE: 'South America', VE: 'South America', UY: 'South America', PY: 'South America',
    BO: 'South America', EC: 'South America',
    GB: 'Europe', FR: 'Europe', DE: 'Europe', IT: 'Europe', ES: 'Europe', PT: 'Europe',
    NL: 'Europe', BE: 'Europe', CH: 'Europe', AT: 'Europe', IE: 'Europe', PL: 'Europe',
    SE: 'Europe', NO: 'Europe', DK: 'Europe', FI: 'Europe', GR: 'Europe', CZ: 'Europe',
    HU: 'Europe', RO: 'Europe', RU: 'Europe', UA: 'Europe', TR: 'Europe', IS: 'Europe',
    LU: 'Europe', SK: 'Europe', HR: 'Europe', RS: 'Europe', BG: 'Europe', EE: 'Europe',
    LV: 'Europe', LT: 'Europe', SI: 'Europe', AL: 'Europe', MK: 'Europe', BA: 'Europe',
    CY: 'Europe', MT: 'Europe',
    IN: 'Asia', JP: 'Asia', KR: 'Asia', CN: 'Asia', HK: 'Asia', TW: 'Asia', SG: 'Asia',
    MY: 'Asia', TH: 'Asia', ID: 'Asia', PH: 'Asia', VN: 'Asia', PK: 'Asia', BD: 'Asia',
    LK: 'Asia', NP: 'Asia', AE: 'Asia', SA: 'Asia', IL: 'Asia', IR: 'Asia', IQ: 'Asia',
    LB: 'Asia', JO: 'Asia', QA: 'Asia', KW: 'Asia', KZ: 'Asia', UZ: 'Asia', GE: 'Asia',
    NG: 'Africa', ZA: 'Africa', DZ: 'Africa', MA: 'Africa', TN: 'Africa', EG: 'Africa',
    KE: 'Africa', ET: 'Africa', GH: 'Africa', SN: 'Africa', CI: 'Africa', UG: 'Africa',
    TZ: 'Africa', ZW: 'Africa',
    AU: 'Oceania', NZ: 'Oceania', FJ: 'Oceania',
  };
  return map[code] || 'Other';
}

/**
 * Averages an array of numbers.
 *
 * Args:
 *   values (number[]): Numbers to average.
 *
 * Returns:
 *   number: Arithmetic mean, or 0 for an empty array.
 */
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Finds the median of an array of numbers.
 *
 * Args:
 *   values (number[]): Numbers to inspect.
 *
 * Returns:
 *   number|null: Median value, or null for an empty array.
 */
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Clamps a number between a lower and upper bound.
 *
 * Args:
 *   value (number): Input value.
 *   low (number): Lower bound.
 *   high (number): Upper bound.
 *
 * Returns:
 *   number: Clamped value.
 */
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * Pearson product-moment correlation coefficient between two number arrays.
 *
 * Args:
 *   xs (number[]): First series.
 *   ys (number[]): Second series.
 *
 * Returns:
 *   number: Correlation in the range -1 to 1.
 */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/**
 * Computes a normalised (0..1) Shannon entropy of the genre distribution.
 *
 * 1 means genres are spread perfectly even, 0 means the whole library is one
 * single genre. Backbone of the genre diversity spectrum axis.
 *
 * Args:
 *   rows (Array<Object>): Enriched movies with a `genres` array.
 *
 * Returns:
 *   number: Normalised genre entropy between 0 and 1.
 */
function genreEntropy(rows) {
  const map = new Map();
  for (const movie of rows) {
    for (const genre of (movie.genres || [])) {
      map.set(genre, (map.get(genre) || 0) + 1);
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const distinct = map.size;
  if (distinct <= 1) return 0;
  let entropy = 0;
  for (const count of map.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy / Math.log2(distinct);
}

/**
 * Builds the 4 cinephile spectrum axes for the horizontal bar visualisation.
 *
 * Each axis returns a 0..1 value (0 = left pole, 1 = right pole), a human
 * readable percentage, an explanation for tooltips, and availability.
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *
 * Returns:
 *   Array<Object>: Axis descriptors with labels, values, explanations and availability.
 */
function buildSpectrum(rows) {
  const withVotes = rows.filter((m) => m.voteCount != null && m.voteCount > 0);
  const withGenres = rows.filter((m) => (m.genres || []).length > 0);
  const withLang = rows.filter((m) => m.originalLanguage);
  const years = rows.filter((m) => m.year).map((m) => m.year);

  const medianVotes = median(withVotes.map((m) => m.voteCount));
  const mainstreamCount = medianVotes != null && withVotes.length
    ? withVotes.filter((m) => m.voteCount >= medianVotes).length
    : 0;
  const mainstream = withVotes.length ? mainstreamCount / withVotes.length : null;

  let modern = null;
  let modernCount = 0;
  let medianYr = null;
  if (years.length) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    medianYr = Math.round(median(years));
    modern = minYear === maxYear ? 0.5 : (medianYr - minYear) / (maxYear - minYear);
    modernCount = rows.filter((m) => m.year && m.year >= 2000).length;
  }

  const intlCount = withLang.length
    ? withLang.filter((m) => m.originalLanguage !== 'en').length
    : 0;
  const international = withLang.length ? intlCount / withLang.length : null;

  const distinctGenres = new Set(rows.flatMap((m) => m.genres || [])).size;
  const diverse = withGenres.length ? genreEntropy(rows) : null;

  const makeAxis = (key, leftLabel, rightLabel, value, pctLabel, explanation) => ({
    key,
    leftLabel,
    rightLabel,
    value: value ?? 0,
    available: value != null,
    pctLabel: pctLabel ?? '',
    explanation,
  });

  const pct = (v) => (v != null ? `${Math.round(v * 100)}%` : null);

  return [
    makeAxis(
      'mainstream',
      'Indie',
      'Mainstream',
      mainstream,
      mainstream != null ? `${Math.round(mainstream * 100)}% mainstream` : null,
      withVotes.length
        ? `Out of ${withVotes.length.toLocaleString()} films, ${mainstreamCount.toLocaleString()} (${Math.round(mainstream * 100)}%) are above average TMDB popularity.`
        : 'Not enough TMDB vote data.'
    ),
    makeAxis(
      'modern',
      'Classic',
      'Modern',
      modern,
      modern != null ? `${Math.round(modern * 100)}% modern` : null,
      years.length
        ? `Out of ${years.length.toLocaleString()} films, ${modernCount.toLocaleString()} (${Math.round((modernCount / years.length) * 100)}%) were released in 2000 or later (median release year: ${medianYr}).`
        : 'Not enough release year data.'
    ),
    makeAxis(
      'international',
      'US / English',
      'International',
      international,
      pct(international) ? `${pct(international)} international` : null,
      withLang.length
        ? `Out of ${withLang.length.toLocaleString()} films, ${intlCount.toLocaleString()} (${Math.round(international * 100)}%) are non-English / international, while ${(withLang.length - intlCount).toLocaleString()} are English-speaking.`
        : 'Not enough language data.'
    ),
    makeAxis(
      'diverse',
      'Focused',
      'Diverse',
      diverse,
      diverse != null ? `${Math.round(diverse * 100)}% genre spread` : null,
      withGenres.length
        ? `Out of ${withGenres.length.toLocaleString()} films, your watches span ${distinctGenres} distinct genres (Diversity score: ${Math.round(diverse * 100)}/100).`
        : 'Not enough genre data.'
    ),
  ];
}

/**
 * Builds the genre vertical dotplot data.
 *
 * Every genre column carries the full sorted list of films (rated ones first so
 * the bright dots sit at the top of the column). The column is capped at
 * GENRE_DOTPLOT_MAX_DOTS rendered dots; the remainder is reported as overflow.
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *
 * Returns:
 *   Object: Sorted genre list, maxCount, total genre occurrences, entropy, rarest genre.
 */
function buildGenreDistribution(rows) {
  const byGenre = new Map();
  for (const movie of rows) {
    const genres = movie.genres || [];
    for (const genre of genres) {
      let entry = byGenre.get(genre);
      if (!entry) {
        entry = { genre, count: 0, films: [] };
        byGenre.set(genre, entry);
      }
      entry.count++;
      entry.films.push({
        name: movie.name,
        year: movie.year,
        rating: movie.rating ?? null,
        posterPath: movie.posterPath || null,
      });
    }
  }

  // sort each genre's films: rated first (highest rating at top of column), unrated last
  for (const entry of byGenre.values()) {
    entry.films.sort((a, b) => {
      if (a.rating != null && b.rating != null) return b.rating - a.rating;
      if (a.rating != null) return -1;
      if (b.rating != null) return 1;
      return 0;
    });
  }

  const list = [...byGenre.values()].sort((a, b) => b.count - a.count);
  const total = list.reduce((sum, entry) => sum + entry.count, 0);
  const maxCount = list.length ? list[0].count : 0;
  const validForRarest = list.filter(e => e.genre !== 'TV Movie' && e.genre !== 'Documentary');
  const rarestGenre = validForRarest.length ? validForRarest[validForRarest.length - 1] : null;

  return {
    list,
    total,
    maxCount,
    entropy: genreEntropy(rows),
    topGenre: list[0] || null,
    rarestGenre,
    distinctCount: list.length,
    maxDots: GENRE_DOTPLOT_MAX_DOTS,
  };
}

/**
 * Builds the average rating per year series and taste direction metadata.
 *
 * Direction compares the average rating in the first half vs the second half
 * of your Letterboxd history. Positive delta = you rate higher lately
 * (more generous), negative = you rate lower (harsher).
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *
 * Returns:
 *   Object: series, direction ('up'|'down'|'steady'), delta, earlyAvg, lateAvg.
 */
function buildTasteEvolution(rows) {
  // check date, watchedDate, or fallback to year so no logs get lost
  const rated = rows.filter((m) => m.rating != null && (m.date || m.watchedDate || m.year));
  const byYear = new Map();

  for (const movie of rated) {
    const rawDate = movie.date || movie.watchedDate;
    let watchYear = rawDate ? parseInt(String(rawDate).substring(0, 4), 10) : null;
    if (!watchYear || isNaN(watchYear) || watchYear < 1900 || watchYear > 2100) {
      watchYear = movie.year;
    }
    if (!watchYear) continue;

    let entry = byYear.get(watchYear);
    if (!entry) {
      entry = { year: watchYear, count: 0, sum: 0 };
      byYear.set(watchYear, entry);
    }
    entry.count++;
    entry.sum += movie.rating;
  }

  const series = [...byYear.values()]
    .map((entry) => ({ year: entry.year, count: entry.count, avg: entry.sum / entry.count }))
    .sort((a, b) => a.year - b.year);

  let direction = 'steady';
  let delta = 0;
  let earlyAvg = null;
  let lateAvg = null;
  if (series.length >= 2) {
    const half = Math.ceil(series.length / 2);
    const earlySeries = series.slice(0, half);
    const lateSeries = series.slice(half);
    earlyAvg = mean(earlySeries.map((s) => s.avg));
    lateAvg = mean(lateSeries.map((s) => s.avg));
    delta = lateAvg - earlyAvg;
    if (delta > 0.12) direction = 'up';
    else if (delta < -0.12) direction = 'down';
    else direction = 'steady';
  }

  return { series, direction, delta, earlyAvg, lateAvg, total: rated.length };
}

/**
 * Builds the tick density scatter data for runtime or era correlation.
 *
 * Films with runtime > MAX_FILM_RUNTIME_MIN are excluded (they're anime series
 * or TV marathons, not films). Each point carries x (runtime or year), y (rating)
 * and the film name & poster for the tooltip.
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *   axis (string): Either 'runtime' or 'era'.
 *
 * Returns:
 *   Object: points, Pearson r, count, xMin, xMax, avgX.
 */
function buildCorrelation(rows, axis) {
  const points = [];
  for (const movie of rows) {
    if (movie.rating == null) continue;
    let x;
    if (axis === 'runtime') {
      if (!movie.runtime || movie.runtime <= 0 || movie.runtime > MAX_FILM_RUNTIME_MIN) continue;
      x = movie.runtime;
    } else {
      if (!movie.year) continue;
      x = movie.year;
    }
    points.push({
      x,
      y: movie.rating,
      name: movie.name,
      year: movie.year,
      posterPath: movie.posterPath || null,
    });
  }

  if (!points.length) {
    return { points: [], r: 0, count: 0, xMin: 0, xMax: 0, avgX: 0 };
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  let xSum = 0;
  for (const point of points) {
    if (point.x < xMin) xMin = point.x;
    if (point.x > xMax) xMax = point.x;
    xSum += point.x;
  }

  return {
    points,
    r: pearson(points.map((p) => p.x), points.map((p) => p.y)),
    count: points.length,
    xMin,
    xMax,
    avgX: xSum / points.length,
  };
}

/**
 * Builds the behind-the-lens diversity stats & top director analytics.
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *
 * Returns:
 *   Object: Diversity metrics, top countries, top director, and continent distribution.
 */
function buildDiversity(rows) {
  let femaleInfo = 0;
  let femaleFilms = 0;
  let intlInfo = 0;
  let intlFilms = 0;
  const countryCounts = new Map();
  const continentCounts = new Map();
  const directorStats = new Map();

  for (const movie of rows) {
    const genders = movie.directorGenders;
    if (Array.isArray(genders) && genders.length) {
      femaleInfo++;
      if (genders.some((g) => g === 1)) femaleFilms++;
    }

    const directors = movie.directors || [];
    for (const name of directors) {
      let dEntry = directorStats.get(name);
      if (!dEntry) {
        dEntry = { name, count: 0, ratingSum: 0, ratedCount: 0 };
        directorStats.set(name, dEntry);
      }
      dEntry.count++;
      if (movie.rating != null) {
        dEntry.ratingSum += movie.rating;
        dEntry.ratedCount++;
      }
    }

    const language = movie.originalLanguage;
    const countries = movie.productionCountries || [];
    for (const code of countries) {
      countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
      const continent = continentOf(code);
      continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
    }

    if (language || countries.length) {
      intlInfo++;
      const isInternational = language
        ? language !== 'en'
        : !countries.includes('US') && !countries.includes('GB');
      if (isInternational) intlFilms++;
    }
  }

  const topCountries = [...countryCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topDirectors = [...directorStats.values()]
    .map((d) => ({
      ...d,
      avgRating: d.ratedCount ? d.ratingSum / d.ratedCount : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgRating || 0) - (a.avgRating || 0))
    .slice(0, 3);

  const continents = [...continentCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    femaleShare: femaleInfo ? femaleFilms / femaleInfo : null,
    femaleInfo,
    internationalShare: intlInfo ? intlFilms / intlInfo : null,
    intlInfo,
    topCountries,
    continents,
    topDirectors,
    topCountry: topCountries[0] || null,
  };
}

/**
 * Builds per-country film counts for the world map visualisation.
 *
 * Uses the productionCountries ISO 3166-1 codes already on every TMDB-enriched
 * film. No extra API call needed – this is all from the existing enrichment.
 *
 * Args:
 *   rows (Array<Object>): Full enriched movies array.
 *
 * Returns:
 *   Object: byCountry map, maxCount, totalCountries with at least one film.
 */
function buildWorldMap(rows) {
  const byCountry = new Map();
  for (const movie of rows) {
    const countries = movie.productionCountries || [];
    for (const code of countries) {
      byCountry.set(code, (byCountry.get(code) || 0) + 1);
    }
  }
  const maxCount = byCountry.size ? Math.max(...byCountry.values()) : 0;
  return {
    byCountry,
    maxCount,
    totalCountries: byCountry.size,
    totalWatched: rows.length,
  };
}

/**
 * Custom hook that derives every stat for the Section 03 Cinephile Profile.
 *
 * Pure and memoised on the enriched rows. Returns a ready-to-render shape so
 * the component only worries about layout and micro interactions.
 *
 * Args:
 *   rawData (Object|null): The parsed Letterboxd rawData from context.
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: A full bundle of cinephile stats.
 */
export function useCinephileStats(rawData, enrichedData = null) {
  return useMemo(() => {
    const rows = enrichedData || [];
    const watchedCount = rows.length;

    const emptyGenre = { list: [], total: 0, maxCount: 0, entropy: 0, topGenre: null, rarestGenre: null, distinctCount: 0, maxDots: GENRE_DOTPLOT_MAX_DOTS };
    const emptyCorr = { points: [], r: 0, count: 0, xMin: 0, xMax: 0, avgX: 0 };
    const emptyTaste = { series: [], direction: 'steady', delta: 0, earlyAvg: null, lateAvg: null, total: 0 };
    const emptyDiversity = { femaleShare: null, femaleInfo: 0, internationalShare: null, intlInfo: 0, topCountries: [], continents: [], topDirectors: [], topCountry: null };
    const emptyMap = { byCountry: new Map(), maxCount: 0, totalCountries: 0 };

    if (watchedCount === 0) {
      return {
        hasData: false,
        watchedCount: 0,
        spectrum: [],
        genre: emptyGenre,
        taste: emptyTaste,
        duration: emptyCorr,
        era: emptyCorr,
        diversity: emptyDiversity,
        worldMap: emptyMap,
      };
    }

    return {
      hasData: true,
      watchedCount,
      spectrum: buildSpectrum(rows),
      genre: buildGenreDistribution(rows),
      taste: buildTasteEvolution(rows),
      duration: buildCorrelation(rows, 'runtime'),
      era: buildCorrelation(rows, 'era'),
      diversity: buildDiversity(rows),
      worldMap: buildWorldMap(rows),
    };
  }, [enrichedData]);
}

