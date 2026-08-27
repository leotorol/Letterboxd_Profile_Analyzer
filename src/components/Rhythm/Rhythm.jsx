import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useRhythmStats, buildYearGrid } from '../../hooks/useRhythmStats';
import { useCountUp } from '../../hooks/useCountUp';
import { formatIsoDate } from '../../utils/dateFormat';
import Heatmap from './Heatmap';
import './Rhythm.css';

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FlameIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const RepeatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Formats a watchlist clearing time in weeks into a readable duration label.
 *
 * Args:
 *   weeks (number|null): Weeks to clear the watchlist.
 *
 * Returns:
 *   string|null: Short humanised duration, or null when the input is falsy.
 */
function formatWeeks(weeks) {
  if (!weeks || !Number.isFinite(weeks)) return null;
  if (weeks < 4) {
    return `${Math.ceil(weeks)} ${Math.ceil(weeks) === 1 ? 'week' : 'weeks'}`;
  }
  if (weeks < 52) {
    const months = Math.round(weeks / 4.345);
    return `≈ ${months} ${months === 1 ? 'month' : 'months'}`;
  }
  const years = weeks / 52;
  return `≈ ${years >= 10 ? Math.round(years) : years.toFixed(1)} years`;
}

/* 3-letter day labels used in the weekday bars -> full names for the copy */
const FULL_DAYS = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

/* 3-letter month labels -> full names for the busiest-month banner */
const FULL_MONTHS = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

/**
 * Gets the day/month label text and short-form note for a ranked bar group.
 *
 * Args:
 *   item (Object): A ranked { label, count } entry.
 *
 * Returns:
 *   string: Shareable bite like "Most of your watching lands on Sunday".
 */
function patternNote(item, kind) {
  if (!item || !item.count) return null;
  if (kind === 'day') return `Most of your watching lands on ${FULL_DAYS[item.label] || item.label}.`;
  return `${item.label} is your busiest month.`;
}

/**
 * A bespoke SVG area/line trend chart for films watched per month.
 *
 * Los muertos de esta puta función de mrd con lo facil q es y loq me ha costado
 * 
 * the math in this component is a fucking labyrinth. it builds an SVG
 * path by mapping each data point to x/y coordinates, then draws an area fill
 * underneath the line. the hover logic tracks pointer position and snaps to
 * the nearest data point index. pure presentational widget; keeps its own
 * hover state for the tooltip.
 *
 * Args:
 *   series (Array<Object>): Chronological { year, month, label, count } points.
 *
 * Returns:
 *   JSX.Element: The responsive trend chart.
 */
function TrendChart({ series }) {
  const [hover, setHover] = useState(-1);

  const chart = useMemo(() => {
    const W = 720;
    const H = 250;
    const padL = 10;
    const padR = 10;
    const padT = 20;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const counts = series.map(s => s.count);
    const max = Math.max(1, ...counts);
    const n = series.length;

    const x = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
    const y = (count) => padT + (1 - count / max) * plotH;

    const linePath = series
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.count).toFixed(1)}`)
      .join(' ');

    const baseY = H - padB;
    const areaPath = n > 0
      ? `${linePath} L ${x(n - 1).toFixed(1)} ${baseY} L ${x(0).toFixed(1)} ${baseY} Z`
      : '';

    const gridLines = [0.25, 0.5, 0.75].map((f) => y(max * f));

    const ticks = [];
    series.forEach((s, i) => {
      if (i === 0 || s.year !== series[i - 1].year) {
        ticks.push({ i, year: s.year });
      }
    });

    return { W, H, padL, padR, padT, padB, baseY, max, n, x, y, linePath, areaPath, gridLines, ticks };
  }, [series]);

  const peak = useMemo(() => {
    if (series.length === 0) return null;
    let best = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i].count > series[best].count) best = i;
    }
    return best;
  }, [series]);

  if (series.length === 0) return null;

  const { W, H, padL, padT, baseY, n, x, y, linePath, areaPath, gridLines, ticks } = chart;
  const hovered = hover >= 0 && hover < n ? series[hover] : null;

  /**
   * Maps a pointer event to the nearest point index on the chart.
   *
   * Args:
   *   e (MouseEvent): The pointer event.
   *
   * Returns:
   *   void
   */
  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <div className="ry-evo">
      <svg
        className="ry-evo-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Films watched per month over time"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(-1)}
      >
        {gridLines.map((gy) => (
          <line key={gy} className="ry-evo-grid" x1={padL} y1={gy} x2={W - chart.padR} y2={gy} />
        ))}

        {areaPath && <path className="ry-evo-area" d={areaPath} />}
        {linePath && <path className="ry-evo-line" d={linePath} />}

        {peak >= 0 && (
          <circle className="ry-evo-peak" cx={x(peak)} cy={y(series[peak].count)} r="3.5" />
        )}

        {ticks.map((tick) => (
          <g key={tick.year + '-' + tick.i}>
            <line className="ry-evo-tick" x1={x(tick.i)} y1={baseY} x2={x(tick.i)} y2={baseY + 5} />
            <text className="ry-evo-year" x={x(tick.i)} y={H - 6} textAnchor="middle">{tick.year}</text>
          </g>
        ))}

        {hovered && (
          <g>
            <line className="ry-evo-guide" x1={x(hover)} y1={padT} x2={x(hover)} y2={baseY} />
            <circle className="ry-evo-dot" cx={x(hover)} cy={y(hovered.count)} r="4" />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="ry-evo-tooltip"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hovered.count) / H) * 100}%` }}
        >
          <span className="ry-evo-tooltip-count tabular-nums">{hovered.count}</span>
          <span className="ry-evo-tooltip-label">{hovered.label} {hovered.year}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive month bars for the "busiest month" banner.
 *
 * Each bar is one calendar month with the total films watched in that month
 * across every year in your Letterboxd history. Hovering a bar reveals a dark
 * micro-tooltip with the full month name and that total.
 *
 * Pure presentational widget; keeps its own hover state.
 *
 * Args:
 *   data (Array<Object>): Chronological { label, count } month entries.
 *   max (number): Max count across all months, used to scale bar heights.
 *   favorite (Object|null): The favourite { label, count } month to highlight.
 *
 * Returns:
 *   JSX.Element: The month bar chart block.
 */
function MonthBarChart({ data, max, favorite }) {
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) return null;

  return (
    <div className="ry-month-bars" onMouseLeave={() => setHover(null)}>
      {data.map((m, i) => {
        const full = FULL_MONTHS[m.label] || m.label;
        const isPeak = favorite && m.label === favorite.label;
        return (
          <div
            key={m.label}
            className={`ry-month-bar${isPeak ? ' is-peak' : ''}`}
            style={{ height: `${(m.count / max) * 100}%` }}
            onMouseEnter={() => setHover(i)}
            aria-label={`${full}: ${m.count} films total`}
          >
            {hover === i && (
              <div className="ry-month-tip" role="tooltip">
                <span className="ry-month-tip-count tabular-nums">{m.count}</span>
                <span className="ry-month-tip-label">{full}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact pace evolution: films per year across your whole Letterboxd life.
 *
 * Groups the monthly evolution into yearly totals, draws a small responsive
 * area sparkline, and adds a one-line takeaway so you instantly see whether
 * you're watching more, less, or the same as you used to.
 *
 * Pure presentational widget.
 *
 * Args:
 *   series (Array<Object>): Monthly { year, month, label, count } series.
 *
 * Returns:
 *   JSX.Element: The compact evolution block, or null when there's no data.
 */
function PaceEvolution({ series = [] }) {
  const { yearly, max, direction, peakYear } = useMemo(() => {
    const byYear = new Map();
    for (const s of series) {
      byYear.set(s.year, (byYear.get(s.year) || 0) + s.count);
    }
    const yearly = [...byYear.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
    if (yearly.length === 0) return { yearly: [], max: 0, direction: null, peakYear: null };

    const max = Math.max(1, ...yearly.map(y => y.count));
    const half = Math.max(1, Math.floor(yearly.length / 2));
    const firstAvg = yearly.slice(0, half).reduce((a, y) => a + y.count, 0) / half;
    const lastAvg = yearly.slice(yearly.length - half).reduce((a, y) => a + y.count, 0) / half;
    let direction = 'steady';
    if (lastAvg > firstAvg * 1.05) direction = 'up';
    else if (lastAvg < firstAvg * 0.95) direction = 'down';
    const peakYear = yearly.reduce((a, b) => (b.count > a.count ? b : a), yearly[0]);
    return { yearly, max, direction, peakYear };
  }, [series]);

  // a single year (or zero) says nothing about how your pace changed
  if (yearly.length < 2) return null;

  const trendText = direction === 'up'
    ? 'watching more than before'
    : direction === 'down'
      ? 'watching less than before'
      : 'keeping a steady rhythm';

  const W = 340;
  const H = 96;
  const padT = 10;
  const padB = 18;
  const plotH = H - padT - padB;
  const n = yearly.length;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (c) => padT + (1 - c / max) * plotH;
  const line = yearly.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - padB} L ${x(0).toFixed(1)} ${H - padB} Z`;

  return (
    <div className="ry-proj-evolution">
      <div className="ry-proj-evo-head">
        <span className="ry-proj-evo-title">Evolution</span>
        <span className="ry-proj-evo-sub">films per year</span>
      </div>
      <svg
        className="ry-proj-evo-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Films watched per year over your whole Letterboxd life"
      >
        <path className="ry-proj-evo-area" d={area} />
        <path className="ry-proj-evo-line" d={line} />
        <text className="ry-proj-evo-year" x={x(n - 1)} y={H - 4} textAnchor="end">
          {yearly[n - 1].year}
        </text>
      </svg>
      <p className="ry-proj-takeaway">
        You're <strong>{trendText}</strong>. Peak of <strong className="tabular-nums">{peakYear.count}</strong> films in {peakYear.year}.
      </p>
    </div>
  );
}

/**
 * Rhythm section: when and how often you watch, over your whole Letterboxd life.
 *
 * A hub of custom temporal visualisations: a browsable calendar-year heat grid,
 * streaks, weekday/month rhythm bars, an SVG pace trend, a forward projection
 * and the comfort-movie rewatch ranking. Pure presentational; stats come from
 * the hook.
 *
 * Returns:
 *   JSX.Element: The Rhythm section.
 */
export default function Rhythm() {
  const { rawData, enrichedData } = useData();
  const stats = useRhythmStats(rawData, enrichedData);

  const username = rawData?.profile?.username;
  const currentYear = new Date().getFullYear();
  const latestYear = stats.years[stats.years.length - 1] || currentYear;

  // year navigator state, defaulting to the most recent year with activity
  const [viewYear, setViewYear] = useState(() =>
    stats.years.includes(currentYear) ? currentYear : latestYear
  );
  const year = stats.years.includes(viewYear) ? viewYear : latestYear;

  const prevYear = [...stats.years].reverse().find((y) => y < year);
  const nextYear = stats.years.find((y) => y > year);

  const yearGrid = useMemo(
    () => buildYearGrid(stats.byDate, year),
    [stats.byDate, year]
  );

  const yearFilms = yearGrid.cells.filter((c) => !c.blank).reduce((sum, c) => sum + c.count, 0);
  const yearDays = yearGrid.cells.filter((c) => !c.blank && c.count > 0).length;

  const animTrailing = useCountUp(yearFilms, 1400, 200);
  const animDays = useCountUp(yearDays, 1400, 300);
  const animStreak = useCountUp(stats.streaks.longestActive, 1400, 200);
  const animCurrent = useCountUp(stats.streaks.current, 1400, 300);
  const animYearEnd = useCountUp(stats.projection.filmsByYearEnd, 1400, 200);

  const weekdayMax = stats.patterns ? Math.max(1, ...stats.patterns.weekdayRank.map((w) => w.count)) : 1;
  const monthMax = stats.patterns ? Math.max(1, ...stats.patterns.monthRank.map((m) => m.count)) : 1;
  const watchlistLabel = formatWeeks(stats.projection.watchlistWeeks);

  const empty = stats.empty;
  const COMFORT_LIMIT = 5;
  const comfortShown = Math.min(COMFORT_LIMIT, stats.rewatch.comfortMovies.length);

  return (
    <div className="ry-section">
      <header className="ry-header">
        <div className="ry-category-tag">Section 02 / Rhythm</div>
        <h2 className="ry-title">
          {username ? (
            <>
              You've got a rhythm, let's take a look at it.
            </>
          ) : (
            "Your watching has a rhythm."
          )}
        </h2>
        <p className="ry-subtitle">
          You've seen borring facts. Now let's start with the fun part: when, how often, and
          patterns hiding inside your film watching routine.
        </p>
      </header>

      {empty ? (
        <div className="ry-empty">
          <CalendarIcon />
          <p>
            We couldn't find any watch dates in your export, so there's no rhythm to
            chart yet. Check that your <code>watched.csv</code> has a <code>Date</code> column and try again.
          </p>
        </div>
      ) : (
        <div className="ry-grid">
          {/* 01 — Heatmap hero */}
          <section className="ry-card ry-span-3" aria-label="Year at a glance">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent)' }}>
                  <CalendarIcon />
                </div>
                <div className="ry-card-label">Year at a Glance</div>
              </div>

              <div className="ry-year-nav" role="group" aria-label="Select viewing year">
                <button
                  type="button"
                  className="ry-year-btn"
                  onClick={() => prevYear != null && setViewYear(prevYear)}
                  disabled={prevYear == null}
                  aria-label={`View ${year - 1}`}
                >
                  <ChevronLeftIcon />
                </button>
                <span className="ry-year-value tabular-nums">{year}</span>
                <button
                  type="button"
                  className="ry-year-btn"
                  onClick={() => nextYear != null && setViewYear(nextYear)}
                  disabled={nextYear == null}
                  aria-label={`View ${year + 1}`}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>

            <p className="ry-click-hint">
              Click a day to see which films you watched on that day.
            </p>

            <div className="ry-hero-numbers">
              <div>
                <span className="ry-hero-number tabular-nums">{animTrailing.toLocaleString()}</span>
                <span className="ry-hero-unit">films</span>
                <div className="ry-hero-subtext">logged in {year}</div>
              </div>
              <div>
                <span className="ry-hero-number ry-hero-number-muted tabular-nums">{animDays.toLocaleString()}</span>
                <span className="ry-hero-unit">active days</span>
                <div className="ry-hero-subtext">
                  {yearDays > 200
                    ? 'You were out there almost every single day.'
                    : yearDays > 60
                      ? 'You were out there more often than not.'
                      : yearDays > 0
                        ? 'You showed up on the odd day.'
                        : 'Nothing logged yet this year.'}
                </div>
              </div>
            </div>

            <Heatmap heatmap={yearGrid} byDateMovies={stats.byDateMovies} />
          </section>

          {/* 02 — Streaks */}
          <section className="ry-card" aria-label="Streaks">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent-warm)' }}>
                  <FlameIcon />
                </div>
                <div className="ry-card-label">Streaks</div>
              </div>
            </div>

            <div className="ry-streak-block">
              <span className="ry-streak-number tabular-nums">{animStreak}</span>
              <span className="ry-streak-unit">day streak</span>
              <div className="ry-streak-subtext">Your longest run of watching at least one film a day</div>
            </div>

            {stats.streakFilms.length > 0 && (
              <div className="ry-streak-films" aria-label="Films watched during your longest streak">
                {stats.streakFilms.map((f, i) => (
                  <div className="ry-streak-film" key={`${f.iso}-${f.name}-${i}`}>
                    <div className="ry-streak-film-poster">
                      {f.posterPath ? (
                        <img src={f.posterPath} alt={`Poster of ${f.name}`} loading="lazy" />
                      ) : (
                        <div className="ry-streak-film-poster-missing" aria-hidden="true" />
                      )}
                    </div>
                    <span className="ry-streak-film-name">{f.name}</span>
                  </div>
                ))}
              </div>
            )}

            {stats.streaks.current > 0 && stats.streaks.current < stats.streaks.longestActive && (
              <p className="ry-streak-note">
                Don't mix that up with what's going on right now: your current run is{' '}
                <strong className="tabular-nums">{stats.streaks.current}</strong> days, not the record.
              </p>
            )}

            <div className="ry-mini-pair">
              <div className="ry-mini">
                <span className="ry-mini-number tabular-nums">{animCurrent}</span>
                <span className="ry-mini-label">right now</span>
              </div>
              <div className="ry-mini">
                <span className="ry-mini-number tabular-nums">{stats.streaks.longestGap.toLocaleString()}</span>
                <span className="ry-mini-label">days was your longest dry spell</span>
              </div>
            </div>
          </section>

          {/* 03 — When you watch (weekday + month bars) */}
          <section className="ry-card ry-span-2" aria-label="When you watch">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                  <ClockIcon />
                </div>
                <div className="ry-card-label">When You Watch</div>
              </div>
              {stats.patterns && (
                <div className="ry-card-note">{patternNote(stats.patterns.favoriteDay, 'day')}</div>
              )}
            </div>

            <div className="ry-bars" aria-label="Watches by weekday">
              {stats.patterns.weekdayRank.map((w) => (
                <div className="ry-bar-row" key={w.label}>
                  <span className="ry-bar-label">{w.label}</span>
                  <div className="ry-bar-track">
                    <div
                      className={`ry-bar-fill${w.count === stats.patterns.favoriteDay.count ? ' is-peak' : ''}`}
                      style={{ width: `${(w.count / weekdayMax) * 100}%` }}
                    />
                  </div>
                  <span className="ry-bar-value tabular-nums">{w.count}</span>
                </div>
              ))}
            </div>

            <div className="ry-divider" />

            <div className="ry-month-banner">
              <span className="ry-month-banner-label">Busiest month</span>
              <span className="ry-month-banner-value">{FULL_MONTHS[stats.patterns.favoriteMonth.label] || stats.patterns.favoriteMonth.label}</span>
              <MonthBarChart
                data={stats.patterns.monthRank}
                max={monthMax}
                favorite={stats.patterns.favoriteMonth}
              />
            </div>
          </section>

          {/* 04 — Pace over time */}
          <section className="ry-card ry-span-2" aria-label="Your pace over time">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent-4)' }}>
                  <TrendIcon />
                </div>
                <div className="ry-card-label">Your Pace Over Time</div>
              </div>
              <div className="ry-card-note">watched per month</div>
            </div>

            <TrendChart series={stats.evolution} />
          </section>

          {/* 05 — Projection */}
          <section className="ry-card" aria-label="Where you're headed">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent-4)' }}>
                  <TrendIcon />
                </div>
                <div className="ry-card-label">Where You're Headed</div>
              </div>
            </div>

            {stats.projection.avgPerWeek > 0 ? (
              <>
                <div className="ry-streak-block">
                  <span className="ry-streak-number tabular-nums">{animYearEnd.toLocaleString()}</span>
                  <span className="ry-streak-unit">more films</span>
                  <div className="ry-streak-subtext">By the end of the year at your current pace ({stats.projection.avgPerWeek}/wk)</div>
                </div>

                <div className="ry-mini ry-mini-solo">
                  <span className="ry-mini-number">{watchlistLabel || '—'}</span>
                  <span className="ry-mini-label">to clear your watchlist</span>
                </div>
              </>
            ) : (
              <p className="ry-projection-idle">
                Pace is currently paused. No recent activity to project from.
                Come back after a few more watch days.
              </p>
            )}

            <PaceEvolution series={stats.evolution} />
          </section>

          {/* 06 — Comfort movies */}
          <section className="ry-card ry-span-3" aria-label="Comfort movies">
            <div className="ry-card-head">
              <div className="ry-card-title-group">
                <div className="ry-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                  <RepeatIcon />
                </div>
                <div className="ry-card-label">Your Comfort Movies</div>
              </div>
              {stats.rewatch.comfortMovies.length > 0 && (
                <div className="ry-card-note">Top {comfortShown} you couldn't leave alone</div>
              )}
            </div>

            {stats.rewatch.comfortMovies.length > 0 ? (
              <div className="ry-comfort-list">
                {stats.rewatch.comfortMovies.slice(0, COMFORT_LIMIT).map((movie, i) => (
                  <div className="ry-comfort-item" key={movie.key}>
                    <div className="ry-comfort-poster">
                      {movie.posterPath ? (
                        <img src={movie.posterPath} alt={`Poster of ${movie.name}`} loading="lazy" />
                      ) : (
                        <div className="ry-comfort-poster-missing" aria-hidden="true" />
                      )}
                    </div>
                    <div className="ry-comfort-info">
                      <div className="ry-comfort-top">
                        <span className="ry-comfort-rank">Top {i + 1}</span>
                        <span className="ry-comfort-count tabular-nums">×{movie.count}</span>
                      </div>
                      <div className="ry-comfort-title">
                        {movie.name}
                        {movie.year ? <span className="ry-comfort-year">{movie.year}</span> : null}
                      </div>
                      <div className="ry-comfort-last">
                        {movie.lastWatch ? `Last rewatch ${formatIsoDate(movie.lastWatch)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ry-comfort-idle">
                No rewatching detected — every film was a one-time thing. That's a
                decisive (if stubborn) viewing style.
              </p>
            )}
            <div className="ry-comfort-foot">
              Of your {stats.rewatch.totalWatches} total watches, {stats.rewatch.rewatchCount} were rewatches across {stats.rewatch.uniqueFilms} unique titles.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
