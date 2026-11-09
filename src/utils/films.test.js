import { describe, expect, it } from 'vitest';
import { dedupeFilms, filmKey } from './films';

describe('film helpers', () => {
  it('builds a case insensitive identity key', () => {
    expect(filmKey('  Dune ', 2021)).toBe('dune::2021');
    expect(filmKey(null, null)).toBe('::');
  });

  it('keeps the first copy of each film', () => {
    const rows = [
      { name: 'Dune', year: 2021, rating: 5 },
      { name: 'dune', year: 2021, rating: 3 },
      { name: 'Arrival', year: 2016, rating: 4 },
      null,
    ];

    expect(dedupeFilms(rows)).toEqual([
      { name: 'Dune', year: 2021, rating: 5 },
      { name: 'Arrival', year: 2016, rating: 4 },
    ]);
  });
});
