/**
 * Inline SVG icons shared by more than one section.
 *
 * These used to be copy pasted into QuickFacts, Rhythm, CinephileProfile and
 * Ratings. One copy, one place to fix, done.
 *
 * Args:
 *   size (number, optional): Icon width and height in px. Defaults to 20.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
export function CalendarIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * Clock icon shared by the watch time and rhythm cards.
 *
 * Args:
 *   size (number, optional): Icon width and height in px. Defaults to 20.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
export function ClockIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Upward trend icon shared by the pace and correlation cards.
 *
 * Args:
 *   size (number, optional): Icon width and height in px. Defaults to 20.
 *
 * Returns:
 *   JSX.Element: Inline SVG icon.
 */
export function TrendIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
