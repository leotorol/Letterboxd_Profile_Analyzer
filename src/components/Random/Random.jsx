import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useRandomStats } from '../../hooks/useRandomStats';
import useSectionMotion from '../../hooks/useSectionMotion';
import { formatIsoDate } from '../../utils/dateFormat';
import { tipPosition } from '../../utils/positionTip';
import { TMDB_POSTER_LARGE, TMDB_POSTER_SMALL } from '../../utils/tmdbImages';
import PosterTip from '../PosterTip/PosterTip';
import './Random.css';

/*
 * Section 08 contract
 * THESIS: the closing chapter is an archive dossier, not another bento. Each
 *   fact becomes a measuring instrument: a film strip, a log spine, a ruler,
 *   a bookend spread and a ledger of milestones.
 * OWN-WORLD: the established dark cinematic surface, Letterboxd orange as the
 *   section signal, hairline rules, stamps, perforations and oversized numerals.
 * STORY: the user sees the films they missed, where their taste sits at both
 *   extremes, what the crowd agrees on, and when their log crossed the round numbers.
 * FIRST VIEWPORT: an editorial header with a ghost 08 and a chapter index,
 *   then the missing blockbuster as a full poster with a NOT SEEN stamp.
 * FORM: local extension of the established world, no new identity.
 */

const DOT_STEP = 8;
const COUNT_FORMAT = new Intl.NumberFormat('en-US');

/**
 * Formats a number with English thousands separators.
 *
 * Args:
 *   value (number|null): Number to format.
 *
 * Returns:
 *   string: Formatted number, or zero when the value is missing.
 */
function formatCount(value) {
  if (value == null || !Number.isFinite(value)) return '0';
  return COUNT_FORMAT.format(value);
}

/**
 * Converts a TMDB 0 to 10 average into the 0 to 5 scale the app uses.
 *
 * Args:
 *   voteAverage (number|null): TMDB average.
 *
 * Returns:
 *   string: One decimal rating on the 0 to 5 scale.
 */
function formatRating(voteAverage) {
  if (voteAverage == null || !Number.isFinite(voteAverage)) return '0.0';
  return (voteAverage / 2).toFixed(1);
}

/**
 * Turns a day count into a compact number and unit for the bookends.
 *
 * Args:
 *   days (number): Whole days between two watches.
 *
 * Returns:
 *   Object: Display value and unit, for example 8.4 years or 3 months.
 */
function formatSpanDays(days) {
  if (!Number.isFinite(days) || days <= 0) return { value: '0', unit: 'days' };
  if (days < 60) return { value: String(Math.round(days)), unit: 'days' };
  if (days < 365) return { value: String(Math.max(1, Math.round(days / 30.44))), unit: 'months' };

  const years = days / 365.25;
  return {
    value: years >= 10 ? String(Math.round(years)) : years.toFixed(1),
    unit: 'years',
  };
}

/**
 * Compresses a logarithmic axis value into a short label.
 *
 * Args:
 *   value (number): Axis value.
 *
 * Returns:
 *   string: Short label like 950, 12.4k or 1.2M.
 */
function formatLogTick(value) {
  if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

/**
 * Renders a film poster with a typographic fallback when TMDB has none.
 *
 * Args:
 *   film (Object): Film with name, posterPath and year.
 *   size (string): 'small' or 'large'.
 *   className (string, optional): Extra class names.
 *
 * Returns:
 *   JSX.Element: The poster block.
 */
function FilmPoster({ film, size, className = '' }) {
  const base = size === 'large' ? TMDB_POSTER_LARGE : TMDB_POSTER_SMALL;

  return (
    <div className={`rd-poster rd-poster-${size} ${className}`.trim()}>
      {film.posterPath ? (
        <img
          src={base + film.posterPath}
          alt={`Poster of ${film.name}`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="rd-poster-fallback">{film.name}</span>
      )}
    </div>
  );
}

/**
 * Renders the heading row shared by every band.
 *
 * Args:
 *   id (string): Anchor id for the section label.
 *   number (string): Chapter number.
 *   title (string): Band title.
 *   note (string): Short contextual note.
 *
 * Returns:
 *   JSX.Element: The band heading.
 */
function BandHead({ id, number, title, note }) {
  return (
    <div className="rd-band-head">
      <span className="rd-band-number tabular-nums" aria-hidden="true">{number}</span>
      <h3 className="rd-band-title" id={id}>{title}</h3>
      <span className="rd-band-note">{note}</span>
    </div>
  );
}

/**
 * Renders a compact message for loading, empty and error states.
 *
 * Args:
 *   title (string): State headline.
 *   body (string): Human explanation with the recovery path.
 *   actionLabel (string, optional): Retry button label.
 *   onAction (Function, optional): Retry callback.
 *
 * Returns:
 *   JSX.Element: The state panel.
 */
function PanelState({ title, body, actionLabel, onAction }) {
  return (
    <div className="rd-panel-state">
      <div className="rd-panel-state-title">{title}</div>
      <p className="rd-panel-state-body">{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="rd-retry" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton that mirrors the gap layout while the global catalog loads.
 *
 * Returns:
 *   JSX.Element: The loading block.
 */
function GapSkeleton() {
  return (
    <div className="rd-gap-skeleton" aria-busy="true">
      <span className="rd-sr-only">Loading the global TMDB catalog</span>
      <div className="rd-skeleton-poster" />
      <div className="rd-skeleton-copy">
        <span className="rd-skeleton-line is-sm" />
        <span className="rd-skeleton-line is-lg" />
        <span className="rd-skeleton-line" />
        <span className="rd-skeleton-line is-md" />
      </div>
    </div>
  );
}

/**
 * Renders the perforated coverage strip of the 100 most rated films of all time.
 *
 * Args:
 *   gap (Object): Gap bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The coverage block with its hover tooltip.
 */
function CoverageStrip({ gap }) {
  const wrapRef = useRef(null);
  const frameRef = useRef(0);
  const pendingRef = useRef(null);
  const hoverKeyRef = useRef(null);
  const [hover, setHover] = useState(null);
  const heroIndex = gap.popular
    ? gap.cells.findIndex((cell) => cell.tmdbId === gap.popular.tmdbId)
    : -1;
  const missingCount = gap.windowSize - gap.seenCount;

  /**
   * Computes the tooltip position once per animation frame.
   *
   * Every square used to read the layout on its own mouseenter, so a quick
   * sweep across the reel forced a reflow per cell and the whole strip
   * crawled. Batching it into one frame keeps it as snappy as the other charts.
   *
   * Args:
   *   None
   *
   * Returns:
   *   void
   */
  const commitHover = useCallback(() => {
    frameRef.current = 0;
    const pending = pendingRef.current;
    if (!pending || !pending.node.isConnected) return;

    const { cell, node } = pending;
    if (hoverKeyRef.current === cell.tmdbId) return;

    hoverKeyRef.current = cell.tmdbId;
    const { x, y } = tipPosition(wrapRef.current, node, 145);
    setHover({ cell, x, y });
  }, []);

  /**
   * Queues a cell for the next frame instead of updating state immediately.
   *
   * Args:
   *   cell (Object): Catalog film behind the square.
   *   node (HTMLElement): The square that got the pointer.
   *
   * Returns:
   *   void
   */
  const trackCell = useCallback((cell, node) => {
    pendingRef.current = { cell, node };
    if (!frameRef.current) frameRef.current = requestAnimationFrame(commitHover);
  }, [commitHover]);

  /**
   * Drops the tooltip when the pointer leaves the whole reel.
   *
   * Args:
   *   None
   *
   * Returns:
   *   void
   */
  const clearHover = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    pendingRef.current = null;
    hoverKeyRef.current = null;
    setHover(null);
  }, []);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  // keep the 100 squares stable across tooltip updates, otherwise every cell
  // crossing re renders the entire strip and it feels like wet mud
  const cellNodes = useMemo(() => gap.cells.map((cell, index) => {
    const isGap = gap.popular != null && cell.tmdbId === gap.popular.tmdbId;
    return (
      <span
        key={cell.tmdbId}
        className={`rd-cell${cell.seen ? ' is-seen' : ' is-missing'}${isGap ? ' is-gap' : ''}`}
        style={{ '--i': index }}
        onPointerEnter={(event) => trackCell(cell, event.currentTarget)}
        onPointerDown={(event) => trackCell(cell, event.currentTarget)}
      />
    );
  }), [gap.cells, gap.popular, trackCell]);

  // the reel only shows posters on hover, so warm the small thumbs once the
  // block gets close to the viewport. without this the first sweep fetches a
  // poster per cell and the tooltip looks stuck waiting for the network.
  useEffect(() => {
    const wrap = wrapRef.current;
    const paths = gap.cells.map((cell) => cell.posterPath).filter(Boolean);
    if (!wrap || paths.length === 0) return undefined;

    const preloads = [];
    let cancelled = false;
    let started = false;
    let index = 0;
    let observer = null;

    function loadBatch() {
      if (cancelled) return;
      const batch = paths.slice(index, index + 4);
      index += batch.length;
      for (const path of batch) {
        const img = new Image();
        img.decoding = 'async';
        img.src = TMDB_POSTER_SMALL + path;
        preloads.push(img);
      }
      if (index < paths.length) schedule();
    }

    function schedule() {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(loadBatch, { timeout: 2000 });
      } else {
        window.setTimeout(loadBatch, 60);
      }
    }

    function start() {
      if (started || cancelled) return;
      started = true;
      schedule();
    }

    if (typeof window.IntersectionObserver === 'function') {
      observer = new window.IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        observer = null;
        start();
      }, { rootMargin: '700px 0px' });
      observer.observe(wrap);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, [gap.cells]);

  return (
    <div className="rd-coverage" ref={wrapRef}>
      <div className="rd-coverage-head">
        <span className="rd-coverage-big tabular-nums">{gap.seenCount}</span>
        <span className="rd-coverage-of">of {gap.windowSize}</span>
        <span className="rd-coverage-copy">most rated films of all time on TMDB are already in your log.</span>
      </div>

      <div className="rd-filmstrip-head" aria-hidden="true">
        <span>#1 most rated</span>
        <span>#{gap.windowSize}</span>
      </div>

      <div
        className="rd-filmstrip"
        role="img"
        aria-label={`You have seen ${gap.seenCount} of the ${gap.windowSize} most rated films of all time on TMDB`}
        onPointerLeave={clearHover}
        onPointerCancel={clearHover}
      >
        <div className="rd-filmstrip-cells">{cellNodes}</div>
      </div>

      <span className="rd-filmstrip-hint">Swipe the reel to see the rest.</span>

      {hover && (
        <PosterTip
          film={{
            name: hover.cell.name,
            year: hover.cell.year,
            rating: hover.cell.userRating ?? null,
            posterPath: hover.cell.posterPath,
          }}
          sub={`${hover.cell.year || 'Year unknown'} · ${formatCount(hover.cell.voteCount)} TMDB votes · ${hover.cell.seen ? 'seen' : 'not seen'}`}
          style={{ left: hover.x, top: hover.y }}
        />
      )}

      <div className="rd-coverage-legend" aria-hidden="true">
        <span className="rd-legend-item">
          <span className="rd-legend-swatch is-seen" />seen <span className="rd-legend-count tabular-nums">{gap.seenCount}</span>
        </span>
        <span className="rd-legend-item">
          <span className="rd-legend-swatch is-missing" />still missing <span className="rd-legend-count tabular-nums">{missingCount}</span>
        </span>
        {gap.popular && heroIndex >= 0 && (
          <span className="rd-legend-item">
            <span className="rd-legend-swatch is-gap" />your gap
          </span>
        )}
      </div>

      <p className="rd-coverage-note">
        Each square is one film, ordered by total TMDB ratings. Green means you have seen it.
        {gap.popular && heroIndex >= 0
          ? ' Orange is the first one you missed.'
          : gap.popular
            ? ` You cleared every square, so your first miss sits just outside this top ${gap.windowSize} window.`
            : ' You cleared every square.'}
      </p>
    </div>
  );
}

/**
 * Section 01 band: the biggest films missing from the log.
 *
 * Args:
 *   gap (Object): Gap bundle from the hook.
 *   catalogState (string): Catalog loading state.
 *   retryCatalog (Function): Retry callback for a failed request.
 *
 * Returns:
 *   JSX.Element: The Gap band.
 */
function GapBand({ gap, catalogState, retryCatalog }) {
  const hero = gap.popular || gap.topRated;
  const secondary = gap.popular && gap.topRated ? gap.topRated : null;
  const heroIsMostVoted = Boolean(gap.popular);
  const heroCopy = heroIsMostVoted
    ? 'Everyone has seen it. You have not. This is the most rated film of all time on TMDB that is still missing from your log.'
    : 'This is the best rated film of all time on TMDB that is still missing from your log.';

  return (
    <section className="rd-band" aria-labelledby="rd-gap-title" data-reveal>
      <div className="rd-band-inner">
        <BandHead id="rd-gap-title" number="01" title="The Gap" note="the films everyone else got to first" />

        {(catalogState === 'loading' || catalogState === 'idle') && <GapSkeleton />}

        {catalogState === 'no-key' && (
          <PanelState
            title="The global gap needs a TMDB key"
            body="Add VITE_TMDB_API_KEY to your .env and upload the ZIP again. The rest of the archive still works without it."
          />
        )}

        {catalogState === 'error' && (
          <PanelState
            title="TMDB did not answer"
            body="The global lists could not load, so the gap is hiding. The local extremes and the ledger are still below."
            actionLabel="Try TMDB again"
            onAction={retryCatalog}
          />
        )}

        {catalogState === 'ready' && (
          <div className="rd-gap-layout">
            <div className="rd-gap-main">
              <div>
                <span className="rd-micro">{heroIsMostVoted ? 'The all time vote' : 'The all time critics pick'}</span>
                {hero ? (
                  <>
                    <h4 className="rd-gap-film">{hero.name}</h4>
                    <div className="rd-meta-row">
                      {hero.year && <span>{hero.year}</span>}
                      <span>{formatRating(hero.voteAverage)} / 5 on TMDB</span>
                      {hero.voteCount != null && <span>{formatCount(hero.voteCount)} votes</span>}
                    </div>
                    <p className="rd-body-copy">{heroCopy}</p>
                  </>
                ) : (
                  <>
                    <h4 className="rd-gap-film">You cleared the mainstream.</h4>
                    <p className="rd-body-copy">
                      Every film in the all time list is already in your log. Genuinely unhinged behaviour.
                    </p>
                  </>
                )}
              </div>

              {hero && (
                <div className="rd-gap-poster-wrap">
                  <FilmPoster film={hero} size="large" />
                  <span className="rd-stamp">not seen</span>
                </div>
              )}
            </div>

            {secondary && (
              <aside className="rd-gap-second" aria-label="The best rated film you have not seen">
                <span className="rd-micro">The all time critics pick</span>
                <div className="rd-gap-second-body">
                  <FilmPoster film={secondary} size="small" />
                  <div>
                    <div className="rd-gap-second-title">{secondary.name}</div>
                    <div className="rd-meta-row">
                      {secondary.year && <span>{secondary.year}</span>}
                      <span>{formatRating(secondary.voteAverage)} / 5</span>
                    </div>
                    <p className="rd-body-copy is-small">
                      The best rated film of all time on TMDB that you still have not watched.
                    </p>
                  </div>
                </div>
              </aside>
            )}

            {gap.cells.length > 0 && <CoverageStrip gap={gap} />}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Static dot layer. It has no per dot listeners on purpose: the field tracks
 * the pointer once and picks the nearest dot, otherwise 400 hover targets
 * fight each other and the tooltip crawls. Coño.
 *
 * Args:
 *   dots (Array<Object>): Dot layout from the hook.
 *
 * Returns:
 *   JSX.Element: The dot spans.
 */
const DotScatter = memo(function DotScatter({ dots }) {
  return (
    <>
      {dots.map((dot, index) => (
        <span
          key={`${dot.film.name}-${dot.film.year}-${index}`}
          className="rd-dot"
          style={{
            left: `${dot.x * 100}%`,
            bottom: `${dot.stack * DOT_STEP}px`,
            '--dot-x': dot.x,
          }}
        />
      ))}
    </>
  );
});

/**
 * Renders one dot per film on a horizontal axis, with the shared poster tooltip.
 *
 * The dots make the distribution literal: no abstract bars, every mark is a
 * film. Dots stack when films share a similar value. The parent can pass a
 * band or other marks as children so they sit behind the dots.
 *
 * Args:
 *   dots (Array<Object>): Dot layout from the hook with film, x and stack.
 *   ariaLabel (string): Screen reader summary of the chart.
 *   subFor (Function): Builds the tooltip meta line for one film.
 *   className (string, optional): Extra class names for sizing.
 *   children (ReactNode, optional): Background marks rendered under the dots.
 *
 * Returns:
 *   JSX.Element: The dot field and its tooltip.
 */
function DotField({ dots, ariaLabel, subFor, className = '', children }) {
  const plotRef = useRef(null);
  const frameRef = useRef(0);
  const pointerRef = useRef(null);
  const hoverFilmRef = useRef(null);
  const [hover, setHover] = useState(null);

  /**
   * Finds the dot nearest to the last pointer position and updates the tooltip.
   *
   * One pointer handler beats hundreds of per dot mouseenter listeners, which
   * overlapped each other and turned every quick mouse move into a state storm.
   *
   * Args:
   *   None
   *
   * Returns:
   *   void
   */
  const applyNearest = useCallback(() => {
    frameRef.current = 0;
    const point = pointerRef.current;
    const plot = plotRef.current;
    if (!point || !plot) return;

    const rect = plot.getBoundingClientRect();
    const px = point.x - rect.left;
    const py = point.y - rect.top;

    let best = null;
    let bestDist = 22 * 22;

    for (const dot of dots) {
      const dx = dot.x * rect.width - px;
      const dy = rect.height - dot.stack * DOT_STEP - 3.5 - py;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = dot;
      }
    }

    if (!best || best.film === hoverFilmRef.current) return;
    hoverFilmRef.current = best.film;

    const margin = Math.min(152, Math.max(0, rect.width / 2 - 8));
    const x = Math.max(margin, Math.min(rect.width - margin, best.x * rect.width)) + 4;
    const y = rect.height - best.stack * DOT_STEP - 7;
    setHover({ film: best.film, x, y });
  }, [dots]);

  const trackPointer = useCallback((event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (!frameRef.current) frameRef.current = requestAnimationFrame(applyNearest);
  }, [applyNearest]);

  const showAtPointer = useCallback((event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    applyNearest();
  }, [applyNearest]);

  const clearHover = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    pointerRef.current = null;
    hoverFilmRef.current = null;
    setHover(null);
  }, []);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className={`rd-dotfield ${className}`.trim()}>
      <div
        className="rd-dotfield-plot"
        role="img"
        aria-label={ariaLabel}
        ref={plotRef}
        onPointerMove={trackPointer}
        onPointerDown={showAtPointer}
        onPointerLeave={clearHover}
        onPointerCancel={clearHover}
      >
        {children}
        <DotScatter dots={dots} />
      </div>

      {hover && (
        <PosterTip
          film={{
            name: hover.film.name,
            year: hover.film.year,
            rating: hover.film.rating ?? null,
            posterPath: hover.film.posterPath || null,
          }}
          sub={subFor(hover.film)}
          style={{ left: hover.x, top: hover.y }}
        />
      )}
    </div>
  );
}

/**
 * Renders the logarithmic vote spine with the library density behind it.
 *
 * Args:
 *   popularity (Object): Popularity bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The spine block.
 */
function PopularitySpine({ popularity }) {
  const { niche, mainstream, median, q1, q3, logMin, logMax, dots, hiddenDots, flat } = popularity;
  const range = logMax - logMin || 1;
  const medianPos = flat ? 50 : ((Math.log10(Math.max(10, median)) - logMin) / range) * 100;
  const clampedMedian = flat ? 50 : Math.min(96, Math.max(4, medianPos));
  const middleTick = Math.pow(10, (logMin + logMax) / 2);
  const q1Pos = ((Math.log10(Math.max(10, q1)) - logMin) / range) * 100;
  const q3Pos = ((Math.log10(Math.max(10, q3)) - logMin) / range) * 100;
  const bandLeft = Math.min(q1Pos, q3Pos);
  const bandWidth = Math.max(1.5, Math.abs(q3Pos - q1Pos));
  const hasBand = q3 > q1;

  return (
    <div className="rd-spine-wrap">
      <div className="rd-spine">
        <div className="rd-spine-card is-niche">
          <span className="rd-micro">Least voted</span>
          <FilmPoster film={niche} size="small" />
          <div className="rd-spine-title">{niche.name}</div>
          <div className="rd-meta-row"><span>{formatCount(niche.voteCount)} TMDB votes</span></div>
        </div>

        <div className="rd-spine-chart">
          <DotField
            dots={dots}
            className="rd-dotfield-spine"
            ariaLabel={`Each dot is one film. Your library spans ${formatCount(popularity.min)} to ${formatCount(popularity.max)} TMDB votes, with a median of ${formatCount(median)}.`}
            subFor={(film) => `${film.year || 'year unknown'} · ${formatCount(film.voteCount)} TMDB votes`}
          >
            {hasBand && (
              <span
                className="rd-dotfield-band"
                style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
                aria-hidden="true"
              />
            )}
          </DotField>

          <div className="rd-spine-line" aria-hidden="true" />
          <span className="rd-spine-median" style={{ left: `${clampedMedian}%` }}>
            <span className="rd-spine-median-label">your median · {formatCount(median)} votes</span>
          </span>
          <div className="rd-spine-ticks" aria-hidden="true">
            <span>{formatLogTick(popularity.min)}</span>
            <span>{formatLogTick(middleTick)}</span>
            <span>{formatLogTick(popularity.max)}</span>
          </div>
        </div>

        <div className="rd-spine-card is-mainstream">
          <span className="rd-micro">Most voted</span>
          <FilmPoster film={mainstream} size="small" />
          <div className="rd-spine-title">{mainstream.name}</div>
          <div className="rd-meta-row"><span>{formatCount(mainstream.voteCount)} TMDB votes</span></div>
        </div>
      </div>

      <p className="rd-spine-caption">
        Each dot is one film. {hasBand
          ? `The shaded band is the middle 50% of your library, from ${formatCount(Math.round(q1))} to ${formatCount(Math.round(q3))} votes.`
          : 'Your vote counts are too tightly packed to draw a meaningful middle band.'} Hover or tap a dot to see the film and your rating.
        {hiddenDots > 0 ? ` ${formatCount(hiddenDots)} films are hidden in the densest stacks.` : ''}
      </p>
    </div>
  );
}

/**
 * Renders a physical ruler with the two extreme films at its ends.
 *
 * Args:
 *   title (string): Ruler title.
 *   note (string): Short explanation.
 *   lowFilm (Object): Film at the minimum end.
 *   highFilm (Object): Film at the maximum end.
 *   min (number): Minimum value.
 *   max (number): Maximum value.
 *   medianValue (number): Median value.
 *   formatValue (Function): Formatter for one value.
 *   lowLabel (string): Tag above the low film.
 *   highLabel (string): Tag above the high film.
 *   dots (Array<Object>): Film dots for the ruler.
 *   hiddenDots (number): Films hidden in the densest stacks.
 *   subFor (Function): Builds the tooltip meta line for one film.
 *   dotAriaLabel (string): Screen reader summary of the dot field.
 *
 * Returns:
 *   JSX.Element: The ruler block.
 */
function MeasureRuler({ title, note, lowFilm, highFilm, min, max, medianValue, formatValue, lowLabel, highLabel, dots, hiddenDots, subFor, dotAriaLabel }) {
  const medianPos = max === min ? 50 : ((medianValue - min) / (max - min)) * 100;
  const clampedMedian = Math.min(96, Math.max(4, medianPos));

  return (
    <div>
      <div className="rd-measure-head">
        <h4 className="rd-measure-title">{title}</h4>
        <span className="rd-measure-note">{note}</span>
      </div>

      <div className="rd-measure-films">
        <div className="rd-measure-film">
          <FilmPoster film={lowFilm} size="small" />
          <div>
            <span className="rd-measure-film-tag">{lowLabel}</span>
            <span className="rd-measure-film-name">{lowFilm.name}</span>
            <span className="rd-measure-film-value tabular-nums">{formatValue(min)}</span>
          </div>
        </div>
        <div className="rd-measure-film is-right">
          <div>
            <span className="rd-measure-film-tag">{highLabel}</span>
            <span className="rd-measure-film-name">{highFilm.name}</span>
            <span className="rd-measure-film-value tabular-nums">{formatValue(max)}</span>
          </div>
          <FilmPoster film={highFilm} size="small" />
        </div>
      </div>

      <div className="rd-ruler">
        <DotField
          dots={dots}
          className="rd-dotfield-ruler"
          ariaLabel={dotAriaLabel}
          subFor={subFor}
        />
        <div className="rd-ruler-line" aria-hidden="true" />
        {Array.from({ length: 21 }, (_, index) => (
          <span
            key={index}
            className={`rd-ruler-tick${index % 5 === 0 ? ' is-major' : ''}`}
            style={{ left: `${(index / 20) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="rd-ruler-marker" style={{ left: `${clampedMedian}%` }} aria-hidden="true">
          <span className="rd-ruler-marker-label">your median · {formatValue(medianValue)}</span>
        </span>
      </div>

      <div className="rd-ruler-scale" aria-hidden="true">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>

      <p className="rd-ruler-caption">
        Each dot is one film, stacked when values are close. Hover or tap a dot to see the film and your rating.
        {hiddenDots > 0 ? ` ${formatCount(hiddenDots)} films are hidden in the densest stacks.` : ''}
      </p>
    </div>
  );
}

/**
 * Renders one side of the best and worst rating duel.
 *
 * Args:
 *   tone (string): 'best' or 'worst'.
 *   label (string): Card label.
 *   film (Object): Rated film with name, year, rating, date and poster.
 *
 * Returns:
 *   JSX.Element: The rating call card.
 */
function RatingCall({ tone, label, film }) {
  return (
    <article className={`rd-rating-call is-${tone}`}>
      <div className="rd-rating-call-top">
        <span className="rd-rating-call-dot" aria-hidden="true" />
        <span className="rd-rating-call-label">{label}</span>
      </div>
      <div className="rd-rating-call-body">
        <FilmPoster film={film} size="small" />
        <div>
          <h5 className="rd-rating-call-film">{film.name}</h5>
          <div className="rd-rating-call-value tabular-nums">
            {film.rating.toFixed(1)}<span> / 5</span>
          </div>
          <div className="rd-meta-row">
            {film.year && <span>{film.year}</span>}
            <span>{film.date ? formatIsoDate(film.date) : 'date unavailable'}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Renders one end of the first and last bookend track.
 *
 * Args:
 *   label (string): Tag above the poster.
 *   film (Object): First or last film snapshot.
 *   isRight (boolean, optional): Aligns the right hand end to the edge.
 *
 * Returns:
 *   JSX.Element: The bookend side.
 */
function BookendSide({ label, film, isRight = false }) {
  return (
    <div className={`rd-bookend-side${isRight ? ' is-right' : ''}`}>
      <span className="rd-bookend-tag">{label}</span>
      <div className="rd-bookend-poster">
        <FilmPoster film={film} size="large" />
      </div>
      <div className="rd-bookend-film">{film.name}</div>
      <div className="rd-meta-row">
        {film.year && <span>{film.year}</span>}
        <span>{film.date ? formatIsoDate(film.date) : 'date unavailable'}</span>
      </div>
    </div>
  );
}

/**
 * Section 03 band: the first and last film, plus the best and worst ratings.
 *
 * Args:
 *   bookends (Object): Bookend bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The Bookends band.
 */
function BookendsBand({ bookends }) {
  if (!bookends.available) return null;

  const { first, last, best, worst, spanDays, hasDates, ratedCount } = bookends;
  const sameBookend = first.name === last.name && first.year === last.year;
  const bothDated = Boolean(first.date && last.date);
  const span = formatSpanDays(spanDays);
  const sameRating = best && worst && best.rating === worst.rating;

  return (
    <section className="rd-band" aria-labelledby="rd-bookends-title" data-reveal>
      <div className="rd-band-inner">
        <BandHead id="rd-bookends-title" number="03" title="The Bookends" note="" />

        <div className="rd-bookends-block">
          <div className="rd-subhead-row">
            <h4 className="rd-subhead">The First and the Last</h4>
            <p className="rd-body-copy is-small">The first film in your log and the most recent one.</p>
          </div>

          {sameBookend ? (
            <div className="rd-bookend-single">
              <span className="rd-bookend-tag">Your only film so far</span>
              <div className="rd-bookend-poster">
                <FilmPoster film={first} size="large" />
              </div>
              <div>
                <div className="rd-bookend-film">{first.name}</div>
                <div className="rd-meta-row">
                  {first.year && <span>{first.year}</span>}
                  <span>{first.date ? formatIsoDate(first.date) : 'date unavailable'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rd-bookend-track">
              <BookendSide label="Where it started" film={first} />

              <div className="rd-bookend-center">
                {bothDated && spanDays > 0 ? (
                  <>
                    <div className="rd-bookend-span">
                      <span className="rd-bookend-span-value tabular-nums">{span.value}</span>
                      <span className="rd-bookend-span-unit">{span.unit}</span>
                    </div>
                    <span className="rd-bookend-span-label">between your first and latest watch</span>
                  </>
                ) : (
                  <span className="rd-bookend-span-label">
                    {bothDated
                      ? 'Both bookends landed on the same day'
                      : 'Not enough dated watches to measure the span'}
                  </span>
                )}
                <span className="rd-bookend-rule" aria-hidden="true" />
              </div>

              <BookendSide label="Where you are now" film={last} isRight />
            </div>
          )}

          {!hasDates && (
            <p className="rd-footnote">
              Your export had no watch dates, so the bookends follow the order of your file.
            </p>
          )}
        </div>

        <div className="rd-bookends-block">
          <div className="rd-subhead-row">
            <h4 className="rd-subhead">Your Best and Worst Calls</h4>
            <p className="rd-body-copy is-small">The films you rated highest and lowest. No crowd, no average, just your taste.</p>
          </div>

          {ratedCount === 0 ? (
            <PanelState
              title="No ratings yet"
              body="Rate a few films on Letterboxd and your best and worst calls will appear here."
            />
          ) : ratedCount === 1 ? (
            <div className="rd-rating-single">
              <RatingCall tone="best" label="Your only rated film" film={best} />
              <p className="rd-footnote">Only one rated film so far. The other side of the duel is waiting for you.</p>
            </div>
          ) : (
            <div className="rd-rating-duel">
              <RatingCall tone="best" label="Your best call" film={best} />
              <div className="rd-rating-duel-divider" aria-hidden="true"><span>or</span></div>
              <RatingCall tone="worst" label="Your worst call" film={worst} />
            </div>
          )}

          {ratedCount > 1 && sameRating && (
            <p className="rd-footnote">Every film you have rated got the same score so far. The duel will get more interesting.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Section 02 band: popularity and release year extremes.
 *
 * Args:
 *   popularity (Object): Popularity bundle.
 *   era (Object): Release year bundle.
 *
 * Returns:
 *   JSX.Element: The Extremes band.
 */
function ExtremesBand({ popularity, era }) {
  return (
    <section className="rd-band" aria-labelledby="rd-extremes-title" data-reveal>
      <div className="rd-band-inner">
        <BandHead id="rd-extremes-title" number="02" title="The Extremes" note="" />

        <div className="rd-extreme-block">
          <div className="rd-subhead-row">
            <h4 className="rd-subhead">The Deep End</h4>
            <p className="rd-body-copy is-small">
              Every film as a dot on a log scale of TMDB votes. Dots stack when counts are close.
            </p>
          </div>
          {popularity.available ? (
            <PopularitySpine popularity={popularity} />
          ) : (
            <PanelState
              title="No popularity data"
              body="This needs the TMDB vote counts from enrichment. Add a key and upload the ZIP again."
            />
          )}
        </div>

        <div className="rd-extreme-block">
          {era.available ? (
            <MeasureRuler
              title="The Timeline"
              note=""
              lowFilm={era.oldest}
              highFilm={era.newest}
              min={era.min}
              max={era.max}
              medianValue={era.median}
              formatValue={(value) => String(value)}
              lowLabel="Oldest film"
              highLabel="Newest film"
              dots={era.dots}
              hiddenDots={era.hiddenDots}
              subFor={(film) => String(film.year)}
              dotAriaLabel={`Each dot is one film. Release years from ${era.min} to ${era.max}, median ${era.median}.`}
            />
          ) : (
            <PanelState
              title="No release years"
              body="This one needs at least two films with a release year from TMDB."
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Section 04 band: the milestone ledger and the first 50 progress state.
 *
 * Args:
 *   milestones (Object): Milestone bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The Ledger band.
 */
function LedgerBand({ milestones }) {
  return (
    <section className="rd-band" aria-labelledby="rd-ledger-title" data-reveal>
      <div className="rd-band-inner">
        <BandHead id="rd-ledger-title" number="04" title="The Ledger" note="" />

        {milestones.reached.length === 0 ? (
          <div className="rd-first-milestone">
            <div className="rd-first-count tabular-nums">
              {milestones.total}<span> / {milestones.next}</span>
            </div>
            <p className="rd-body-copy">
              Your ledger starts at 50 films. You have {milestones.total}, so {milestones.nextGap} to go. Log a few more and the round numbers will show up here.
            </p>
            <div
              className="rd-first-track"
              role="img"
              aria-label={`${milestones.total} of ${milestones.next} films`}
            >
              <span className="rd-first-fill" style={{ width: `${milestones.progress * 100}%` }} />
            </div>
          </div>
        ) : (
          <>
            <p className="rd-ledger-intro">
              Each step is {milestones.step} films. This is the exact film that crossed each round number, in the order you logged it.
            </p>
            <div className="rd-ledger">
              <div className="rd-ledger-track">
                {milestones.reached.map((entry, index) => (
                  <div className="rd-ledger-step" key={entry.count} style={{ '--i': index }}>
                    <div className="rd-ledger-number tabular-nums">#{entry.count}</div>
                    <FilmPoster film={entry.film} size="small" />
                    <div className="rd-ledger-copy">
                      <div className="rd-ledger-film">{entry.film.name}</div>
                      <div className="rd-ledger-date">
                        {entry.film.date ? formatIsoDate(entry.film.date) : 'date unavailable'}
                      </div>
                    </div>
                    <span className="rd-ledger-stem" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rd-ledger-foot">
              <span>{formatCount(milestones.total)} films logged</span>
              {milestones.next && (
                <span>Next stop: #{milestones.next}, {milestones.nextGap} films away</span>
              )}
            </div>
          </>
        )}

        {!milestones.hasDates && (
          <p className="rd-footnote">
            Your export had no watch dates, so the ledger follows the order of your file.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Section 08: The Deep Cuts. The shareable closing chapter.
 *
 * Returns:
 *   JSX.Element: The Deep Cuts section.
 */
export default function Random() {
  const { enrichedData } = useData();
  const stats = useRandomStats(enrichedData);
  const sectionRef = useRef(null);
  useSectionMotion(sectionRef);

  return (
    <div className="rd-section" id="section-08" data-section ref={sectionRef}>
      <header className="rd-header">
        <div className="rd-header-inner" data-reveal>
          <div className="rd-ghost-number" aria-hidden="true">
            <span>0</span>
            <span>8</span>
          </div>
          <div className="rd-header-copy">
            <div className="rd-section-label">Section 08 / The Deep Cuts</div>
            <h2 className="rd-title">
              The weird <span className="lb-hl-orange">edges</span> of your taste.
            </h2>
            <p className="rd-subtitle">
              The numbers that did not fit anywhere else, and the films behind them. Strange corners of your log, ready to screenshot.
            </p>
          </div>
        </div>
      </header>

      {!stats.hasData ? (
        <section className="rd-band" data-reveal>
          <div className="rd-band-inner">
            <PanelState
              title="Nothing to riff on yet"
              body="Log a few films on Letterboxd, export the ZIP again, and the weird corners will show up here."
            />
          </div>
        </section>
      ) : (
        <>
          <GapBand
            gap={stats.gap}
            catalogState={stats.catalogState}
            retryCatalog={stats.retryCatalog}
          />
          <ExtremesBand
            popularity={stats.popularity}
            era={stats.era}
          />
          <BookendsBand bookends={stats.bookends} />
          <LedgerBand milestones={stats.milestones} />
        </>
      )}
    </div>
  );
}
