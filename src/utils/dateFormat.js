const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Turns an ISO YYYY-MM-DD date string into a readable short string like "3 May 2022".
 *
 * Args:
 *   iso (string): ISO date string.
 *
 * Returns:
 *   string: Human readable date, or the raw value when it cannot be parsed.
 */
export function formatIsoDate(iso) {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTH_LABELS[Number(match[2]) - 1]} ${match[1]}`;
}
