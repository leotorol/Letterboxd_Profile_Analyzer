export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 3-letter labels to full names, for copy that reads better than "Mon" or "Jan"
export const FULL_MONTHS = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

export const FULL_DAYS = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

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

/**
 * Parses a YYYY-MM-DD string into a local midnight Date.
 *
 * Uses a manual split instead of `new Date(str)` so the day lands on the right
 * date in the local timezone instead of dropping to the day before because
 * the browser assumes the string is UTC.
 *
 * Args:
 *   value (string): ISO date string from the CSV.
 *
 * Returns:
 *   Date|null: Local midnight Date, or null when the value is garbage.
 */
export function parseLbDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whole-day difference between two dates.
 *
 * Args:
 *   a (Date): Earlier date.
 *   b (Date): Later date.
 *
 * Returns:
 *   number: Days from a to b.
 */
export function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Returns a new Date shifted by a number of days.
 *
 * Args:
 *   date (Date): Base date.
 *   days (number): Days to add (can be negative).
 *
 * Returns:
 *   Date: The shifted date.
 */
export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Returns a year+month index for a Date (year * 12 + month).
 *
 * Useful for grouping data by month monotonically across years.
 *
 * Args:
 *   d (Date): Date to index.
 *
 * Returns:
 *   number: Monotonic month index.
 */
export function monthIndex(d) {
  return d.getFullYear() * 12 + d.getMonth();
}

