import { useRef, useState } from 'react';
import { formatIsoDate } from '../../utils/dateFormat';
import './Heatmap.css';

/**
 * GitHub-style calendar-year activity heat grid with hover tooltips.
 *
 * Each day is a cell whose intensity bucket (0-4) maps to a green ramp, so a
 * busy streak jumps out at a glance. Days outside the selected year and days
 * still to come render as blank cells. Hovering or tapping a cell reveals a
 * dark micro-tooltip with the exact date and count.
 *
 * Args:
 *   heatmap (Object): Derived year grid from buildYearGrid with cells,
 *     weekCount and monthLabels.
 *   byDateMovies (Map<string, Array<Object>>): ISO date -> films with posters.
 *
 * Returns:
 *   JSX.Element: The heat grid block.
 */
export default function Heatmap({ heatmap, byDateMovies = new Map() }) {
  const wrapRef = useRef(null);
  // simple count popover that follows the pointer on hover
  const [hover, setHover] = useState(null);
  // the big film list stays put until you click another cell or leave it
  const [pinned, setPinned] = useState(null);

  if (!heatmap) return null;

  const { cells, weekCount, monthLabels } = heatmap;

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /**
   * Positions a popover centred on a cell relative to the wrapper.
   *
   * Args:
   *   node (Element): The cell DOM element.
   *
   * Returns:
   *   Object: Clamped { x, y } coordinates.
   */
  function cellPosition(node) {
    const wrap = wrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const wrapRect = wrap.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const x = rect.left - wrapRect.left + rect.width / 2;
    const y = rect.top - wrapRect.top;
    return { x: Math.max(90, Math.min(wrapRect.width - 90, x)), y };
  }

  /**
   * Shows the simple count popover while hovering a cell. The popover hides
   * the moment the pointer leaves the cell, every time.
   *
   * Args:
   *   cell (Object): The hovered cell definition.
   *   node (Element): The hovered DOM cell node.
   *
   * Returns:
   *   void
   */
  function handleEnter(cell, node) {
    // joder no hover on empty days, that's just noise
    if (cell.blank || cell.count === 0) return;
    const { x, y } = cellPosition(node);
    setHover({ iso: cell.iso, count: cell.count, x, y });
  }

  function handleLeave() {
    setHover(null);
  }

  /**
   * Pins (or unpins) the big film-list popover on a cell click.
   *
   * Args:
   *   cell (Object): The clicked cell definition.
   *   node (Element): The clicked DOM cell node.
   *
   * Returns:
   *   void
   */
  function handleClick(cell, node) {
    if (cell.blank || cell.count === 0) return;
    if (pinned && pinned.iso === cell.iso) {
      setPinned(null);
      return;
    }
    const { x, y } = cellPosition(node);
    const films = byDateMovies.get(cell.iso) || [];
    setPinned({ iso: cell.iso, count: cell.count, films, x, y });
  }

  function handlePinnedLeave() {
    // close the instant the pointer leaves the tooltip, no ifs or buts
    setPinned(null);
  }

  const hoverFilms = pinned?.films || [];
  const hoverFilmsToShow = hoverFilms.slice(0, 6);
  const hoverExtra = hoverFilms.length - hoverFilmsToShow.length;

  return (
    <div className="ry-heat" ref={wrapRef}>
      <div className="ry-heat-scroll">
        <div className="ry-heat-row">
          <div className="ry-heat-weekdays" aria-hidden="true">
            {DAY_LABELS.map((label, dayIndex) => (
              <div
                key={label}
                className="ry-heat-weekday-label"
                style={{ gridRowStart: dayIndex + 1 }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="ry-heat-main">
            <div className="ry-heat-months" aria-hidden="true" style={{ '--weeks': weekCount }}>
              {monthLabels.map((m) => (
                <span
                  key={`${m.week}-${m.label}`}
                  className="ry-heat-month-label"
                  style={{ gridColumnStart: m.week + 1 }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="ry-heat-grid" role="grid" aria-label="Your watching activity by day, trailing 12 months" style={{ '--weeks': weekCount }}>
              {cells.map((cell) => {
                const label = `${cell.count} ${cell.count === 1 ? 'film' : 'films'} on ${formatIsoDate(cell.iso)}`;
                return (
                  <div
                    key={cell.iso}
                    className={`ry-heat-cell lv${cell.level}${cell.blank ? ' blank' : ''}`}
                    role="gridcell"
                    aria-label={label}
                    style={{ gridColumn: cell.week + 1, gridRow: cell.dayOfWeek + 1 }}
                    onMouseEnter={(e) => handleEnter(cell, e.currentTarget)}
                    onMouseLeave={handleLeave}
                    onClick={(e) => handleClick(cell, e.currentTarget)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="ry-heat-legend">
        <span className="ry-heat-legend-text">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={`ry-heat-cell lv${level}`} />
        ))}
        <span className="ry-heat-legend-text">More</span>
      </div>

      {/* simple count popover: follows the cursor, vanishes on mouseleave */}
      {hover && !pinned && (
        <div className="ry-heat-mini-tip" style={{ left: hover.x, top: hover.y }}>
          <span className="ry-heat-mini-count tabular-nums">{hover.count}</span>
          <span className="ry-heat-mini-label">{formatIsoDate(hover.iso)}</span>
        </div>
      )}

      {/* big film-list popover: pinned on click until you leave it */}
      {pinned && (
        <div
          className="ry-heat-tooltip"
          style={{ left: pinned.x, top: pinned.y }}
          onMouseLeave={handlePinnedLeave}
        >
          <div className="ry-heat-tooltip-head">
            <div className="ry-heat-tooltip-total">
              <span className="ry-heat-tooltip-count tabular-nums">{pinned.count}</span>
              <span className="ry-heat-tooltip-count-label">films watched</span>
            </div>
            <span className="ry-heat-tooltip-date">{formatIsoDate(pinned.iso)}</span>
          </div>

          {hoverFilms.length > 0 && (
            <div className="ry-heat-tooltip-films">
              {hoverFilmsToShow.map((film, i) => (
                <div className="ry-heat-film" key={`${film.name}-${film.year}-${i}`}>
                  <div className="ry-heat-film-poster">
                    {film.posterPath ? (
                      <img
                        src={film.posterPath}
                        alt={`Poster of ${film.name}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="ry-heat-film-poster-missing" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ry-heat-film-info">
                    <span className="ry-heat-film-name">{film.name}</span>
                    <span className="ry-heat-film-year">
                      {film.year || ''}
                      {film.rating != null ? ` · ${film.rating}★` : ''}
                    </span>
                  </div>
                </div>
              ))}
              {hoverExtra > 0 && (
                <div className="ry-heat-tooltip-more">+{hoverExtra} more</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
