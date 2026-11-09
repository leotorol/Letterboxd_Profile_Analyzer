const buckets = new Map();
const MAX_BUCKETS = 5000;

/**
 * Extracts the caller IP from the proxy headers Vercel sets.
 *
 * Args:
 *   req (IncomingMessage): Vercel request.
 *
 * Returns:
 *   string: Best effort client IP.
 */
function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Rejects requests that do not come from the app itself.
 *
 * This is not a security boundary, since headers can be forged, but it stops
 * the endpoint from being used as a free open proxy by random bots. The check
 * is skipped outside Vercel so local tooling and manual curl keep working.
 *
 * Args:
 *   req (IncomingMessage): Vercel request.
 *
 * Returns:
 *   boolean: True when the request looks same origin or runs locally.
 */
export function isSameOrigin(req) {
  if (!process.env.VERCEL) return true;

  const site = req.headers?.['sec-fetch-site'];
  if (typeof site === 'string') {
    return site === 'same-origin' || site === 'same-site';
  }

  const source = req.headers?.origin || req.headers?.referer;
  if (!source) return false;

  try {
    return new URL(source).host === req.headers?.host;
  } catch {
    return false;
  }
}

/**
 * Simple in memory fixed window rate limiter.
 *
 * Serverless instances are short lived, so this is a burst guard rather than a
 * perfect global limit. The shared queue already caps concurrency when Redis is
 * configured; this is the cheap safety net when it is not.
 *
 * Args:
 *   req (IncomingMessage): Vercel request.
 *   options (Object): `namespace`, `limit` and `windowMs`.
 *
 * Returns:
 *   Object: `{ allowed, retryAfter }`.
 */
export function rateLimit(req, { namespace, limit, windowMs }) {
  const now = Date.now();
  const key = `${namespace}:${clientIp(req)}`;
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  bucket.count += 1;

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, entry] of buckets) {
      if (now >= entry.resetAt) buckets.delete(bucketKey);
    }
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  if (bucket.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  return { allowed: true, retryAfter: 0 };
}
