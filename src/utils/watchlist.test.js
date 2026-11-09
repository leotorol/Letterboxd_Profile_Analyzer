import { describe, expect, it } from 'vitest';
import { selectOldestWatchlist } from './watchlist';

const TODAY = new Date(2026, 0, 1);

describe('selectOldestWatchlist', () => {
  it('keeps the oldest copy of each film and ignores future dates', () => {
    const rows = [
      { name: 'Dune', year: 2021, date: '2025-01-01' },
      { name: 'Dune', year: 2021, date: '2024-01-01' },
      { name: 'Arrival', year: 2016, date: '2023-01-01' },
      { name: 'Future', year: 2030, date: '2030-01-01' },
      { name: 'Invalid', year: 2000, date: 'nope' },
    ];

    const result = selectOldestWatchlist(rows, 10, TODAY);

    expect(result.map((row) => row.name)).toEqual(['Arrival', 'Dune']);
    expect(result[1].date).toBe('2024-01-01');
  });

  it('respects the limit', () => {
    const rows = [
      { name: 'A', year: 2001, date: '2024-01-01' },
      { name: 'B', year: 2002, date: '2023-01-01' },
      { name: 'C', year: 2003, date: '2022-01-01' },
    ];

    expect(selectOldestWatchlist(rows, 2, TODAY)).toHaveLength(2);
  });
});
