import { useMemo } from 'react';
import { dedupeFilms } from '../utils/films';

/**
 * Contrarian persona bands, shared with the Ratings component so nobody
 * retypes the thresholds. Score is 0 to 100 where 0 is perfect agreement and
 * 100 is max disagreement. Each band carries its upper bound, the persona
 * name and a short blurb. Infinity caps the last one.
 */
export const CONTRARIAN_BANDS = [
  { max: 15, label: 'Sheep', blurb: 'You and the crowd are basically the same person.' },
  { max: 30, label: 'Mild rebel', blurb: 'You mostly agree, but you have your moments.' },
  { max: 50, label: 'Contrarian', blurb: 'You call it like you see it, crowd be damned.' },
  { max: 75, label: 'Film anarchist', blurb: 'The consensus is basically your nemesis.' },
  { max: Infinity, label: 'Cinematic anarchist', blurb: 'Do you even like the movies everyone else loves?' },
];

// shared empty shape so the hook and buildContrarian stop diverging
const EMPTY_CONTRARIAN = {
  score: null,
  meanAbsDelta: 0,
  meanDelta: 0,
  label: 'Unknown',
  blurb: '',
  sampleSize: 0,
};

/**
 * Converts TMDB 0..10 scale to Letterboxd 0..5 scale.
 *
 * Args:
 *   tmdbAvg (number): TMDB vote_average on 0..10 scale.
 *
 * Returns:
 *   number: Equivalent on 0..5 scale.
 */
function tmdbTo5(tmdbAvg) {
  return tmdbAvg / 2;
}

/**
 * Filters films that carry both a user rating and a usable TMDB average, then
 * maps them to the scored shape every section 04 builder consumes.
 *
 * The consensus card and the contrarian meter used to filter and map this same
 * set twice, so now it happens once and both just read the result.
 *
 * Args:
 *   rows (Array<Object>): Enriched movies with rating and voteAverage.
 *
 * Returns:
 *   Array<Object>: { name, year, posterPath, userRating, tmdbAvg5, delta }.
 */
function buildScoredRows(rows) {
  return rows
    .filter((m) => m.rating != null && m.voteAverage != null && m.voteAverage > 0)
    .map((m) => {
      const tmdbAvg5 = tmdbTo5(m.voteAverage);
      return {
        name: m.name,
        year: m.year,
        posterPath: m.posterPath || null,
        userRating: m.rating,
        tmdbAvg5,
        delta: m.rating - tmdbAvg5,
      };
    });
}

/**
 * Builds the You vs the consensus data: the films where the user's rating
 * diverges the most from the TMDB average. Fucking crucial for the UI.
 *
 * Returns the top 4 hidden gems and the top 4 overhyped shit.
 *
 * Args:
 *   scored (Array<Object>): Output of buildScoredRows.
 *
 * Returns:
 *   Object: gems Array, overhyped Array each with up to 4 entries, and total.
 */
function buildConsensus(scored) {
  // hidden gems: user rates way ABOVE consensus. hostia puta
  const gems = [...scored]
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);

  // overhyped: user rates way BELOW consensus. mierda
  const overhyped = [...scored]
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 4);

  return { gems, overhyped, total: scored.length };
}

/**
 * Computes the contrarian score: how much the user tends to disagree
 * with the general consensus.
 *
 * The score is the mean absolute delta mapped to 0 to 100.
 * A 2.5 star average discrepancy is max contrarian. Deadass simple math.
 *
 * Args:
 *   scored (Array<Object>): Output of buildScoredRows.
 *
 * Returns:
 *   Object: score, meanAbsDelta, meanDelta, label, blurb, sampleSize
 */
function buildContrarian(scored) {
  if (scored.length === 0) {
    return { ...EMPTY_CONTRARIAN };
  }

  let absDeltaSum = 0;
  let signedDeltaSum = 0;
  for (const m of scored) {
    absDeltaSum += Math.abs(m.delta);
    signedDeltaSum += m.delta;
  }

  const meanAbsDelta = absDeltaSum / scored.length;
  // signed bias: positive means you are kinder than the crowd, negative harsher
  const meanDelta = signedDeltaSum / scored.length;

  // map to 0 to 100: 2.5 stars of avg discrepancy is 100
  const score = Math.min(100, Math.round((meanAbsDelta / 2.5) * 100));

  const band = CONTRARIAN_BANDS.find((p) => score <= p.max) || CONTRARIAN_BANDS[CONTRARIAN_BANDS.length - 1];

  return {
    score,
    meanAbsDelta,
    meanDelta,
    label: band.label,
    blurb: band.blurb,
    sampleSize: scored.length,
  };
}

/**
 * Minimum logged films a decade needs before it earns a spot in the
 * "Highest Rated Decades" wall. Below this the average is meaningless and
 * the poster wall looks sad, so we just leave the decade out.
 */
export const MIN_DECADE_FILMS = 19;

/**
 * Groups logged films by decade, computes average rating per decade,
 * and returns the top 3 decades sorted by average user rating.
 *
 * A decade only qualifies when it holds at least MIN_DECADE_FILMS logged
 * films, so thin decades never sneak in with a fluke average. Each decade
 * carries its rated films sorted by rating for the poster wall.
 *
 * Args:
 *   rows (Array<Object>): Enriched movies with rating and year.
 *
 * Returns:
 *   Array<Object>: Top 3 decades, each with label, avgRating, count, films.
 */
function buildDecades(rows) {
  const byDecade = new Map();

  for (const movie of rows) {
    if (movie.year == null) continue;

    const startYear = Math.floor(movie.year / 10) * 10;
    const label = `${startYear}s`;

    let entry = byDecade.get(startYear);
    if (!entry) {
      entry = { label, ratingSum: 0, ratedCount: 0, loggedCount: 0, films: [] };
      byDecade.set(startYear, entry);
    }

    // logged counts every watched film, rated or not
    entry.loggedCount++;

    if (movie.rating != null) {
      entry.ratingSum += movie.rating;
      entry.ratedCount++;
      entry.films.push({
        name: movie.name,
        year: movie.year,
        posterPath: movie.posterPath || null,
        rating: movie.rating,
      });
    }
  }

  // sort films within each decade by rating descending
  for (const entry of byDecade.values()) {
    entry.films.sort((a, b) => b.rating - a.rating);
  }

  const decades = [...byDecade.values()]
    .filter((d) => d.loggedCount >= MIN_DECADE_FILMS && d.ratedCount > 0)
    .map((d) => ({
      label: d.label,
      avgRating: d.ratingSum / d.ratedCount,
      count: d.loggedCount,
      films: d.films,
    }))
    .sort((a, b) => b.avgRating - a.avgRating);

  return decades.slice(0, 3);
}

/**
 * Custom hook that derives every stat for the Section 04 Ratings section.
 *
 * Pure and memoised on the enriched rows. Returns a ready to render shape so
 * the component only worries about layout and micro interactions. Fuck yeah.
 *
 * Args:
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: hasData, consensus, contrarian, decades
 */
export function useRatingStats(enrichedData = null) {
  return useMemo(() => {
    const rows = dedupeFilms(enrichedData || []);

    if (rows.length === 0) {
      return {
        hasData: false,
        consensus: { gems: [], overhyped: [], total: 0 },
        contrarian: { ...EMPTY_CONTRARIAN },
        decades: [],
      };
    }

    const scored = buildScoredRows(rows);

    return {
      hasData: true,
      consensus: buildConsensus(scored),
      contrarian: buildContrarian(scored),
      decades: buildDecades(rows),
    };
  }, [enrichedData]);
}
