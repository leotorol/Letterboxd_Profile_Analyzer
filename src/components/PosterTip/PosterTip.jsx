import { TMDB_POSTER_SMALL } from '../../utils/tmdbImages';
import './PosterTip.css';

/**
 * Floating dark tooltip with a film poster, title, meta line and rating.
 *
 * Shared by every chart that pops film details on hover, tap or keyboard
 * focus, so the whole page speaks one tooltip instead of three lookalikes.
 *
 * Args:
 *   film (Object): Normalised film with name, year, rating and posterPath.
 *   sub (string, optional): Middle meta line rendered under the title.
 *   stackCount (number, optional): How many films share this chart point.
 *   style (Object, optional): Absolute positioning CSS.
 *
 * Returns:
 *   JSX.Element: The poster tooltip.
 */
export default function PosterTip({ film, sub, stackCount = 0, style }) {
  return (
    <div className="poster-tip" style={style}>
      <div className="poster-tip-card">
        {film.posterPath && (
          <img src={TMDB_POSTER_SMALL + film.posterPath} alt="" className="poster-tip-poster" />
        )}
        <div className="poster-tip-info">
          <span className="poster-tip-title">{film.name}</span>
          {sub && <span className="poster-tip-sub">{sub}</span>}
          <span className="poster-tip-rating">
            {film.rating != null ? `★ ${film.rating.toFixed(1)} / 5` : 'unrated'}
          </span>
          {stackCount > 1 && (
            <span className="poster-tip-stack-tag">+{stackCount - 1} more at this point</span>
          )}
        </div>
      </div>
    </div>
  );
}
