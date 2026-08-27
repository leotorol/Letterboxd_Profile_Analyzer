import { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useCountUp } from '../../hooks/useCountUp';
import './QuickFacts.css';

/* Vector SVG Icons */
const FilmIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const ListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * Converts total minutes into formatted hours, minutes, and days breakdown.
 *
 * Args:
 *   totalMinutes (number): Total duration in minutes.
 *
 * Returns:
 *   Object: Formatted hours string, minutes integer, and days string.
 */
function formatTime(totalMinutes) {
  if (!totalMinutes) return { hours: '0', mins: 0, days: '0.0' };
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const days = (totalMinutes / (60 * 24)).toFixed(1);
  return { hours: hours.toLocaleString(), mins, days };
}

/**
 * Builds the playful "watch time" anecdote for the total minutes.
 *
 * - 21000+ minutes: full-time job roast.
 * - Between 45h (2700 min) and 21000: Europe road trip equivalence.
 * - Under 45h: no anecdote (return null so nothing renders).
 *
 * Args:
 *   totalMinutes (number): Total watched minutes.
 *
 * Returns:
 *   string|null: Impactful anecdote or null if nothing applies.
 */
function buildWatchTimeNote(totalMinutes) {
  if (totalMinutes >= 21000) {
    const totalHours = totalMinutes / 60;
    const months = totalHours / (40 * 4.5);
    const monthsStr = months >= 10 ? Math.round(months).toLocaleString() : months.toFixed(1);
    return `That's literally ${monthsStr} months of a full-time job. Did you get paid?`;
  }

  const EUROPE_TRIP_MINUTES = 45 * 60;
  if (totalMinutes >= EUROPE_TRIP_MINUTES) {
    const trips = (totalMinutes / EUROPE_TRIP_MINUTES).toFixed(1);
    return `Gotta pump up those numbers. You could have driven across Europe ${trips} times.`;
  }

  return null;
}

/**
 * Calculates how many sleepless nights it takes to watch the given minutes.
 * Assumes one night = 8 hours = 480 minutes.
 *
 * Args:
 *   totalMinutes (number): Total minutes to convert.
 *
 * Returns:
 *   string: Formatted number of nights.
 */
function calcSleeplessNights(totalMinutes) {
  const NIGHT_MINUTES = 8 * 60;
  return Math.ceil(totalMinutes / NIGHT_MINUTES).toLocaleString();
}

/**
 * Computes summary statistics from enriched movie data and raw ZIP exports.
 *
 * Args:
 *   enriched (Array<Object>): Enriched watched movies array.
 *   rawData (Object): Parsed raw CSV data object.
 *
 * Returns:
 *   Object: Calculated metrics.
 */
function calcStats(enriched, rawData) {
  // los muertos suyos que facil es calcular las stats cuando el data esta limpio
  const totalWatched = enriched.length;
  const totalMinutes = enriched.reduce((sum, m) => sum + (m.runtime || 0), 0);

  const directorSet = new Set();
  enriched.forEach(m => (m.directors || []).forEach(d => directorSet.add(d)));
  const uniqueDirectors = directorSet.size;

  const rated = enriched.filter(m => m.rating != null);
  const avgRating = rated.length
    ? (rated.reduce((s, m) => s + m.rating, 0) / rated.length)
    : 0;

  const watchlistCount = rawData?.watchlist?.length || 0;
  const watchlistEstimatedMinutes = watchlistCount * 110;

  return {
    totalWatched,
    totalMinutes,
    uniqueDirectors,
    avgRating,
    watchlistCount,
    watchlistEstimatedMinutes,
    ratedCount: rated.length,
    unratedCount: Math.max(0, totalWatched - rated.length),
  };
}

/**
 * QuickFacts section component rendering Spotify Wrapped style informal stats in Bento Grid.
 *
 * Returns:
 *   JSX.Element: QuickFacts section dashboard.
 */
export default function QuickFacts() {
  const { enrichedData, rawData, enrichmentReport } = useData();

  const stats = useMemo(() => calcStats(enrichedData || [], rawData), [enrichedData, rawData]);

  const watchedTime = formatTime(stats.totalMinutes);
  const watchlistTime = formatTime(stats.watchlistEstimatedMinutes);
  const username = rawData?.profile?.username;

  // trigger count-up animations for the numbers
  const animWatched = useCountUp(stats.totalWatched, 1600);
  const animHours = useCountUp(parseInt(watchedTime.hours.replace(/,/g, '')), 1600);
  const animDirectors = useCountUp(stats.uniqueDirectors, 1600);
  const animWatchlist = useCountUp(stats.watchlistCount, 1600);
  const animWatchlistHours = useCountUp(parseInt(watchlistTime.hours.replace(/,/g, '')), 1600);
  const animRatingRaw = useCountUp(Math.round(stats.avgRating * 10), 1600);
  const animRating = (animRatingRaw / 10).toFixed(1);

  return (
    <div className="qf-section">
      {/* Header */}
      <header className="qf-header">
        <div className="qf-category-tag">
          Section 01 / Quick Facts
        </div>
        <h2 className="qf-title">
          {username ? (
            <>
              Here's your film life, <span className="qf-username">@{username}</span>.
            </>
          ) : (
            'Here is your film life in numbers.'
          )}
        </h2>
        <p className="qf-subtitle">
          You've been spending some quality time in front of the screen. Let's look at what you logged.
        </p>
      </header>

      {/* Enrichment Report Banner */}
      {enrichmentReport && enrichmentReport.failed.length > 0 && (
        <div className="qf-enrichment-banner">
          <span>
            {enrichmentReport.failed.length} {enrichmentReport.failed.length === 1 ? 'title' : 'titles'} couldn't be matched with TMDB data. They won't appear on the report. Sorry :(
          </span>
        </div>
      )}

      {/* Asymmetrical Bento Grid */}
      <div className="qf-bento-grid">

        {/* Bento 1: Movies Watched Hero */}
        <div className="bento-card bento-span-2">
          <div>
            <div className="bento-header">
              <div className="bento-title-group">
                <div className="bento-icon" style={{ color: 'var(--color-accent)' }}>
                  <FilmIcon />
                </div>
                <div className="bento-label">Movies Watched</div>
              </div>
            </div>
            <div className="bento-number tabular-nums">
              {animWatched.toLocaleString()}
            </div>
            <div className="bento-subtext">
              {stats.totalWatched < 150
                ? "Still building your collection. Keep watching!"
                : "That's a lot of popcorn. Total films logged in your history."}
            </div>
          </div>

          {/* Meter Bar */}
          <div className="bento-meter-wrap">
            <div className="bento-meter-bar">
              <div
                className="bento-meter-fill"
                style={{ width: `${stats.totalWatched > 0 ? (stats.ratedCount / stats.totalWatched) * 100 : 0}%` }}
              />
            </div>
            <div className="bento-meter-labels tabular-nums">
              <span>{stats.ratedCount} rated films</span>
              <span>{stats.unratedCount} unrated</span>
            </div>
          </div>
        </div>

        {/* Bento 2: Average Rating */}
        <div className="bento-card">
          <div className="bento-header">
            <div className="bento-title-group">
              <div className="bento-icon" style={{ color: 'var(--color-accent-3)' }}>
                <StarIcon />
              </div>
              <div className="bento-label">Average Rating</div>
            </div>
          </div>
          <div>
            <div className="bento-number tabular-nums">
              {animRating}
              <span className="bento-number-unit">/ 5.0</span>
            </div>
            {/* 5-Star visual gauge */}
            <div className="rating-stars-gauge" title={`${stats.avgRating.toFixed(2)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const fillAmount = Math.max(0, Math.min(1, stats.avgRating - (starIndex - 1)));
                return (
                  <div key={starIndex} className="star-box">
                    <div className="star-box-fill" style={{ width: `${fillAmount * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="bento-subtext">
              Across {stats.ratedCount} rated titles. {stats.avgRating < 3 ? "You're kind of a critic, huh?" : 'You know what you like.'}
            </div>
          </div>
        </div>

        {/* Bento 3: Watch Time Breakdown */}
        <div className="bento-card bento-span-2">
          <div>
            <div className="bento-header">
              <div className="bento-title-group">
                <div className="bento-icon" style={{ color: 'var(--color-accent-2)' }}>
                  <ClockIcon />
                </div>
                <div className="bento-label">Total Watch Time</div>
              </div>
            </div>
            <div className="bento-number tabular-nums">
              {animHours.toLocaleString()} {"h"}
              <span className="bento-number-sub-minutes tabular-nums">
                {watchedTime.mins}m
              </span>
            </div>
            <div className="bento-subtext">
              {stats.totalMinutes > 0
                ? (buildWatchTimeNote(stats.totalMinutes) ?? '')
                : 'Configure VITE_TMDB_API_KEY in .env to calculate exact runtimes.'}
            </div>
          </div>
        </div>

        {/* Bento 4: Unique Directors */}
        <div className="bento-card">
          <div className="bento-header">
            <div className="bento-title-group">
              <div className="bento-icon">
                <CameraIcon />
              </div>
              <div className="bento-label">Directors</div>
            </div>
          </div>
          <div>
            <div className="bento-number tabular-nums">
              {animDirectors.toLocaleString()}
            </div>
            <div className="bento-subtext">
              {stats.uniqueDirectors > 0
                ? `Filmmakers explored. Average ${(stats.totalWatched / Math.max(stats.uniqueDirectors, 1)).toFixed(1)} films per director.`
                : 'Unique filmmakers discovered.'}
            </div>
          </div>
        </div>

        {/* Bento 5: Watchlist Dual Split Card */}
        <div className="bento-card bento-span-3">
          <div className="bento-header">
            <div className="bento-title-group">
              <div className="bento-icon">
                <ListIcon />
              </div>
              <div className="bento-label">Watchlist Queue</div>
            </div>
          </div>

          <div className="watchlist-split">
            <div className="watchlist-stat-box">
              <div className="bento-number tabular-nums">
                {animWatchlist.toLocaleString()}
              </div>
              <div className="bento-subtext">
                Movies waiting for you on your Letterboxd watchlist.
              </div>
            </div>

            <div className="watchlist-stat-box">
              <div className="bento-number tabular-nums">
                {animWatchlistHours.toLocaleString()}
                <span className="bento-number-unit">hours</span>
              </div>
              <div className="bento-subtext">
                That's {calcSleeplessNights(stats.watchlistEstimatedMinutes)} sleepless nights to clear it all. Worth it?
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
