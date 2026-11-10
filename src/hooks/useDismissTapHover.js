import { useEffect, useRef } from 'react';

/**
 * Closes a hover tooltip when the user taps outside its container on touch.
 *
 * Desktop hover stays exactly as it was. This only reacts to non mouse
 * pointers, so a phone tap on empty page space clears whatever tooltip was
 * left open by an earlier tap.
 *
 * Args:
 *   ref (Object): React ref pointing at the element that owns the tooltip.
 *   active (boolean): Whether a tooltip is currently showing.
 *   onDismiss (Function): Called with no args when a touch starts outside.
 *
 * Returns:
 *   void
 */
export function useDismissTapHover(ref, active, onDismiss) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) return undefined;

    function handlePointerDown(event) {
      // mouse users get the classic behaviour, the browser already hides the
      // tooltip when the cursor leaves the chart, no need to duplicate it
      if (event.pointerType === 'mouse') return;
      if (!ref.current || ref.current.contains(event.target)) return;
      dismissRef.current();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref, active]);
}
