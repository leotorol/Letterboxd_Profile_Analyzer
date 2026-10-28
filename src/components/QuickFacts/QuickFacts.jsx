import { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useCountUp } from '../../hooks/useCountUp';
import { ClockIcon } from '../icons/Icons';
import ChapterHeading from '../shared/ChapterHeading';
import PanelHead from '../shared/PanelHead';
import './QuickFacts.css';

/* Vector SVG Icons */
const FilmIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
 * QuickFacts section: the compact opening spread.
 *
 * Five numbers, one screen. The chapter heading carries a direct jump to Rhythm
 * so the hook never traps the reader in a wall of cards.
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

  const ratedShare = stats.totalWatched > 0 ? (stats.ratedCount / stats.totalWatched) * 100 : 0;

  return (
    <div
      className="lb-chapter qf-section"
      id="section-01"
      data-section
      style={{ '--chapter-ambient': '0, 232, 122' }}
    >
      <ChapterHeading
        number="01"
        name="Quick Facts"
        variant="masthead"
        title={username ? (
          <>Here's your film life, <span className="qf-username">@{username}</span>.</>
        ) : (
          'Here is your film life in numbers.'
        )}
        subtitle="The numbers to set the scene. Everything after this is the story behind them."
      />

      {enrichmentReport && enrichmentReport.failed.length > 0 && (
        <div className="qf-enrichment">
          {enrichmentReport.failed.length} {enrichmentReport.failed.length === 1 ? 'title' : 'titles'} could not be matched with TMDB data, so they stay out of the report.
        </div>
      )}

      <div className="lb-grid qf-grid">
        <div className="lb-panel qf-card lb-col-5">
          <PanelHead
            icon={<FilmIcon />}
            accent="var(--color-accent)"
            label="Movies Watched"
          />
          <div>
            <div className="qf-number tabular-nums">{animWatched.toLocaleString()}</div>
            <div className="qf-sub">
              {stats.totalWatched < 150
                ? 'Still building your collection. Keep watching.'
                : 'Total films logged in your history.'}
            </div>
          </div>

          {stats.ratedCount > 0 && stats.unratedCount > 0 && (
            <div className="qf-meter">
              <div className="qf-meter-bar">
                <div className="qf-meter-fill" style={{ width: `${ratedShare}%` }} />
              </div>
              <div className="qf-meter-labels tabular-nums">
                <span>{stats.ratedCount} rated</span>
                <span>{stats.unratedCount} unrated</span>
              </div>
            </div>
          )}
          {stats.ratedCount > 0 && stats.unratedCount === 0 && (
            <div className="qf-meter-labels tabular-nums">
              <span>{stats.ratedCount} rated</span>
              <span>0 unrated</span>
            </div>
          )}
        </div>

        <div className="lb-panel qf-card lb-col-4">
          <PanelHead
            icon={<ClockIcon />}
            accent="var(--color-accent-2)"
            label="Total Watch Time"
          />
          <div>
            <div className="qf-number tabular-nums">
              {animHours.toLocaleString()}h
              <span className="qf-number-sub tabular-nums">{watchedTime.mins}m</span>
            </div>
            <div className="qf-sub">
              {stats.totalMinutes > 0
                ? (buildWatchTimeNote(stats.totalMinutes) ?? `${watchedTime.days} full days in the dark.`)
                : 'Configure VITE_TMDB_API_KEY in .env to calculate exact runtimes.'}
            </div>
          </div>
        </div>

        <div className="lb-panel qf-card lb-col-3">
          <PanelHead
            icon={<StarIcon />}
            accent="var(--color-accent-3)"
            label="Average Rating"
          />
          <div>
            <div className="qf-number tabular-nums">
              {animRating}<span className="qf-number-unit">/5.0</span>
            </div>
            <div className="qf-stars" title={`${stats.avgRating.toFixed(2)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const fillAmount = Math.max(0, Math.min(1, stats.avgRating - (starIndex - 1)));
                return (
                  <div key={starIndex} className="qf-star">
                    <div className="qf-star-fill" style={{ width: `${fillAmount * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="qf-sub">Across {stats.ratedCount} rated titles.</div>
          </div>
        </div>

        <div className="lb-panel qf-card lb-col-4">
          <PanelHead
            icon={<CameraIcon />}
            label="Directors"
          />
          <div>
            <div className="qf-number tabular-nums">{animDirectors.toLocaleString()}</div>
            <div className="qf-sub">
              {stats.uniqueDirectors > 0
                ? `${(stats.totalWatched / Math.max(stats.uniqueDirectors, 1)).toFixed(1)} films per director on average.`
                : 'Unique filmmakers discovered.'}
            </div>
          </div>
        </div>

        <div className="lb-panel qf-card lb-col-8">
          <PanelHead
            icon={<ListIcon />}
            label="Watchlist Queue"
          />
          <div className="qf-watchlist">
            <div className="qf-watchlist-box">
              <div className="qf-number tabular-nums">{animWatchlist.toLocaleString()}</div>
              <div className="qf-sub">Films waiting for you on Letterboxd.</div>
            </div>
            <div className="qf-watchlist-box">
              <div className="qf-number tabular-nums">
                {animWatchlistHours.toLocaleString()}<span className="qf-number-unit">hours</span>
              </div>
              <div className="qf-sub">
                {calcSleeplessNights(stats.watchlistEstimatedMinutes)} sleepless nights to clear the pile.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
