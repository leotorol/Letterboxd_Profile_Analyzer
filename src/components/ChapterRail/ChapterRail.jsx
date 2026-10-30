import { useEffect, useRef, useState } from 'react';
import { useActiveSection } from '../../hooks/useActiveSection';
import { UploadIcon } from '../icons/Icons';
import './ChapterRail.css';

const CHAPTERS = [
  { id: 'section-01', number: '01', name: 'Quick Facts' },
  { id: 'section-02', number: '02', name: 'Rhythm' },
  { id: 'section-03', number: '03', name: 'Profile' },
  { id: 'section-04', number: '04', name: 'Ratings' },
  { id: 'section-05', number: '05', name: 'Cast' },
  { id: 'section-06', number: '06', name: 'Reviews' },
  { id: 'section-07', number: '07', name: 'Watchlist' },
  { id: 'section-08', number: '08', name: 'Deep Cuts' },
  { id: 'section-09', number: '09', name: 'A to Z' },
];

const CREDITS = { id: 'credits', number: '10', name: 'Credits' };

/**
 * Fixed chapter index for the long scroll.
 *
 * A vertical spine on desktop and a swipeable strip on small screens. The
 * active chapter follows the viewport middle through useActiveSection. The
 * foot of the rail holds the way back to the upload screen.
 *
 * Args:
 *   onReset (Function): Resets the app back to the upload screen.
 *
 * Returns:
 *   JSX.Element: The chapter navigation.
 */
export default function ChapterRail({ onReset }) {
  const activeId = useActiveSection();
  const listRef = useRef(null);
  const [pinnedId, setPinnedId] = useState(null);
  const [creditsSeen, setCreditsSeen] = useState(false);
  const [atCredits, setAtCredits] = useState(false);
  const pinnedRef = useRef(null);
  const jumpRef = useRef(false);
  const settleTimer = useRef(0);

  // when you click a chapter we highlight it right away, so the observer does
  // not light up every number on the way there like a cheap disco
  const handleJump = (id) => () => {
    jumpRef.current = true;
    pinnedRef.current = id;
    setPinnedId(id);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      jumpRef.current = false;
    }, 500);
  };

  // the pin holds the clicked chapter until the user scrolls again, so the
  // observer never flashes a middle chapter when the jump lands
  useEffect(() => {
    const onScroll = () => {
      // the credits are not a chapter you can browse to from the top, they
      // join the rail once the footer is properly on screen, and the rail
      // hands them the highlight right there instead of waiting for the
      // footer to crawl past the exact middle of the viewport
      const footer = document.getElementById('credits');
      const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      const footerInView = footerTop < window.innerHeight * 0.8;
      setAtCredits(footerInView);
      if (footerInView) setCreditsSeen(true);

      if (jumpRef.current) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => {
          jumpRef.current = false;
          // the scroll has settled, so hand control back to the observer even
          // if the user stopped on the last pixel and never scrolls again
          pinnedRef.current = null;
          setPinnedId(null);
        }, 220);
      } else if (pinnedRef.current) {
        // the user is scrolling again, so hand control back to the observer
        pinnedRef.current = null;
        setPinnedId(null);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  // on the mobile strip the active chapter can sit off screen, so follow it
  useEffect(() => {
    const list = listRef.current;
    if (!list || window.innerWidth >= 1200) return;
    const active = list.querySelector('.lb-rail-link.is-active');
    if (!active) return;

    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const delta = activeRect.left - listRect.left - (listRect.width - activeRect.width) / 2;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({
      left: list.scrollLeft + delta,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeId, pinnedId, creditsSeen, atCredits]);

  // the credits always win once the footer is on screen, so neither a stale
  // jump pin nor the observer lag can keep A to Z lit while credits are there
  const shownActiveId = atCredits || activeId === CREDITS.id
    ? CREDITS.id
    : (pinnedId || activeId);
  const isFinal = shownActiveId === 'section-09' || shownActiveId === CREDITS.id;
  const shownChapters = creditsSeen ? [...CHAPTERS, CREDITS] : CHAPTERS;

  return (
    <nav
      className={`lb-rail${isFinal ? ' is-final' : ''}`}
      aria-label="Report chapters"
    >
      <span className="lb-rail-title">Chapters</span>
      <ol className="lb-rail-list" ref={listRef}>
        {shownChapters.map((chapter) => {
          const isActive = chapter.id === shownActiveId;
          return (
            <li
              key={chapter.id}
              className={chapter.id === CREDITS.id ? 'lb-rail-credits' : undefined}
            >
              <a
                href={`#${chapter.id}`}
                className={`lb-rail-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={handleJump(chapter.id)}
              >
                <span className="lb-rail-num tabular-nums">{chapter.number}</span>
                <span className="lb-rail-name">{chapter.name}</span>
              </a>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="lb-rail-reset"
        onClick={onReset}
        aria-label="Upload a different ZIP file"
      >
        <UploadIcon size={14} />
        <span>New export</span>
      </button>
    </nav>
  );
}
