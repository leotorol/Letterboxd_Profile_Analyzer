/**
 * Averages an array of numbers.
 *
 * Args:
 *   values (number[]): Numbers to average.
 *
 * Returns:
 *   number: Arithmetic mean, or 0 for an empty array.
 */
export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Finds the median of an array of numbers.
 *
 * Args:
 *   values (number[]): Numbers to inspect.
 *
 * Returns:
 *   number|null: Median value, or null for an empty array.
 */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pearson product-moment correlation coefficient between two number arrays.
 *
 * Args:
 *   xs (number[]): First series.
 *   ys (number[]): Second series.
 *
 * Returns:
 *   number: Correlation in the range -1 to 1.
 */
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}
