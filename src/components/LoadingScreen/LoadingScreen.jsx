import { useData } from '../../context/DataContext';
import { hasTmdbKey } from '../../services/tmdbApi';
import './LoadingScreen.css';

/**
 * LoadingScreen component displaying TMDB enrichment progress bar and an
 * animated film strip that fills up with the movie titles as they're found.
 *
 * Returns:
 *   JSX.Element: Animated loading progress screen.
 */
export default function LoadingScreen() {
  const { progress, rawData, tmdbReady } = useData();
  const { processed, total, currentMovies, queue } = progress;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const HAS_API_KEY = tmdbReady ?? hasTmdbKey();
  const inQueue = Boolean(queue?.enabled && !queue?.admitted);
  const ahead = Number(queue?.position) || 0;
  const waiting = Number(queue?.waiting) || 0;
  const maxActive = Number(queue?.maxActive) || 0;

  const username = rawData?.profile?.username || 'your collection';
  const foundMovies = Array.isArray(currentMovies) ? currentMovies : [];

  return (
    <div className="loading-wrapper">
      {/* Film strip decoration - fetches and shows posters as they're found */}
      <div className="loading-filmstrip" aria-label="Recently found movies">
        {Array.from({ length: 7 }).map((_, i) => {
          const movie = foundMovies[i];
          return (
            <div
              key={i}
              className={`loading-film-frame${movie ? ' active' : ''}`}
              title={movie ? `${movie.name}${movie.year ? ` (${movie.year})` : ''}` : ''}
            >
              {movie?.poster
                ? <img className="loading-film-poster" src={movie.poster} alt="" loading="eager" decoding="async" />
                : movie && <div className="loading-film-title">{movie.name}</div>}
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="loading-content">
        <h1 className="loading-title">Analysing {username}…</h1>
        <p className="loading-subtitle">
          {inQueue
            ? 'Waiting for a free spot in the shared TMDB queue'
            : HAS_API_KEY
              ? 'Enriching your movies with TMDB data'
              : 'Crunching your CSV data'}
        </p>

        {inQueue ? (
          <div className="loading-queue" role="status" aria-live="polite">
            <span className="loading-queue-kicker">Shared TMDB queue</span>
            <p className="loading-queue-count">
              {ahead > 0
                ? `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`
                : 'You are next'}
            </p>
            <div className="loading-queue-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="loading-queue-note">
              We let {maxActive} {maxActive === 1 ? 'person' : 'people'} enrich at a time so the
              free API key does not get rate limited.
              {waiting > 0
                ? ` ${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting with you.`
                : ''}
              {' '}Keep this tab open.
            </p>
          </div>
        ) : (
          <div className="loading-progress-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="loading-progress-bar-bg">
              <div
                className="loading-progress-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="loading-progress-label">
              <span>
                {HAS_API_KEY
                  ? `${processed} of ${total} movies enriched`
                  : 'Processing…'}
              </span>
              <span className="loading-progress-count">{pct}%</span>
            </div>
          </div>
        )}

        {/* No API key notice */}
        {!HAS_API_KEY && !inQueue && (
          <div className="loading-nokey">
            Metadata enrichment is unavailable right now, so runtime, director
            and poster data may be missing. The rest of your stats still work.
          </div>
        )}

        <p className="loading-note">
          Enrichment can take a few minutes for large libraries. Keep this tab
          open while it finishes.
        </p>
      </div>
    </div>
  );
}
