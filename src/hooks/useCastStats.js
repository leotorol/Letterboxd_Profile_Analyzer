import { useMemo } from 'react';
import { dedupeFilms } from '../utils/films';
import { mean, median, pearson } from '../utils/stats';

// how many faces and studios the section actually renders
const TOP_ACTOR_LIMIT = 8;
const TOP_STUDIO_LIMIT = 10;
// a duo needs at least a couple of films together to count as a pattern
const MIN_DUO_FILMS = 2;
// money buckets: above this is a blockbuster, below is a micro budget indie
export const BLOCKBUSTER_BUDGET = 50_000_000;
export const INDIE_BUDGET = 5_000_000;
// a film that grossed under 1% of its budget almost certainly has unreported
// box office (streaming releases), not a real flop, so it stays off the chart
const MIN_REVENUE_RATIO = 0.01;

/**
 * Adds one appearance to a tally and folds in the rating when there is one.
 *
 * Every ranking in this hook counts appearances and averages the rated ones,
 * so this keeps the two lines from being retyped in each builder.
 *
 * Args:
 *   entry (Object): Tally with count, ratingSum and ratedCount.
 *   rating (number|null): Your rating for this appearance.
 *
 * Returns:
 *   void
 */
function bumpTally(entry, rating) {
  entry.count++;
  if (rating != null) {
    entry.ratingSum += rating;
    entry.ratedCount++;
  }
}

/**
 * Averages a tally's ratings, or null when nothing was rated.
 *
 * Args:
 *   entry (Object): Tally with ratingSum and ratedCount.
 *
 * Returns:
 *   number|null: Average rating or null.
 */
function tallyAverage(entry) {
  return entry.ratedCount ? entry.ratingSum / entry.ratedCount : null;
}

/**
 * Ranks the most watched cast members across the whole library.
 *
 * Counts every top billed appearance, then attaches the film list only to the
 * faces that make the cut, so we are not holding thousands of throwaway arrays
 * around. Gender rides along so the UI can call someone an actor or an actress.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched movies with a `cast` array.
 *
 * Returns:
 *   Array<Object>: Top faces with name, gender, profilePath, count, avgRating, films.
 */
function buildTopActors(rows) {
  const byActor = new Map();

  for (const movie of rows) {
    for (const person of movie.cast || []) {
      if (!person?.name) continue;
      let entry = byActor.get(person.name);
      if (!entry) {
        entry = {
          name: person.name,
          gender: person.gender ?? 0,
          profilePath: person.profilePath || null,
          count: 0,
          ratingSum: 0,
          ratedCount: 0,
        };
        byActor.set(person.name, entry);
      }
      // some rows come back without a headshot, so keep the first one we find
      if (!entry.profilePath && person.profilePath) entry.profilePath = person.profilePath;
      bumpTally(entry, movie.rating);
    }
  }

  const ranked = [...byActor.values()]
    .map((a) => ({ ...a, avgRating: tallyAverage(a) }))
    .sort((a, b) => b.count - a.count || (b.avgRating || 0) - (a.avgRating || 0) || a.name.localeCompare(b.name))
    .slice(0, TOP_ACTOR_LIMIT);

  const topNames = new Set(ranked.map((a) => a.name));
  const filmsByName = new Map();
  for (const movie of rows) {
    for (const person of movie.cast || []) {
      if (!person?.name || !topNames.has(person.name)) continue;
      const list = filmsByName.get(person.name) || [];
      list.push({
        name: movie.name,
        year: movie.year,
        rating: movie.rating ?? null,
        posterPath: movie.posterPath || null,
      });
      filmsByName.set(person.name, list);
    }
  }

  return ranked.map((a) => ({
    ...a,
    films: (filmsByName.get(a.name) || []).sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0)),
  }));
}

/**
 * Finds the director-actor pair that shows up together the most.
 *
 * Walks every director against every top billed face per film and counts the
 * reunions, Scorsese-De Niro style. Only pairs with a real repeat pattern
 * qualify, a one off cameo is not a duo.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched movies.
 *
 * Returns:
 *   Object|null: { director, actor, count, films } or null when nobody repeats.
 */
function buildDuo(rows) {
  const pairs = new Map();

  for (const movie of rows) {
    const directors = movie.directors || [];
    const cast = movie.cast || [];
    if (!directors.length || !cast.length) continue;

    for (const director of directors) {
      for (const person of cast) {
        if (!person?.name) continue;
        const key = `${director}||${person.name}`;
        let entry = pairs.get(key);
        if (!entry) {
          entry = {
            director: { name: director, profilePath: movie.directorProfiles?.[director] || null },
            actor: { name: person.name, gender: person.gender ?? 0, profilePath: person.profilePath || null },
            count: 0,
            ratingSum: 0,
            films: [],
          };
          pairs.set(key, entry);
        }
        if (!entry.director.profilePath && movie.directorProfiles?.[director]) {
          entry.director.profilePath = movie.directorProfiles[director];
        }
        entry.count++;
        if (movie.rating != null) entry.ratingSum += movie.rating;
        entry.films.push({
          name: movie.name,
          year: movie.year,
          rating: movie.rating ?? null,
          posterPath: movie.posterPath || null,
        });
      }
    }
  }

  const best = [...pairs.values()]
    .filter((p) => p.count >= MIN_DUO_FILMS)
    .sort((a, b) => b.count - a.count || (b.ratingSum - a.ratingSum))
    .slice(0, 1)[0];

  if (!best) return null;
  best.films.sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0));
  return best;
}

/**
 * Ranks production companies by how many of your films they are behind.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched movies with `productionCompanies`.
 *
 * Returns:
 *   Array<Object>: Top studios with name, count, avgRating.
 */
function buildStudios(rows) {
  const byStudio = new Map();

  for (const movie of rows) {
    for (const company of movie.productionCompanies || []) {
      if (!company?.name) continue;
      let entry = byStudio.get(company.name);
      if (!entry) {
        entry = { name: company.name, count: 0, ratingSum: 0, ratedCount: 0 };
        byStudio.set(company.name, entry);
      }
      bumpTally(entry, movie.rating);
    }
  }

  // a studio with nothing rated cannot show an average, so it does not chart
  return [...byStudio.values()]
    .filter((s) => s.ratedCount > 0)
    .map((s) => ({ ...s, avgRating: tallyAverage(s) }))
    .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating)
    .slice(0, TOP_STUDIO_LIMIT);
}

/**
 * Builds the budget vs box office scatter plus the blockbuster/indie split.
 *
 * Only films with a real budget count. Revenue needs its own positive value and
 * must clear MIN_REVENUE_RATIO, so streaming releases with a token box office
 * do not fake a flop. Correlation is Pearson r between log budget and your
 * rating, because budgets span several orders of magnitude.
 *
 * Args:
 *   rows (Array<Object>): Deduped enriched movies with budget, revenue, rating.
 *
 * Returns:
 *   Object: points, medianBudget, blockbuster/indie counts and averages, correlation, verdict.
 */
function buildBudget(rows) {
  const withBudget = rows.filter((m) => m.budget != null && m.budget > 0);

  const points = withBudget
    .filter((m) => m.revenue != null && m.revenue > 0 && m.revenue >= m.budget * MIN_REVENUE_RATIO)
    .map((m) => ({
      name: m.name,
      year: m.year,
      budget: m.budget,
      revenue: m.revenue,
      rating: m.rating ?? null,
      posterPath: m.posterPath || null,
    }));

  const rated = withBudget.filter((m) => m.rating != null);
  const blockbusters = rated.filter((m) => m.budget >= BLOCKBUSTER_BUDGET);
  const indies = rated.filter((m) => m.budget <= INDIE_BUDGET);

  const correlation = rated.length >= 5
    ? pearson(rated.map((m) => Math.log10(m.budget)), rated.map((m) => m.rating))
    : null;

  let verdict = null;
  if (correlation != null) {
    if (correlation >= 0.2) verdict = 'up';
    else if (correlation <= -0.2) verdict = 'down';
    else verdict = 'flat';
  }

  return {
    points,
    medianBudget: median(withBudget.map((m) => m.budget)),
    budgetCount: withBudget.length,
    ratedCount: rated.length,
    blockbusterCount: blockbusters.length,
    indieCount: indies.length,
    blockbusterAvg: blockbusters.length ? mean(blockbusters.map((m) => m.rating)) : null,
    indieAvg: indies.length ? mean(indies.map((m) => m.rating)) : null,
    correlation,
    verdict,
  };
}

const EMPTY_BUDGET = {
  points: [],
  medianBudget: null,
  budgetCount: 0,
  ratedCount: 0,
  blockbusterCount: 0,
  indieCount: 0,
  blockbusterAvg: null,
  indieAvg: null,
  correlation: null,
  verdict: null,
};

/**
 * Derives every stat for the Section 05 Cast & Money section.
 *
 * Pure and memoised on the enriched rows. Dedupes rewatches first so a film you
 * logged five times does not turn one actor into your all time favourite.
 *
 * Args:
 *   enrichedData (Array<Object>|null): Enriched rows from TMDB.
 *
 * Returns:
 *   Object: hasData, topActors, duo, studios, budget.
 */
export function useCastStats(enrichedData = null) {
  return useMemo(() => {
    const rows = dedupeFilms(enrichedData || []);

    if (rows.length === 0) {
      return {
        hasData: false,
        topActors: [],
        duo: null,
        studios: [],
        budget: { ...EMPTY_BUDGET },
      };
    }

    return {
      hasData: true,
      topActors: buildTopActors(rows),
      duo: buildDuo(rows),
      studios: buildStudios(rows),
      budget: buildBudget(rows),
    };
  }, [enrichedData]);
}
