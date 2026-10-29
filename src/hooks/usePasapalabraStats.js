import { useMemo } from 'react';
import { dedupeFilms, filmKey } from '../utils/films';

export const PASAPALABRA_LETTERS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

const COUNT_FORMAT = new Intl.NumberFormat('en-US');

// articles are a scam, strip the bastards so The Matrix lands under M where it
// fucking belongs. spanish and french ones too, this is a cinephile app.
const ARTICLES = new Set([
  'a', 'an', 'the',
  'el', 'la', 'los', 'las', 'lo',
  'le', 'les', 'l',
  'il',
  'un', 'una', 'une', 'des', 'du',
]);

// latin letters that do not decompose under NFD, fold the weird ones by hand
const EXTRA_FOLD = {
  'Ø': 'O',
  'Æ': 'A',
  'Œ': 'O',
  'ß': 'S',
  'Ł': 'L',
  'Đ': 'D',
  'Ð': 'D',
  'Þ': 'T',
};

/**
 * Removes a leading article so the title maps to the letter people expect.
 *
 * Args:
 *   name (string): Raw film title.
 *
 * Returns:
 *   string: Title without a leading article, or the original when there is none.
 */
function stripLeadingArticle(name) {
  const match = name.match(/^([\p{L}]+)[\s'’]+/u);
  if (!match || !ARTICLES.has(match[1].toLowerCase())) return name;

  const rest = name.slice(match[0].length).trim();
  return rest || name;
}

/**
 * Maps a film title to its A to Z initial.
 *
 * Leading punctuation is ignored, accents fold to their base letter, and
 * titles that start with a number or a non Latin script return null on
 * purpose. The rosco is a clean A to Z board, no numbers, no Ñ.
 *
 * Args:
 *   name (string): Raw film title.
 *
 * Returns:
 *   string|null: One letter from A to Z, or null when the title does not fit.
 */
function initialOf(name) {
  const cleaned = String(name || '')
    .trim()
    .replace(/^[\s"'“”‘’«»¿¡([{]+/, '');
  const stripped = stripLeadingArticle(cleaned);
  const first = stripped.match(/^[\p{L}]/u)?.[0];
  if (!first) return null;

  const folded = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const mapped = EXTRA_FOLD[folded] || folded;
  return PASAPALABRA_LETTERS.includes(mapped) ? mapped : null;
}

/**
 * Keeps only the fields the A to Z card actually renders.
 *
 * Args:
 *   film (Object): Enriched film row.
 *
 * Returns:
 *   Object: Compact film snapshot with the stats the record rows need.
 */
function filmSnapshot(film) {
  return {
    name: film.name,
    year: film.year ?? null,
    rating: film.rating ?? null,
    voteAverage: film.voteAverage ?? null,
    voteCount: film.voteCount ?? null,
    runtime: film.runtime ?? null,
    posterPath: film.posterPath || null,
  };
}

/**
 * Turns a runtime in minutes into a short human label.
 *
 * Args:
 *   minutes (number|null): Runtime in minutes.
 *
 * Returns:
 *   string: Label like 2h 16m, or a fallback when the runtime is unknown.
 */
function formatRuntime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'an unknown runtime';

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/**
 * The five records every letter can hold.
 *
 * Each record declares how a film qualifies, how the films of a letter are
 * ranked, and the stat that gets printed on the card.
 */
const RECORDS = [
  {
    id: 'popular',
    name: 'Most watched',
    tone: 'blue',
    eligible: (film) => Number.isFinite(film.voteCount) && film.voteCount > 0,
    rank: (a, b) => (b.voteCount - a.voteCount)
      || ((b.voteAverage || 0) - (a.voteAverage || 0))
      || a.name.localeCompare(b.name),
    stat: (film) => `${COUNT_FORMAT.format(film.voteCount)} votes`,
    empty: 'No votes',
  },
  {
    id: 'niche',
    name: 'Least watched',
    tone: 'orange',
    eligible: (film) => Number.isFinite(film.voteCount) && film.voteCount > 0,
    rank: (a, b) => (a.voteCount - b.voteCount)
      || ((a.voteAverage || 0) - (b.voteAverage || 0))
      || a.name.localeCompare(b.name),
    stat: (film) => `${COUNT_FORMAT.format(film.voteCount)} votes`,
    empty: 'No votes',
  },
  {
    id: 'long',
    name: 'Longest',
    tone: 'green',
    eligible: (film) => (
      Number.isFinite(film.runtime)
      && film.runtime > 0
      && film.mediaType !== 'tv'
    ),
    rank: (a, b) => (b.runtime - a.runtime)
      || ((b.voteCount || 0) - (a.voteCount || 0))
      || a.name.localeCompare(b.name),
    stat: (film) => formatRuntime(film.runtime),
    empty: 'No runtime',
  },
  {
    id: 'rated',
    name: 'Best rated',
    tone: 'orange',
    eligible: (film) => Number.isFinite(film.rating) && film.rating > 0,
    rank: (a, b) => (b.rating - a.rating)
      || ((b.voteAverage || 0) - (a.voteAverage || 0))
      || a.name.localeCompare(b.name),
    stat: (film) => `${film.rating.toFixed(1)} / 5`,
    empty: 'Not rated',
  },
  {
    id: 'old',
    name: 'Oldest',
    tone: 'blue',
    eligible: (film) => Number.isFinite(film.year) && film.year >= 1888,
    rank: (a, b) => (a.year - b.year) || a.name.localeCompare(b.name),
    stat: (film) => String(film.year),
    empty: 'No year',
  },
];

/**
 * Builds the record card for one letter.
 *
 * A film that wins several categories gets one tile with several labels, so
 * the same poster never repeats. Categories with no eligible film still get
 * a placeholder tile that says what data is missing.
 *
 * Args:
 *   films (Array<Object>): Every film starting with that letter.
 *
 * Returns:
 *   Object: Letter count, the unique record holders and the missing categories.
 */
function buildLetter(films) {
  const recordByFilm = new Map();
  const records = [];
  const missing = [];

  for (const record of RECORDS) {
    const eligible = films.filter(record.eligible);

    if (eligible.length === 0) {
      missing.push({
        id: record.id,
        name: record.name,
        tone: record.tone,
        empty: record.empty,
      });
      continue;
    }

    eligible.sort(record.rank);
    const film = eligible[0];
    const key = filmKey(film.name, film.year);
    let entry = recordByFilm.get(key);

    if (!entry) {
      entry = {
        film: filmSnapshot(film),
        labels: [],
        stats: [],
      };
      recordByFilm.set(key, entry);
      records.push(entry);
    }

    entry.labels.push({ id: record.id, name: record.name, tone: record.tone });
    const stat = record.stat(film);
    if (!entry.stats.includes(stat)) entry.stats.push(stat);
  }

  return {
    count: films.length,
    records,
    missing,
  };
}

/**
 * Groups every A to Z film by its initial and builds its record card.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched films.
 *
 * Returns:
 *   Object: hasData flag, the letter bundles and how many letters have films.
 */
function buildPasapalabraStats(rows) {
  const buckets = new Map();

  for (const film of rows) {
    const letter = initialOf(film.name);
    if (!letter) continue;

    const bucket = buckets.get(letter);
    if (bucket) bucket.push(film);
    else buckets.set(letter, [film]);
  }

  const letters = {};
  for (const [letter, films] of buckets) {
    letters[letter] = buildLetter(films);
  }

  return {
    hasData: rows.length > 0,
    letters,
    availableLetters: Object.keys(letters).length,
  };
}

/**
 * Derives the A to Z record board from the enriched library.
 *
 * Args:
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: The record card for every letter, computed once per upload.
 */
export function usePasapalabraStats(enrichedData = null) {
  return useMemo(() => {
    const rows = dedupeFilms(enrichedData || []);
    return buildPasapalabraStats(rows);
  }, [enrichedData]);
}
