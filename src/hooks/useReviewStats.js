import { useMemo } from 'react';

/**
 * Closed class function words only: articles, pronouns, prepositions,
 * conjunctions, auxiliaries and the degree or focus particles. These carry no
 * lexical meaning, so dropping them leaves only what the writer actually said.
 * Everything with meaning (nouns, verbs, adjectives, real adverbs) stays in
 * the cloud on purpose. Contractions are listed with their apostrophes
 * stripped, since the tokenizer normalises them before the lookup.
 */
const STOPWORDS = new Set([
  // English articles and determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'some', 'any', 'each',
  'every', 'no', 'all', 'such', 'other', 'others', 'own', 'same',
  // English pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours',
  'theirs', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves',
  'yourselves', 'themselves', 'who', 'whom', 'whose', 'which', 'what',
  // English prepositions
  'of', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'into', 'onto', 'upon',
  // English conjunctions
  'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'than', 'as',
  // English auxiliaries and modals
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'doing', 'done', 'will', 'would', 'shall', 'should',
  'can', 'could',
  // English negators, degree, focus and deictic particles
  'not', 'very', 'too', 'just', 'only', 'also',
  'there',
  'then', 'yes',
  // English contractions (apostrophes stripped by the tokenizer)
  'im', 'ive', 'id', 'ill', 'youre', 'youve', 'youll', 'youd', 'hes', 'shes',
  'its', 'were', 'weve', 'wed', 'theyre', 'theyve', 'theyll', 'theyd', 'thats',
  'theres', 'heres', 'whats', 'hows', 'whos', 'dont', 'doesnt', 'didnt', 'isnt', 'arent',
  'wasnt', 'werent', 'wont', 'cant', 'couldnt', 'wouldnt', 'shouldnt', 'hasnt',
  'havent', 'hadnt',
  // Spanish articles and determiners
  'el', 'la', 'lo', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'del',
  'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'esos', 'esas',
  'aquel', 'aquella', 'aquello',
  // Spanish pronouns
  'yo', 'tu', 'él', 'ella', 'ello', 'nosotros', 'nosotras', 'vosotros',
  'vosotras', 'ellos', 'ellas', 'me', 'te', 'se', 'nos', 'os', 'le', 'les',
  'mi', 'mis', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'vuestro', 'vuestra', 'mio', 'mia', 'tuyo', 'tuya', 'suyo', 'suya', 'quien',
  'quienes', 'que', 'cual', 'cuales', 'cuanto', 'cuanta',
  // Spanish prepositions
  'a', 'de', 'en', 'con', 'por', 'para', 'sin',
  // Spanish conjunctions
  'y', 'e', 'o', 'u', 'ni', 'si', 'pero',
  // Spanish auxiliaries and modals
  'ser', 'estar', 'haber', 'es', 'son', 'era', 'eran', 'fue', 'fueron', 'estoy',
  'estas', 'esta', 'estamos', 'estan', 'estaba', 'estaban', 'he', 'has', 'ha',
  'han', 'hay', 'habia', 'puede', 'pueden', 'podia', 'debe', 'deben', 'sea',
  'sido', 'siendo',
  // Spanish negators, degree, focus and deictic particles
  'no',
  // French function words, some reviewers write in French too
  'le', 'les', 'des', 'du', 'une', 'et', 'est', 'sont', 'dans', 'pour', 'avec',
  'sans', 'sur', 'sous', 'que', 'qui', 'quoi', 'dont', 'mais', 'car', 'donc',
  'or', 'ni', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma',
  'mes', 'ton', 'ta', 'tes', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te',
  'se', 'lui', 'au', 'aux', 'par', 'vers', 'chez', 'entre', 'comme', 'plus',
  'moins', 'tres', 'très', 'tout', 'toute', 'tous', 'toutes', 'aussi', 'alors',
  'ainsi', 'meme', 'même', 'encore', 'deja', 'déjà', 'jamais', 'toujours',
  'souvent', 'parfois', 'ici', 'etre', 'être', 'suis', 'sommes', 'etes', 'êtes',
  'etait', 'était', 'avoir', 'avons', 'avez', 'ont', 'peut', 'peuvent', 'doit',
  'doivent', 'cela', 'celui', 'celle', 'ne', 'pas', 'non', 'oui',
]);

// how much of the cloud we even bother computing, the layout drops the rest
const WORD_CLOUD_LIMIT = 60;
// reviews shown in the featured picker, the first one becomes the hero. Kept
// at five so the ranked list stays about as tall as the hero beside it and the
// card does not end up with a dead column.
const FEATURED_LIMIT = 5;

/**
 * Counts the words in a review body.
 *
 * Args:
 *   text (string): Review text.
 *
 * Returns:
 *   number: Word count, 0 for empty text.
 */
function wordCount(text) {
  if (!text) return 0;
  const matches = text.trim().match(/[\p{L}\p{N}']+/gu);
  return matches ? matches.length : 0;
}

/**
 * Splits a review into clean, lowercase words worth counting.
 *
 * Keeps accented letters so Spanish reviews are not gutted, strips punctuation
 * and drops stopwords plus anything shorter than three letters.
 *
 * Args:
 *   text (string): Review text.
 *
 * Returns:
 *   Array<string>: Tokenised words.
 */
function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const raw = lower.match(/[\p{L}']+/gu) || [];
  const words = [];
  for (const token of raw) {
    // apostrophes come off so "don't" and "dont" hit the same stopword
    const word = token.replace(/'/g, '');
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    words.push(word);
  }
  return words;
}

/**
 * Indexes enriched films so reviews can borrow their poster and rating.
 *
 * Args:
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: { byKey, byName } lookup maps.
 */
function buildFilmIndex(enrichedData) {
  const byKey = new Map();
  const byName = new Map();
  for (const movie of enrichedData || []) {
    if (!movie?.name) continue;
    const nameKey = String(movie.name).trim().toLowerCase();
    byKey.set(`${nameKey}::${movie.year ?? ''}`, movie);
    if (!byName.has(nameKey)) byName.set(nameKey, movie);
  }
  return { byKey, byName };
}

/**
 * Finds the enriched film behind a review, matching on title plus year first.
 *
 * Args:
 *   review (Object): Normalised review row.
 *   index (Object): Film index from buildFilmIndex.
 *
 * Returns:
 *   Object|null: Matching enriched movie or null.
 */
function matchFilm(review, index) {
  const nameKey = String(review.name || '').trim().toLowerCase();
  return index.byKey.get(`${nameKey}::${review.year ?? ''}`) || index.byName.get(nameKey) || null;
}

/**
 * Builds the frequency ranked word list.
 *
 * Args:
 *   reviews (Array<Object>): Normalised reviews.
 *
 * Returns:
 *   Array<Object>: { word, count } sorted by count desc.
 */
function buildWordCloud(reviews) {
  const tally = new Map();

  for (const review of reviews) {
    const seen = new Set();
    for (const word of tokenize(review.review)) {
      let entry = tally.get(word);
      if (!entry) {
        entry = { word, count: 0 };
        tally.set(word, entry);
      }
      // one review can only bump a word once, otherwise a single rant skews it
      if (seen.has(word)) continue;
      seen.add(word);
      entry.count++;
    }
  }

  const minCount = reviews.length >= 10 ? 2 : 1;

  return [...tally.values()]
    .filter((entry) => entry.count >= minCount)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, WORD_CLOUD_LIMIT);
}

/**
 * Groups review lengths by year into the simple numbers the bar chart draws.
 *
 * One row per year with the average word count, plus the shortest and longest
 * review so the tooltip can show the spread. No quartiles: the chart is meant
 * to be read at a glance, not decoded.
 *
 * Args:
 *   reviews (Array<Object>): Normalised reviews with a `words` count.
 *
 * Returns:
 *   Array<Object>: Per year { year, count, avg, min, max }.
 */
function buildLengthByYear(reviews) {
  const byYear = new Map();

  for (const review of reviews) {
    const year = review.date ? parseInt(String(review.date).slice(0, 4), 10) : NaN;
    if (!Number.isFinite(year)) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(review.words);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, lengths]) => {
      const sum = lengths.reduce((a, b) => a + b, 0);
      return {
        year,
        count: lengths.length,
        avg: sum / lengths.length,
        min: Math.min(...lengths),
        max: Math.max(...lengths),
      };
    });
}

/**
 * Decides whether the writer's takes got longer, shorter or stayed put.
 *
 * Compares the average of the earlier half of the years against the later half,
 * so a single loud year cannot flip the verdict.
 *
 * Args:
 *   series (Array<Object>): Per year rows from buildLengthByYear.
 *
 * Returns:
 *   Object: { direction, delta } where direction is up, down, steady or none.
 */
function buildLengthVerdict(series) {
  if (series.length < 3) return { direction: 'none', delta: 0 };

  const half = Math.ceil(series.length / 2);
  const early = series.slice(0, half);
  const late = series.slice(-half);
  const mean = (rows) => rows.reduce((sum, row) => sum + row.avg, 0) / rows.length;
  const earlyAvg = mean(early);
  const lateAvg = mean(late);
  const delta = lateAvg - earlyAvg;

  if (earlyAvg === 0) return { direction: 'none', delta: 0 };
  const ratio = delta / earlyAvg;
  if (ratio >= 0.1) return { direction: 'up', delta };
  if (ratio <= -0.1) return { direction: 'down', delta };
  return { direction: 'steady', delta };
}

/**
 * Picks the reviews with the most meat and enriches them for the UI.
 *
 * Sorted purely by word count: depth in this section means how much the writer
 * actually had to say, and the poster makes each one recognisable at a glance.
 *
 * Args:
 *   reviews (Array<Object>): Normalised reviews with matched film data.
 *
 * Returns:
 *   Array<Object>: Top reviews with { name, year, rating, posterPath, text, words, date }.
 */
function buildFeatured(reviews) {
  return [...reviews]
    .sort((a, b) => b.words - a.words || String(b.date).localeCompare(String(a.date)))
    .slice(0, FEATURED_LIMIT)
    .map((review) => ({
      name: review.name,
      year: review.year,
      rating: review.rating,
      posterPath: review.posterPath || null,
      text: review.review,
      words: review.words,
      date: review.date,
    }));
}

const EMPTY_STATS = {
  totalReviews: 0,
  totalWords: 0,
  avgWords: 0,
  longest: null,
  busiestYear: null,
  topWord: null,
};

/**
 * Derives every stat for the Section 06 Reviews section.
 *
 * Pure and memoised on the raw export plus the enriched rows. Reviews are
 * matched to their enriched film so the UI can show posters and ratings
 * without the component doing any lookups.
 *
 * Args:
 *   rawData (Object|null): Parsed export containing `reviews`.
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: hasData, wordCloud, lengthByYear, lengthVerdict, featured, stats.
 */
export function useReviewStats(rawData = null, enrichedData = null) {
  return useMemo(() => {
    const index = buildFilmIndex(enrichedData);
    const rawReviews = rawData?.reviews || [];

    const reviews = rawReviews.map((review) => {
      const film = matchFilm(review, index);
      return {
        ...review,
        posterPath: film?.posterPath || null,
        rating: review.rating != null ? review.rating : film?.rating ?? null,
        words: wordCount(review.review),
      };
    });

    if (reviews.length === 0) {
      return {
        hasData: false,
        wordCloud: [],
        lengthByYear: [],
        lengthVerdict: { direction: 'none', delta: 0 },
        featured: [],
        stats: { ...EMPTY_STATS },
      };
    }

    const wordCloud = buildWordCloud(reviews);
    const lengthByYear = buildLengthByYear(reviews);
    const featured = buildFeatured(reviews);

    const totalWords = reviews.reduce((sum, review) => sum + review.words, 0);
    const busiest = lengthByYear.reduce(
      (best, row) => (!best || row.count > best.count ? row : best),
      null,
    );

    return {
      hasData: true,
      wordCloud,
      lengthByYear,
      lengthVerdict: buildLengthVerdict(lengthByYear),
      featured,
      stats: {
        totalReviews: reviews.length,
        totalWords,
        avgWords: totalWords / reviews.length,
        longest: featured[0] || null,
        busiestYear: busiest,
        topWord: wordCloud[0] || null,
      },
    };
  }, [rawData, enrichedData]);
}
