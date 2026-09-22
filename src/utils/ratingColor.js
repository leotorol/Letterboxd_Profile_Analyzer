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
  if (rating == null) return 'rgba(255, 255, 255, 0.18)';
  return `rgba(0, 232, 122, ${(0.35 + (rating / 5) * 0.65).toFixed(2)})`;
}
