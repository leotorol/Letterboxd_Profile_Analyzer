import { describe, expect, it } from 'vitest';
import { toFiniteNumber, toIsoDate, toName, toRating, toYear } from './coerce';

describe('coerce helpers', () => {
  it('parses numbers and handles comma decimals', () => {
    expect(toFiniteNumber('4,5')).toBe(4.5);
    expect(toFiniteNumber(' 12 ')).toBe(12);
    expect(toFiniteNumber('nope', 0)).toBe(0);
    expect(toFiniteNumber(null, 7)).toBe(7);
  });

  it('only accepts ratings inside 0.5 to 5', () => {
    expect(toRating('4.5')).toBe(4.5);
    expect(toRating('0')).toBeNull();
    expect(toRating('5.5')).toBeNull();
    expect(toRating('')).toBeNull();
  });

  it('rejects years outside a plausible film range', () => {
    expect(toYear('1999')).toBe(1999);
    expect(toYear('1800')).toBeNull();
    expect(toYear('3000')).toBeNull();
  });

  it('normalises dates and rejects invalid ones', () => {
    expect(toIsoDate('2024-3-7')).toBe('2024-03-07');
    expect(toIsoDate('2024-13-01')).toBeNull();
    expect(toIsoDate('not a date')).toBeNull();
  });

  it('trims names and rejects empty values', () => {
    expect(toName('  Dune  ')).toBe('Dune');
    expect(toName('   ')).toBeNull();
    expect(toName(42)).toBeNull();
  });
});
