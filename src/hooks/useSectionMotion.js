import { useEffect } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Wakes a section when it reaches the viewport and reveals its marked children.
 *
 * Elements tagged with data-reveal start hidden once the root is armed, then
 * slide in the first time they cross the viewport. The root also toggles
 * is-awake so ambient loops can stop when the section is off screen instead of
 * burning frames somewhere else in the page.
 *
 * Args:
 *   ref (Object): React ref pointing at the section root.
 *
 * Returns:
 *   void
 */
export default function useSectionMotion(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const reveals = Array.from(root.querySelectorAll('[data-reveal]'));
    const canObserve = typeof window.IntersectionObserver === 'function';
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION_QUERY).matches;

    // no observer or the user asked for less motion: everything stays readable
    if (!canObserve || reduceMotion) {
      root.classList.add('is-awake');
      reveals.forEach((node) => node.classList.add('is-in'));
      return undefined;
    }

    root.classList.add('is-armed');

    const revealObserver = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    reveals.forEach((node) => revealObserver.observe(node));

    // the ambient loops only breathe while the section is actually on screen
    const wakeObserver = new window.IntersectionObserver((entries) => {
      const onScreen = entries.some((entry) => entry.isIntersecting);
      root.classList.toggle('is-awake', onScreen);
    }, { rootMargin: '140px 0px' });

    wakeObserver.observe(root);

    return () => {
      revealObserver.disconnect();
      wakeObserver.disconnect();
    };
  }, [ref]);
}
