import { useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useCastStats } from '../../hooks/useCastStats';
import { ratingColor } from '../../utils/ratingColor';
import { TMDB_POSTER_SMALL, TMDB_PROFILE_SMALL } from '../../utils/tmdbImages';
import { tipPosition } from '../../utils/positionTip';
import PosterTip from '../PosterTip/PosterTip';
import './Cast.css';

// local SVG icons, this section owns them so they do not pollute the shared set

const CastIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DuoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const StudioIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V8l7-5 7 5v13" />
    <path d="M9 21v-6h6v6" />
    <line x1="9" y1="11" x2="9.01" y2="11" />
    <line x1="15" y1="11" x2="15.01" y2="11" />
  </svg>
);

const MoneyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v12" />
    <path d="M15 9.5a3 3 0 0 0-3-1.5h-1.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H11a3 3 0 0 1-3-1.5" />
  </svg>
);

/**
 * Builds a short monogram from a person's name.
 *
 * Args:
 *   name (string): Full name.
 *
 * Returns:
 *   string: Up to two uppercase initials.
 */
function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/**
 * Names the on-screen role for a TMDB gender code.
 *
 * TMDB sends 1 for women, 2 for men and 0 when it does not know, so we only
 * call someone an actress or an actor when we actually have the data.
 *
 * Args:
 *   gender (number): TMDB gender code.
 *   fallback (string): Label used when the gender is unknown.
 *
 * Returns:
 *   string: 'actress', 'actor' or the fallback.
 */
function personRole(gender, fallback) {
  if (gender === 1) return 'actress';
  if (gender === 2) return 'actor';
  return fallback;
}

/**
 * Compact money label for budgets and box office numbers.
 *
 * Args:
 *   value (number|null): Amount in dollars.
 *
 * Returns:
 *   string: Short human label such as $12M, $1.4B or n/a when unknown.
 */
function formatMoney(value) {
  if (value == null) return 'n/a';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/**
 * Circular headshot with an initials fallback.
 *
 * Args:
 *   person (Object): { name, profilePath }.
 *   className (string, optional): Extra class for sizing variants.
 *
 * Returns:
 *   JSX.Element: The avatar element.
 */
function Portrait({ person, className = '' }) {
  return (
    <div className={`cs-portrait ${className}`}>
      {person.profilePath ? (
        <img src={TMDB_PROFILE_SMALL + person.profilePath} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="cs-portrait-initials" aria-hidden="true">{initials(person.name)}</span>
      )}
    </div>
  );
}

/**
 * Poster thumbnail for the film strips.
 *
 * Args:
 *   film (Object): Film with name and posterPath.
 *
 * Returns:
 *   JSX.Element: The lazy loaded poster image.
 */
function PosterImage({ film }) {
  return (
    <img
      src={TMDB_POSTER_SMALL + film.posterPath}
      alt={`Poster of ${film.name}`}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * One-line takeaway banner with an accent dot.
 *
 * Args:
 *   accent (string): CSS colour for the dot.
 *   muted (boolean, optional): Renders the quieter secondary variant.
 *   children (ReactNode): The takeaway sentence.
 *
 * Returns:
 *   JSX.Element: The takeaway line.
 */
function Takeaway({ accent, muted = false, children }) {
  return (
    <div className={`cs-takeaway${muted ? ' cs-takeaway-muted' : ''}`} style={{ '--accent': accent }}>
      <span className="cs-takeaway-dot" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Card header: icon chip, label and an optional right-aligned note.
 *
 * Args:
 *   icon (ReactNode): Icon rendered inside the chip.
 *   accent (string): CSS colour for the icon.
 *   label (string): Card title.
 *   note (string, optional): Small note on the right.
 *
 * Returns:
 *   JSX.Element: The card header.
 */
function CardHead({ icon, accent, label, note }) {
  return (
    <div className="cs-card-head">
      <div className="cs-card-title-group">
        <div className="cs-card-icon" style={{ color: accent }}>
          {icon}
        </div>
        <div className="cs-card-label">{label}</div>
      </div>
      {note && <div className="cs-card-note">{note}</div>}
    </div>
  );
}

/**
 * Most watched faces card: a headliner plus a ranked unit chart.
 *
 * Args:
 *   topActors (Array<Object>): Ranked actors from the hook.
 *
 * Returns:
 *   JSX.Element: The cast card body.
 */
function CastBoard({ topActors }) {
  if (!topActors.length) {
    return (
      <p className="cs-empty">
        No cast data yet. Add a TMDB key and reimport your ZIP so we can put faces to your films.
      </p>
    );
  }

  const hero = topActors[0];
  const rest = topActors.slice(1);
  const heroRole = personRole(hero.gender, 'cast member');
  const heroFilms = hero.films.filter((film) => film.posterPath).slice(0, 5);

  return (
    <div className="cs-cast">
      <div className="cs-cast-hero">
        <div className="cs-cast-hero-portrait">
          <Portrait person={hero} className="cs-portrait-hero" />
          <span className="cs-cast-rank-badge tabular-nums">#1</span>
        </div>

        <div className="cs-cast-hero-body">
          <span className="cs-cast-hero-role">Most watched {heroRole}</span>
          <span className="cs-cast-hero-name">{hero.name}</span>
          <div className="cs-cast-hero-metrics">
            <span className="cs-cast-hero-count tabular-nums">{hero.count}</span>
            <span className="cs-cast-hero-count-lbl">films</span>
            {hero.avgRating != null && (
              <span className="cs-cast-hero-rating tabular-nums">★ {hero.avgRating.toFixed(1)} avg</span>
            )}
          </div>
          <p className="cs-cast-hero-line">
            You have watched {hero.name} in {hero.count} films without even noticing.
          </p>
        </div>
      </div>

      {heroFilms.length > 0 && (
        <div className="cs-cast-strip" aria-label={`Some films with ${hero.name}`}>
          {heroFilms.map((film) => (
            <div className="cs-cast-strip-item" key={`${film.name}-${film.year}`}>
              <PosterImage film={film} />
            </div>
          ))}
        </div>
      )}

      <div className="cs-cast-list">
        {rest.map((actor, i) => (
          <div className="cs-cast-row" key={actor.name}>
            <span className="cs-cast-row-rank tabular-nums">{i + 2}</span>
            <Portrait person={actor} className="cs-portrait-row" />
            <div className="cs-cast-row-main">
              <span className="cs-cast-row-name" title={actor.name}>{actor.name}</span>
              <div className="cs-cast-units" aria-hidden="true">
                {Array.from({ length: actor.count }).map((_, unit) => (
                  <span
                    className="cs-cast-unit"
                    key={unit}
                    style={{ '--unit-delay': `${i * 55 + unit * 16}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="cs-cast-row-metrics">
              <span className="cs-cast-row-count tabular-nums">{actor.count}</span>
              {actor.avgRating != null && (
                <span className="cs-cast-row-avg tabular-nums">★ {actor.avgRating.toFixed(1)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Favourite director-actor collaboration card.
 *
 * Args:
 *   duo (Object|null): Duo bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The duo card body.
 */
function DuoCard({ duo }) {
  if (!duo) {
    return (
      <p className="cs-empty">
        No recurring director and actor duo yet. Watch a couple more films from the same
        filmmaker and their favourite face will show up here.
      </p>
    );
  }

  const actorRole = personRole(duo.actor.gender, 'performer');
  const films = duo.films.filter((film) => film.posterPath).slice(0, 6);
  const rated = duo.films.filter((film) => film.rating != null);
  const duoAvg = rated.length ? rated.reduce((sum, film) => sum + film.rating, 0) / rated.length : null;

  return (
    <div className="cs-duo">
      <p className="cs-duo-intro">
        Some people just come as a package. This is the pair you have watched team up the most.
      </p>

      <div className="cs-duo-body">
        <div className="cs-duo-pair">
          <div className="cs-duo-person">
            <Portrait person={duo.director} className="cs-portrait-duo" />
            <span className="cs-duo-name" title={duo.director.name}>{duo.director.name}</span>
            <span className="cs-duo-role">director</span>
          </div>

          <div className="cs-duo-link" aria-hidden="true">
            <DuoIcon />
          </div>

          <div className="cs-duo-person">
            <Portrait person={duo.actor} className="cs-portrait-duo" />
            <span className="cs-duo-name" title={duo.actor.name}>{duo.actor.name}</span>
            <span className="cs-duo-role">{actorRole}</span>
          </div>
        </div>

        <div className="cs-duo-count">
          <span className="cs-duo-count-num tabular-nums">{duo.count}</span>
          <span className="cs-duo-count-lbl">films together</span>
        </div>

        {films.length > 0 && (
          <div className="cs-duo-films" aria-label="Films they made together">
            {films.map((film) => (
              <div className="cs-duo-film" key={`${film.name}-${film.year}`}>
                <PosterImage film={film} />
              </div>
            ))}
          </div>
        )}
      </div>

      {duoAvg != null && (
        <Takeaway accent="var(--color-accent-2)">
          You rate their collaborations ★{duoAvg.toFixed(1)} on average.
        </Takeaway>
      )}
    </div>
  );
}

/**
 * Favourite studios card rendered as a lollipop chart.
 *
 * Every studio gets a rail from 0 to 5, a stem up to its average rating and a
 * dot that carries the rating colour, so you read length and quality together.
 *
 * Args:
 *   studios (Array<Object>): Ranked studios from the hook.
 *
 * Returns:
 *   JSX.Element: The studios card body.
 */
function StudiosBoard({ studios }) {
  if (!studios.length) {
    return (
      <p className="cs-empty">
        No studio data yet. Add a TMDB key and reimport your ZIP to see who is behind your films.
      </p>
    );
  }

  return (
    <div className="cs-studios">
      <div className="cs-studios-rows">
        <div className="cs-studios-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {studios.map((studio) => {
          const pct = (studio.avgRating / 5) * 100;
          const color = ratingColor(studio.avgRating);
          return (
            <div className="cs-studio-row" key={studio.name}>
              <div className="cs-studio-meta">
                <span className="cs-studio-name" title={studio.name}>{studio.name}</span>
                <span className="cs-studio-count tabular-nums">{studio.count} films</span>
              </div>
              <div className="cs-studio-track">
                <span className="cs-studio-stem" style={{ width: `${pct}%`, background: color }} />
                <span className="cs-studio-dot" style={{ left: `${pct}%`, background: color }} />
              </div>
              <span className="cs-studio-rating tabular-nums">{studio.avgRating.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="cs-studio-scale" aria-hidden="true">
        <span>0</span>
        <span>2.5</span>
        <span>5</span>
      </div>
    </div>
  );
}

// quadrant geometry, log scale on both axes so the break even line is the diagonal
const QUAD_W = 560;
const QUAD_H = 320;
const QUAD_PAD_L = 58;
const QUAD_PAD_R = 20;
const QUAD_PAD_T = 20;
const QUAD_PAD_B = 44;

/**
 * Budget versus box office quadrant chart.
 *
 * Both axes share one log scale, so a film above the diagonal made its money
 * back and a film below it flopped. Dot colour carries your own rating.
 *
 * Args:
 *   budget (Object): Budget bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The quadrant SVG.
 */
function BudgetQuadrant({ budget }) {
  const { points } = budget;
  const plotRef = useRef(null);
  const svgRef = useRef(null);
  const keyIdxRef = useRef(-1);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);

  const chart = useMemo(() => {
    if (!points.length) return null;

    let minV = Infinity;
    let maxV = 0;
    for (const point of points) {
      if (point.budget < minV) minV = point.budget;
      if (point.revenue < minV) minV = point.revenue;
      if (point.budget > maxV) maxV = point.budget;
      if (point.revenue > maxV) maxV = point.revenue;
    }

    const loE = Math.floor(Math.log10(minV));
    const hiE = Math.ceil(Math.log10(maxV));
    const span = hiE - loE || 1;
    const plotW = QUAD_W - QUAD_PAD_L - QUAD_PAD_R;
    const plotH = QUAD_H - QUAD_PAD_T - QUAD_PAD_B;
    const xs = (v) => QUAD_PAD_L + ((Math.log10(v) - loE) / span) * plotW;
    const ys = (v) => QUAD_PAD_T + (1 - (Math.log10(v) - loE) / span) * plotH;

    const ticks = [];
    for (let e = loE; e <= hiE; e++) ticks.push(Math.pow(10, e));

    return { xs, ys, ticks };
  }, [points]);

  // points ordered by budget so the arrow keys walk the chart left to right
  const ordered = useMemo(
    () => points.map((point, i) => ({ point, i })).sort((a, b) => a.point.budget - b.point.budget),
    [points],
  );

  if (!chart) {
    return (
      <p className="cs-empty">
        No box office data yet. Add a TMDB key and reimport your ZIP to chart budget against revenue.
      </p>
    );
  }

  const { xs, ys, ticks } = chart;
  const active = hover || pinned;

  const tipFor = (point, node) => ({ point, ...tipPosition(plotRef.current, node, 100) });

  const focusIndex = (idx) => {
    if (idx < 0 || idx >= ordered.length) return;
    keyIdxRef.current = idx;
    const { point, i } = ordered[idx];
    const dots = svgRef.current ? svgRef.current.querySelectorAll('.cs-quad-dot') : [];
    const node = dots[i];
    if (node) setPinned(tipFor(point, node));
  };

  return (
    <div className="cs-quad">
      <div className="cs-quad-plot" ref={plotRef}>
        <span className="cs-quad-axis-title cs-quad-axis-title-y">Box office</span>
        <svg
          ref={svgRef}
          className="cs-quad-svg"
          viewBox={`0 0 ${QUAD_W} ${QUAD_H}`}
          role="img"
          tabIndex={0}
          aria-label="Budget versus box office for every film, dots coloured by your rating; arrow keys move between films"
          onMouseDown={(e) => e.preventDefault()}
          onPointerLeave={() => { if (!pinned) setHover(null); }}
          onFocus={() => focusIndex(0)}
          onBlur={() => { keyIdxRef.current = -1; setPinned(null); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusIndex(keyIdxRef.current + 1); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusIndex(Math.max(0, keyIdxRef.current - 1)); }
          }}
        >
        {ticks.map((tick, i) => (
          <g key={tick}>
            <line className="cs-quad-grid" x1={xs(tick)} y1={QUAD_PAD_T} x2={xs(tick)} y2={QUAD_H - QUAD_PAD_B} />
            <line className="cs-quad-grid" x1={QUAD_PAD_L} y1={ys(tick)} x2={QUAD_W - QUAD_PAD_R} y2={ys(tick)} />
            <text
              className="cs-quad-axis"
              x={xs(tick)}
              y={QUAD_H - QUAD_PAD_B + 16}
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
            >
              {formatMoney(tick)}
            </text>
            <text className="cs-quad-axis" x={QUAD_PAD_L - 8} y={ys(tick)} textAnchor="end" dominantBaseline="middle">
              {formatMoney(tick)}
            </text>
          </g>
        ))}

        <line
          className="cs-quad-breakeven"
          x1={xs(ticks[0])}
          y1={ys(ticks[0])}
          x2={xs(ticks[ticks.length - 1])}
          y2={ys(ticks[ticks.length - 1])}
        />

        {points.map((point, i) => (
          <g key={`${point.name}-${point.year}-${i}`}>
            <circle
              className="cs-quad-hit"
              cx={xs(point.budget)}
              cy={ys(point.revenue)}
              r={9}
              onPointerEnter={(e) => setHover(tipFor(point, e.currentTarget))}
              onPointerDown={(e) => {
                const tip = tipFor(point, e.currentTarget);
                setPinned((prev) => (prev?.point === point ? null : tip));
              }}
            />
            <circle
              className="cs-quad-dot"
              cx={xs(point.budget)}
              cy={ys(point.revenue)}
              r={4}
              style={{ fill: ratingColor(point.rating) }}
            />
          </g>
        ))}
        </svg>

        <span className="cs-quad-axis-title cs-quad-axis-title-x">Budget</span>

        {active && (
          <PosterTip
            film={{
              name: active.point.name,
              year: active.point.year,
              rating: active.point.rating,
              posterPath: active.point.posterPath,
            }}
            sub={`${formatMoney(active.point.budget)} budget · ${formatMoney(active.point.revenue)} box office`}
            style={{ left: active.x, top: active.y }}
          />
        )}
      </div>

      <div className="cs-quad-legend">
        <span className="cs-quad-legend-item">
          <span className="cs-quad-legend-swatch is-loved" /> you loved it
        </span>
        <span className="cs-quad-legend-item">
          <span className="cs-quad-legend-swatch is-meh" /> you did not
        </span>
        <span className="cs-quad-legend-item">
          <span className="cs-quad-legend-line" /> break even
        </span>
      </div>
    </div>
  );
}

/**
 * Budget and box office card with the taste verdict.
 *
 * Args:
 *   budget (Object): Budget bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The money card body.
 */
function MoneyBoard({ budget }) {
  if (budget.budgetCount === 0) {
    return (
      <p className="cs-empty">
        No budget data yet. Add a TMDB key and reimport your ZIP to see the money behind your films.
      </p>
    );
  }

  const blockbusterShare = budget.ratedCount ? budget.blockbusterCount / budget.ratedCount : 0;
  const indieShare = budget.ratedCount ? budget.indieCount / budget.ratedCount : 0;

  let preference = null;
  if (budget.blockbusterAvg != null && budget.indieAvg != null) {
    const gap = budget.indieAvg - budget.blockbusterAvg;
    if (gap >= 0.2) preference = 'indie';
    else if (gap <= -0.2) preference = 'blockbuster';
    else preference = 'balanced';
  }

  const preferenceText = {
    indie: `Micro budget indies win with you: ★${budget.indieAvg.toFixed(1)} against ★${budget.blockbusterAvg.toFixed(1)} for the blockbusters.`,
    blockbuster: `You are a blockbuster person: ★${budget.blockbusterAvg.toFixed(1)} against ★${budget.indieAvg.toFixed(1)} for the micro indies.`,
    balanced: `Blockbusters and micro indies score about the same with you (★${budget.blockbusterAvg.toFixed(1)} and ★${budget.indieAvg.toFixed(1)}).`,
  }[preference];

  const correlationText = budget.verdict === 'up'
    ? `The bigger the budget, the higher you score it (r = ${budget.correlation.toFixed(2)}).`
    : budget.verdict === 'down'
      ? `The bigger the budget, the lower you score it (r = ${budget.correlation.toFixed(2)}).`
      : budget.verdict === 'flat'
        ? `Budget barely moves your score (r = ${budget.correlation.toFixed(2)}).`
        : null;

  return (
    <div className="cs-money">
      <BudgetQuadrant budget={budget} />

      <div className="cs-money-foot">
        <div className="cs-money-stat">
          <span className="cs-money-stat-val tabular-nums">{formatMoney(budget.medianBudget)}</span>
          <span className="cs-money-stat-lbl">median budget</span>
        </div>
        <div className="cs-money-stat">
          <span className="cs-money-stat-val tabular-nums">{Math.round(blockbusterShare * 100)}%</span>
          <span className="cs-money-stat-lbl">blockbusters</span>
        </div>
        <div className="cs-money-stat">
          <span className="cs-money-stat-val tabular-nums">{Math.round(indieShare * 100)}%</span>
          <span className="cs-money-stat-lbl">micro indies</span>
        </div>
      </div>

      {preferenceText && (
        <Takeaway accent="var(--color-accent-3)">{preferenceText}</Takeaway>
      )}
      {correlationText && (
        <Takeaway accent="var(--color-accent-4)" muted>{correlationText}</Takeaway>
      )}
    </div>
  );
}

/**
 * Section 05: Cast and money, the lighter trivia breather between the heavy
 * analytical sections.
 *
 * Returns:
 *   JSX.Element: The Cast and Money section.
 */
export default function Cast() {
  const { enrichedData } = useData();
  const stats = useCastStats(enrichedData);

  if (!stats.hasData) {
    return (
      <div className="cs-section">
        <header className="cs-header">
          <div className="cs-section-label">Section 05 / Cast &amp; Money</div>
          <h2 className="cs-title">The faces and the <span className="lb-hl-orange">money</span>.</h2>
          <p className="cs-subtitle">Add some watches so we can show you who and what is behind your films.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="cs-section">
      <header className="cs-header">
        <div className="cs-section-label">Section 05 / Cast &amp; Money</div>
        <h2 className="cs-title">The people and the <span className="lb-hl-orange">money</span>.</h2>
        <p className="cs-subtitle">
          Who keeps showing up on screen, which studios you keep coming back to, and whether your taste runs blockbuster or indie.
        </p>
      </header>

      <div className="cs-grid">
        <section className="cs-card cs-col-7" aria-label="Most watched cast">
          <CardHead
            icon={<CastIcon />}
            accent="var(--color-accent)"
            label="Most Watched Faces"
            note="one square per film"
          />
          <CastBoard topActors={stats.topActors} />
        </section>

        <section className="cs-card cs-col-5" aria-label="Favourite director and actor duo">
          <CardHead
            icon={<DuoIcon />}
            accent="var(--color-accent-2)"
            label="Favourite Duo"
          />
          <DuoCard duo={stats.duo} />
        </section>

        <section className="cs-card cs-col-6" aria-label="Favourite studios">
          <CardHead
            icon={<StudioIcon />}
            accent="var(--color-accent-3)"
            label="Studios You Trust"
            note="dot is your average rating"
          />
          <StudiosBoard studios={stats.studios} />
        </section>

        <section className="cs-card cs-col-6" aria-label="Budget and box office">
          <CardHead
            icon={<MoneyIcon />}
            accent="var(--color-accent-4)"
            label="The Money Behind It"
            note="budget vs box office"
          />
          <MoneyBoard budget={stats.budget} />
        </section>
      </div>
    </div>
  );
}
