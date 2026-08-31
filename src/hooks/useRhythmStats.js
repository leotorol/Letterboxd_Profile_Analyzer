import { useMemo } from 'react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DISPLAY_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// thumbnails in the heatmap tooltip: small enough to load fast, big enough to read
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';
// comfort movies are shown as big posters so we want a chunkier resolution
const POSTER_BASE_LARGE = 'https://image.tmdb.org/t/p/w500';

// the pace window used for the forward projection
const PACE_WINDOW_DAYS = 56;
const PACE_WINDOW_WEEKS = PACE_WINDOW_DAYS / 7;

/**
 * Parses a Letterboxd date string (YYYY-MM-DD) into a local Date object.
 *
 * Uses a manual split instead of `new Date(str)` so the day lands on the right
 * local midnight instead of drifting a day with the UTC shift.
 *
 * Args:
 *   value (string): Raw date value from watched/ratings CSV.
 *
 * Returns:
 *   Date|null: Local Date at midnight, or null when the value isn't a real date.
 */
function parseLbDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a Date into an ISO YYYY-MM-DD string using local time.
 *
 * Args:
 *   date (Date): Date to format.
 *
 * Returns:
 *   string: Zero-padded ISO date string.
 */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a new Date shifted by a number of days.
 *
 * Args:
 *   date (Date): Base date.
 *   days (number): Days to add (can be negative).
 *
 * Returns:
 *   Date: New shifted Date.
 */
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Rolls a Date back to the Sunday that starts its week (getDay 0 === Sunday).
 *
 * Args:
 *   date (Date): Date to align.
 *
 * Returns:
 *   Date: The Sunday on or before the given date.
 */
function startOfWeekSunday(date) {
  return addDays(date, -date.getDay());
}

/**
 * Whole-day difference between two dates.
 *
 * Uses Math.round so DST transitions don't leave a 23/25 hour remainder.
 *
 * Args:
 *   a (Date): Earlier date.
 *   b (Date): Later date.
 *
 * Returns:
 *   number: Days from a to b.
 */
function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Counts how many watches happened on each calendar day.
 *
 * Args:
 *   rows (Array<Object>): Watched rows with a `date` field.
 *
 * Returns:
 *   Map<string, number>: ISO date string -> watch count.
 */
function countByDate(rows) {
  const map = new Map();
  for (const row of rows) {
    const d = parseLbDate(row.date);
    if (!d) continue;
    const iso = toISO(d);
    map.set(iso, (map.get(iso) || 0) + 1);
  }
  return map;
}

/**
 * Finds the longest run of consecutive days present in a sorted date list.
 *
 * Args:
 *   days (Array<string>): Sorted ISO date strings that had at least one watch.
 *
 * Returns:
 *   Object: { length } of the longest run, plus the ISO dates that make it up
 *   so the UI can pull the posters watched during it.
 */
function findLongestStreak(days) {
  if (days.length === 0) return { length: 0, dates: [] };
  let bestLen = 1;
  let bestEnd = 0;
  let runLen = 1;
  let runEnd = 0;
  for (let i = 1; i < days.length; i++) {
    // parseLbDate keeps everything local so DST/UTC drift doesn't eat a day
    const gap = diffDays(parseLbDate(days[i - 1]), parseLbDate(days[i]));
    if (gap === 1) {
      runLen++;
      runEnd = i;
    } else {
      runLen = 1;
      runEnd = i;
    }
    if (runLen > bestLen) {
      bestLen = runLen;
      bestEnd = runEnd;
    }
  }
  const startIdx = bestEnd - bestLen + 1;
  return { length: bestLen, dates: days.slice(startIdx, bestEnd + 1) };
}

/**
 * Finds the longest stretch of empty days between two watches.
 *
 * Args:
 *   days (Array<string>): Sorted ISO date strings that had at least one watch.
 *
 * Returns:
 *   number: Longest number of consecutive days with no watch between active days.
 */
function longestGap(days) {
  if (days.length < 2) return 0;
  let best = 0;
  for (let i = 1; i < days.length; i++) {
    const gap = diffDays(parseLbDate(days[i - 1]), parseLbDate(days[i])) - 1;
    if (gap > best) best = gap;
  }
  return best;
}

/**
 * Counts consecutive active days ending at the most recent watched day.
 *
 * Args:
 *   days (Array<string>): Sorted ISO date strings that had at least one watch.
 *   watchedSet (Set<string>): Quick lookup of active days.
 *
 * Returns:
 *   number: Consecutive active days ending at the last watch.
 */
function currentStreak(days, watchedSet) {
  if (days.length === 0) return 0;
  // count the run that's still alive: start today, but let a not-watched-yet
  // today fall back to yesterday so the streak isn't killed before bedtime
  const today = new Date();
  let cursor = today;
  if (!watchedSet.has(toISO(cursor))) cursor = addDays(cursor, -1);
  if (!watchedSet.has(toISO(cursor))) return 0;

  let run = 0;
  while (watchedSet.has(toISO(cursor))) {
    run++;
    cursor = addDays(cursor, -1);
  }
  return run;
}

/**
 * Finds the longest run of consecutive weeks with at least one watch.
 *
 * A week is considered active if any day within it had a watch. Weeks start
 * on Sunday to match the heatmap grid.
 *
 * Args:
 *   days (Array<string>): Sorted ISO date strings that had at least one watch.
 *
 * Returns:
 *   Object: { length } of the longest week streak, plus the week start dates
 *   (Sundays) that make it up.
 */
function findLongestWeekStreak(days) {
  if (days.length === 0) return { length: 0, weekStarts: [] };
  
  const weekStarts = new Set();
  for (const day of days) {
    const d = parseLbDate(day);
    if (!d) continue;
    const weekStart = toISO(startOfWeekSunday(d));
    weekStarts.add(weekStart);
  }
  
  const sortedWeeks = [...weekStarts].sort();
  if (sortedWeeks.length === 0) return { length: 0, weekStarts: [] };
  
  let bestLen = 1;
  let bestEnd = 0;
  let runLen = 1;
  let runEnd = 0;
  
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = parseLbDate(sortedWeeks[i - 1]);
    const curr = parseLbDate(sortedWeeks[i]);
    const gap = diffDays(prev, curr);
    
    if (gap === 7) {
      runLen++;
      runEnd = i;
    } else {
      runLen = 1;
      runEnd = i;
    }
    
    if (runLen > bestLen) {
      bestLen = runLen;
      bestEnd = runEnd;
    }
  }
  
  const startIdx = bestEnd - bestLen + 1;
  return { length: bestLen, weekStarts: sortedWeeks.slice(startIdx, bestEnd + 1) };
}

/**
 * Counts consecutive active weeks ending at the most recent watched week.
 *
 * Args:
 *   days (Array<string>): Sorted ISO date strings that had at least one watch.
 *
 * Returns:
 *   number: Consecutive active weeks ending at the last watch.
 */
function currentWeekStreak(days) {
  if (days.length === 0) return 0;
  
  const weekStarts = new Set();
  for (const day of days) {
    const d = parseLbDate(day);
    if (!d) continue;
    const weekStart = toISO(startOfWeekSunday(d));
    weekStarts.add(weekStart);
  }
  
  const sortedWeeks = [...weekStarts].sort();
  if (sortedWeeks.length === 0) return 0;
  
  const today = new Date();
  let cursor = startOfWeekSunday(today);
  let cursorISO = toISO(cursor);
  
  if (!weekStarts.has(cursorISO)) {
    cursor = addDays(cursor, -7);
    cursorISO = toISO(cursor);
  }
  
  if (!weekStarts.has(cursorISO)) return 0;
  
  let run = 0;
  while (weekStarts.has(cursorISO)) {
    run++;
    cursor = addDays(cursor, -7);
    cursorISO = toISO(cursor);
  }
  
  return run;
}

/**
 * Scales a daily count into a discrete 0-4 intensity bucket.
 *
 * Buckets are relative to the max day so both a casual and a marathoning user
 * get a readable ramp instead of one flooded with the top color.
 *
 * Args:
 *   count (number): Watches on a given day.
 *   max (number): Max watches seen on any day in the window.
 *
 * Returns:
 *   number: Bucket from 0 (no activity) to 4 (most active).
 */
function intensity(count, max) {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.round((count / max) * 4)));
}

/**
 * Builds a GitHub-style heat grid for a single calendar year.
 *
 * the grid layout math here is a fucking headache. it lays out days in
 * week columns (Sun-Sat) starting from the Sunday on or before Jan 1 and ending
 * on the Saturday on or after Dec 31. days outside the target year and days
 * after today are rendered as blank cells so the current year reads as "so far".
 * a month label is placed on the column that holds the first of that month.
 * the intensity buckets are relative to the max day so both a casual and a
 * marathoning user get a readable ramp.
 *
 * Args:
 *   byDate (Map<string, number>): ISO date -> watch count.
 *   year (number): Calendar year to render.
 *   today (Date, optional): Reference "now" for future-day blanking.
 *
 * Returns:
 *   Object: Heatmap cells, weekCount and monthLabels.
 */
export function buildYearGrid(byDate, year, today = new Date()) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const gridStart = startOfWeekSunday(jan1);
  const gridEnd = addDays(startOfWeekSunday(dec31), 6);

  let max = 0;
  for (const [iso, count] of byDate) {
    if (iso.startsWith(`${year}-`) && count > max) max = count;
  }

  const cells = [];
  let cursor = gridStart;
  let week = 0;
  while (cursor <= gridEnd) {
    const inYear = cursor.getFullYear() === year;
    const iso = toISO(cursor);
    const count = inYear ? byDate.get(iso) || 0 : 0;
    const blank = !inYear || cursor > today;
    cells.push({
      iso,
      date: cursor,
      dayOfWeek: cursor.getDay(),
      week,
      count,
      level: blank ? 0 : intensity(count, max),
      blank,
    });
    if (cursor.getDay() === 6) week++;
    cursor = addDays(cursor, 1);
  }

  const weekCount = week;
  const monthLabels = [];
  for (let m = 0; m < 12; m++) {
    const col = Math.floor(diffDays(gridStart, new Date(year, m, 1)) / 7);
    if (col >= 0 && col < weekCount) {
      monthLabels.push({ week: col, label: MONTH_LABELS[m] });
    }
  }

  return { cells, weekCount, monthLabels };
}

/**
 * Tallies watches per weekday and per calendar month (each watch counts).
 *
 * Args:
 *   rows (Array<Object>): Watched rows with a `date` field.
 *
 * Returns:
 *   Object: weekday counts in display order (Mon..Sun), month counts, and
 *   the favourite weekday/month names.
 */
function buildRhythmPatterns(rows) {
  const byDow = Array(7).fill(0);
  const monthCounts = Array(12).fill(0);
  for (const row of rows) {
    const d = parseLbDate(row.date);
    if (!d) continue;
    byDow[d.getDay()]++;
    monthCounts[d.getMonth()]++;
  }

  // getDay() returns 0 = Sunday, but the UI shows the week Mon-first
  const DOW_BY_LABEL = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const weekdayRank = DISPLAY_WEEKDAYS.map((label) => ({ label, count: byDow[DOW_BY_LABEL[label]] }));
  const favoriteDay = weekdayRank.reduce((a, b) => (b.count > a.count ? b : a), weekdayRank[0]);

  const monthRank = MONTH_LABELS.map((label, i) => ({ label, count: monthCounts[i] }));
  const favoriteMonth = monthRank.reduce((a, b) => (b.count > a.count ? b : a), monthRank[0]);

  return { weekdayRank, monthRank, favoriteDay, favoriteMonth };
}

/**
 * Builds a contiguous month-by-month series from first to last watch.
 *
 * Args:
 *   rows (Array<Object>): Watched rows with a `date` field.
 *
 * Returns:
 *   Array<Object>: Chronological { year, month, label, count } points including
 *   zero-count months in between watches.
 */
function buildEvolution(rows) {
  const monthIndex = new Map();
  let minIndex = null;
  let maxIndex = null;
  for (const row of rows) {
    const d = parseLbDate(row.date);
    if (!d) continue;
    const index = d.getFullYear() * 12 + d.getMonth();
    monthIndex.set(index, (monthIndex.get(index) || 0) + 1);
    if (minIndex === null || index < minIndex) minIndex = index;
    if (maxIndex === null || index > maxIndex) maxIndex = index;
  }
  if (minIndex === null) return [];

  const series = [];
  for (let i = minIndex; i <= maxIndex; i++) {
    const year = Math.floor(i / 12);
    const month = i % 12;
    series.push({
      year,
      month,
      label: MONTH_LABELS[month],
      count: monthIndex.get(i) || 0,
    });
  }
  return series;
}

/**
 * Projects the current pace into the rest of the year and the watchlist.
 *
 * Args:
 *   rows (Array<Object>): Watched rows with a `date` field.
 *   watchlistCount (number): Films currently in the watchlist.
 *
 * Returns:
 *   Object: Average pace (films/week), projected films by year end, and the
 *   watchlist clearing time in weeks (or null when pace is zero).
 */
function buildProjection(rows, watchlistCount) {
  const today = new Date();
  const paceStart = toISO(addDays(today, -PACE_WINDOW_DAYS));
  let paceCount = 0;
  for (const row of rows) {
    const d = parseLbDate(row.date);
    if (!d) continue;
    if (toISO(d) >= paceStart) paceCount++;
  }
  const avgPerWeek = Math.round((paceCount / PACE_WINDOW_WEEKS) * 10) / 10;

  const weeksRemaining = diffDays(today, new Date(today.getFullYear(), 11, 31)) / 7;
  const filmsByYearEnd = Math.round(avgPerWeek * weeksRemaining);

  const watchlistWeeks = avgPerWeek > 0 ? watchlistCount / avgPerWeek : null;

  return { avgPerWeek, filmsByYearEnd, watchlistWeeks };
}

/**
 * Builds a date -> films map with TMDB poster paths for the heatmap tooltip.
 *
 * Walks the enriched rows in lockstep with the raw watched rows (they're the
 * same array, just enriched in place) so each film can carry its poster. Films
 * that failed TMDB matching simply end up with a null poster.
 *
 * Args:
 *   rows (Array<Object>): Watched rows with date, name, year, uri, rating.
 *   enriched (Array<Object>|null): Enriched rows in the same order as rows.
 *
 * Returns:
 *   Map<string, Array<Object>>: ISO date -> fully-formed film entries.
 */
function buildByDateMovies(rows, enriched) {
  const map = new Map();
  rows.forEach((row, i) => {
    const d = parseLbDate(row.date);
    if (!d) return;
    const iso = toISO(d);

    let posterPath = null;
    if (enriched?.[i]) {
      posterPath = enriched[i].posterPath ? POSTER_BASE + enriched[i].posterPath : null;
    }

    let list = map.get(iso);
    if (!list) {
      list = [];
      map.set(iso, list);
    }
    list.push({
      name: row.name,
      year: row.year,
      rating: row.rating,
      posterPath,
    });
  });
  return map;
}

/**
 * Groups rewatches and ranks the most-repeated titles ("comfort movies").
 *
 * letterboxd splits the data in two files: watched.csv has one row per distinct film (deduped), while
 * diary.csv has one row per watch event (rewatches are separate entries). we
 * need both to get honest rewatch numbers. we group by name+year, never by uri,
 * because a diary uri points at the specific viewing page and changes on every
 * rewatch. the poster mapping is a bitch because we have to align the enriched
 * array (which matches watched.csv order) with the diary keys.
 *
 * Args:
 *   watchedRows (Array<Object>): Watched rows (one per film) with name/year/date.
 *   diaryRows (Array<Object>): Diary rows (one per watch) with name/year/date.
 *   enriched (Array<Object>|null): Enriched rows in the same order as watchedRows,
 *     used to attach a large poster to each comfort movie.
 *
 * Returns:
 *   Object: ranked comfort movies, total watch events, unique titles, and the
 *   rewatch count (extra watches beyond the first per title).
 */
function buildRewatches(watchedRows, diaryRows = [], enriched = null) {
  // name::year -> big poster URL, pulled from the enriched row that sits at the
  // same index as the deduped watched row. Shit, the diary uri changes on every
  // rewatch so that's the only stable way to map a title to its poster.
  const posterByKey = new Map();
  watchedRows.forEach((row, i) => {
    const key = `${row.name}::${row.year}`;
    if (enriched?.[i]?.posterPath && !posterByKey.has(key)) {
      posterByKey.set(key, POSTER_BASE_LARGE + enriched[i].posterPath);
    }
  });

  // baseline: one watch per distinct title from watched.csv
  const films = new Map();
  for (const row of watchedRows) {
    const key = `${row.name}::${row.year}`;
    const iso = parseLbDate(row.date);
    const last = iso ? toISO(iso) : null;
    const entry = films.get(key);
    if (!entry) {
      films.set(key, {
        key,
        name: row.name,
        year: row.year,
        count: 1,
        lastWatch: last,
        posterPath: posterByKey.get(key) || null,
      });
    } else if (last && (!entry.lastWatch || last > entry.lastWatch)) {
      entry.lastWatch = last;
    }
  }

  // diary adds the extra watch events on top of that baseline
  const diaryCount = new Map();
  const diaryLast = new Map();
  for (const row of diaryRows) {
    const key = `${row.name}::${row.year}`;
    const iso = parseLbDate(row.date);
    const last = iso ? toISO(iso) : null;
    diaryCount.set(key, (diaryCount.get(key) || 0) + 1);
    if (last && (diaryLast.get(key) == null || last > diaryLast.get(key))) {
      diaryLast.set(key, last);
    }
  }

  let rewatchCount = 0;
  const comfortMovies = [];
  for (const [key, entry] of films) {
    const count = diaryCount.get(key) || 0;
    if (count >= 2) {
      entry.count = count;
      rewatchCount += count - 1;
      const dlast = diaryLast.get(key);
      if (dlast && (!entry.lastWatch || dlast > entry.lastWatch)) entry.lastWatch = dlast;
      comfortMovies.push(entry);
    }
  }
  comfortMovies.sort((a, b) => b.count - a.count || (a.lastWatch || '').localeCompare(b.lastWatch || ''));

  const uniqueFilms = films.size;
  return {
    comfortMovies,
    totalWatches: uniqueFilms + rewatchCount,
    uniqueFilms,
    rewatchCount,
  };
}

/**
 * Custom hook that derives every temporal stat for the Rhythm section.
 *
 * Pure and memoised on the raw watched rows; returns a ready-to-render shape
 * plus a flag the component can branch on for the empty state.
 *
 * Args:
 *   rawData (Object|null): The parsed Letterboxd rawData from context.
 *   enrichedData (Array<Object>|null): Enriched rows matching rawData.watched order.
 *
 * Returns:
 *   Object: Rhythm stats bundle.
 */
export function useRhythmStats(rawData, enrichedData = null) {
  return useMemo(() => {
    const rows = rawData?.watched || [];
    const byDate = countByDate(rows);
    const byDateMovies = buildByDateMovies(rows, enrichedData);
    const activeDays = [...byDate.keys()].sort();
    const watchedSet = new Set(activeDays);

    const empty = activeDays.length === 0;

    const yearSet = new Set();
    for (const iso of byDate.keys()) {
      yearSet.add(Number(iso.slice(0, 4)));
    }
    const years = [...yearSet].sort((a, b) => a - b);

    const patterns = empty
      ? null
      : buildRhythmPatterns(rows);
    const evolution = empty ? [] : buildEvolution(rows);
    const projection = empty
      ? { avgPerWeek: 0, filmsByYearEnd: 0, watchlistWeeks: null }
      : buildProjection(rows, rawData?.watchlist?.length || 0);
    // watched.csv gives every distinct title ever watched, diary.csv gives the
    // rewatch events. both together make the comfort-movie numbers honest.
    const rewatch = buildRewatches(rows, rawData?.diary || [], enrichedData);

    // longest active streak plus the films watched during it, flattened in
    // chronological order, so the Streaks card can show a poster strip.
    const longest = findLongestStreak(activeDays);
    const streakFilms = [];
    for (const iso of longest.dates) {
      const films = byDateMovies.get(iso) || [];
      streakFilms.push(...films.map(f => ({ ...f, iso })));
    }

    const longestWeek = findLongestWeekStreak(activeDays);

    return {
      empty,
      byDate,
      byDateMovies,
      years,
      streaks: {
        longestActive: empty ? 0 : longest.length,
        longestGap: empty ? 0 : longestGap(activeDays),
        current: empty ? 0 : currentStreak(activeDays, watchedSet),
        activeDays: activeDays.length,
        longestWeek: empty ? 0 : longestWeek.length,
        currentWeek: empty ? 0 : currentWeekStreak(activeDays),
      },
      streakFilms,
      patterns,
      evolution,
      projection,
      rewatch,
    };
  }, [rawData, enrichedData]);
}
