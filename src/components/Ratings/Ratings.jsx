import { useLayoutEffect, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useRatingStats, CONTRARIAN_BANDS, MIN_DECADE_FILMS } from '../../hooks/useRatingStats';
import { polarToCartesian } from '../../utils/geometry';
import { TMDB_POSTER_SMALL } from '../../utils/tmdbImages';
import { CalendarIcon } from '../icons/Icons';
import './Ratings.css';

// SVG icons

/**
 * Balance scale icon for the consensus card header.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const ScaleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" />
    <path d="M5 6l7-3 7 3" />
    <path d="M5 6l-3 6h6l-3-6" />
    <path d="M19 6l-3 6h6l-3-6" />
    <circle cx="5" cy="12" r="3" fill="none" />
    <circle cx="19" cy="12" r="3" fill="none" />
  </svg>
);

/**
 * Rebel face icon for the contrarian level card header.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const RebelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
  </svg>
);

// Consensus Card component

/**
 * Renders a single consensus film: poster + name + rating comparison.
 *
 * Args:
 *   film (Object): Consensus entry with name, posterPath, userRating, tmdbAvg5, delta.
 *   isPositive (boolean): True for a hidden gem, false for an overhyped pick.
 *   index (number): Position in the grid, used to alternate the column split.
 *
 * Returns:
 *   JSX.Element: A film card within the consensus grid.
 */
function ConsensusItem({ film, isPositive, index }) {
  const { delta } = film;
  const sign = delta > 0 ? '+' : '';
  const badgeClass = isPositive ? 'is-positive' : 'is-negative';

  return (
    <div className={`rt-consensus-item ${index % 2 === 0 ? 'is-left-col' : ''}`}>
      <div className="rt-consensus-poster-wrap">
        {film.posterPath ? (
          <img
            src={TMDB_POSTER_SMALL + film.posterPath}
            alt={`Poster of ${film.name}`}
            loading="lazy"
          />
        ) : (
          <div className="rt-decade-poster-placeholder">{film.name}</div>
        )}
        <span className={`rt-consensus-delta-badge ${badgeClass}`}>
          {sign}{delta.toFixed(1)}
        </span>
      </div>
      <div className="rt-consensus-info">
        <span className="rt-consensus-name">{film.name}</span>
        <div className="rt-consensus-ratings">
          <div className="rt-consensus-rating-block">
            <span className="rt-consensus-you">You: ★</span>
            <span className="rt-consensus-you" style={{ fontSize: '1.1rem' }}>{film.userRating.toFixed(1)}</span>
          </div>
          <span className="rt-consensus-vs" style={{ margin: '0 4px' }}>vs</span>
          <div className="rt-consensus-rating-block">
            <span className="rt-consensus-tmdb">Avg: ★</span>
            <span className="rt-consensus-tmdb" style={{ fontSize: '1.1rem' }}>{film.tmdbAvg5.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One labelled half of the consensus card: a heading plus its film grid.
 *
 * The gems and overhyped halves were the same markup twice, so they share this.
 *
 * Args:
 *   label (string): Heading shown above the grid.
 *   labelClass (string): Extra class that colours the heading.
 *   films (Array<Object>): Consensus entries to render.
 *   isPositive (boolean): True for hidden gems, false for overhyped picks.
 *
 * Returns:
 *   JSX.Element: A labelled consensus half.
 */
function ConsensusHalf({ label, labelClass, films, isPositive }) {
  const keyPrefix = isPositive ? 'gem' : 'hype';
  return (
    <div className="rt-consensus-half">
      <div className={`rt-consensus-label ${labelClass}`}>
        <span>★</span> {label}
      </div>
      <div className="rt-consensus-grid">
        {films.map((film, i) => (
          <ConsensusItem key={`${keyPrefix}-${i}-${film.name}-${film.year}`} film={film} isPositive={isPositive} index={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-width card showing the user's 4 hidden gems and 4 overhyped films,
 * split horizontally with a divider.
 *
 * Args:
 *   consensus (Object): { gems, overhyped, total } from the hook.
 *
 * Returns:
 *   JSX.Element: The consensus card body.
 */
function ConsensusCard({ consensus }) {
  if (consensus.total === 0) {
    return (
      <p className="rt-chart-empty">
        Not enough rated films with TMDB data to compute consensus gaps. Add a TMDB key and reimport your ZIP.
      </p>
    );
  }

  return (
    <div className="rt-consensus-wrap">
      {/* Hidden gems: user rates ABOVE consensus */}
      <ConsensusHalf
        label="Hidden gems underrated by the world"
        labelClass="rt-consensus-label-gems"
        films={consensus.gems}
        isPositive={true}
      />

      <div className="rt-consensus-divider" />

      {/* Overhyped: user rates BELOW consensus */}
      <ConsensusHalf
        label="Overhyped don't get the hype"
        labelClass="rt-consensus-label-hype"
        films={consensus.overhyped}
        isPositive={false}
      />
    </div>
  );
}

// Contrarian Meter component

// One colour per persona band, in the same order as CONTRARIAN_BANDS
const BAND_COLORS = [
  'var(--color-accent)',
  'var(--color-accent-4)',
  'var(--color-accent-3)',
  'var(--color-accent-warm)',
  '#ff4444',
];

/**
 * Returns the colour for a contrarian score by finding the band it lands in.
 *
 * Reads the shared thresholds instead of repeating them, so a new band only
 * has to be added in one place.
 *
 * Args:
 *   score (number): 0..100 contrarian score.
 *
 * Returns:
 *   string: CSS colour string.
 */
function contrarianColor(score) {
  const idx = CONTRARIAN_BANDS.findIndex((band) => score <= band.max);
  return BAND_COLORS[idx === -1 ? BAND_COLORS.length - 1 : idx];
}

// Geometry for the radial persona ring
const RING_CX = 100;
const RING_CY = 100;
const RING_R = 74;
const RING_STROKE = 15;
const RING_GAP_DEG = 15;
// Persona breakpoints dropped as ticks on the linear scale
const SCALE_TICKS = CONTRARIAN_BANDS.slice(0, -1).map((band) => band.max);

/**
 * Turns the shared persona thresholds into proportional bands.
 *
 * Returns start, end, width and colour per band.
 *
 * Args:
 *   None
 *
 * Returns:
 *   Array<Object>: Bands with label, start, end, width, color.
 */
function buildContrarianBands() {
  return CONTRARIAN_BANDS.reduce((bands, band) => {
    const start = bands.length ? bands[bands.length - 1].end : 0;
    const end = band.max === Infinity ? 100 : band.max;
    bands.push({
      label: band.label,
      start,
      end,
      width: end - start,
      color: contrarianColor((start + end) / 2),
    });
    return bands;
  }, []);
}

// the bands never change, so build them once instead of on every render
const RING_BANDS = buildContrarianBands();

/**
 * Maps the bands onto the ring, leaving a rounded gap between every segment.
 *
 * Returns the segments with their angles plus the angle where the marker
 * should sit, so the dot always lands inside the segment you fall into.
 *
 * Args:
 *   bands (Array<Object>): Bands from buildContrarianBands.
 *   score (number): 0..100 contrarian score.
 *
 * Returns:
 *   Object: { segments, activeIndex, markerAngle }
 */
function buildRingLayout(bands, score) {
  const usable = 360 - RING_GAP_DEG * bands.length;
  let cursor = -90;
  const segments = bands.map((band) => {
    const span = (band.width / 100) * usable;
    const segment = { ...band, span, startAngle: cursor, endAngle: cursor + span };
    cursor += span + RING_GAP_DEG;
    return segment;
  });

  const activeIndex = segments.findIndex((s) => score <= s.end);
  const active = segments[activeIndex] || segments[segments.length - 1];
  const local = active.width > 0 ? (score - active.start) / active.width : 0;
  const markerAngle = active.startAngle + Math.min(Math.max(local, 0), 1) * active.span;

  return { segments, activeIndex, markerAngle };
}

/**
 * Builds a stroked arc path for one persona segment of the ring.
 *
 * Rendering the ring as fat round capped strokes gives each segment a clean
 * pill shape, way nicer than clipped donut slices.
 *
 * Args:
 *   r (number): Arc radius.
 *   startDeg (number): Start angle.
 *   endDeg (number): End angle.
 *
 * Returns:
 *   string: SVG path data.
 */
function arcStrokePath(r, startDeg, endDeg) {
  const [x1, y1] = polarToCartesian(RING_CX, RING_CY, r, startDeg);
  const [x2, y2] = polarToCartesian(RING_CX, RING_CY, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * Radial persona ring for the contrarian level.
 *
 * Five proportional pill segments with real gaps. The segment you fall into
 * burns bright in its colour while the rest sit as a dark low saturation
 * track, and a knob marks the exact spot. A linear scale underneath names
 * both ends and shows how far along you sit. No meaningless out of 100 score.
 *
 * Args:
 *   contrarian (Object): { score, meanAbsDelta, meanDelta, label, blurb, sampleSize }
 *
 * Returns:
 *   JSX.Element: Contrarian meter widget.
 */
function ContrarianMeter({ contrarian }) {
  if (contrarian.score == null) {
    return (
      <p className="rt-chart-empty">
        Rate some films and add a TMDB key to measure your contrarian level.
      </p>
    );
  }

  const { score, meanAbsDelta, meanDelta, label, blurb, sampleSize } = contrarian;
  const clamped = Math.min(Math.max(score, 0), 100);
  const color = contrarianColor(score);
  const { segments, activeIndex, markerAngle } = buildRingLayout(RING_BANDS, clamped);
  const biasLabel = meanDelta >= 0 ? 'kinder' : 'harsher';
  const markerRadius = RING_R + RING_STROKE / 2 + 4;
  const [markerX, markerY] = polarToCartesian(RING_CX, RING_CY, markerRadius, markerAngle);
  const isLongLabel = label.length > 12;

  return (
    <div className="rt-contrarian-wrap">
      <div className="rt-rebel-ring">
        <svg
          className="rt-rebel-ring-svg"
          viewBox="0 0 200 200"
          aria-label={`Contrarian level: ${label}`}
        >
          {segments.map((segment, i) => (
            <path
              key={segment.label}
              className={`rt-rebel-arc${i === activeIndex ? ' is-active' : ''}`}
              d={arcStrokePath(RING_R, segment.startAngle, segment.endAngle)}
              style={{ '--zone-color': segment.color }}
            />
          ))}
          <circle className="rt-rebel-marker" cx={markerX} cy={markerY} r="5.5" />
        </svg>

        <div className="rt-rebel-ring-center">
          <span
            className={`rt-rebel-persona-label${isLongLabel ? ' is-long' : ''}`}
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>

      {blurb && <p className="rt-rebel-blurb">{blurb}</p>}

      <div className="rt-rebel-scale" aria-hidden="true">
        <div className="rt-rebel-scale-track">
          <span className="rt-rebel-scale-fill" style={{ width: `${clamped}%`, background: color }} />
          {SCALE_TICKS.map((tick) => (
            <span key={tick} className="rt-rebel-scale-tick" style={{ left: `${tick}%` }} />
          ))}
          <span className="rt-rebel-scale-knob" style={{ left: `${clamped}%`, background: color }} />
        </div>
        <div className="rt-rebel-scale-labels">
          <span>Sheep</span>
          <span>Cinematic anarchist</span>
        </div>
      </div>

      <p className="rt-rebel-stats">
        <span>
          <span className="rt-rebel-stats-val tabular-nums">±{meanAbsDelta.toFixed(2)}</span> avg stars gap
          <span className="rt-rebel-stats-sep">·</span>
          <span className="rt-rebel-stats-val tabular-nums">{sampleSize.toLocaleString()}</span> films compared
        </span>
        <span className="rt-rebel-stats-verdict">leaning {biasLabel} than the crowd</span>
      </p>
    </div>
  );
}

// Decade Showcase component

// Decades show a dense poster wall, capped to two rows of the best rated films
const DECADE_ROWS = 2;
const DEFAULT_DECADE_COLUMNS = 10;

/**
 * Measures how many columns an auto-filling grid actually resolved to.
 *
 * Reads the computed grid-template-columns track list so a decade wall can
 * slice to exactly two rows no matter the viewport width. Re-measures on
 * resize. Lays out before paint so there is no visible reflow.
 *
 * Args:
 *   None
 *
 * Returns:
 *   Array: [ref, columns] where ref attaches to the grid element.
 */
function useGridColumns() {
  const ref = useRef(null);
  const [columns, setColumns] = useState(DEFAULT_DECADE_COLUMNS);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns;
      const count = tracks && tracks !== 'none' ? tracks.split(' ').length : 0;
      setColumns((prev) => (prev === count || count === 0 ? prev : count));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, columns];
}

/**
 * Picks how many films to show so the wall stays tidy.
 *
 * Keeps at most two rows, and drops a second row when it would only hold a
 * handful of posters, since an almost empty row just leaves a sea of dead
 * space on the right. Better one full row than one full row plus an orphan.
 *
 * Args:
 *   total (number): Total films in the decade.
 *   columns (number): Measured column count of the grid.
 *
 * Returns:
 *   number: How many films to render.
 */
function visibleDecadeCount(total, columns) {
  if (columns <= 0) return total;
  if (total <= columns) return total;
  const secondRow = Math.min(total, columns * DECADE_ROWS) - columns;
  if (secondRow < columns * 0.4) return columns;
  return Math.min(total, columns * DECADE_ROWS);
}

/**
 * Static poster wall for a single decade.
 *
 * Posters flow into an auto-filling grid and only the two highest rows are
 * kept, so every decade reads like the same tidy wall of covers.
 *
 * Args:
 *   decade (Object): { label, avgRating, count, films }
 *
 * Returns:
 *   JSX.Element: A decade row with poster grid.
 */
function DecadeRow({ decade }) {
  const [postersRef, columns] = useGridColumns();

  const shownFilms = decade.films.slice(
    0,
    visibleDecadeCount(decade.films.length, columns)
  );

  return (
    <div className="rt-decade-row">
      <div className="rt-decade-meta">
        <span className="rt-decade-label">{decade.label}</span>
        <span className="rt-decade-avg">
          <span className="rt-decade-avg-star">★</span>
          Average {decade.avgRating.toFixed(2)}
        </span>
        <span className="rt-decade-count">{decade.count} films</span>
      </div>

      <div className="rt-decade-posters" ref={postersRef}>
        {shownFilms.map((film, i) => (
          <div key={i} className="rt-decade-poster">
            {film.posterPath ? (
              <img
                src={TMDB_POSTER_SMALL + film.posterPath}
                alt={`${film.name} poster`}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="rt-decade-poster-placeholder">
                {film.name.length > 12 ? film.name.slice(0, 11) + '…' : film.name}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders the top 3 highest rated decades with poster grids.
 *
 * Args:
 *   decades (Array<Object>): Top 3 decades from the hook.
 *
 * Returns:
 *   JSX.Element: Decade showcase block.
 */
function DecadeShowcase({ decades }) {
  if (!decades.length) {
    return (
      <div className="rt-decades-empty">
        <p className="rt-decades-empty-title">No decade qualifies yet</p>
        <p className="rt-decades-empty-body">
          A decade only makes this wall once you have at least {MIN_DECADE_FILMS} logged films in it. Keep watching and it fills itself.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rt-decades-wrap">
        {decades.map((decade) => (
          <DecadeRow key={decade.label} decade={decade} />
        ))}
      </div>
      {decades.length < 3 && (
        <p className="rt-decades-note">
          A decade needs at least {MIN_DECADE_FILMS} logged films to make the wall.
        </p>
      )}
    </>
  );
}

// Main Section Component

/**
 * Section 04: Ratings deep dive.
 *
 * Returns:
 *   JSX.Element: The Ratings section.
 */
export default function Ratings() {
  const { enrichedData } = useData();
  const stats = useRatingStats(enrichedData);

  if (!stats.hasData) {
    return (
      <div className="rt-section">
        <header className="rt-header">
          <div className="rt-section-label">Section 04 / Ratings</div>
          <h2 className="rt-title">Your rating <span className="lb-hl-green">fingerprint</span>.</h2>
          <p className="rt-subtitle">Add some watches so we can analyse how you rate.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="rt-section">
      <header className="rt-header">
        <div className="rt-section-label">Section 04 / Ratings</div>
        <h2 className="rt-title">Your rating <span className="lb-hl-green">fingerprint</span>.</h2>
        <p className="rt-subtitle">
          How you rate compared to everyone else, how contrarian you really are, and which decades you love the most.
        </p>
      </header>

      <div className="rt-grid">
        {/* 01: You vs the Consensus */}
        <section className="rt-card rt-col-8" aria-label="You vs the consensus">
          <div className="rt-card-head">
            <div className="rt-card-title-group">
              <div className="rt-card-icon" style={{ color: 'var(--color-accent)' }}>
                <ScaleIcon />
              </div>
              <div className="rt-card-label">You vs. the Consensus</div>
            </div>
            <div className="rt-card-note">your biggest disagreements with the crowd</div>
          </div>
          <ConsensusCard consensus={stats.consensus} />
        </section>

        {/* 02: Contrarian Meter */}
        <section className="rt-card rt-col-4" aria-label="Contrarian score">
          <div className="rt-card-head">
            <div className="rt-card-title-group">
              <div className="rt-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <RebelIcon />
              </div>
              <div className="rt-card-label">Contrarian Level</div>
            </div>
          </div>
          <ContrarianMeter contrarian={stats.contrarian} />
        </section>

        {/* 03: Highest Rated Decades */}
        <section className="rt-card rt-col-12" aria-label="Highest rated decades">
          <div className="rt-card-head">
            <div className="rt-card-title-group">
              <div className="rt-card-icon" style={{ color: 'var(--color-accent-4)' }}>
                <CalendarIcon />
              </div>
              <div className="rt-card-label">Highest Rated Decades</div>
            </div>
          </div>
          <DecadeShowcase decades={stats.decades} />
        </section>
      </div>
    </div>
  );
}
