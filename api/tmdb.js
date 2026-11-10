import { isSameOrigin, rateLimit } from './_lib/guard.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const ALLOWED_PATH = /^\/(search\/(multi|movie|tv)|movie\/\d+|tv\/\d+|person\/\d+|discover\/movie|genre\/movie\/list|trending\/(movie|tv|all)\/(day|week))$/;

const DROPPED_PARAMS = new Set(['path', 'api_key', 'action']);

/**
 * Picks a CDN cache lifetime for a TMDB path.
 *
 * Movie details barely move, search queries are stable enough, and discover
 * pages change a bit more often. These headers let Vercel serve repeat traffic
 * from the edge without spending another function invocation.
 *
 * Args:
 *   path (string): Validated TMDB path.
 *
 * Returns:
 *   number: TTL in seconds.
 */
function cacheTtl(path) {
  if (path.startsWith('/search/')) return 259200;
  if (path.startsWith('/movie/') || path.startsWith('/tv/')) return 1209600;
  if (path.startsWith('/discover/')) return 86400;
  return 3600;
}

/**
 * Builds a clean URLSearchParams from the incoming request query.
 *
 * Args:
 *   query (Object): Vercel query object.
 *
 * Returns:
 *   URLSearchParams: Forwarded params without secrets or routing junk.
 */
function buildParams(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (DROPPED_PARAMS.has(key) || value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) params.append(key, String(item));
  }
  if (!params.has('language')) params.set('language', 'en-US');
  return params;
}

/**
 * Serverless proxy for TMDB.
 *
 * Keeps the API key out of the browser bundle, rejects everything except the
 * handful of read endpoints the app actually uses, and lets Vercel's CDN cache
 * identical requests so ten users looking up the same film cost one request.
 *
 * Args:
 *   req (IncomingMessage): Vercel request.
 *   res (ServerResponse): Vercel response.
 *
 * Returns:
 *   Promise<void>
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  if (!isSameOrigin(req)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Generous enough for a full library import, firm enough to stop a runaway
  // loop from burning the shared TMDB quota.
  const limit = rateLimit(req, { namespace: 'tmdb', limit: 12000, windowMs: 60_000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'too many requests' });
    return;
  }

  // vercel.json rewrites /api/tmdb/:path* here. Named params arrive as a
  // query string, and req.url keeps the original pathname, so read both.
  const rawPath = req.query?.path;
  let segments = Array.isArray(rawPath) ? rawPath : [rawPath].filter(Boolean);
  if (segments.length === 0) {
    const url = new URL(req.url || '/', 'http://localhost');
    const match = url.pathname.match(/^\/api\/tmdb\/?(.*)$/);
    segments = (match?.[1] || '').split('/').filter(Boolean);
  }
  const path = `/${segments.join('/')}`;

  if (!ALLOWED_PATH.test(path) || path.includes('..')) {
    res.status(404).json({ error: 'unknown tmdb path' });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';
  if (!apiKey) {
    res.status(503).json({ error: 'tmdb key is not configured' });
    return;
  }

  const params = buildParams(req.query);
  const isBearer = apiKey.startsWith('eyJ');
  const url = `${TMDB_BASE}${path}?${params.toString()}${isBearer ? '' : `&api_key=${encodeURIComponent(apiKey)}`}`;

  let upstream;
  try {
    upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(isBearer ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    res.status(504).json({ error: 'tmdb timed out' });
    return;
  }

  if (upstream.status === 429 || upstream.status >= 500) {
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status === 429 ? 429 : 502).json({ error: 'tmdb is busy' });
    return;
  }

  if (!upstream.ok) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'tmdb request failed' });
    return;
  }

  const body = await upstream.text();
  const ttl = cacheTtl(path);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=86400`);
  res.setHeader('CDN-Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=86400`);
  res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=86400`);
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(200).send(body);
}
