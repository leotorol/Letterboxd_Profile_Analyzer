/**
 * Averages an array of numbers, ignoring anything that is not finite.
 *
 * Args:
 *   values (Array<number>): Numbers to average.
 *
 * Returns:
 *   number: Arithmetic mean, or 0 when there is nothing usable.
 */
export function mean(values) {
  if (!Array.isArray(values)) return 0;

  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    sum += value;
    count++;
  }
  return count ? sum / count : 0;
}

/**
 * Finds the median of an array of numbers, ignoring non finite values.
 *
 * Args:
 *   values (Array<number>): Numbers to inspect.
 *
 * Returns:
 *   number|null: Median value, or null when there is nothing usable.
 */
export function median(values) {
  if (!Array.isArray(values)) return null;

  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;

  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pearson product-moment correlation coefficient between two number arrays.
 *
 * Pairs where either side is not a finite number are dropped so one broken
 * cell cannot poison the whole coefficient.
 *
 * Args:
 *   xs (Array<number>): First series.
 *   ys (Array<number>): Second series.
 *
 * Returns:
 *   number: Correlation in the range -1 to 1, or 0 when it cannot be computed.
 */
export function pearson(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys)) return 0;

  const pairs = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  if (pairs.length < 2) return 0;

  const mx = mean(pairs.map(([x]) => x));
  const my = mean(pairs.map(([, y]) => y));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    const a = x - mx;
    const b = y - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}
