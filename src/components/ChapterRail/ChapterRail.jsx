import { useEffect, useRef } from 'react';
import { useActiveSection } from '../../hooks/useActiveSection';
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
];

/**
 * Fixed chapter index for the long scroll.
 *
 * A vertical spine on desktop and a swipeable strip on small screens. The
 * active chapter follows the viewport middle through useActiveSection.
 *
 * Returns:
 *   JSX.Element: The chapter navigation.
 */
export default function ChapterRail() {
  const activeId = useActiveSection();
  const listRef = useRef(null);

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
  }, [activeId]);

  return (
    <nav className="lb-rail" aria-label="Report chapters">
      <span className="lb-rail-title">Chapters</span>
      <ol className="lb-rail-list" ref={listRef}>
        {CHAPTERS.map((chapter) => {
          const isActive = chapter.id === activeId;
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                className={`lb-rail-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'location' : undefined}
              >
                <span className="lb-rail-num tabular-nums">{chapter.number}</span>
                <span className="lb-rail-name">{chapter.name}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
