import { useEffect, useState } from 'react';

/**
 * Tracks which chapter crosses the middle of the viewport.
 *
 * The rail uses it to highlight the active chapter. Instead of trusting
 * IntersectionObserver entry order (which can flip between two neighbours and
 * make the rail flicker), this just asks the geometry who owns the middle.
 *
 * Returns:
 *   string: Id of the section owning the viewport middle, or an empty string.
 */
export function useActiveSection() {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('[data-section]'));
    if (!sections.length) return undefined;

    let frame = 0;

    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let current = sections[0].id;

      // the last section whose top is above the middle is the one we are in
      for (const section of sections) {
        if (section.getBoundingClientRect().top > middle) break;
        current = section.id;
      }

      setActiveId((previous) => (previous === current ? previous : current));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return activeId;
}
