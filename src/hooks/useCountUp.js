import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to animate a numerical value from 0 to target using requestAnimationFrame.
 *
 * Employs ease-out-cubic easing for smooth deceleration. Respects prefers-reduced-motion.
 * Broken targets (NaN or Infinity) are treated as 0 and a target of 0 resets the
 * value instead of leaving the previous number frozen on screen.
 *
 * Args:
 *   target (number): Destination integer value to animate towards.
 *   duration (number, optional): Animation duration in milliseconds. Defaults to 1600.
 *   delay (number, optional): Delay in milliseconds before animation starts. Defaults to 0.
 *
 * Returns:
 *   number: Current animated integer value during frame updates.
 */
export function useCountUp(target, duration = 1600, delay = 0) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(frameRef.current);

    // reduced motion and zero targets are handled during render, no state sync
    if (prefersReducedMotion || safeTarget === 0) return undefined;

    const startTime = performance.now() + delay;

    /**
     * Animation frame handler ticking forward.
     *
     * Args:
     *   now (DOMHighResTimeStamp): Current timestamp from requestAnimationFrame.
     *
     * Returns:
     *   void
     */
    function tick(now) {
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(elapsed / duration, 1);

      // cubic ease-out curve to make numbers pop
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * safeTarget));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [safeTarget, duration, delay, prefersReducedMotion]);

  // a zero target should actually render zero, not the previous number
  if (prefersReducedMotion || safeTarget === 0) return safeTarget;

  return value;
}
