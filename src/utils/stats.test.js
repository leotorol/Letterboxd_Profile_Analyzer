import { describe, expect, it } from 'vitest';
import { mean, median, pearson } from './stats';

describe('stats helpers', () => {
  it('averages only finite values', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([2, Number.NaN, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it('computes the median for odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('computes Pearson correlation', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [2, 3, 4])).toBe(0);
  });
});
