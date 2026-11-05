/**
 * Maps a 0..5 film rating to an emerald fill colour.
 *
 * Shared by every chart that tints a dot or cell by how much you liked the
 * film, so the whole page speaks one colour language.
 *
 * Args:
 *   rating (number|null): Film rating.
 *
 * Returns:
 *   string: CSS colour string.
 */
export function ratingColor(rating) {
  if (rating == null || !Number.isFinite(rating)) return 'rgba(255, 255, 255, 0.18)';
  const clamped = Math.min(5, Math.max(0, rating));
  return `rgba(0, 232, 122, ${(0.35 + (clamped / 5) * 0.65).toFixed(2)})`;
}
