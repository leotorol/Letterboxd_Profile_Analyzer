import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatIsoDate, monthIndex, parseLbDate } from './dateFormat';

describe('date helpers', () => {
  it('formats ISO dates for display', () => {
    expect(formatIsoDate('2024-03-07')).toBe('7 Mar 2024');
    expect(formatIsoDate('bad')).toBe('bad');
    expect(formatIsoDate('')).toBe('');
  });

  it('parses dates as local midnight', () => {
    const date = parseLbDate('2024-03-07');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(7);
    expect(parseLbDate('2024-13-01')).toBeNull();
  });

  it('counts whole days between dates', () => {
    expect(diffDays(parseLbDate('2024-03-07'), parseLbDate('2024-03-09'))).toBe(2);
    expect(diffDays(parseLbDate('2024-03-09'), parseLbDate('2024-03-07'))).toBe(-2);
  });

  it('shifts dates across month boundaries', () => {
    const next = addDays(parseLbDate('2024-01-31'), 1);
    expect(`${next.getFullYear()}-${next.getMonth() + 1}-${next.getDate()}`).toBe('2024-2-1');
  });

  it('builds a monotonic month index', () => {
    expect(monthIndex(parseLbDate('2024-01-01'))).toBe(2024 * 12);
    expect(monthIndex(parseLbDate('2024-12-01'))).toBe(2024 * 12 + 11);
  });
});
