import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import { useData } from '../../context/DataContext';
import { useCinephileStats } from '../../hooks/useCinephileStats';
import './CinephileProfile.css';

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_POSTER_SMALL = 'https://image.tmdb.org/t/p/w185';

// ISO 3166-1 alpha-2 to full country name map, used by the world map tooltip
const COUNTRY_NAMES = {
  US: 'United States', GB: 'United Kingdom', FR: 'France', DE: 'Germany',
  IT: 'Italy', ES: 'Spain', JP: 'Japan', KR: 'South Korea', CN: 'China',
  IN: 'India', AU: 'Australia', CA: 'Canada', BR: 'Brazil', MX: 'Mexico',
  RU: 'Russia', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria',
  PL: 'Poland', CZ: 'Czech Republic', HU: 'Hungary', RO: 'Romania',
  PT: 'Portugal', GR: 'Greece', TR: 'Turkey', AR: 'Argentina', CL: 'Chile',
  CO: 'Colombia', HK: 'Hong Kong', TW: 'Taiwan', SG: 'Singapore', TH: 'Thailand',
  IR: 'Iran', IL: 'Israel', ZA: 'South Africa', EG: 'Egypt', NG: 'Nigeria',
  NZ: 'New Zealand', IE: 'Ireland', UA: 'Ukraine',
};

// SVG icons
const DnaIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M 3 6 C 7 6, 8 18, 12 18 C 16 18, 17 6, 21 6" />
    <path d="M 3 18 C 7 18, 8 6, 12 6 C 16 6, 17 18, 21 18" />
    <line x1="3" y1="6" x2="3" y2="18" />
    <line x1="6.5" y1="9" x2="6.5" y2="15" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="17.5" y1="9" x2="17.5" y2="15" />
    <line x1="21" y1="6" x2="21" y2="18" />
  </svg>
);

const GenreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="4" height="14" rx="1" />
    <rect x="10" y="6" width="4" height="11" rx="1" />
    <rect x="17" y="9" width="4" height="8" rx="1" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

const TrendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const LensIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

/**
 * Maps a 0..5 film rating to an emerald fill colour.
 *
 * Args:
 *   rating (number|null): Film rating.
 *
 * Returns:
 *   string: CSS colour string.
 */
function ratingColor(rating) {
  if (rating == null) return 'rgba(255, 255, 255, 0.18)';
  return `rgba(0, 232, 122, ${(0.35 + (rating / 5) * 0.65).toFixed(2)})`;
}

/**
 * Four horizontal spectrum bars replacing the old radar polygon with hover explanations.
 *
 * Args:
 *   axes (Array<Object>): Spectrum axes from the stats hook.
 *
 * Returns:
 *   JSX.Element: The spectrum bars block.
 */
function CinephileSpectrum({ axes }) {
  const [hoverKey, setHoverKey] = useState(null);

  if (!axes.length) return null;

  return (
    <div className="cp-spectrum">
      {axes.map((axis) => (
        <div key={axis.key} className="cp-spectrum-row">
          <div className="cp-spectrum-meta">
            <span className="cp-spectrum-key">{axis.key}</span>
            {axis.available
              ? <span className="cp-spectrum-pct">{axis.pctLabel}</span>
              : <span className="cp-spectrum-na">no data</span>
            }
          </div>
          <div className="cp-spectrum-track-wrap">
            <span className="cp-spectrum-pole cp-spectrum-pole-left">{axis.leftLabel}</span>
            <div
              className="cp-spectrum-track"
              aria-label={`${axis.key}: ${axis.pctLabel}`}
            >
              <div className="cp-spectrum-fill" style={{ width: `${axis.value * 100}%` }} />
              {axis.available && (
                <>
                  <div
                    className={`cp-spectrum-marker ${hoverKey === axis.key ? 'is-active' : ''}`}
                    style={{ left: `${axis.value * 100}%` }}
                    aria-hidden="true"
                    onMouseEnter={() => setHoverKey(axis.key)}
                    onMouseLeave={() => setHoverKey(null)}
                  />
                  {hoverKey === axis.key && axis.explanation && (
                    <div
                      className="cp-dna-tip"
                      style={{ left: `${axis.value * 100}%` }}
                    >
                      {axis.explanation}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="cp-spectrum-pole cp-spectrum-pole-right">{axis.rightLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Palette for genre arc segments — ordered for visual variety
const GENRE_ARC_PALETTE = [
  'var(--color-accent-2)',
  'var(--color-accent)',
  'var(--color-accent-4)',
  'var(--color-accent-3)',
  'var(--color-accent-warm)',
  'rgba(124,109,240,0.55)',
  'rgba(0,232,122,0.55)',
];

/**
 * Genre Fingerprint Card — radial donut of top genres.
 *
 * Args:
 *   genre (Object): Genre stats bundle.
 *
 * Returns:
 *   JSX.Element: Radial arc genre fingerprint widget.
 */
function GenreDiversityCard({ genre }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Edge case: no genre data at all
  if (!genre.list.length || genre.total === 0) {
    return (
      <div className="cp-gfp-wrap cp-gfp-empty">
        <p className="cp-chart-empty">
          No genre data yet. Add a TMDB key and reimport your ZIP to see your genre spread.
        </p>
      </div>
    );
  }

  // Filter out any zero-count entries (shouldn't happen, but safety first)
  const top = genre.list.filter((r) => r.count > 0).slice(0, 7);
  if (!top.length) {
    return <p className="cp-chart-empty">Not enough genre data to display.</p>;
  }

  const topTotal = top.reduce((s, r) => s + r.count, 0);
  const otherCount = Math.max(0, genre.total - topTotal);
  const rawSegments = [
    ...top.map((r, i) => ({ label: r.genre, count: r.count, color: GENRE_ARC_PALETTE[i] })),
    ...(otherCount > 0 ? [{ label: 'Other', count: otherCount, color: 'rgba(255,255,255,0.1)' }] : []),
  ];
  const grandTotal = rawSegments.reduce((s, seg) => s + seg.count, 0);

  // Degenerate: grandTotal still 0 after filtering
  if (grandTotal === 0) {
    return <p className="cp-chart-empty">Not enough genre data to display.</p>;
  }

  // Single-segment: skip the gap so it renders as a full circle
  const segments = rawSegments;

  // SVG donut params
  const CX = 80; const CY = 80;
  const R_OUTER = 66; const R_INNER = 44;
  // Only apply gaps when there are multiple segments (a 360° arc path degenerates)
  const isSingle = segments.length === 1;
  const GAP_DEG = isSingle ? 0 : 2;

  function polarToXY(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function arcPath(startDeg, endDeg, rOuter, rInner) {
    const s1 = polarToXY(CX, CY, rOuter, startDeg);
    const e1 = polarToXY(CX, CY, rOuter, endDeg);
    const s2 = polarToXY(CX, CY, rInner, endDeg);
    const e2 = polarToXY(CX, CY, rInner, startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${s1[0].toFixed(2)} ${s1[1].toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${e1[0].toFixed(2)} ${e1[1].toFixed(2)}`,
      `L ${s2[0].toFixed(2)} ${s2[1].toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${e2[0].toFixed(2)} ${e2[1].toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  const totalDeg = 360 - segments.length * GAP_DEG;
  let cursor = 0;
  const arcs = segments.map((seg, i) => {
    const spanDeg = (seg.count / grandTotal) * totalDeg;
    const start = cursor;
    const end = cursor + spanDeg;
    cursor = end + GAP_DEG;
    return { ...seg, start, end, idx: i };
  });

  // Safe percentage helpers
  const safePct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
  const topDominancePct = safePct(genre.topGenre?.count || 0, genre.total);
  const hovered = hoveredIdx !== null ? arcs[hoveredIdx] : null;

  return (
    <div className="cp-gfp-wrap">
      <div className="cp-gfp-donut-area">
        <svg
          className="cp-gfp-svg"
          viewBox="0 0 160 160"
          aria-label="Genre fingerprint donut chart"
        >
          {/* subtle track ring */}
          <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="var(--color-surface-raised)" strokeWidth={R_OUTER - R_INNER} />
          {isSingle ? (
            /* Single genre: render as a solid full-ring circle */
            <circle
              cx={CX}
              cy={CY}
              r={(R_OUTER + R_INNER) / 2}
              fill="none"
              stroke={arcs[0].color}
              strokeWidth={R_OUTER - R_INNER}
              style={{ cursor: 'default' }}
              onMouseEnter={() => setHoveredIdx(0)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ) : (
            arcs.map((arc) => (
              <path
                key={arc.idx}
                d={arcPath(arc.start, arc.end, R_OUTER, R_INNER)}
                fill={arc.color}
                opacity={hoveredIdx === null ? 1 : hoveredIdx === arc.idx ? 1 : 0.35}
                style={{ transition: 'opacity 150ms ease', cursor: 'default' }}
                onMouseEnter={() => setHoveredIdx(arc.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))
          )}
          {/* center label */}
          {hovered ? (
            <>
              <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-num">
                {safePct(hovered.count, genre.total)}%
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-lbl">
                {hovered.label.length > 10 ? hovered.label.slice(0, 9) + '…' : hovered.label}
              </text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-num">
                {genre.distinctCount}
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-lbl">
                genres
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="cp-gfp-legend">
        {arcs.slice(0, 6).map((arc) => (
          <div
            key={arc.idx}
            className={`cp-gfp-legend-row${hoveredIdx === arc.idx ? ' is-active' : ''}`}
            onMouseEnter={() => setHoveredIdx(arc.idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="cp-gfp-legend-dot" style={{ background: arc.color }} />
            <span className="cp-gfp-legend-name">{arc.label}</span>
            <span className="cp-gfp-legend-pct tabular-nums">
              {safePct(arc.count, genre.total)}%
            </span>
          </div>
        ))}
      </div>

      <div className="cp-gfp-foot">
        <div className="cp-gfp-stat">
          <span className="cp-gfp-stat-val tabular-nums">{topDominancePct}%</span>
          <span className="cp-gfp-stat-lbl">top genre share</span>
        </div>
        <div className="cp-gfp-stat-divider" />
        <div className="cp-gfp-stat">
          <span className="cp-gfp-stat-val tabular-nums">{genre.total}</span>
          <span className="cp-gfp-stat-lbl">genre tags total</span>
        </div>
      </div>
    </div>
  );
}


/**
 * Vertical genre scatter dotplot with poster hover preview and non-symmetrical scatter.
 *
 * Args:
 *   genre (Object): Genre distribution bundle from the stats hook.
 *
 * Returns:
 *   JSX.Element: The scattered dotplot block.
 */
function GenreDotplot({ genre }) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!genre.list.length) {
    return (
      <p className="cp-chart-empty">
        No genre data yet. Add a TMDB key and reimport your ZIP to see your genre spread.
      </p>
    );
  }

  const visibleGenres = genre.list.slice(0, 20);
  const maxCount = visibleGenres[0]?.count || 1;
  const MAX_DOTS_PER_COL = genre.maxDots;

  function positionFrom(node) {
    const wrap = containerRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const wrapRect = wrap.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const x = rect.left - wrapRect.left + rect.width / 2;
    const y = rect.top - wrapRect.top;
    return {
      x: Math.max(120, Math.min(wrapRect.width - 120, x)),
      y,
    };
  }

  return (
    <div className="cp-dotplot" ref={containerRef} onMouseLeave={() => setHover(null)}>
      <div className="cp-dotplot-columns">
        {visibleGenres.map((row) => {
          const colHeightPct = (row.count / maxCount) * 100;
          const dotsToShow = row.films.slice(0, MAX_DOTS_PER_COL);
          const overflow = row.count - MAX_DOTS_PER_COL;

          return (
            <div
              key={row.genre}
              className="cp-dotplot-col"
            >
              <div className="cp-dotplot-count tabular-nums">{row.count}</div>
              <div className="cp-dotplot-col-inner" style={{ height: `${colHeightPct}%` }}>
                <div className="cp-dotplot-dots cp-dotplot-scatter">
                  {dotsToShow.map((film, i) => {
                    // deterministic horizontal jitter based on film title & index
                    const seed = (film.name.charCodeAt(0) || i) * 31 + i * 17;
                    const leftPct = 12 + Math.abs(Math.sin(seed) * 76);
                    const topPct = dotsToShow.length > 1 ? (i / (dotsToShow.length - 1)) * 90 + 5 : 50;

                    return (
                      <span
                        key={i}
                        className="cp-dotplot-dot"
                        style={{
                          background: ratingColor(film.rating),
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          position: 'absolute',
                        }}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHover({ type: 'film', film, genre: row.genre, ...positionFrom(e.currentTarget) });
                        }}
                      />
                    );
                  })}
                  {overflow > 0 && <span className="cp-dotplot-overflow" style={{ position: 'absolute', bottom: '-20px', width: '100%', left: '0' }}>+{overflow}</span>}
                </div>
              </div>
              <span className="cp-dotplot-label" title={row.genre}>{row.genre}</span>
            </div>
          );
        })}
      </div>

      {hover && hover.type === 'film' && (
        <div className="cp-tip cp-poster-tip" style={{ left: hover.x, top: hover.y }}>
          <div className="cp-tip-film-card">
            {hover.film.posterPath && (
              <img
                src={TMDB_POSTER_SMALL + hover.film.posterPath}
                alt={hover.film.name}
                className="cp-tip-poster"
              />
            )}
            <div className="cp-tip-film-info">
              <span className="cp-tip-title">{hover.film.name}</span>
              <span className="cp-tip-sub">{hover.film.year ? `${hover.film.year} • ` : ''}{hover.genre}</span>
              <span className="cp-tip-rating">{hover.film.rating != null ? `★ ${hover.film.rating.toFixed(1)} / 5` : 'unrated'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dual-tone area chart for taste evolution.
 *
 * Args:
 *   taste (Object): Taste evolution bundle from the stats hook.
 *
 * Returns:
 *   JSX.Element: The evolution chart block.
 */
function TasteEvolutionChart({ taste }) {
  if (taste.series.length < 2) {
    return (
      <p className="cp-chart-empty">
        Not enough Letterboxd history to show a taste trend. Keep watching.
      </p>
    );
  }

  const W = 560;
  const H = 200;
  const padL = 42;
  const padR = 16;
  const padT = 20;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yMin = 0;
  const yMax = 5;
  const xMin = taste.series[0].year;
  const xMax = taste.series[taste.series.length - 1].year;
  const xspan = (xMax - xMin) || 1;
  const xs = (year) => padL + ((year - xMin) / xspan) * plotW;
  const ys = (avg) => padT + (1 - (avg - yMin) / (yMax - yMin)) * plotH;

  const splitIdx = Math.ceil(taste.series.length / 2);
  const early = taste.series.slice(0, splitIdx);
  const late = taste.series.slice(splitIdx - 1);

  function buildPath(pts) {
    return pts.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xs(s.year).toFixed(1)} ${ys(s.avg).toFixed(1)}`).join(' ');
  }

  function buildArea(pts) {
    if (!pts.length) return null;
    const line = buildPath(pts);
    const firstX = xs(pts[0].year).toFixed(1);
    const lastX = xs(pts[pts.length - 1].year).toFixed(1);
    const baseY = (padT + plotH).toFixed(1);
    return `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }

  const earlyArea = buildArea(early);
  const lateArea = buildArea(late);
  const earlyLine = buildPath(early);
  const lateLine = buildPath(late);

  const step = Math.max(1, Math.ceil(taste.series.length / 6));
  const xTicks = taste.series.filter((_, i) => i % step === 0);
  const yTicks = [1, 2, 3, 4, 5];

  const verdictMap = {
    up: { text: 'Your ratings have gotten more generous over time', color: 'var(--color-accent)' },
    down: { text: 'Your ratings have gotten tougher over time', color: 'var(--color-accent-warm)' },
    steady: { text: 'Your taste has been remarkably steady', color: 'var(--color-accent-4)' },
  };
  const verdict = verdictMap[taste.direction];

  return (
    <div className="cp-taste-chart">
      <svg className="cp-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your average rating trend over time">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="cp-chart-grid" x1={padL} y1={ys(tick)} x2={W - padR} y2={ys(tick)} />
            <text className="cp-chart-axis" x={padL - 8} y={ys(tick)} textAnchor="end" dominantBaseline="middle">{tick}</text>
          </g>
        ))}
        {xTicks.map((s) => (
          <g key={s.year}>
            <line className="cp-chart-tick" x1={xs(s.year)} y1={padT + plotH} x2={xs(s.year)} y2={padT + plotH + 5} />
            <text className="cp-chart-year" x={xs(s.year)} y={H - 8} textAnchor="middle">{s.year}</text>
          </g>
        ))}
        {earlyArea && <path className="cp-taste-area-early" d={earlyArea} />}
        {lateArea && <path className="cp-taste-area-late" d={lateArea} />}
        {earlyLine && <path className="cp-taste-line-early" d={earlyLine} />}
        {lateLine && <path className="cp-taste-line-late" d={lateLine} />}
        {early.length > 0 && late.length > 0 && (
          <line
            className="cp-taste-split"
            x1={xs(late[0].year)}
            y1={padT}
            x2={xs(late[0].year)}
            y2={padT + plotH}
          />
        )}
      </svg>
      <div className="cp-taste-verdict" style={{ '--verdict-color': verdict.color }}>
        {verdict.text}
        {taste.delta !== 0 && (
          <span className="cp-taste-delta tabular-nums">
            {taste.delta > 0 ? '+' : ''}{taste.delta.toFixed(2)} avg
          </span>
        )}
      </div>
      <div className="cp-taste-legend">
        <span className="cp-taste-legend-item cp-taste-legend-early">Early years</span>
        <span className="cp-taste-legend-item cp-taste-legend-late">Recent years</span>
      </div>
    </div>
  );
}

/**
 * 2D Scatter plot for runtime and release year correlation with poster hover & multi-film stack handling.
 *
 * Args:
 *   data (Object): Correlation data from the stats hook.
 *   xLabel (string): X axis description.
 *   accent (string): CSS accent variable for the average line.
 *
 * Returns:
 *   JSX.Element: The tick density chart block.
 */
function TickDensityChart({ data, xLabel, accent }) {
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  if (data.count === 0) {
    return <p className="cp-chart-empty">Not enough rated data to plot this correlation.</p>;
  }

  const W = 560;
  const H = 200;
  const padL = 46;
  const padR = 16;
  const padT = 12;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xspan = (data.xMax - data.xMin) || 1;
  const xs = (x) => padL + ((x - data.xMin) / xspan) * plotW;
  const ys = (rating) => padT + plotH * (1 - rating / 5);

  const BIN_COUNT = 40;
  const bins = Array.from({ length: BIN_COUNT }, () => ({ sum: 0, count: 0 }));
  for (const point of data.points) {
    const binIdx = Math.min(BIN_COUNT - 1, Math.floor(((point.x - data.xMin) / xspan) * BIN_COUNT));
    bins[binIdx].sum += point.y;
    bins[binIdx].count++;
  }

  const avgLine = bins
    .map((bin, i) => {
      if (bin.count === 0) return null;
      const x = data.xMin + (i / BIN_COUNT) * xspan + xspan / BIN_COUNT / 2;
      const y = bin.sum / bin.count;
      return { x, y };
    })
    .filter(Boolean);

  const linePath = avgLine.length > 1
    ? avgLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(p.x).toFixed(1)} ${ys(p.y).toFixed(1)}`).join(' ')
    : null;

  const xTickCount = 6;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => data.xMin + (xspan * i) / (xTickCount - 1));

  function onSvgMove(e) {
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const mouseSvgX = ((e.clientX - rect.left) / rect.width) * W;
    const mouseSvgY = ((e.clientY - rect.top) / rect.height) * H;

    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < data.points.length; i++) {
      const p = data.points[i];
      const px = xs(p.x);
      const py = ys(p.y);
      const d = Math.hypot(px - mouseSvgX, py - mouseSvgY);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }

    if (closest != null && minDist < 30) {
      const p = data.points[closest];
      const stack = data.points.filter((pt) => Math.abs(pt.x - p.x) < (xspan * 0.01) && Math.abs(pt.y - p.y) < 0.2);
      setHover({ ...p, stackCount: stack.length });
    } else {
      setHover(null);
    }
  }

  return (
    <div className="cp-tick-chart" ref={containerRef}>
      <svg
        className="cp-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${xLabel} vs your rating`}
        onMouseMove={onSvgMove}
        onMouseLeave={() => setHover(null)}
      >
        {xTicks.map((tick) => (
          <g key={tick}>
            <line className="cp-chart-tick" x1={xs(tick)} y1={padT + plotH} x2={xs(tick)} y2={padT + plotH + 5} />
            <text className="cp-chart-year" x={xs(tick)} y={H - 8} textAnchor="middle">{Math.round(tick)}</text>
          </g>
        ))}
        <line className="cp-tick-baseline" x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} />

        {data.points.map((point, i) => {
          const isHovered = hover && hover.name === point.name && hover.x === point.x;
          return (
            <circle
              key={`${point.name}-${i}`}
              className={`cp-scatter-dot${isHovered ? ' is-hover' : ''}`}
              cx={xs(point.x)}
              cy={ys(point.y)}
              r={isHovered ? 6 : 3.5}
              style={{ fill: ratingColor(point.y) }}
            />
          );
        })}

        {linePath && <path className="cp-tick-avg-line" d={linePath} style={{ stroke: accent }} />}
      </svg>

      {hover && (
        <div
          className="cp-tip cp-poster-tip"
          style={{
            left: `${(xs(hover.x) / W) * 100}%`,
            top: `${(ys(hover.y) / H) * 100}%`,
          }}
        >
          <div className="cp-tip-film-card">
            {hover.posterPath && (
              <img
                src={TMDB_POSTER_SMALL + hover.posterPath}
                alt={hover.name}
                className="cp-tip-poster"
              />
            )}
            <div className="cp-tip-film-info">
              <span className="cp-tip-title">{hover.name}</span>
              <span className="cp-tip-sub">{hover.year ? `${hover.year} • ` : ''}{Math.round(hover.x)} {xLabel.toLowerCase() === 'runtime' ? 'min' : ''}</span>
              <span className="cp-tip-rating">★ {hover.y.toFixed(1)} / 5</span>
              {hover.stackCount > 1 && (
                <span className="cp-tip-stack-tag">+{hover.stackCount - 1} more at this point</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Circular arc gauge for a percentage value.
 *
 * Args:
 *   value (number|null): Fraction 0..1, or null when unavailable.
 *   label (string): Label below gauge.
 *   accent (string): CSS variable for colour.
 *   subtext (string): Optional text below percentage inside circle.
 *
 * Returns:
 *   JSX.Element: Arc gauge component.
 */
function ArcGauge({ value, label, accent, subtext, size }) {
  const R = 38;
  const cx = 54;
  const cy = 54;
  const circumference = 2 * Math.PI * R;
  const fill = value != null ? circumference * Math.min(Math.max(value, 0), 1) : 0;
  const svgStyle = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div className="cp-arc-gauge">
      <svg className="cp-arc-svg" style={svgStyle} viewBox="0 0 108 108" aria-label={label || 'Gauge'}>
        <circle
          className="cp-arc-track"
          cx={cx}
          cy={cy}
          r={R}
        />
        <circle
          className="cp-arc-fill"
          cx={cx}
          cy={cy}
          r={R}
          strokeDasharray={`${fill} ${circumference - fill}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ stroke: `var(${accent})` }}
        />
        <text
          className="cp-arc-pct tabular-nums"
          x={cx}
          y={subtext ? cy - 6 : cy}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {value != null ? `${Math.round(value * 100)}%` : '?'}
        </text>
        {subtext && (
          <text
            className="cp-arc-sub"
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {subtext}
          </text>
        )}
      </svg>
      {label && <span className="cp-arc-label">{label}</span>}
    </div>
  );
}

/**
 * Upgraded Diversity Card with Top Director Spotlight.
 *
 * Args:
 *   diversity (Object): Diversity bundle from hook.
 *
 * Returns:
 *   JSX.Element: Behind the Lens card body.
 */
function DiversityCard({ diversity }) {
  const topCountries = diversity.topCountries.slice(0, 5);
  const topDirectors = diversity.topDirectors || [];

  return (
    <div className="cp-diversity-enhanced">
      <div className="cp-diversity-gauges">
        <ArcGauge
          value={diversity.femaleShare}
          label="Female directed"
          accent="--color-accent-2"
        />
        <ArcGauge
          value={diversity.internationalShare}
          label="Non-English"
          accent="--color-accent-4"
        />
      </div>

      {topDirectors.length > 0 && (
        <div className="cp-director-spotlight">
          <div className="cp-director-title">Top Directors Watched</div>
          <div className="cp-director-list">
            {topDirectors.map((d, i) => (
              <div key={i} className="cp-director-item">
                <div className="cp-director-info">
                  <span className="cp-director-name">{d.name}</span>
                  <span className="cp-director-stats tabular-nums">
                    {d.count} {d.count === 1 ? 'film' : 'films'}
                    {d.avgRating != null && ` • ★ ${d.avgRating.toFixed(1)}`}
                  </span>
                </div>
                <div className="cp-director-bar">
                  <div className="cp-director-fill" style={{ width: `${(d.count / topDirectors[0].count) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SVG world map with anti-meridian wrap path splitting fix.
 *
 * Args:
 *   worldMap (Object): World map bundle.
 *
 * Returns:
 *   JSX.Element: World map component.
 */
function WorldMapChart({ worldMap }) {
  const [geoData, setGeoData] = useState(null);
  const [hover, setHover] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default || mod;
      const countries = feature(topo, topo.objects.countries);
      setGeoData(countries);
    }).catch((err) => {
      console.warn('WorldMapChart: failed to load world-atlas data', err);
    });
  }, []);

  const features = useMemo(() => {
    if (!geoData) return [];
    return geoData.features.filter((f) => Number(f.id) !== 10);
  }, [geoData]);

  if (!geoData) {
    return <div className="cp-map-loading">Loading map...</div>;
  }

  if (worldMap.totalCountries === 0) {
    return (
      <p className="cp-chart-empty">
        No country data available. Add a TMDB key and reimport your ZIP to see where your films come from.
      </p>
    );
  }

  const numericToAlpha2 = {
    '840': 'US', '826': 'GB', '250': 'FR', '276': 'DE', '380': 'IT', '724': 'ES',
    '392': 'JP', '410': 'KR', '156': 'CN', '356': 'IN', '036': 'AU', '124': 'CA',
    '076': 'BR', '484': 'MX', '643': 'RU', '752': 'SE', '578': 'NO', '208': 'DK',
    '246': 'FI', '528': 'NL', '056': 'BE', '756': 'CH', '040': 'AT', '616': 'PL',
    '203': 'CZ', '348': 'HU', '642': 'RO', '620': 'PT', '300': 'GR', '792': 'TR',
    '032': 'AR', '152': 'CL', '170': 'CO', '344': 'HK', '158': 'TW', '702': 'SG',
    '764': 'TH', '364': 'IR', '376': 'IL', '710': 'ZA', '818': 'EG', '566': 'NG',
    '554': 'NZ', '372': 'IE', '804': 'UA', '788': 'TN', '504': 'MA',
    '704': 'VN', '360': 'ID', '050': 'BD', '144': 'LK', '586': 'PK',
    '458': 'MY', '608': 'PH', '682': 'SA', '784': 'AE', '414': 'KW', '634': 'QA',
    '422': 'LB', '400': 'JO', '320': 'GT', '600': 'PY', '598': 'PG', '024': 'AO',
    '288': 'GH', '404': 'KE', '231': 'ET', '800': 'UG', '834': 'TZ', '716': 'ZW',
    '072': 'BW', '686': 'SN', '384': 'CI', '132': 'CV', '388': 'JM', '192': 'CU',
    '858': 'UY', '068': 'BO', '218': 'EC', '604': 'PE', '862': 'VE',
    '100': 'BG', '191': 'HR', '705': 'SI', '703': 'SK', '233': 'EE', '428': 'LV',
    '440': 'LT', '352': 'IS', '442': 'LU', '688': 'RS', '070': 'BA', '807': 'MK',
    '008': 'AL', '196': 'CY', '470': 'MT', '112': 'BY', '498': 'MD', '268': 'GE',
    '051': 'AM', '031': 'AZ', '398': 'KZ', '860': 'UZ',
  };

  function countryFill(numericId) {
    const alpha2 = numericToAlpha2[numericId];
    if (!alpha2) return '#1a1a2e';
    const count = worldMap.byCountry.get(alpha2) || 0;
    if (count === 0) return '#1a1a2e';
    const intensity = Math.log(count + 1) / Math.log(worldMap.maxCount + 1);
    const opacity = 0.25 + intensity * 0.75;
    return `rgba(0, 232, 122, ${opacity.toFixed(2)})`;
  }

  function handleMouseMove(e, numericId) {
    const alpha2 = numericToAlpha2[numericId];
    const count = alpha2 ? (worldMap.byCountry.get(alpha2) || 0) : 0;
    if (!alpha2 || count === 0) {
      setHover(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const wrapRect = container.getBoundingClientRect();
    const x = e.clientX - wrapRect.left;
    const y = e.clientY - wrapRect.top;
    setHover({
      name: (alpha2 && COUNTRY_NAMES[alpha2]) || alpha2 || `Country ${numericId}`,
      count,
      alpha2,
      x,
      y,
    });
  }

  const MAP_W = 960;
  const MAP_H = 480;
  const LAT_MAX = 84;
  const LAT_MIN = -58;

  function project([lng, lat]) {
    const clampedLat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
    const x = ((lng + 180) / 360) * MAP_W;
    const y = ((LAT_MAX - clampedLat) / (LAT_MAX - LAT_MIN)) * MAP_H;
    return [x, y];
  }

  /**
   * Converts geometry to SVG path with antimeridian ring split fix.
   */
  function geometryToPath(geometry) {
    if (!geometry) return '';
    const rings = geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.flat(1)
        : [];

    return rings.map((ring) => {
      let pathStr = '';
      for (let i = 0; i < ring.length; i++) {
        const [lng, lat] = ring[i];
        const [x, y] = project([lng, lat]);

        if (i === 0) {
          pathStr += `M ${x.toFixed(1)},${y.toFixed(1)}`;
        } else {
          const [prevLng] = ring[i - 1];
          // anti-meridian wrap check: if longitude jumps > 180 degrees, start new path instead of drawing line across map
          if (Math.abs(lng - prevLng) > 180) {
            pathStr += ` M ${x.toFixed(1)},${y.toFixed(1)}`;
          } else {
            pathStr += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
          }
        }
      }
      return pathStr + ' Z';
    }).join(' ');
  }

  return (
    <div className="cp-map-wrap" ref={containerRef} onMouseLeave={() => setHover(null)}>
      <svg
        className="cp-map-svg"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label="World map showing countries your films come from"
      >
        {features.map((f) => {
          const id = String(f.id).padStart(3, '0');
          const pathD = geometryToPath(f.geometry);
          const fill = countryFill(id);
          const alpha2 = numericToAlpha2[id];
          const hasFilms = alpha2 && worldMap.byCountry.has(alpha2);
          const isHovered = hover && hover.alpha2 === alpha2;
          return (
            <path
              key={f.id}
              d={pathD}
              className={`cp-map-country${hasFilms ? ' has-films' : ''}${isHovered ? ' is-hovered' : ''}`}
              style={{ fill }}
              onMouseEnter={(e) => handleMouseMove(e, id)}
              onMouseMove={(e) => handleMouseMove(e, id)}
            />
          );
        })}
      </svg>

      {hover && hover.count > 0 && (
        <div
          className="cp-map-tip"
          style={{
            transform: `translate3d(${hover.x}px, ${hover.y}px, 0) translate(-50%, -120%)`,
          }}
        >
          <span className="cp-map-tip-country">{hover.name}</span>
          <div className="cp-map-tip-badge">
            <span className="cp-map-tip-count tabular-nums">
              {hover.count} {hover.count === 1 ? 'film' : 'films'}
            </span>
            {worldMap.totalWatched > 0 && (
              <span className="cp-map-tip-pct tabular-nums">
                {((hover.count / worldMap.totalWatched) * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full-width horizontal strip of movie posters.
 *
 * Args:
 *   films (Array<Object>): Films with posterPath, name, year, caption.
 *   title (string): Strip heading.
 *
 * Returns:
 *   JSX.Element|null: Full-width poster grid.
 */
function PosterAccent({ films, title }) {
  const withPosters = films.filter((f) => f.posterPath);
  if (!withPosters.length) return null;

  return (
    <section className="cp-poster-accent" aria-label={title}>
      <div className="cp-poster-accent-label">{title}</div>
      <div className="cp-poster-accent-strip">
        {withPosters.map((film, i) => (
          <div key={i} className="cp-poster-accent-item">
            <div className="cp-poster-accent-img">
              <img
                src={TMDB_POSTER_SMALL + film.posterPath}
                alt={`Poster of ${film.name}`}
                loading="lazy"
              />
            </div>
            <div className="cp-poster-accent-info">
              <span className="cp-poster-accent-name">{film.name}</span>
              {film.year && <span className="cp-poster-accent-year">{film.year}</span>}
              {film.caption && <span className="cp-poster-accent-caption">{film.caption}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Section 03: Cinephile Profile and cinematic DNA.
 *
 * Returns:
 *   JSX.Element: The Cinephile Profile section.
 */
export default function CinephileProfile() {
  const { rawData, enrichedData } = useData();
  const stats = useCinephileStats(rawData, enrichedData);
  const username = rawData?.profile?.username;

  // poster accents: 7 top genres (1 row)
  const topGenreFilms = useMemo(() => {
    if (!stats.genre.list.length || !enrichedData) return [];
    const enrichedByName = new Map(enrichedData.map((e) => [e.name, e]));
    const results = [];
    const top7Genres = stats.genre.list.slice(0, 7);

    for (const row of top7Genres) {
      for (const film of row.films) {
        const enriched = enrichedByName.get(film.name);
        if (enriched?.posterPath && !results.some((r) => r.name === enriched.name)) {
          results.push({
            name: enriched.name,
            year: enriched.year,
            posterPath: enriched.posterPath,
            caption: row.genre,
          });
          break;
        }
      }
      if (results.length >= 7) break;
    }
    return results;
  }, [stats.genre.list, enrichedData]);

  // poster accents: 7 top-rated international films from distinct countries (1 row)
  const internationalFilms = useMemo(() => {
    if (!enrichedData) return [];

    const candidates = enrichedData
      .filter((m) => {
        if (!m.posterPath || m.rating == null) return false;
        const isNonEnglish = m.originalLanguage && m.originalLanguage !== 'en';
        const isNonUSGB = m.productionCountries && !m.productionCountries.includes('US') && !m.productionCountries.includes('GB');
        return isNonEnglish || isNonUSGB;
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    const selected = [];
    const usedCountries = new Set();

    // Pass 1: Prioritize 1 film per distinct country
    for (const m of candidates) {
      const countryCode = m.productionCountries?.[0] || (m.originalLanguage ? m.originalLanguage.toUpperCase() : 'INT');
      if (!usedCountries.has(countryCode)) {
        usedCountries.add(countryCode);
        selected.push({ film: m, countryCode });
      }
      if (selected.length >= 7) break;
    }

    // Pass 2: Fill remaining slots up to 7 if fewer than 7 distinct countries found
    if (selected.length < 7) {
      for (const m of candidates) {
        if (!selected.some((s) => s.film.name === m.name)) {
          const countryCode = m.productionCountries?.[0] || (m.originalLanguage ? m.originalLanguage.toUpperCase() : 'INT');
          selected.push({ film: m, countryCode });
        }
        if (selected.length >= 7) break;
      }
    }

    return selected.map(({ film: m, countryCode }) => {
      const countryName = COUNTRY_NAMES[countryCode] || countryCode;
      return {
        name: m.name,
        year: m.year,
        posterPath: m.posterPath,
        caption: countryName,
      };
    });
  }, [enrichedData]);

  if (!stats.hasData) {
    return (
      <div className="cp-section">
        <header className="cp-header">
          <div className="cp-category-tag">Section 03 / Cinephile Profile</div>
          <h2 className="cp-title">Your cinematic DNA.</h2>
          <p className="cp-subtitle">Add some watches so we can work out who you are as a viewer.</p>
        </header>
      </div>
    );
  }

  const durationCorr = stats.duration;
  const eraCorr = stats.era;

  const durationVerdict = durationCorr.r >= 0.35
    ? `You tend to rate longer films higher (r = ${durationCorr.r.toFixed(2)})`
    : durationCorr.r <= -0.35
      ? `You tend to rate shorter films higher (r = ${durationCorr.r.toFixed(2)})`
      : `Runtime barely affects your scores (r = ${durationCorr.r.toFixed(2)})`;

  const eraVerdict = eraCorr.r >= 0.35
    ? `You tend to rate newer films higher (r = ${eraCorr.r.toFixed(2)})`
    : eraCorr.r <= -0.35
      ? `You tend to rate older films higher (r = ${eraCorr.r.toFixed(2)})`
      : `Release era barely affects your scores (r = ${eraCorr.r.toFixed(2)})`;

  return (
    <div className="cp-section">
      <header className="cp-header">
        <div className="cp-category-tag">Section 03 / Cinephile Profile</div>
        <h2 className="cp-title">
          {username ? (
            <>Your cinematic DNA, <span className="cp-username">@{username}</span>.</>
          ) : 'Your cinematic DNA.'}
        </h2>
        <p className="cp-subtitle">
          Who you are as a viewer. What you lean into, what you avoid, and how your taste has shifted over the years.
        </p>
      </header>

      <div className="cp-grid">
        {/* 01 — Cinephile spectrum bars */}
        <section className="cp-card cp-col-8" aria-label="Your cinephile spectrum">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent)' }}>
                <DnaIcon />
              </div>
              <div className="cp-card-label">Your Cinephile DNA</div>
            </div>
            <div className="cp-card-note">hover markers for calculation details</div>
          </div>
          <CinephileSpectrum axes={stats.spectrum} />
        </section>

        {/* 02 — Genre diversity score */}
        <section className="cp-card cp-col-4" aria-label="Genre diversity index">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <GenreIcon />
              </div>
              <div className="cp-card-label">Genre Diversity</div>
            </div>
          </div>
          <GenreDiversityCard genre={stats.genre} />
        </section>

        {/* 03 — Genre dotplot (full width) */}
        <section className="cp-card cp-col-12" aria-label="Genre distribution dotplot">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <GenreIcon />
              </div>
              <div className="cp-card-label">Genres, Ranked</div>
            </div>
            <div className="cp-card-note">hover dots for movie poster & details</div>
          </div>
          <GenreDotplot genre={stats.genre} />
        </section>

        {/* POSTER ACCENT — top genre picks */}
        {topGenreFilms.length > 0 && (
          <div className="cp-col-12">
            <PosterAccent films={topGenreFilms} title="Your highest-rated picks by genre" />
          </div>
        )}

        {/* 04 — Taste evolution */}
        <section className="cp-card cp-col-8" aria-label="Taste evolution">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-4)' }}>
                <TrendIcon />
              </div>
              <div className="cp-card-label">How Your Taste Evolved</div>
            </div>
            <div className="cp-card-note">average rating per year of watching</div>
          </div>
          <TasteEvolutionChart taste={stats.taste} />
        </section>

        {/* 05 — Genre reward card */}
        <section className="cp-card cp-col-4 cp-reward-card" aria-label="What you most reward">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <GenreIcon />
              </div>
              <div className="cp-card-label">Favourite / Least Favourite Genre</div>
            </div>
          </div>
          {(() => {
            const withAvg = stats.genre.list
              .map((row) => {
                const rated = row.films.filter((f) => f.rating != null);
                const avg = rated.length ? rated.reduce((s, f) => s + f.rating, 0) / rated.length : null;
                return { ...row, avg, ratedCount: rated.length };
              })
              .filter((r) => r.avg != null)
              .sort((a, b) => b.avg - a.avg);
            const top = withAvg[0];
            const bottom = withAvg[withAvg.length - 1];
            if (!top) return <p className="cp-chart-empty">Rate a few films to see which genre you reward most.</p>;
            return (
              <div className="cp-reward-gauge-wrap">
                <div className="cp-reward-block">
                  <ArcGauge
                    value={top.avg / 5}
                    subtext={`★ ${top.avg.toFixed(1)}`}
                    accent="--color-accent-3"
                    size={170}
                  />
                  <div className="cp-reward-info-side">
                    <span className="cp-reward-tag-label" style={{ color: 'var(--color-accent-3)' }}>
                      Highest avg
                    </span>
                    <span className="cp-reward-genre-title" title={top.genre}>{top.genre}</span>
                  </div>
                </div>

                {bottom && bottom.genre !== top.genre && (
                  <div className="cp-reward-block">
                    <ArcGauge
                      value={bottom.avg / 5}
                      subtext={`★ ${bottom.avg.toFixed(1)}`}
                      accent="--color-accent-warm"
                      size={170}
                    />
                    <div className="cp-reward-info-side">
                      <span className="cp-reward-tag-label" style={{ color: 'var(--color-accent-warm)' }}>
                        Lowest avg
                      </span>
                      <span className="cp-reward-genre-title" title={bottom.genre}>{bottom.genre}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        {/* 06 — Duration correlation */}
        <section className="cp-card cp-col-6" aria-label="Runtime vs your rating">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <ClockIcon />
              </div>
              <div className="cp-card-label">Long or Short Films</div>
            </div>
            <div className="cp-card-note">runtime (min) vs your rating scatter</div>
          </div>
          <TickDensityChart data={durationCorr} xLabel="Runtime" accent="var(--color-accent-3)" />
          <div className="cp-takeaway" style={{ '--accent': 'var(--color-accent-3)' }}>
            <span>{durationVerdict}</span>
          </div>
        </section>

        {/* 07 — Era correlation */}
        <section className="cp-card cp-col-6" aria-label="Release year vs your rating">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-4)' }}>
                <ClockIcon />
              </div>
              <div className="cp-card-label">Old or New Films</div>
            </div>
            <div className="cp-card-note">release year vs your rating scatter</div>
          </div>
          <TickDensityChart data={eraCorr} xLabel="Release year" accent="var(--color-accent-4)" />
          <div className="cp-takeaway" style={{ '--accent': 'var(--color-accent-4)' }}>
            <span>{eraVerdict}</span>
          </div>
        </section>

        {/* POSTER ACCENT — international films */}
        {internationalFilms.length > 0 && (
          <div className="cp-col-12">
            <PosterAccent films={internationalFilms} title="Some of your top-rated international films" />
          </div>
        )}

        {/* 08 — Diversity behind the camera */}
        <section className="cp-card cp-col-5" aria-label="Diversity behind the camera">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <LensIcon />
              </div>
              <div className="cp-card-label">Behind the Lens</div>
            </div>
          </div>
          <DiversityCard diversity={stats.diversity} />
          {stats.diversity.femaleInfo > 0 && (
            <p className="cp-index-copy">
              Based on {stats.diversity.femaleInfo} films with director data from TMDB.
            </p>
          )}
        </section>

        {/* 09 — World map */}
        <section className="cp-card cp-col-7" aria-label="World map of your films">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent)' }}>
                <GlobeIcon />
              </div>
              <div className="cp-card-label">Where Your Films Come From</div>
            </div>
            <div className="cp-card-note">Hover a country to see how many films from there you have watched.</div>
          </div>
          <WorldMapChart worldMap={stats.worldMap} />
        </section>
      </div>
    </div>
  );
}

