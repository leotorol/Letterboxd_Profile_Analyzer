// single source of truth for TMDB image buckets, no more inlining this string in 4 files
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const TMDB_POSTER_SMALL = `${TMDB_IMAGE_BASE}w185`;
export const TMDB_POSTER_MEDIUM = `${TMDB_IMAGE_BASE}w342`;
export const TMDB_POSTER_LARGE = `${TMDB_IMAGE_BASE}w500`;
export const TMDB_PROFILE_SMALL = `${TMDB_IMAGE_BASE}w185`;
export const TMDB_LOGO_SMALL = `${TMDB_IMAGE_BASE}w300`;
