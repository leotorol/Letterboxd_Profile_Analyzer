import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useWatchlistStats, formatAge } from '../../hooks/useWatchlistStats';
import { formatIsoDate } from '../../utils/dateFormat';
import './Watchlist.css';

/*
 * Section 07 contract
 * THESIS: the watchlist is the shadow side of everything before it. Those
 *   sections read your past; this one reads what you still owe yourself.
 * OWN-WORLD: same dark bento, Letterboxd orange as section accent, graveyard
 *   posters desaturated, area chart in warm red vs green.
 * STORY: user sees the oldest neglected films, whether they are gaining or
 *   losing ground, and how long a movie waits on average.
 * FIRST VIEWPORT: full width graveyard card with faded posters and age badges.
 * FORM: local extension of the established world, no new identity.
 */

// SVG icons owned by this section

const SkullIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="8" />
    <path d="M12 18v4" />
    <path d="M8 22h8" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <path d="M10 15h4" />
  </svg>
);

const TrendIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 8 14 12" />
    <path d="M18 8v14" />
    <polyline points="2 12 6 16 10 12" />
    <path d="M6 16V2" />
  </svg>
);

const ClockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// chart geometry for the growth area chart
const CHART_W = 700;
const CHART_H = 260;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 24;
const PAD_B = 40;

/**
 * Area chart overlaying monthly watchlist additions vs films watched.
 *
 * Two translucent areas with a crisp line on top. Warm red for additions,
 * green for watches. The user reads which area dominates to understand
 * whether they are gaining or losing ground. Hover shows the exact numbers.
 *
 * Args:
 *   series (Array<Object>): Monthly data points from the hook.
 *
 * Returns:
 *   JSX.Element: The growth chart body.
 */
function GrowthChart({ series }) {
  const [hover, setHover] = useState(null);

  const chart = useMemo(() => {
    if (series.length < 2) return null;

    // only show the last 24 months so the chart isn't a wall of noise
    const maxPoints = 24;
    const trimmed = series.length > maxPoints ? series.slice(-maxPoints) : series;

    const plotW = CHART_W - PAD_L - PAD_R;
    const plotH = CHART_H - PAD_T - PAD_B;
    const n = trimmed.length;

    const rawMax = Math.max(1, ...trimmed.map(p => Math.max(p.added, p.watched)));
    const step = rawMax <= 5 ? 1 : rawMax <= 15 ? 3 : rawMax <= 30 ? 5 : 10;
    const yMax = Math.ceil(rawMax / step) * step;

    const xAt = (i) => PAD_L + (i / (n - 1)) * plotW;
    const yAt = (v) => PAD_T + (1 - v / yMax) * plotH;
    const baseline = yAt(0);

    // build area and line path strings for both series
    const buildPaths = (key) => {
      const linePoints = trimmed.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`);
      const line = `M ${linePoints.join(' L ')}`;
      const area = `M ${PAD_L},${baseline} L ${linePoints.join(' L ')} L ${xAt(n - 1).toFixed(1)},${baseline} Z`;
      return { line, area };
    };

    const added = buildPaths('added');
    const watched = buildPaths('watched');

    const ticks = [];
    for (let v = 0; v <= yMax; v += step) ticks.push(v);

    // year labels for the x axis, only show where the year actually changes
    const yearLabels = [];
    let lastYear = null;
    trimmed.forEach((p, i) => {
      if (p.year !== lastYear) {
        yearLabels.push({ x: xAt(i), label: String(p.year) });
        lastYear = p.year;
      }
    });

    return { trimmed, plotW, n, yMax, xAt, yAt, baseline, added, watched, ticks, yearLabels };
  }, [series]);

  if (!chart) {
    return <p className="wl-empty">Not enough data to chart the growth trend yet.</p>;
  }

  const { trimmed, n, xAt, yAt, baseline, ticks, yearLabels } = chart;
  const slotW = (CHART_W - PAD_L - PAD_R) / n;

  return (
    <div className="wl-growth" style={{ position: 'relative' }}>
      <svg
        className="wl-growth-svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Watchlist additions vs films watched per month"
      >
        {/* y-axis grid + labels */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="wl-growth-grid" x1={PAD_L} y1={yAt(tick)} x2={CHART_W - PAD_R} y2={yAt(tick)} />
            <text className="wl-growth-axis" x={PAD_L - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle">
              {tick}
            </text>
          </g>
        ))}

        {/* x-axis year labels */}
        {yearLabels.map((yl) => (
          <text key={yl.label + yl.x} className="wl-growth-axis" x={yl.x} y={CHART_H - 10} textAnchor="start">
            {yl.label}
          </text>
        ))}

        {/* areas (painted first so the lines sit on top) */}
        <path className="wl-growth-area-added" d={chart.added.area} />
        <path className="wl-growth-area-watched" d={chart.watched.area} />

        {/* lines */}
        <path className="wl-growth-line-added" d={chart.added.line} />
        <path className="wl-growth-line-watched" d={chart.watched.line} />

        {/* invisible hit rects for hover */}
        {trimmed.map((point, i) => (
          <rect
            key={i}
            className="wl-growth-hit"
            x={xAt(i) - slotW / 2}
            y={PAD_T}
            width={slotW}
            height={baseline - PAD_T}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}

        {/* hover column highlight */}
        {hover != null && (
          <line
            x1={xAt(hover)}
            y1={PAD_T}
            x2={xAt(hover)}
            y2={baseline}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
      </svg>

      {hover != null && trimmed[hover] && (
        <div className="wl-growth-tip" style={{ '--tip-x': `${(xAt(hover) / CHART_W) * 100}%` }}>
          <span className="wl-growth-tip-month">{trimmed[hover].label}</span>
          <span className="wl-growth-tip-row">
            <span className="wl-growth-tip-dot" style={{ background: 'var(--color-accent-warm)' }} />
            <span className="wl-growth-tip-val tabular-nums">{trimmed[hover].added}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>added</span>
          </span>
          <span className="wl-growth-tip-row">
            <span className="wl-growth-tip-dot" style={{ background: 'var(--color-lb-green)' }} />
            <span className="wl-growth-tip-val tabular-nums">{trimmed[hover].watched}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>watched</span>
          </span>
        </div>
      )}

      <div className="wl-growth-legend" aria-hidden="true">
        <span className="wl-growth-legend-item">
          <span className="wl-growth-legend-swatch is-added" />
          added to watchlist
        </span>
        <span className="wl-growth-legend-item">
          <span className="wl-growth-legend-swatch is-watched" />
          films watched
        </span>
      </div>
    </div>
  );
}

/**
 * Graveyard card: the oldest films still sitting in the watchlist.
 *
 * Posters are desaturated to look dusty and forgotten. On hover they
 * spring back to full colour. An age badge sits on the corner of each.
 *
 * Args:
 *   graveyard (Array<Object>): Graveyard entries from the hook.
 *
 * Returns:
 *   JSX.Element: The graveyard card body.
 */
function GraveyardBoard({ graveyard }) {
  if (!graveyard.length) {
    return <p className="wl-empty">Your watchlist is empty. Add some films on Letterboxd and export again.</p>;
  }

  return (
    <div className="wl-graveyard">
      <div className="wl-graveyard-grid">
        {graveyard.map((film) => {
          const age = formatAge(film.ageDays);
          return (
            <div className="wl-grave" key={`${film.name}-${film.year}`}>
              <div className="wl-grave-poster">
                {film.posterPath ? (
                  <img
                    src={film.posterPath}
                    alt={`Poster of ${film.name}`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="wl-grave-poster-missing" aria-hidden="true">
                    {film.name}
                  </span>
                )}
                <span className="wl-grave-age-badge tabular-nums">
                  {age.value} {age.unit}
                </span>
              </div>
              <div className="wl-grave-info">
                <span className="wl-grave-name" title={film.name}>{film.name}</span>
                <span className="wl-grave-meta">
                  {film.year ? `${film.year} · ` : ''}added {formatIsoDate(film.addedDate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="wl-graveyard-note">
        These films have been sitting in your watchlist the longest. At some point you wanted to watch them. Maybe it is time.
      </p>
    </div>
  );
}

/**
 * Big hero number showing the average watchlist waiting time, plus pace rows.
 *
 * Args:
 *   averageAgeDays (number): Mean age in days.
 *   growth (Object): Growth bundle from the hook.
 *   watchlistSize (number): Total films in the watchlist.
 *
 * Returns:
 *   JSX.Element: The age card body.
 */
function AgeCard({ averageAgeDays, growth, watchlistSize }) {
  const age = formatAge(averageAgeDays);

  const clearWeeks = growth.watchedPerMonth > 0
    ? Math.round((watchlistSize / (growth.watchedPerMonth / 4.33)) * 10) / 10
    : null;

  const clearLabel = clearWeeks != null
    ? clearWeeks >= 52
      ? `${(clearWeeks / 52).toFixed(1)} years`
      : `${Math.round(clearWeeks)} weeks`
    : 'never at this pace';

  return (
    <div className="wl-age">
      <div className="wl-age-hero">
        <span className="wl-age-hero-value tabular-nums">{age.value}</span>
        <span className="wl-age-hero-unit">{age.unit}</span>
        <span className="wl-age-hero-label">average time a film waits in your watchlist</span>
      </div>

      <div className="wl-age-rows">
        <div className="wl-age-row">
          <span className="wl-age-row-label">films in watchlist</span>
          <span className="wl-age-row-value tabular-nums">{watchlistSize.toLocaleString()}</span>
        </div>
        <div className="wl-age-row">
          <span className="wl-age-row-label">adding per month</span>
          <span className="wl-age-row-value tabular-nums">{growth.addedPerMonth}</span>
        </div>
        <div className="wl-age-row">
          <span className="wl-age-row-label">watching per month</span>
          <span className="wl-age-row-value tabular-nums">{growth.watchedPerMonth}</span>
        </div>
        <div className="wl-age-row">
          <span className="wl-age-row-label">time to clear watchlist</span>
          <span className="wl-age-row-value tabular-nums">{clearLabel}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared section header so the empty and populated states stay in sync.
 *
 * Args:
 *   subtitle (string): Contextual sentence shown under the title.
 *
 * Returns:
 *   JSX.Element: The section header.
 */
function SectionHeader({ subtitle }) {
  return (
    <header className="wl-header">
      <div className="wl-section-label">Section 07 / Watchlist</div>
      <h2 className="wl-title">The ones still <span className="lb-hl-green">waiting</span>.</h2>
      <p className="wl-subtitle">{subtitle}</p>
    </header>
  );
}

/**
 * Section 07: Watchlist. Closes the analytical block by looking forward.
 *
 * Returns:
 *   JSX.Element: The Watchlist section.
 */
export default function Watchlist() {
  const { rawData, enrichedWatchlist } = useData();
  const stats = useWatchlistStats(rawData, enrichedWatchlist);

  if (!stats.hasData) {
    return (
      <div className="wl-section">
        <SectionHeader subtitle="Your watchlist is empty. Add some films on Letterboxd, export your data again, and this section will show you what you have been putting off." />
        <div className="wl-grid">
          <section className="wl-card wl-col-12">
            <p className="wl-empty">
              Nothing to see here yet. Start building your watchlist on Letterboxd and come back.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const { growth } = stats;

  const verdictMap = {
    losing: {
      text: 'You are adding films faster than you watch them. The pile keeps growing.',
      color: 'var(--color-accent-warm)',
    },
    winning: {
      text: 'You are watching faster than you add. The pile is actually shrinking.',
      color: 'var(--color-lb-green)',
    },
    even: {
      text: 'Additions and watches are roughly balanced. The pile stays about the same.',
      color: 'var(--color-lb-blue)',
    },
    none: {
      text: 'Not enough recent data to judge the trend.',
      color: 'var(--color-text-faint)',
    },
  };
  const verdictInfo = verdictMap[growth.verdict] || verdictMap.none;

  return (
    <div className="wl-section">
      <SectionHeader
        subtitle={`You have watched a lot. But there are ${stats.watchlistSize.toLocaleString()} films you told yourself you would get to. Let's see how that is going.`}
      />

      <div className="wl-grid">
        {/* Graveyard: full width hero card */}
        <section className="wl-card wl-col-12" aria-label="Watchlist graveyard">
          <div className="wl-card-head">
            <div className="wl-card-title-group">
              <div className="wl-card-icon" style={{ color: 'var(--color-accent-warm)' }}>
                <SkullIcon />
              </div>
              <div className="wl-card-label">The Graveyard</div>
            </div>
            <div className="wl-card-note">films waiting the longest</div>
          </div>
          <GraveyardBoard graveyard={stats.graveyard} />
        </section>

        {/* Growth chart */}
        <section className="wl-card wl-col-8" aria-label="Watchlist growth over time">
          <div className="wl-card-head">
            <div className="wl-card-title-group">
              <div className="wl-card-icon" style={{ color: 'var(--color-lb-green)' }}>
                <TrendIcon />
              </div>
              <div className="wl-card-label">Gaining or Losing Ground</div>
            </div>
            <div className="wl-card-note">additions vs watches per month</div>
          </div>
          <GrowthChart series={growth.series} />
          <div className="wl-verdict" style={{ '--verdict-color': verdictInfo.color }}>
            <span className="wl-verdict-dot" />
            {verdictInfo.text}
          </div>
        </section>

        {/* Average age card */}
        <section className="wl-card wl-col-4" aria-label="Average watchlist age">
          <div className="wl-card-head">
            <div className="wl-card-title-group">
              <div className="wl-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <ClockIcon />
              </div>
              <div className="wl-card-label">The Wait</div>
            </div>
          </div>
          <AgeCard
            averageAgeDays={stats.averageAgeDays}
            growth={growth}
            watchlistSize={stats.watchlistSize}
          />
        </section>
      </div>
    </div>
  );
}
