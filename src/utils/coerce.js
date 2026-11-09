// Shared coercion helpers so one weird CSV cell cannot turn every stat into NaN.
// Letterboxd exports are usually clean, but reimports and hand edited files can
// contain unexpected values.

/**
 * Coerces any value to a finite number.
 *
 * Args:
 *   value (unknown): Raw value from a CSV, cache or API.
 *   fallback (number|null, optional): Value returned when coercion fails.
 *
 * Returns:
 *   number|null: A finite number or the fallback.
 */
export function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  const cleaned = typeof value === 'number'
    ? value
    : parseFloat(String(value).trim().replace(',', '.'));

  return Number.isFinite(cleaned) ? cleaned : fallback;
}

/**
 * Normalises a Letterboxd rating into the trusted 0.5..5 range.
 *
 * Args:
 *   value (unknown): Raw rating cell.
 *
 * Returns:
 *   number|null: Rating when it is a real score, otherwise null.
 */
export function toRating(value) {
  const rating = toFiniteNumber(value);
  if (rating == null || rating <= 0 || rating > 5) return null;
  return rating;
}

/**
 * Normalises a release or watch year.
 *
 * Args:
 *   value (unknown): Raw year cell.
 *
 * Returns:
 *   number|null: Whole year inside a sane film range, otherwise null.
 */
export function toYear(value) {
  const year = toFiniteNumber(value);
  if (year == null) return null;

  const whole = Math.trunc(year);
  if (whole < 1870 || whole > 2100) return null;
  return whole;
}

/**
 * Normalises a date cell into a padded YYYY-MM-DD string.
 *
 * Args:
 *   value (unknown): Raw date cell.
 *
 * Returns:
 *   string|null: ISO date when the value is usable, otherwise null.
 */
export function toIsoDate(value) {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1870 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the value only when it is a real array.
 *
 * Args:
 *   value (unknown): Candidate array.
 *
 * Returns:
 *   Array: The original array or an empty one.
 */
export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Trims a string and rejects empty values.
 *
 * Args:
 *   value (unknown): Candidate name.
 *
 * Returns:
 *   string|null: Trimmed name or null.
 */
export function toName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
