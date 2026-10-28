import { useEffect, useState } from 'react';

/**
 * Tracks which chapter crosses the middle of the viewport.
 *
 * The rail uses it to highlight the active chapter. The observer watches every
 * element carrying the data-section attribute, so adding a chapter is just a
 * matter of tagging its root.
 *
 * Returns:
 *   string: Id of the section owning the viewport middle, or an empty string.
 */
export function useActiveSection() {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('[data-section]'));
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return activeId;
}
