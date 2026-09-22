import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useReviewStats } from '../../hooks/useReviewStats';
import { TMDB_POSTER_SMALL, TMDB_POSTER_MEDIUM } from '../../utils/tmdbImages';
import './Reviews.css';

/*
 * Section 06 contract
 * THESIS: every other section reads what you watch; this one reads how you
 *   write. One packed word cloud is the thesis, refusing the stock tag list.
 * OWN-WORLD: the shared dark bento, Letterboxd blue as the section accent, a
 *   cloud painted in the Letterboxd tri colour and a hand drawn box plot.
 * STORY: the writer sees the words they lean on, how their takes got longer or
 *   shorter, and the reviews they went hardest on, then picks one to reread.
 * FIRST VIEWPORT: full width word cloud card, sizes by frequency, hover for the
 *   count and the film it came from.
 * FORM: local extension of the established world, no new identity.
 */

const FONT_FAMILY = "'Plus Jakarta Sans', 'Inter', sans-serif";

// one offscreen canvas reused for every text measurement, created lazily
let measureCanvas = null;

/**
 * Lazily creates the shared 2D context used to measure word widths.
 *
 * Returns:
 *   CanvasRenderingContext2D: Context for text measurement.
 */
function getMeasureContext() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

// the cloud borrows the Letterboxd brand trio plus two page accents
const CLOUD_PALETTE = [
  'var(--color-lb-green)',
  'var(--color-lb-blue)',
  'var(--color-lb-orange)',
  'var(--color-accent-2)',
  'var(--color-accent-3)',
];

const CloudIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.5 4.5 4.5 0 0 0 7 19h10.5z" />
  </svg>
);

const BarsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="20" y2="20" />
    <rect x="5" y="12" width="3" height="6" rx="1" />
    <rect x="10.5" y="8" width="3" height="10" rx="1" />
    <rect x="16" y="4" width="3" height="14" rx="1" />
  </svg>
);

const WaveIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="10" x2="4" y2="14" />
    <line x1="8" y1="6" x2="8" y2="18" />
    <line x1="12" y1="9" x2="12" y2="15" />
    <line x1="16" y1="4" x2="16" y2="20" />
    <line x1="20" y1="10" x2="20" y2="14" />
  </svg>
);

const QuillIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

/**
 * Packs words into a cloud by walking an outward spiral per word.
 *
 * Big words are placed first near the middle, every later word spirals out
 * until it finds a spot that overlaps nothing, so the cloud fills itself
 * without a physics engine. Deterministic, so it never jumps between renders.
 *
 * Args:
 *   words (Array<Object>): { word, count, film } sorted by count desc.
 *   width (number): Container width in px.
 *   height (number): Container height in px.
 *   fontFamily (string): Font stack used for measuring and rendering.
 *   measureText (Function): (text, font) => width in px.
 *
 * Returns:
 *   Array<Object>: Placed words with { word, count, left, top, w, h, size, font }.
 */
function packCloud(words, width, height, fontFamily, measureText) {
  if (!words.length || width <= 0 || height <= 0) return [];

  const maxCount = words[0].count;
  const minCount = words[words.length - 1].count;
  // when every word is used the same number of times there is no spread to
  // scale on, so they all land mid size instead of collapsing to the minimum
  const flat = maxCount === minCount;
  const span = Math.max(1, maxCount - minCount);
  // wide size range so the words you lean on dwarf the rare ones
  const maxSize = Math.max(24, Math.min(78, width / 5.6));
  const minSize = Math.max(11, maxSize * 0.2);
  const cx = width / 2;
  const cy = height / 2;
  // a tall narrow container should use its height, a wide one its width
  const portrait = height > width * 0.85;
  const xMul = portrait ? 1 : 1.2;
  const yMul = portrait ? 1.05 : 0.66;
  const placed = [];
  const result = [];

  for (const item of words) {
    // linear scaling instead of a square root keeps the big words big and the
    // small ones small, so the contrast actually reads
    const t = flat ? 0.55 : (item.count - minCount) / span;
    const size = minSize + t * (maxSize - minSize);
    const font = `800 ${size}px ${fontFamily}`;
    const w = measureText(item.word, font) + 5;
    const h = size * 1.1;
    let spot = null;

    for (let i = 0; i < 1600; i++) {
      // a tighter spiral plus a 1px gap packs the words shoulder to shoulder
      const angle = i * 0.22;
      const radius = 2 * angle;
      const x = cx + radius * Math.cos(angle) * xMul;
      const y = cy + radius * Math.sin(angle) * yMul;
      const left = x - w / 2;
      const top = y - h / 2;
      if (left < 0 || top < 0 || left + w > width || top + h > height) continue;

      let hit = false;
      for (const p of placed) {
        if (left < p.left + p.w + 1 && left + w + 1 > p.left && top < p.top + p.h + 1 && top + h + 1 > p.top) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      spot = { left, top };
      break;
    }

    if (!spot) continue;
    placed.push({ left: spot.left, top: spot.top, w, h });
    result.push({ ...item, left: spot.left, top: spot.top, w, h, size, font });
  }

  return result;
}

/**
 * Frequency word cloud with hover and tap tooltips.
 *
 * Args:
 *   words (Array<Object>): Ranked words from the stats hook.
 *
 * Returns:
 *   JSX.Element: The packed cloud block.
 */
function WordCloud({ words }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fontsReady, setFontsReady] = useState(
    () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded',
  );
  const [hoverIdx, setHoverIdx] = useState(null);
  const [pinnedIdx, setPinnedIdx] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // wait for the display font, otherwise the first pass measures the fallback
  useEffect(() => {
    if (!document.fonts || document.fonts.status === 'loaded') return undefined;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const layout = useMemo(() => {
    if (!size.width || !size.height || !words.length) return [];
    const ctx = getMeasureContext();
    const fontFamily = fontsReady ? FONT_FAMILY : 'Inter, sans-serif';
    const measureText = (text, font) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
    return packCloud(words, size.width, size.height, fontFamily, measureText);
  }, [words, size.width, size.height, fontsReady]);

  const activeIdx = pinnedIdx ?? hoverIdx;
  const active = activeIdx != null ? layout[activeIdx] : null;

  if (!words.length) {
    return <p className="rv-empty">No repeated words yet. Write a few more reviews and your vocabulary shows up here.</p>;
  }

  // arrow keys walk the cloud instead of tabbing through sixty words
  const move = (step) => {
    if (!layout.length) return;
    setHoverIdx((prev) => {
      const next = prev == null ? 0 : (prev + step + layout.length) % layout.length;
      return next;
    });
  };

  return (
    <>
      <div
        className="rv-cloud"
        ref={wrapRef}
        role="img"
        tabIndex={0}
        aria-label="Word cloud of your most used words, sized by frequency; arrow keys move between words"
        onPointerLeave={() => {
          if (pinnedIdx == null) setHoverIdx(null);
        }}
        onFocus={() => {
          if (hoverIdx == null && pinnedIdx == null) setHoverIdx(0);
        }}
        onBlur={() => {
          setHoverIdx(null);
          setPinnedIdx(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          if ((e.key === 'Enter' || e.key === ' ') && hoverIdx != null) {
            e.preventDefault();
            setPinnedIdx((prev) => (prev === hoverIdx ? null : hoverIdx));
          }
        }}
      >
        {layout.map((item, i) => {
          const isActive = activeIdx === i;
          return (
            <button
              key={item.word}
              type="button"
              tabIndex={-1}
              className={`rv-cloud-word${isActive ? ' is-active' : ''}`}
              style={{
                left: item.left,
                top: item.top,
                fontSize: item.size,
                color: CLOUD_PALETTE[i % CLOUD_PALETTE.length],
                '--word-delay': `${Math.min(i * 18, 700)}ms`,
              }}
              aria-hidden="true"
              onPointerEnter={() => setHoverIdx(i)}
              onClick={() => setPinnedIdx((prev) => (prev === i ? null : i))}
            >
              {item.word}
            </button>
          );
        })}

        {active && (
          <div className="rv-cloud-tip" style={{ left: active.left + active.w / 2, top: active.top }}>
            <span className="rv-cloud-tip-count tabular-nums">{active.count}</span>
            <span className="rv-cloud-tip-label">{active.count === 1 ? 'time' : 'times'}</span>
          </div>
        )}
      </div>

      <ul className="rv-sr-only" aria-label="Your most used words">
        {words.slice(0, 12).map((item) => (
          <li key={item.word}>{item.word}: {item.count}</li>
        ))}
      </ul>
    </>
  );
}

// review length chart frame, shared by every piece of maths below
const BARS_W = 620;
const BARS_H = 300;
const BARS_PAD_L = 48;
const BARS_PAD_R = 20;
const BARS_PAD_T = 30;
const BARS_PAD_B = 56;

/**
 * Average review length per year as plain labelled columns.
 *
 * A taller column means longer reviews that year, the number on top is the
 * average word count, and the orange line joins the averages so the direction
 * is obvious. Hovering a year opens a dark micro tooltip with the spread.
 *
 * Args:
 *   series (Array<Object>): Per year { year, count, avg, min, max } from the hook.
 *   verdict (Object): { direction, delta } from the hook.
 *
 * Returns:
 *   JSX.Element: The review length card body.
 */
function LengthBars({ series, verdict }) {
  const [hover, setHover] = useState(null);

  const chart = useMemo(() => {
    if (series.length === 0) return null;

    const plotW = BARS_W - BARS_PAD_L - BARS_PAD_R;
    const plotH = BARS_H - BARS_PAD_T - BARS_PAD_B;
    // round the axis to a human step so short reviews do not leave a mountain
    // of dead space above the columns
    const rawMax = Math.max(10, ...series.map((s) => s.avg));
    const step = rawMax <= 20 ? 5 : rawMax <= 60 ? 10 : rawMax <= 150 ? 25 : 50;
    const yMax = Math.ceil(rawMax / step) * step;
    const n = series.length;
    const slot = plotW / n;
    const barW = Math.min(52, slot * 0.52);

    const xAt = (i) => BARS_PAD_L + slot * (i + 0.5);
    const yAt = (v) => BARS_PAD_T + (1 - v / yMax) * plotH;

    // ticks on the same human step as the axis, so no ugly 13 / 38 labels
    const ticks = [];
    for (let v = 0; v <= yMax; v += step) ticks.push(v);
    const trend = series
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(s.avg).toFixed(1)}`)
      .join(' ');

    return { plotH, yMax, xAt, yAt, slot, barW, ticks, trend };
  }, [series]);

  if (!chart) {
    return <p className="rv-empty">No reviews with dates to chart yet.</p>;
  }

  const { yAt, xAt, slot, barW, ticks, trend } = chart;

  const verdictMap = {
    up: { text: 'Your reviews have gotten longer over the years', color: 'var(--color-lb-green)' },
    down: { text: 'Your reviews have gotten shorter over the years', color: 'var(--color-accent-warm)' },
    steady: { text: 'Your review length has stayed pretty consistent', color: 'var(--color-lb-blue)' },
    none: { text: 'Not enough history for a clear trend yet', color: 'var(--color-text-faint)' },
  };
  const verdictInfo = verdictMap[verdict.direction] || verdictMap.none;

  return (
    <div className="rv-bars">
      <svg
        className="rv-bars-svg"
        viewBox={`0 0 ${BARS_W} ${BARS_H}`}
        role="img"
        aria-label="Average review length in words per year"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="rv-bars-grid" x1={BARS_PAD_L} y1={yAt(tick)} x2={BARS_W - BARS_PAD_R} y2={yAt(tick)} />
            <text className="rv-bars-axis" x={BARS_PAD_L - 10} y={yAt(tick)} textAnchor="end" dominantBaseline="middle">
              {tick}
            </text>
          </g>
        ))}

        {series.map((row, i) => {
          const x = xAt(i);
          const top = yAt(row.avg);
          const isActive = hover === i;
          return (
            <g
              key={row.year}
              className={`rv-bars-group${isActive ? ' is-active' : ''}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${row.year}: average ${Math.round(row.avg)} words across ${row.count} reviews`}
            >
              <rect
                className="rv-bars-hit"
                x={x - slot / 2}
                y={BARS_PAD_T}
                width={slot}
                height={chart.plotH}
              />
              <rect
                className="rv-bars-bar"
                x={x - barW / 2}
                y={top}
                width={barW}
                height={Math.max(2, yAt(0) - top)}
                rx={4}
              />
              <text className="rv-bars-year" x={x} y={BARS_H - 32} textAnchor="middle">{row.year}</text>
              <text className="rv-bars-count" x={x} y={BARS_H - 16} textAnchor="middle">
                {row.count} {row.count === 1 ? 'review' : 'reviews'}
              </text>
            </g>
          );
        })}

        {series.length > 1 && <path className="rv-bars-trend" d={trend} />}
        {series.map((row, i) => (
          <circle key={`dot-${row.year}`} className="rv-bars-trend-dot" cx={xAt(i)} cy={yAt(row.avg)} r={3} />
        ))}

        {series.map((row, i) => (
          <text
            key={`value-${row.year}`}
            className="rv-bars-value tabular-nums"
            x={xAt(i)}
            y={yAt(row.avg) - 10}
            textAnchor="middle"
          >
            {Math.round(row.avg)}
          </text>
        ))}
      </svg>

      {hover != null && series[hover] && (
        <div className="rv-bars-tip" style={{ '--tip-x': `${(xAt(hover) / BARS_W) * 100}%` }}>
          <span className="rv-bars-tip-year tabular-nums">{series[hover].year}</span>
          <span className="rv-bars-tip-row">
            <span className="rv-bars-tip-val tabular-nums">{Math.round(series[hover].avg)}</span> words on average
          </span>
          <span className="rv-bars-tip-row">
            <span className="rv-bars-tip-val tabular-nums">{series[hover].count}</span> {series[hover].count === 1 ? 'review' : 'reviews'}
          </span>
          <span className="rv-bars-tip-range tabular-nums">
            range {series[hover].min} to {series[hover].max}
          </span>
        </div>
      )}

      <div className="rv-bars-legend" aria-hidden="true">
        <span className="rv-bars-legend-item"><span className="rv-bars-legend-bar" /> average words</span>
        <span className="rv-bars-legend-item"><span className="rv-bars-legend-line" /> trend</span>
      </div>

      <div className="rv-verdict" style={{ '--verdict-color': verdictInfo.color }}>
        <span className="rv-verdict-dot" />
        {verdictInfo.text}
        {verdict.direction !== 'none' && verdict.direction !== 'steady' && (
          <span className="rv-verdict-delta tabular-nums">
            {verdict.delta > 0 ? `+${Math.round(verdict.delta)}` : `\u2212${Math.abs(Math.round(verdict.delta))}`} words
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact numeric portrait of the writer: how much and how often they write.
 *
 * Args:
 *   stats (Object): Stats bundle from the hook.
 *
 * Returns:
 *   JSX.Element: The fingerprint card body.
 */
function WritingFingerprint({ stats }) {
  // how long a reader would spend on one of your reviews, 200 words a minute
  const readMinutes = Math.max(1, Math.round(stats.avgWords / 200));
  const rows = [
    { label: 'reviews written', value: stats.totalReviews.toLocaleString() },
    { label: 'words on the page', value: stats.totalWords.toLocaleString() },
    { label: 'words per review', value: Math.round(stats.avgWords).toLocaleString() },
    {
      label: 'longest single take',
      value: stats.longest ? `${stats.longest.words.toLocaleString()} words` : 'n/a',
      sub: stats.longest ? stats.longest.name : null,
    },
    {
      label: 'busiest review year',
      value: stats.busiestYear ? String(stats.busiestYear.year) : 'n/a',
      sub: stats.busiestYear ? `${stats.busiestYear.count} reviews` : null,
    },
  ];

  return (
    <div className="rv-fingerprint">
      <div className="rv-fingerprint-rows">
        {rows.map((row) => (
          <div className="rv-fingerprint-row" key={row.label}>
            <div className="rv-fingerprint-label-group">
              <span className="rv-fingerprint-label">{row.label}</span>
              {row.sub && <span className="rv-fingerprint-sub">{row.sub}</span>}
            </div>
            <span className="rv-fingerprint-value tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="rv-fingerprint-note">
        That is {Math.round(stats.avgWords)} words per film on average, roughly{' '}
        {readMinutes} minute{readMinutes === 1 ? '' : 's'} of reading for every one you log.
        {readMinutes <= 1 && ' Weak'}
      </p>
    </div>
  );
}

/**
 * Featured reviews: one hero take plus a ranked picker of the runners up.
 *
 * Picking a review from the list swaps it into the hero, so the reader can
 * actually reread the ones they went hardest on instead of just seeing a count.
 *
 * Args:
 *   featured (Array<Object>): Top reviews from the hook.
 *
 * Returns:
 *   JSX.Element: The featured reviews card body.
 */
function FeaturedReviews({ featured }) {
  const [activeIdx, setActiveIdx] = useState(0);
  // stores which review is expanded instead of a boolean, so picking another
  // review collapses the old one without an effect resetting state
  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!featured.length) {
    return <p className="rv-empty">No reviews to feature yet.</p>;
  }

  const active = featured[activeIdx];
  const isLong = active.text.length > 420;
  const expanded = expandedIdx === activeIdx;

  // the poster is its own fixed column so the text never runs underneath it.
  // inside the right column the picker floats, so an expanded review flows
  // under the picker and out to the full card width
  return (
    <div className="rv-featured">
      <div className="rv-feature-poster">
        {active.posterPath ? (
          <img src={TMDB_POSTER_MEDIUM + active.posterPath} alt={`Poster of ${active.name}`} loading="lazy" decoding="async" />
        ) : (
          <span className="rv-poster-missing" aria-hidden="true">{active.name.slice(0, 1)}</span>
        )}
      </div>

      <div className="rv-feature-main">
        <div className="rv-feature-list" role="group" aria-label="Your longest reviews">
          <span className="rv-feature-list-title">Ranked by how much you had to say</span>
          {featured.map((review, i) => (
            <button
              key={`${review.name}-${review.year}-${i}`}
              type="button"
              className={`rv-rank-row${i === activeIdx ? ' is-active' : ''}`}
              aria-pressed={i === activeIdx}
              onClick={() => setActiveIdx(i)}
            >
              <span className="rv-rank-num tabular-nums">{i + 1}</span>
              <span className="rv-rank-poster">
                {review.posterPath ? (
                  <img src={TMDB_POSTER_SMALL + review.posterPath} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="rv-poster-missing" aria-hidden="true">{review.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="rv-rank-main">
                <span className="rv-rank-name">{review.name}</span>
                <span className="rv-rank-meta">{review.year}{review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ''}</span>
              </span>
              <span className="rv-rank-words tabular-nums">{review.words}</span>
            </button>
          ))}
        </div>

        <div className="rv-feature-body">
          <div className="rv-feature-head">
            <div className="rv-feature-head-row">
              <div className="rv-feature-title-group">
                <span className="rv-feature-name">{active.name}</span>
                <span className="rv-feature-year">{active.year}</span>
              </div>
              <div className="rv-feature-metrics">
                {active.rating != null && <span className="rv-feature-rating tabular-nums">★ {active.rating.toFixed(1)}</span>}
                <span className="rv-feature-words tabular-nums">{active.words.toLocaleString()} words</span>
              </div>
            </div>
          </div>

          <p className={`rv-feature-text${isLong && !expanded ? ' is-clamped' : ''}`}>{active.text}</p>

          {isLong && (
            <button type="button" className="rv-feature-more" onClick={() => setExpandedIdx(expanded ? null : activeIdx)}>
              {expanded ? 'Show less' : 'Read the whole thing'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Section 06: the analysis of your own reviews.
 *
 * Returns:
 *   JSX.Element: The Reviews section.
 */
export default function Reviews() {
  const { rawData, enrichedData } = useData();
  const stats = useReviewStats(rawData, enrichedData);

  if (!stats.hasData) {
    return (
      <div className="rv-section">
        <header className="rv-header">
          <div className="rv-section-label">Section 06 / Reviews</div>
          <h2 className="rv-title">The voice behind the <span className="lb-hl-blue">watcher</span>.</h2>
          <p className="rv-subtitle">
            This is where we read what you had to say. Your export has no written reviews yet, so there is nothing to analyse here.
          </p>
        </header>
        <div className="rv-grid">
          <section className="rv-card rv-col-12">
            <p className="rv-empty">
              Write a few reviews on Letterboxd, export your data again, and drop the ZIP back in. This section will fill up with the words you lean on, how long your takes run, and the reviews you went hardest on.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const { stats: writing } = stats;

  return (
    <div className="rv-section">
      <header className="rv-header">
        <div className="rv-section-label">Section 06 / Reviews</div>
        <h2 className="rv-title">The voice behind the <span className="lb-hl-blue">watcher</span>.</h2>
        <p className="rv-subtitle">
          You have watched a lot. Now let's read what you actually wrote about it: the words you reach for, how long your takes run, and the ones you went hardest on.
        </p>
      </header>

      <div className="rv-grid">
        <section className="rv-card rv-col-12" aria-label="Your word cloud">
          <div className="rv-card-head">
            <div className="rv-card-title-group">
              <div className="rv-card-icon" style={{ color: 'var(--color-lb-blue)' }}>
                <CloudIcon />
              </div>
              <div className="rv-card-label">Your Writing, In One Picture</div>
            </div>
            <div className="rv-card-note">every word sized by how often you use it</div>
          </div>

          <WordCloud words={stats.wordCloud} />

          {writing.topWord && (
            <div className="rv-cloud-foot">
              <span className="rv-cloud-foot-label">Your most used word</span>
              <span className="rv-cloud-foot-word">{writing.topWord.word}</span>
              <span className="rv-cloud-foot-count tabular-nums">{writing.topWord.count} times</span>
            </div>
          )}
        </section>

        <section className="rv-card rv-col-7" aria-label="Review length over time">
          <div className="rv-card-head">
            <div className="rv-card-title-group">
              <div className="rv-card-icon" style={{ color: 'var(--color-lb-orange)' }}>
                <BarsIcon />
              </div>
              <div className="rv-card-label">How Long Your Takes Run</div>
            </div>
            <div className="rv-card-note">words per review, by year</div>
          </div>
          <LengthBars series={stats.lengthByYear} verdict={stats.lengthVerdict} />
        </section>

        <section className="rv-card rv-col-5" aria-label="Your writing fingerprint">
          <div className="rv-card-head">
            <div className="rv-card-title-group">
              <div className="rv-card-icon" style={{ color: 'var(--color-accent-2)' }}>
                <WaveIcon />
              </div>
              <div className="rv-card-label">Your Writing Fingerprint</div>
            </div>
          </div>
          <WritingFingerprint stats={writing} />
        </section>

        <section className="rv-card rv-col-12" aria-label="Your longest reviews">
          <div className="rv-card-head">
            <div className="rv-card-title-group">
              <div className="rv-card-icon" style={{ color: 'var(--color-accent-3)' }}>
                <QuillIcon />
              </div>
              <div className="rv-card-label">The Ones With The Most Meat</div>
            </div>
            <div className="rv-card-note">pick one to reread</div>
          </div>
          <FeaturedReviews featured={stats.featured} />
        </section>
      </div>
    </div>
  );
}
