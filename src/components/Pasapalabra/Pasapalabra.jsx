import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  PASAPALABRA_LETTERS,
  usePasapalabraStats,
} from '../../hooks/usePasapalabraStats';
import useSectionMotion from '../../hooks/useSectionMotion';
import { TMDB_POSTER_SMALL } from '../../utils/tmdbImages';
import './Pasapalabra.css';

/*
 * Section 09 contract
 * THESIS: the closing chapter is a game show, not another report. The page goes
 *   black and the letter ring becomes the last thing the user plays with.
 * OWN WORLD: true black stage, circular geometry, Letterboxd orange, green and
 *   blue living together for the first time, one overhead light.
 * STORY: the user picks a letter and gets that letter's record holders in one
 *   card: most watched, least watched, longest, best rated and oldest.
 * FIRST VIEWPORT: a huge A to Z title, the letter ring and its record card.
 * FORM: deliberate break from the section 08 dossier. Circle instead of ruler,
 *   center instead of margin, stage instead of archive.
 */

const TONES = [
  { hex: '#ff8000', rgb: '255, 128, 0' },
  { hex: '#00e054', rgb: '0, 224, 84' },
  { hex: '#40bcf4', rgb: '64, 188, 244' },
];

const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="13 6 19 12 13 18" />
  </svg>
);

/**
 * Renders a small poster with a typographic fallback behind it.
 *
 * Args:
 *   film (Object): Film snapshot with name and posterPath.
 *
 * Returns:
 *   JSX.Element: The poster block.
 */
function FilmPoster({ film }) {
  return (
    <div className="pz-poster pz-poster-tile">
      <span className="pz-poster-fallback">{film.name}</span>
      {film.posterPath && (
        <img
          src={TMDB_POSTER_SMALL + film.posterPath}
          alt={`Poster of ${film.name}`}
          loading="lazy"
          decoding="async"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

/**
 * Renders one film and every record it holds for the active letter.
 *
 * Args:
 *   record (Object): Film snapshot plus the category labels and stats it earned.
 *
 * Returns:
 *   JSX.Element: The record tile.
 */
function RecordSlot({ record }) {
  return (
    <article className="pz-slot">
      <div className="pz-slot-labels">
        {record.labels.map((label) => (
          <span className={`pz-slot-label is-${label.tone}`} key={label.id}>
            <span className={`pz-tone-dot is-${label.tone}`} aria-hidden="true" />
            {label.name}
          </span>
        ))}
      </div>

      <div className="pz-slot-body">
        <FilmPoster film={record.film} />
        <div className="pz-slot-copy">
          <h4 className="pz-slot-title">{record.film.name}</h4>
          <div className="pz-slot-stats tabular-nums">
            {record.stats.map((stat) => <span key={stat}>{stat}</span>)}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Renders a category that has no eligible film for the active letter.
 *
 * Args:
 *   slot (Object): Category name, tone and the missing data reason.
 *
 * Returns:
 *   JSX.Element: The missing record tile.
 */
function MissingSlot({ slot }) {
  return (
    <article className="pz-slot is-empty">
      <div className="pz-slot-labels">
        <span className={`pz-slot-label is-${slot.tone}`}>
          <span className={`pz-tone-dot is-${slot.tone}`} aria-hidden="true" />
          {slot.name}
        </span>
      </div>

      <div className="pz-slot-body is-missing">
        <span className="pz-slot-poster-empty" aria-hidden="true" />
        <span className="pz-slot-missing">{slot.empty}</span>
      </div>
    </article>
  );
}

/**
 * Renders the fixed record card beside the letter ring.
 *
 * The card is the same five slots for every letter, with the category label
 * sitting right above its poster. Missing records keep their slot and say
 * which data is missing, so the card never turns into a paragraph.
 *
 * Args:
 *   letter (string|null): Active letter.
 *   entry (Object|null): Film count and the five record slots for the letter.
 *   tone (Object): Colour token for the active letter.
 *
 * Returns:
 *   JSX.Element: The record card.
 */
function AnswerPanel({ letter, entry, tone }) {
  const layoutNames = ['', 'is-one', 'is-two', 'is-three', 'is-four', 'is-five'];
  const tileCount = entry ? entry.records.length + entry.missing.length : 0;
  const gridLayout = tileCount > 0 ? ` ${layoutNames[Math.min(5, tileCount)]}` : '';

  return (
    <aside
      className="pz-answer"
      style={{ '--pz-tone': tone.hex, '--pz-tone-rgb': tone.rgb }}
    >
      <span className="pz-answer-ghost" aria-hidden="true">{letter || '?'}</span>

      <div className="pz-answer-live" aria-live="polite" aria-atomic="true">
        <h3 className="pz-sr-only">{letter ? `Records for letter ${letter}` : 'A to Z records'}</h3>

        <div className="pz-answer-body" key={letter || 'empty'}>
          {!letter ? (
            <div className="pz-answer-empty">
              <h4 className="pz-empty-title">No A to Z letters yet.</h4>
              <p className="pz-empty-body">
                Your log has no films that start with an A to Z letter. Numbered and non Latin titles sit this one out.
              </p>
            </div>
          ) : !entry ? (
            <div className="pz-answer-empty">
              <h4 className="pz-empty-title">Pass.</h4>
              <p className="pz-empty-body">
                Nothing starting with {letter} in your log. Try another letter, or pass to the next one.
              </p>
            </div>
          ) : (
            <div className={`pz-slots${gridLayout}`}>
              {entry.records.map((record) => (
                <RecordSlot
                  key={`${record.film.name}-${record.film.year}`}
                  record={record}
                />
              ))}
              {entry.missing.map((slot) => (
                <MissingSlot key={slot.id} slot={slot} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Renders the letter ring, its centre scoreboard and the probe state for every tile.
 *
 * Args:
 *   activeLetter (string|null): Letter currently in the record card.
 *   letters (Object): Record card bundles keyed by letter.
 *   availableLetters (number): How many letters have at least one film.
 *   onSelect (Function): Called with a letter on hover, focus or tap.
 *   onKeyDown (Function): Arrow and Home key handler for the ring.
 *   tileRefs (Object): Letter to button refs, used for keyboard focus.
 *   isLive (boolean): Starts the one authored ring animation.
 *
 * Returns:
 *   JSX.Element: The rosco.
 */
function Rosco({
  activeLetter,
  letters,
  availableLetters,
  onSelect,
  onKeyDown,
  tileRefs,
  isLive,
}) {
  const activeIndex = activeLetter ? PASAPALABRA_LETTERS.indexOf(activeLetter) : 0;
  const activeTone = TONES[activeIndex % TONES.length];
  const activeData = activeLetter ? letters[activeLetter] : null;
  const tabStop = activeLetter || PASAPALABRA_LETTERS[0];
  const step = 360 / PASAPALABRA_LETTERS.length;
  const [beam, setBeam] = useState(() => ({
    index: activeIndex,
    angle: -90 + activeIndex * step,
  }));

  // take the short way round: A to Z is one step back, not a full lap.
  // adjusting state during render is fine here, it is a pure derivation.
  if (beam.index !== activeIndex) {
    const target = -90 + activeIndex * step;
    const raw = target - beam.angle;
    const shortest = (((raw + 180) % 360 + 360) % 360) - 180;
    setBeam({ index: activeIndex, angle: beam.angle + shortest });
  }

  const beamAngle = beam.angle;

  return (
    <div
      className={`pz-rosco${isLive ? ' is-live' : ''}`}
      role="group"
      aria-label="A to Z letters"
      style={{ '--pz-tone': activeTone.hex, '--pz-tone-rgb': activeTone.rgb }}
    >
      <div className="pz-sweep" aria-hidden="true" />

      <svg className="pz-ring pz-ring-orbit" viewBox="0 0 600 600" aria-hidden="true">
        <circle className="pz-orbit-track" cx="300" cy="300" r="268" />
        <circle className="pz-orbit-ticks" cx="300" cy="300" r="250" />
      </svg>

      <svg className="pz-ring" viewBox="0 0 600 600" aria-hidden="true">
        <circle className="pz-ring-base" cx="300" cy="300" r="286" />
        <circle className="pz-ring-inner" cx="300" cy="300" r="190" />
      </svg>

      <div
        className="pz-beam"
        aria-hidden="true"
        style={{ transform: `rotate(${beamAngle}deg)` }}
      />

      {PASAPALABRA_LETTERS.map((letter, index) => {
        const tone = TONES[index % TONES.length];
        const angle = (-90 + index * step) * (Math.PI / 180);
        const entry = letters[letter];
        const isActive = letter === activeLetter;

        return (
          <button
            key={letter}
            ref={(node) => { tileRefs.current[letter] = node; }}
            type="button"
            className={`pz-letter${isActive ? ' is-active' : ''}${entry ? '' : ' is-empty'}`}
            style={{
              left: `${50 + 47.6 * Math.cos(angle)}%`,
              top: `${50 + 47.6 * Math.sin(angle)}%`,
              '--pz-tone': tone.hex,
              '--pz-tone-rgb': tone.rgb,
              '--pz-i': index,
            }}
            aria-label={entry
              ? `Letter ${letter}, ${entry.count} film${entry.count === 1 ? '' : 's'}`
              : `Letter ${letter}, no films`}
            aria-pressed={isActive}
            tabIndex={letter === tabStop ? 0 : -1}
            onPointerEnter={() => onSelect(letter)}
            onFocus={() => onSelect(letter)}
            onClick={() => onSelect(letter)}
            onKeyDown={onKeyDown}
          >
            {letter}
          </button>
        );
      })}

      <div className="pz-core" aria-hidden="true">
        <span className="pz-core-round">{activeLetter ? `Letter ${activeLetter}` : 'A to Z'}</span>
        <span className={`pz-core-letter${activeData ? '' : ' is-empty'}`}>
          {activeLetter || '?'}
        </span>
        <span className="pz-core-count tabular-nums">
          {activeData
            ? `${activeData.count} film${activeData.count === 1 ? '' : 's'}`
            : 'No films'}
        </span>
        <span className="pz-core-total tabular-nums">
          {availableLetters === 0
            ? 'No letters yet'
            : `${availableLetters} letters with films`}
        </span>
      </div>
    </div>
  );
}

/**
 * Section 09: A to Z. The interactive closing chapter.
 *
 * Returns:
 *   JSX.Element: The final round.
 */
export default function Pasapalabra() {
  const { enrichedData } = useData();
  const stats = usePasapalabraStats(enrichedData);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [isLive, setIsLive] = useState(() => (
    typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'function'
  ));
  const stageRef = useRef(null);
  const sectionRef = useRef(null);
  const tileRefs = useRef({});
  useSectionMotion(sectionRef);

  const firstAvailableLetter = useMemo(() => (
    PASAPALABRA_LETTERS.find((letter) => stats.letters[letter]) || null
  ), [stats]);

  const activeLetter = selectedLetter || firstAvailableLetter;
  const activeEntry = activeLetter ? stats.letters[activeLetter] || null : null;
  const activeIndex = activeLetter ? PASAPALABRA_LETTERS.indexOf(activeLetter) : 0;
  const activeTone = TONES[activeIndex % TONES.length];

  const missingLetters = PASAPALABRA_LETTERS.length - stats.availableLetters;
  const coverage = (stats.availableLetters / PASAPALABRA_LETTERS.length) * 100;
  const ringCopy = missingLetters === 1
    ? 'You missed one letter.'
    : `You missed ${missingLetters} letters.`;
  const showRingScore = stats.availableLetters > 0 && missingLetters > 0;

  const canStep = stats.availableLetters > 0
    && !(stats.availableLetters === 1 && activeEntry);

  // one authored moment: the ring boots up when it actually reaches the viewport
  useEffect(() => {
    const node = stageRef.current;
    if (!node || isLive) return undefined;

    const observer = new window.IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setIsLive(true);
      observer.disconnect();
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [isLive]);

  const selectLetter = useCallback((letter) => {
    setSelectedLetter(letter);
  }, []);

  const moveFocus = useCallback((direction) => {
    const start = activeLetter ? PASAPALABRA_LETTERS.indexOf(activeLetter) : 0;
    const nextLetter = PASAPALABRA_LETTERS[
      (start + direction + PASAPALABRA_LETTERS.length) % PASAPALABRA_LETTERS.length
    ];

    selectLetter(nextLetter);
    tileRefs.current[nextLetter]?.focus();
  }, [activeLetter, selectLetter]);

  const stepToNextPick = useCallback(() => {
    if (stats.availableLetters === 0) return;

    const start = activeLetter ? PASAPALABRA_LETTERS.indexOf(activeLetter) : -1;
    for (let offset = 1; offset <= PASAPALABRA_LETTERS.length; offset += 1) {
      const index = (start + offset + PASAPALABRA_LETTERS.length) % PASAPALABRA_LETTERS.length;
      const letter = PASAPALABRA_LETTERS[index];
      if (!stats.letters[letter]) continue;

      selectLetter(letter);
      tileRefs.current[letter]?.focus();
      return;
    }
  }, [activeLetter, selectLetter, stats]);

  const handleTileKeyDown = useCallback((event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectLetter(PASAPALABRA_LETTERS[0]);
      tileRefs.current[PASAPALABRA_LETTERS[0]]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = PASAPALABRA_LETTERS[PASAPALABRA_LETTERS.length - 1];
      selectLetter(last);
      tileRefs.current[last]?.focus();
    }
  }, [moveFocus, selectLetter]);

  return (
    <section className="pz-section" id="section-09" data-section ref={sectionRef}>
      <div className="pz-inner">
        <header className="pz-header" data-reveal>
          <h2 className="pz-title">
            A to Z<span className="pz-title-dot">.</span>
          </h2>
          <p className="pz-sub">
            The final round. Pick a letter and get its five record holders, all in one card.
          </p>
        </header>

        <div className="pz-stage-line" aria-hidden="true" />

        {!stats.hasData ? (
          <div className="pz-empty-state">
            <h3 className="pz-empty-title">No films to play with yet.</h3>
            <p className="pz-empty-body">
              Upload a Letterboxd ZIP with watched or rated films and the rosco will fill up.
            </p>
          </div>
        ) : (
          <>
            <p className="pz-instruction">
              Articles are ignored and accents fold: The Matrix sits under M.
            </p>

            <div className="pz-stage" ref={stageRef}>
              <Rosco
                activeLetter={activeLetter}
                letters={stats.letters}
                availableLetters={stats.availableLetters}
                onSelect={selectLetter}
                onKeyDown={handleTileKeyDown}
                tileRefs={tileRefs}
                isLive={isLive}
              />

              <AnswerPanel
                letter={activeLetter}
                entry={activeEntry}
                tone={activeTone}
              />
            </div>

            <div
              className="pz-stage-foot"
              style={{ '--pz-tone': activeTone.hex, '--pz-tone-rgb': activeTone.rgb }}
            >
              <button
                type="button"
                className="pz-next"
                onClick={stepToNextPick}
                disabled={!canStep}
              >
                Next letter
                <NextIcon />
              </button>
            </div>

            {showRingScore && (
              <footer className="pz-result">
                <div className="pz-result-copy">
                  <span className="pz-result-label">Your ring</span>
                  <span className="pz-result-score tabular-nums">
                    {stats.availableLetters}<span> / {PASAPALABRA_LETTERS.length}</span>
                  </span>
                  <span className="pz-result-text">{ringCopy}</span>
                </div>

                <div
                  className="pz-meter"
                  role="img"
                  aria-label={`${stats.availableLetters} of ${PASAPALABRA_LETTERS.length} letters have films`}
                >
                  <span className="pz-meter-fill" style={{ width: `${coverage}%` }} />
                </div>
              </footer>
            )}
          </>
        )}
      </div>
    </section>
  );
}
