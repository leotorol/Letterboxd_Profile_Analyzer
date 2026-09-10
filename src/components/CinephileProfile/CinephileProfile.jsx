import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import { useData } from '../../context/DataContext';
import { useCinephileStats } from '../../hooks/useCinephileStats';
import './CinephileProfile.css';

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

// topojson numeric ids to ISO alpha-2 codes for the world map fills
const MAP_NUMERIC_TO_ALPHA2 = {
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

/**
 * Screen-reader fallback for the world map: a plain list of watched countries.
 *
 * Args:
 *   worldMap (Object): World map bundle with a byCountry Map.
 *
 * Returns:
 *   JSX.Element|null: Hidden country list, or null when empty.
 */
function WatchedCountryList({ worldMap }) {
  const rows = [...worldMap.byCountry.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <ul className="cp-sr-only" aria-label="Countries of the films you have watched">
      {rows.map(([code, count]) => (
        <li key={code}>
          {COUNTRY_NAMES[code] || code}: {count} {count === 1 ? 'film' : 'films'}
        </li>
      ))}
    </ul>
  );
}

/**
 * Inline SVG icons used across the section headers.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
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

/**
 * Genre bars section icon.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const GenreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="4" height="14" rx="1" />
    <rect x="10" y="6" width="4" height="11" rx="1" />
    <rect x="17" y="9" width="4" height="8" rx="1" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

/**
 * Trend line section icon.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const TrendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

/**
 * Clock section icon.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Globe section icon.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
const GlobeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

/**
 * Camera lens section icon.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
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
 * Floating dark tooltip with a film poster, title, meta line and rating.
 *
 * Shared by every chart that pops film details on hover, tap or keyboard focus.
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
function PosterTip({ film, sub, stackCount = 0, style }) {
  return (
    <div className="cp-tip cp-poster-tip" style={style}>
      <div className="cp-tip-film-card">
        {film.posterPath && (
          <img src={TMDB_POSTER_SMALL + film.posterPath} alt="" className="cp-tip-poster" />
        )}
        <div className="cp-tip-film-info">
          <span className="cp-tip-title">{film.name}</span>
          {sub && <span className="cp-tip-sub">{sub}</span>}
          <span className="cp-tip-rating">
            {film.rating != null ? `★ ${film.rating.toFixed(1)} / 5` : 'unrated'}
          </span>
          {stackCount > 1 && (
            <span className="cp-tip-stack-tag">+{stackCount - 1} more at this point</span>
          )}
        </div>
      </div>
    </div>
  );
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
      {axes.map((axis) => {
        const leftPct = axis.available ? axis.value * 100 : 50;
        const rightPct = 100 - leftPct;
        return (
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
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={axis.available ? Math.round(leftPct) : undefined}
                aria-valuetext={axis.available ? axis.pctLabel : 'no data'}
                aria-label={axis.key}
              >
                <div className="cp-spectrum-dual">
                  <div className="cp-spectrum-fill-left" style={{ transform: `scaleX(${(leftPct / 100).toFixed(4)})` }} />
                  <div className="cp-spectrum-fill-right" style={{ transform: `scaleX(${(rightPct / 100).toFixed(4)})` }} />
                </div>
                {axis.available && (
                  <>
                    <div
                      className={`cp-spectrum-marker ${hoverKey === axis.key ? 'is-active' : ''}`}
                      style={{ left: `${axis.value * 100}%` }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Details for ${axis.key}`}
                      aria-expanded={hoverKey === axis.key}
                      onPointerEnter={() => setHoverKey(axis.key)}
                      onPointerLeave={() => setHoverKey(null)}
                      onFocus={() => setHoverKey(axis.key)}
                      onBlur={() => setHoverKey(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setHoverKey((prev) => (prev === axis.key ? null : axis.key));
                        }
                      }}
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
        );
      })}
    </div>
  );
}

// Palette for genre arc segments: ordered for visual variety
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
 * Genre Fingerprint Card: radial donut of top genres.
 *
 * Args:
 *   genre (Object): Genre stats bundle.
 *
 * Returns:
 *   JSX.Element: Radial arc genre fingerprint widget.
 */
function GenreDiversityCard({ genre }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [pinnedIdx, setPinnedIdx] = useState(null);

  // what the tooltip centre label shows: pin (tap) wins over hover
  const activeIdx = hoveredIdx ?? pinnedIdx;
  const toggleIdx = (idx) => setPinnedIdx((prev) => (prev === idx ? null : idx));

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
  const segments = [
    ...top.map((r, i) => ({ label: r.genre, count: r.count, color: GENRE_ARC_PALETTE[i] })),
    ...(otherCount > 0 ? [{ label: 'Other', count: otherCount, color: 'rgba(255,255,255,0.1)' }] : []),
  ];
  const grandTotal = segments.reduce((s, seg) => s + seg.count, 0);

  // degenerate: nothing left after filtering
  if (grandTotal === 0) {
    return <p className="cp-chart-empty">Not enough genre data to display.</p>;
  }

  // SVG donut params
  const CX = 80; const CY = 80;
  const R_OUTER = 66; const R_INNER = 44;
  // a 360° arc path degenerates, so only gap when there are multiple segments
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
              style={{ cursor: hoveredIdx != null ? 'default' : 'pointer' }}
              onPointerEnter={() => setHoveredIdx(0)}
              onPointerLeave={() => setHoveredIdx(null)}
              onClick={() => toggleIdx(0)}
            />
          ) : (
            arcs.map((arc) => (
              <path
                key={arc.idx}
                d={arcPath(arc.start, arc.end, R_OUTER, R_INNER)}
                fill={arc.color}
                opacity={activeIdx === null ? 1 : activeIdx === arc.idx ? 1 : 0.35}
                style={{ transition: 'opacity 150ms ease', cursor: 'pointer' }}
                onPointerEnter={() => setHoveredIdx(arc.idx)}
                onPointerLeave={() => setHoveredIdx(null)}
                onClick={() => toggleIdx(arc.idx)}
              />
            ))
          )}
          {/* center label */}
          {activeIdx !== null ? (
            <>
              <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-num">
                {safePct(arcs[activeIdx].count, genre.total)}%
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="middle" className="cp-gfp-center-lbl">
                {arcs[activeIdx].label.length > 10 ? arcs[activeIdx].label.slice(0, 9) + '…' : arcs[activeIdx].label}
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
        {arcs.slice(0, arcs.length > 6 ? 6 : arcs.length).map((arc) => (
          <button
            key={arc.idx}
            type="button"
            className={`cp-gfp-legend-row${activeIdx === arc.idx ? ' is-active' : ''}`}
            onPointerEnter={() => setHoveredIdx(arc.idx)}
            onPointerLeave={() => setHoveredIdx(null)}
            onFocus={() => setHoveredIdx(arc.idx)}
            onBlur={() => setHoveredIdx(null)}
            onClick={() => toggleIdx(arc.idx)}
            aria-pressed={pinnedIdx === arc.idx}
            aria-label={`${arc.label}: ${safePct(arc.count, genre.total)}%`}
          >
            <span className="cp-gfp-legend-dot" style={{ background: arc.color }} />
            <span className="cp-gfp-legend-name">{arc.label}</span>
            <span className="cp-gfp-legend-pct tabular-nums">
              {safePct(arc.count, genre.total)}%
            </span>
          </button>
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
  const [pinned, setPinned] = useState(null);

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

  const makeTip = (film, genreName, node) => ({
    type: 'film', film, genre: genreName, ...positionFrom(node),
  });
  // tap the same dot twice and the pinned tip dies
  const activate = (film, genreName, node) => (
    pinned?.film?.name === film.name && pinned?.genre === genreName
      ? setPinned(null)
      : setPinned(makeTip(film, genreName, node))
  );
  const rowKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const wrap = containerRef.current;
    if (!wrap) return;
    const dots = wrap.querySelectorAll('.cp-dotplot-dot');
    if (!dots.length) return;
    const cur = dots.length && Array.prototype.indexOf.call(dots, wrap.ownerDocument.activeElement);
    const next = cur === -1 ? 0 : (cur + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + dots.length) % dots.length;
    const node = dots[next];
    node.focus();
    setHover(makeTip(nodeFilm(node, visibleGenres), nodeGenre(node, visibleGenres), node));
  };

  const activeTip = hover || pinned;

  return (
    <div className="cp-dotplot" ref={containerRef} onPointerLeave={() => { if (!pinned) setHover(null); }}>
      <div
        className="cp-dotplot-columns"
        tabIndex={0}
        aria-label="Genre dotplot; each dot is a film, use arrow keys to move between dots"
        onKeyDown={rowKeyDown}
      >
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
                      <button
                        key={i}
                        type="button"
                        tabIndex={-1}
                        data-film={film.name}
                        data-genre={row.genre}
                        className="cp-dotplot-dot"
                        aria-label={`${film.name}${film.rating != null ? `, rated ${film.rating.toFixed(1)} out of 5` : ', unrated'}`}
                        style={{
                          background: ratingColor(film.rating),
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          position: 'absolute',
                        }}
                        onPointerEnter={(e) => {
                          e.stopPropagation();
                          setHover(makeTip(film, row.genre, e.currentTarget));
                        }}
                        onFocus={(e) => setHover(makeTip(film, row.genre, e.currentTarget))}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          activate(film, row.genre, e.currentTarget);
                        }}
                        onClick={(e) => activate(film, row.genre, e.currentTarget)}
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

      {activeTip && (
        <PosterTip
          film={activeTip.film}
          sub={`${activeTip.film.year ? `${activeTip.film.year} • ` : ''}${activeTip.genre}`}
          style={{ left: activeTip.x, top: activeTip.y }}
        />
      )}
    </div>
  );
}

/**
 * Digs the film data back out of a dot element for keyboard navigation.
 *
 * Args:
 *   node (HTMLElement): Dot element carrying data-film and data-genre.
 *   list (Array<Object>): Visible genre rows.
 *
 * Returns:
 *   Object: The matching film, or a minimal fallback with just its name.
 */
function nodeFilm(node, list) {
  const genreName = node.dataset.genre;
  const row = list.find((r) => r.genre === genreName);
  return row?.films.find((f) => f.name === node.dataset.film) || { name: node.dataset.film };
}

/**
 * Reads the genre name off a dot element.
 *
 * Args:
 *   node (HTMLElement): Dot element carrying data-genre.
 *   list (Array<Object>): Visible genre rows used as fallback.
 *
 * Returns:
 *   string: Genre name for the node.
 */
function nodeGenre(node, list) {
  return node.dataset.genre || list[0]?.genre || '';
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
        <span className="cp-verdict-dot" />
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
/**
 * Static layer of every scatter dot, memoised so hover never re-reconciles them.
 *
 * Args:
 *   points (Array<Object>): Scatter points with x, y and name.
 *   xs (Function): x scale mapper.
 *   ys (Function): y scale mapper.
 *
 * Returns:
 *   JSX.Element: Fragment of scatter circles.
 */
const ScatterPoints = memo(function ScatterPoints({ points, xs, ys }) {
  return (
    <>
      {points.map((point, i) => (
        <circle
          key={`${point.name}-${i}`}
          className="cp-scatter-dot"
          cx={xs(point.x)}
          cy={ys(point.y)}
          r={3.5}
          style={{ fill: ratingColor(point.y) }}
        />
      ))}
    </>
  );
});

function TickDensityChart({ data, xLabel, accent }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const containerRef = useRef(null);
  const kIdxRef = useRef(-1);

  const W = 560;
  const H = 200;
  const padL = 46;
  const padR = 16;
  const padT = 12;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // one pass: scales, average line and a spatial grid so hover lookups touch 9 cells instead of every film
  const { xs, ys, xspan, linePath, xTicks, grid } = useMemo(() => {
    const span = (data.xMax - data.xMin) || 1;
    const toX = (x) => padL + ((x - data.xMin) / span) * plotW;
    const toY = (rating) => padT + plotH * (1 - rating / 5);

    const localBins = Array.from({ length: 40 }, () => ({ sum: 0, count: 0 }));
    for (const point of data.points) {
      const binIdx = Math.min(39, Math.max(0, Math.floor(((point.x - data.xMin) / span) * 40)));
      localBins[binIdx].sum += point.y;
      localBins[binIdx].count++;
    }
    const avgLine = localBins
      .map((bin, i) => {
        if (bin.count === 0) return null;
        const x = data.xMin + (i / 40) * span + span / 40 / 2;
        const y = bin.sum / bin.count;
        return { x, y };
      })
      .filter(Boolean);

    const localLinePath = avgLine.length > 1
      ? avgLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ')
      : null;

    const CELL = 40;
    const cells = new Map();
    data.points.forEach((p, i) => {
      const key = `${Math.floor(toX(p.x) / CELL)},${Math.floor(toY(p.y) / CELL)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ p, i });
    });

    const xTickCount = 6;
    return {
      xs: toX,
      ys: toY,
      xspan: span,
      linePath: localLinePath,
      xTicks: Array.from({ length: xTickCount }, (_, i) => data.xMin + (span * i) / (xTickCount - 1)),
      grid: { cells, CELL },
    };
  }, [data, padL, plotW, plotH, padT]);

  const pick = (clientX, clientY) => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    const mouseSvgX = ((clientX - rect.left) / rect.width) * W;
    const mouseSvgY = ((clientY - rect.top) / rect.height) * H;
    const cx = Math.floor(mouseSvgX / grid.CELL);
    const cy = Math.floor(mouseSvgY / grid.CELL);
    let best = null;
    let minDist = Infinity;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = grid.cells.get(`${gx},${gy}`);
        if (!bucket) continue;
        for (const { p, i } of bucket) {
          const d = Math.hypot(xs(p.x) - mouseSvgX, ys(p.y) - mouseSvgY);
          if (d < minDist) {
            minDist = d;
            best = { ...p, i };
          }
        }
      }
    }
    if (best && minDist < 30) {
      const stack = data.points.filter((pt) => Math.abs(pt.x - best.x) < (xspan * 0.01) && Math.abs(pt.y - best.y) < 0.2);
      return { ...best, stackCount: stack.length };
    }
    return null;
  };

  // points ordered by x so arrow keys can walk the chart left to right
  const sortedPoints = useMemo(
    () => data.points.map((p, i) => ({ p, i })).sort((a, b) => a.p.x - b.p.x),
    [data],
  );
  const focusKIdx = (idx) => {
    if (idx < 0 || idx >= sortedPoints.length) return;
    kIdxRef.current = idx;
    const { p } = sortedPoints[idx];
    const stack = data.points.filter((pt) => Math.abs(pt.x - p.x) < (xspan * 0.01) && Math.abs(pt.y - p.y) < 0.2);
    setPinned({ ...p, stackCount: stack.length });
  };

  const setPinnedFrom = (entry) => {
    setPinned((prev) => (prev?.name === entry?.name ? null : entry));
  };

  if (data.count === 0) {
    return <p className="cp-chart-empty">Not enough rated data to plot this correlation.</p>;
  }

  const tip = hover || pinned;

  return (
    <div className="cp-tick-chart" ref={containerRef}>
      <svg
        className="cp-chart-svg"
        tabIndex={0}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${xLabel} vs your rating; arrow keys move between films`}
        onPointerMove={(e) => {
          const found = pick(e.clientX, e.clientY);
          setHover(found);
        }}
        onPointerDown={(e) => {
          const found = pick(e.clientX, e.clientY);
          if (found) setPinnedFrom(found);
          else setPinned(null);
        }}
        onPointerLeave={() => {
          if (!pinned) setHover(null);
        }}
        onFocus={() => focusKIdx(0)}
        onBlur={() => {
          kIdxRef.current = -1;
          setPinned(null);
        }}
        onKeyDown={(e) => {
          const cur = kIdxRef.current;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') focusKIdx(cur + 1);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') focusKIdx(cur <= 0 ? 0 : cur - 1);
        }}
      >
        {xTicks.map((tick) => (
          <g key={tick}>
            <line className="cp-chart-tick" x1={xs(tick)} y1={padT + plotH} x2={xs(tick)} y2={padT + plotH + 5} />
            <text className="cp-chart-year" x={xs(tick)} y={H - 8} textAnchor="middle">{Math.round(tick)}</text>
          </g>
        ))}
        <line className="cp-tick-baseline" x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} />

        <ScatterPoints points={data.points} xs={xs} ys={ys} />

        {tip && (
          <circle
            className="cp-scatter-ring"
            cx={xs(tip.x)}
            cy={ys(tip.y)}
            r={7}
          />
        )}

        {linePath && <path className="cp-tick-avg-line" d={linePath} style={{ stroke: accent }} />}
      </svg>

      {tip && (
        <PosterTip
          film={{ name: tip.name, year: tip.year, rating: tip.y, posterPath: tip.posterPath }}
          sub={`${tip.year ? `${tip.year} • ` : ''}${Math.round(tip.x)}${xLabel.toLowerCase() === 'runtime' ? ' min' : ''}`}
          stackCount={tip.stackCount}
          style={{
            left: `${(xs(tip.x) / W) * 100}%`,
            top: `${(ys(tip.y) / H) * 100}%`,
          }}
        />
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
function ArcGauge({ value, label, accent, subtext, size, colorOverride }) {
  const R = 38;
  const cx = 54;
  const cy = 54;
  const circumference = 2 * Math.PI * R;
  const fill = value != null ? circumference * Math.min(Math.max(value, 0), 1) : 0;
  const svgStyle = size ? { width: `${size}px`, height: `${size}px` } : undefined;
  const strokeColor = colorOverride || (accent ? `var(${accent})` : 'var(--color-accent)');

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
          style={{ stroke: strokeColor }}
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
 * Highest and lowest average rated genres, shown as arc gauges.
 *
 * Args:
 *   reward (Object): `{ top, bottom }` genre rows from the stats hook.
 *
 * Returns:
 *   JSX.Element: Genre reward gauges, or an empty hint when nothing is rated.
 */
function GenreRewardCard({ reward }) {
  const { top, bottom } = reward;
  if (!top) {
    return <p className="cp-chart-empty">Rate a few films to see which genre you reward most.</p>;
  }

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
  const topDirectors = diversity.topDirectors || [];
  const maxCount = topDirectors.length > 0 ? topDirectors[0].count : 1;

  const barColors = [
    'var(--color-lb-green)',
    'var(--color-lb-blue)',
    'var(--color-lb-orange)',
    'var(--color-accent-2)',
    'var(--color-accent-3)',
  ];

  return (
    <div className="cp-diversity-enhanced">
      <div className="cp-diversity-gauges">
        <ArcGauge
          value={diversity.femaleShare}
          label="Female directed"
          colorOverride="var(--color-lb-green)"
        />
        <ArcGauge
          value={diversity.directorLoyaltyShare}
          label="Director Loyalty"
          colorOverride="var(--color-lb-blue)"
        />
      </div>

      {topDirectors.length > 0 && (
        <div className="cp-director-spotlight">
          <div className="cp-director-header">
            <span className="cp-director-title">Top Directors</span>
            <span className="cp-director-sub tabular-nums">Films watched</span>
          </div>

          <div className="cp-barchart-container">
            <div className="cp-barchart-grid">
              <div className="cp-barchart-grid-line" style={{ left: '0%' }} />
              <div className="cp-barchart-grid-line" style={{ left: '25%' }} />
              <div className="cp-barchart-grid-line" style={{ left: '50%' }} />
              <div className="cp-barchart-grid-line" style={{ left: '75%' }} />
              <div className="cp-barchart-grid-line" style={{ left: '100%' }} />
            </div>

            <div className="cp-barchart-rows">
              {topDirectors.map((d, i) => {
                const color = barColors[i % barColors.length];
                return (
                  <div key={d.name || i} className="cp-barchart-row">
                    <div className="cp-barchart-label-col">
                      <span className="cp-barchart-name" title={d.name}>{d.name}</span>
                    </div>
                    <div className="cp-barchart-bar-col">
                      <div className="cp-barchart-track">
                        <div
                          className="cp-barchart-fill"
                          style={{
                            // keep a floor so a director with a single film doesn't render as an invisible sliver
                            transform: `scaleX(${Math.max(0.1, d.count / maxCount).toFixed(4)})`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                    <div className="cp-barchart-value-col tabular-nums">
                      <span className="cp-barchart-count">{d.count}</span>
                      {d.avgRating != null && (
                        <span className="cp-barchart-rating">★ {d.avgRating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
const MAP_W = 960;
const MAP_H = 480;
const LAT_MAX = 84;
const LAT_MIN = -58;

/**
 * Miller Cylindrical projection latitude transform.
 *
 * Keeps high latitude countries such as the Nordics, UK and Russia from
 * getting squashed by a plain equirectangular map.
 *
 * Args:
 *   lat (number): Latitude in degrees.
 *
 * Returns:
 *   number: Projected y in Miller space.
 */
function millerY(lat) {
  const latRad = (Math.max(LAT_MIN, Math.min(LAT_MAX, lat)) * Math.PI) / 180;
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latRad));
}

const MAP_Y_MIN = millerY(LAT_MIN);
const MAP_Y_MAX = millerY(LAT_MAX);

/**
 * Projects a longitude/latitude pair onto the SVG viewport.
 *
 * Args:
 *   coords (Array<number>): `[lng, lat]` in degrees.
 *
 * Returns:
 *   Array<number>: `[x, y]` in viewport units.
 */
function project([lng, lat]) {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((MAP_Y_MAX - millerY(lat)) / (MAP_Y_MAX - MAP_Y_MIN)) * MAP_H;
  return [x, y];
}

/**
 * Unwraps polygon ring longitudes so there are no >180 deg jumps across the anti-meridian.
 *
 * Args:
 *   ring (Array<Array<number>>): GeoJSON ring of `[lng, lat]` pairs.
 *
 * Returns:
 *   Array<Array<number>>: Unwrapped ring with continuous longitudes.
 */
function unwrapRing(ring) {
  const unwrapped = [ring[0]];
  let prevLng = ring[0][0];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0] + offset;
    const diff = lng - prevLng;
    if (diff > 180) {
      offset -= 360;
      lng -= 360;
    } else if (diff < -180) {
      offset += 360;
      lng += 360;
    }
    unwrapped.push([lng, ring[i][1]]);
    prevLng = lng;
  }
  return unwrapped;
}

/**
 * Converts one projected ring into a closed SVG path string.
 *
 * Args:
 *   ring (Array<Array<number>>): Unwrapped ring of `[lng, lat]` pairs.
 *
 * Returns:
 *   string: SVG path data for the ring.
 */
function ringToPath(ring) {
  return ring.map((pt, i) => {
    const [x, y] = project(pt);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

/**
 * Converts GeoJSON geometry to SVG path with anti-meridian unwrapping.
 * Prevents straight line artifacts across Japan / Asia while maintaining closed country polygons.
 * holy shit don't touch the unwrap logic, it's what keeps Japan from growing a tail to Hawaii
 */
function geometryToPath(geometry) {
  if (!geometry) return '';
  const rawRings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat(1)
      : [];

  const pathParts = [];
  for (const rawRing of rawRings) {
    if (!rawRing || rawRing.length === 0) continue;
    const ring = unwrapRing(rawRing);
    pathParts.push(ringToPath(ring));

    const minLng = Math.min(...ring.map((p) => p[0]));
    const maxLng = Math.max(...ring.map((p) => p[0]));

    if (maxLng > 180) {
      const shiftedLeft = ring.map(([lng, lat]) => [lng - 360, lat]);
      pathParts.push(ringToPath(shiftedLeft));
    }
    if (minLng < -180) {
      const shiftedRight = ring.map(([lng, lat]) => [lng + 360, lat]);
      pathParts.push(ringToPath(shiftedRight));
    }
  }
  return pathParts.join(' ');
}

/**
 * Memoised SVG body that only re-renders when geometry or fill data changes.
 *
 * Hover state lives in the parent so pointer moves never touch this subtree.
 *
 * Args:
 *   paths (Array<Object>): Country paths with id and path data.
 *   fillById (Map): Numeric country id to fill colour.
 *   onCountryEnter (Function): Pointer enter handler.
 *   onCountryLeave (Function): Pointer leave handler.
 *   onCountryPick (Function): Pointer down handler.
 *
 * Returns:
 *   JSX.Element: The map SVG.
 */
const MapBody = memo(function MapBody({ paths, fillById, onCountryEnter, onCountryLeave, onCountryPick }) {
  return (
    <svg
      className="cp-map-svg"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      role="img"
      aria-label="World map showing countries your films come from"
    >
      {paths.map((path) => {
        const alpha2 = MAP_NUMERIC_TO_ALPHA2[path.id];
        const fill = alpha2 ? fillById.get(path.id) || 'var(--color-map-idle)' : 'var(--color-map-idle)';
        const hasFilms = alpha2 && fillById.has(path.id);
        return (
          <path
            key={path.id}
            d={path.d}
            className={`cp-map-country${hasFilms ? ' has-films' : ''}`}
            style={{ fill }}
            onPointerEnter={(e) => onCountryEnter(e, path.id)}
            onPointerLeave={(e) => onCountryLeave(e, path.id)}
            onPointerDown={(e) => onCountryPick(e, path.id)}
          />
        );
      })}
    </svg>
  );
});

/**
 * Interactive world map whose countries light up by how many films you watched from them.
 *
 * Loads the world-atlas topology lazily, projects it and handles hover, tap and
 * keyboard interactions plus a screen-reader fallback list.
 *
 * Args:
 *   worldMap (Object): World map bundle from the stats hook.
 *
 * Returns:
 *   JSX.Element: The world map block.
 */
function WorldMapChart({ worldMap }) {
  const [geoData, setGeoData] = useState(null);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    import('world-atlas/countries-110m.json').then((mod) => {
      const topo = mod.default || mod;
      const countries = feature(topo, topo.objects.countries);
      setGeoData(countries);
    }).catch((err) => {
      // swallow it in prod, devs get the yelling
      if (import.meta.env.DEV) console.warn('WorldMapChart: failed to load world-atlas data', err);
    });
  }, []);

  const paths = useMemo(() => {
    if (!geoData) return [];
    return geoData.features
      .filter((f) => Number(f.id) !== 10)
      .map((f) => ({
        id: String(f.id).padStart(3, '0'),
        d: geometryToPath(f.geometry),
      }));
  }, [geoData]);

  const fillById = useMemo(() => {
    const map = new Map();
    if (worldMap.maxCount <= 0) return map;
    for (const [alpha2, count] of worldMap.byCountry) {
      if (count === 0) continue;
      const intensity = Math.log(count + 1) / Math.log(worldMap.maxCount + 1);
      const opacity = 0.25 + intensity * 0.75;
      for (const [numericId, code] of Object.entries(MAP_NUMERIC_TO_ALPHA2)) {
        if (code === alpha2) map.set(numericId, `rgba(0, 232, 122, ${opacity.toFixed(2)})`);
      }
    }
    return map;
  }, [worldMap]);

  const countryName = (id) => {
    const alpha2 = MAP_NUMERIC_TO_ALPHA2[id];
    return (alpha2 && COUNTRY_NAMES[alpha2]) || alpha2 || `Country ${id}`;
  };

  const handleCountryEnter = useCallback((e, id) => {
    const count = worldMap.byCountry.get(MAP_NUMERIC_TO_ALPHA2[id]) || 0;
    if (!count || !containerRef.current) {
      setHover(null);
      return;
    }
    const wrapRect = containerRef.current.getBoundingClientRect();
    setHover({
      name: countryName(id),
      count,
      alpha2: MAP_NUMERIC_TO_ALPHA2[id],
      x: e.clientX - wrapRect.left,
      y: e.clientY - wrapRect.top,
    });
  }, [worldMap]);

  const handleCountryLeave = useCallback(() => {
    setHover(null);
  }, []);

  const handleCountryPick = useCallback((e, id) => {
    const alpha2 = MAP_NUMERIC_TO_ALPHA2[id];
    const count = worldMap.byCountry.get(alpha2) || 0;
    if (!count || !containerRef.current) return;
    e.stopPropagation();
    setPinned((prev) => {
      if (prev?.alpha2 === alpha2) return null;
      const wrapRect = containerRef.current.getBoundingClientRect();
      return {
        name: countryName(id),
        count,
        alpha2,
        x: e.clientX - wrapRect.left,
        y: e.clientY - wrapRect.top,
      };
    });
  }, [worldMap]);

  const handleWrapPointerDown = useCallback(() => setPinned(null), []);

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

  const tip = hover || pinned;

  return (
    <div
      className="cp-map-wrap"
      ref={containerRef}
      onPointerLeave={handleCountryLeave}
      onPointerDown={handleWrapPointerDown}
    >
      <MapBody
        paths={paths}
        fillById={fillById}
        onCountryEnter={handleCountryEnter}
        onCountryLeave={handleCountryLeave}
        onCountryPick={handleCountryPick}
      />

      <WatchedCountryList worldMap={worldMap} />

      {tip && (
        <div
          className="cp-map-tip"
          style={{
            transform: `translate3d(${tip.x}px, ${tip.y}px, 0) translate(-50%, -120%)`,
          }}
        >
          <span className="cp-map-tip-country">{tip.name}</span>
          <div className="cp-map-tip-badge">
            <span className="cp-map-tip-count tabular-nums">
              {tip.count} {tip.count === 1 ? 'film' : 'films'}
            </span>
            {worldMap.totalWatched > 0 && (
              <span className="cp-map-tip-pct tabular-nums">
                {((tip.count / worldMap.totalWatched) * 100).toFixed(1)}%
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
  const stats = useCinephileStats(enrichedData);
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

  const loyaltyPct = stats.diversity.directorLoyaltyShare != null
    ? Math.round(stats.diversity.directorLoyaltyShare * 100)
    : null;
  const directorSampleCount = stats.diversity.totalWithDirectors || stats.diversity.femaleInfo;

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
        {/* 01: Cinephile spectrum bars */}
        <section className="cp-card cp-col-8" aria-label="Your cinephile spectrum">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent)' }}>
                <DnaIcon />
              </div>
              <div className="cp-card-label">Your Cinephile DNA</div>
            </div>
            <div className="cp-card-note">hover or focus the markers for the calculation details</div>
          </div>
          <CinephileSpectrum axes={stats.spectrum} />
        </section>

        {/* 02: Genre diversity score */}
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

        {/* 03: Genre dotplot (full width) */}
        <section className="cp-card cp-col-12" aria-label="Genre distribution dotplot">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <GenreIcon />
              </div>
              <div className="cp-card-label">Genres, Ranked</div>
            </div>
            <div className="cp-card-note">Hover or tap the dots for movie poster & details</div>
          </div>
          <GenreDotplot genre={stats.genre} />
        </section>

        {/* POSTER ACCENT: top genre picks */}
        {topGenreFilms.length > 0 && (
          <div className="cp-col-12">
            <PosterAccent films={topGenreFilms} title="Your highest-rated picks by genre" />
          </div>
        )}

        {/* 04: Taste evolution */}
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

        {/* 05: Genre reward card */}
        <section className="cp-card cp-col-4 cp-reward-card" aria-label="What you most reward">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <GenreIcon />
              </div>
              <div className="cp-card-label">Favourite / Least Favourite Genre</div>
            </div>
          </div>
          <GenreRewardCard reward={stats.genreReward} />
        </section>

        {/* 06: Duration correlation */}
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
            <span className="cp-takeaway-dot" />
            <span>{durationVerdict}</span>
          </div>
        </section>

        {/* 07: Era correlation */}
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
            <span className="cp-takeaway-dot" />
            <span>{eraVerdict}</span>
          </div>
        </section>

        {/* POSTER ACCENT: international films */}
        {internationalFilms.length > 0 && (
          <div className="cp-col-12">
            <PosterAccent films={internationalFilms} title="Some of your top-rated international films" />
          </div>
        )}

        {/* 08: Diversity behind the camera */}
        <section className="cp-card cp-col-4" aria-label="Diversity behind the camera">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <LensIcon />
              </div>
              <div className="cp-card-label">Behind the Lens</div>
            </div>
          </div>
          <DiversityCard diversity={stats.diversity} />
          {directorSampleCount > 0 && (
            <div className="cp-takeaway" style={{ '--accent': 'var(--color-accent-2)' }}>
              <span>
                {loyaltyPct != null
                  ? `Director Loyalty: ${loyaltyPct}% of your watches are from directors you've returned to 2+ times (based on ${directorSampleCount.toLocaleString()} films with director data).`
                  : `Based on ${directorSampleCount.toLocaleString()} films with director data from TMDB.`}
              </span>
            </div>
          )}
        </section>

        {/* 09: World map */}
        <section className="cp-card cp-col-8" aria-label="World map of your films">
          <div className="cp-card-head">
            <div className="cp-card-title-group">
              <div className="cp-card-icon" style={{ color: 'var(--color-accent)' }}>
                <GlobeIcon />
              </div>
              <div className="cp-card-label">Where Your Films Come From</div>
            </div>
            <div className="cp-card-note">hover, tap or keyboard a country to see how many films from there you have watched.</div>
          </div>
          <WorldMapChart worldMap={stats.worldMap} />
        </section>
      </div>
    </div>
  );
}

