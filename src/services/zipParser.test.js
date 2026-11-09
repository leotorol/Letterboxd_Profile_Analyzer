import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { normalizeTitle, parseLetterboxdZip } from './zipParser';

async function buildZip(files) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('normalizeTitle', () => {
  it('normalises the dots and dashes that break TMDB searches', () => {
    expect(normalizeTitle('WALL·E')).toBe('WALL-E');
    expect(normalizeTitle('Spider Man – No Way Home')).toBe('Spider Man - No Way Home');
    expect(normalizeTitle('')).toBe('');
  });
});

describe('parseLetterboxdZip', () => {
  it('merges ratings into watched films and dedupes repeated logs', async () => {
    const archive = await buildZip({
      'watched.csv': [
        'Date,Name,Year,Letterboxd URI',
        '2024-01-01,Dune,2021,uri-1',
        '2024-02-01,Dune,2021,uri-2',
        '2024-03-01,WALL·E,2008,uri-3',
      ].join('\n'),
      'ratings.csv': [
        'Date,Name,Year,Letterboxd URI,Rating',
        '2024-01-02,Dune,2021,uri-1,4.5',
      ].join('\n'),
    });

    const parsed = await parseLetterboxdZip(archive);

    expect(parsed.watched).toHaveLength(2);
    expect(parsed.watched[0]).toMatchObject({
      name: 'Dune',
      year: 2021,
      date: '2024-01-01',
      rating: 4.5,
      normalizedTitle: 'Dune',
    });
    expect(parsed.watched[1].normalizedTitle).toBe('WALL-E');
  });

  it('falls back to ratings.csv when watched.csv is missing', async () => {
    const archive = await buildZip({
      'ratings.csv': [
        'Date,Name,Year,Letterboxd URI,Rating',
        '2024-04-01,Arrival,2016,uri-9,4',
      ].join('\n'),
    });

    const parsed = await parseLetterboxdZip(archive);

    expect(parsed.watched).toEqual([
      expect.objectContaining({ name: 'Arrival', year: 2016, rating: 4 }),
    ]);
  });

  it('drops duplicate diary events and empty reviews', async () => {
    const archive = await buildZip({
      'watched.csv': 'Date,Name,Year,Letterboxd URI\n2024-01-01,Dune,2021,u1\n',
      'diary.csv': [
        'Date,Name,Year,Letterboxd URI,Watched Date',
        '2024-01-01,Dune,2021,d1,2024-01-01',
        '2024-01-01,Dune,2021,d1,2024-01-01',
      ].join('\n'),
      'reviews.csv': [
        'Date,Name,Year,Letterboxd URI,Rating,Review',
        '2024-01-01,Dune,2021,r1,4.5,"Loved it"',
        '2024-01-02,Arrival,2016,r2,4,',
      ].join('\n'),
    });

    const parsed = await parseLetterboxdZip(archive);

    expect(parsed.diary).toHaveLength(1);
    expect(parsed.reviews).toEqual([
      expect.objectContaining({ name: 'Dune', review: 'Loved it', rating: 4.5 }),
    ]);
  });

  it('rejects archives that are not Letterboxd exports', async () => {
    const archive = await buildZip({ 'notes.txt': 'hello' });
    await expect(parseLetterboxdZip(archive)).rejects.toThrow(/Missing required Letterboxd data files/);
  });

  it('rejects exports with no usable films', async () => {
    const archive = await buildZip({
      'watched.csv': 'Date,Name,Year,Letterboxd URI\n',
      'ratings.csv': 'Date,Name,Year,Letterboxd URI,Rating\n',
    });
    await expect(parseLetterboxdZip(archive)).rejects.toThrow(/no watched or rated films/);
  });
});
