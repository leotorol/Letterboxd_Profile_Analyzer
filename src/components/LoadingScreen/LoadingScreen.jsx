import { useData } from '../../context/DataContext';
import './LoadingScreen.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const HAS_API_KEY = TMDB_API_KEY && TMDB_API_KEY !== 'your_tmdb_api_key_here';

/**
 * LoadingScreen component displaying TMDB enrichment progress bar and an
 * animated film strip that fills up with the movie titles as they're found.
 *
 * Returns:
 *   JSX.Element: Animated loading progress screen.
 */
export default function LoadingScreen() {
  const { progress, rawData } = useData();
  const { processed, total, currentMovies } = progress;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

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
          {HAS_API_KEY
            ? 'Enriching your movies with TMDB data'
            : 'Crunching your CSV data'}
        </p>

        {/* Progress bar */}
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

        {/* No API key notice */}
        {!HAS_API_KEY && (
          <div className="loading-nokey">
            No TMDB API key detected — runtime & director data will be unavailable.
            Add <code>VITE_TMDB_API_KEY</code> to your <code>.env</code> file.
          </div>
        )}

        {/* Friendly wait message */}
        <p className="loading-note">
          This may take a while after you upload, remember it's a free project
          running on your own machine :):):)
        </p>
      </div>
    </div>
  );
}
