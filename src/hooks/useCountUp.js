import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to animate a numerical value from 0 to target using requestAnimationFrame.
 *
 * Employs ease-out-cubic easing for smooth deceleration.
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
  const [value, setValue] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    // don't run animation on zero or null targets
    if (target === 0 || target == null) return;
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
      setValue(Math.round(eased * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, delay]);

  return value;
}
