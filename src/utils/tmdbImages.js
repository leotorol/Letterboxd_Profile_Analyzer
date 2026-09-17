// single source of truth for TMDB image buckets, no more inlining this string in 4 files
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const TMDB_POSTER_SMALL = `${TMDB_IMAGE_BASE}w185`;
export const TMDB_POSTER_LARGE = `${TMDB_IMAGE_BASE}w500`;
