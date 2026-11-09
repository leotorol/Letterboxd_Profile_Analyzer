import { randomUUID } from 'node:crypto';
import { hasRedis, redisEval } from './_lib/redis.js';

const ACTIVE_KEY = 'lbxd:queue:active';
const WAITING_KEY = 'lbxd:queue:waiting';
const SESSION_PREFIX = 'lbxd:queue:session:';

const MAX_ACTIVE = Math.max(1, Number.parseInt(process.env.TMDB_QUEUE_MAX_ACTIVE || '2', 10));
const LEASE_MS = Math.max(30, Number.parseInt(process.env.TMDB_QUEUE_LEASE_SECONDS || '120', 10)) * 1000;
const SESSION_TTL = 3 * 60 * 60;
const MAX_WAIT_MS = 2 * 60 * 60 * 1000;

const JOIN_SCRIPT = `
local now = tonumber(ARGV[1])
local maxWait = tonumber(ARGV[2])
local leaseMs = tonumber(ARGV[3])
local sessionTtl = tonumber(ARGV[4])
local maxActive = tonumber(ARGV[5])
local sid = ARGV[6]

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)

if redis.call('ZRANK', KEYS[1], sid) == false and redis.call('ZRANK', KEYS[2], sid) == false then
  redis.call('ZADD', KEYS[2], now + maxWait, sid)
end

redis.call('HSET', KEYS[3], 'joinedAt', now, 'total', ARGV[7])
redis.call('EXPIRE', KEYS[3], sessionTtl)

local active = redis.call('ZCARD', KEYS[1])
local activeRank = redis.call('ZRANK', KEYS[1], sid)
local waitRank = redis.call('ZRANK', KEYS[2], sid)
local admitted = 0
local position = 0

if activeRank ~= false then
  redis.call('ZADD', KEYS[1], now + leaseMs, sid)
  admitted = 1
elseif waitRank ~= false then
  local free = maxActive - active
  if free > 0 and waitRank < free then
    redis.call('ZREM', KEYS[2], sid)
    redis.call('ZADD', KEYS[1], now + leaseMs, sid)
    admitted = 1
    active = active + 1
  else
    position = active + waitRank
  end
end

return {admitted, active, position, redis.call('ZCARD', KEYS[2]), 1}
`;

const STATUS_SCRIPT = `
local now = tonumber(ARGV[1])
local sid = ARGV[2]
local maxActive = tonumber(ARGV[3])
local leaseMs = tonumber(ARGV[4])
local sessionTtl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)

local active = redis.call('ZCARD', KEYS[1])
local activeRank = redis.call('ZRANK', KEYS[1], sid)
local waitRank = redis.call('ZRANK', KEYS[2], sid)
local admitted = 0
local position = 0
local known = 0

if activeRank ~= false then
  redis.call('ZADD', KEYS[1], now + leaseMs, sid)
  redis.call('EXPIRE', KEYS[3], sessionTtl)
  admitted = 1
  known = 1
elseif waitRank ~= false then
  known = 1
  local free = maxActive - active
  if free > 0 and waitRank < free then
    redis.call('ZREM', KEYS[2], sid)
    redis.call('ZADD', KEYS[1], now + leaseMs, sid)
    redis.call('EXPIRE', KEYS[3], sessionTtl)
    admitted = 1
    active = active + 1
  else
    position = active + waitRank
  end
end

return {admitted, active, position, redis.call('ZCARD', KEYS[2]), known}
`;

const LEAVE_SCRIPT = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('DEL', KEYS[3])
return 1
`;

/**
 * Shapes a queue script result into the JSON the client expects.
 *
 * Args:
 *   result (Array|null): Four Redis integers.
 *   sessionId (string): Session id, present when the caller joined.
 *
 * Returns:
 *   Object: Queue snapshot.
 */
function queueResponse(result, sessionId) {
  const [admitted = 1, active = 0, position = 0, waiting = 0, known = 1] = Array.isArray(result) ? result : [];
  return {
    enabled: true,
    admitted: Number(admitted) === 1,
    active: Number(active),
    position: Number(position),
    waiting: Number(waiting),
    known: Number(known) === 1,
    sessionId,
    maxActive: MAX_ACTIVE,
  };
}

/**
 * Handles queue join, status, leave and capability probes.
 *
 * The queue caps how many people enrich at once against the shared TMDB key.
 * Without Redis configured it reports itself disabled so the app keeps working
 * instead of pretending there is a queue nobody can see.
 *
 * Args:
 *   req (IncomingMessage): Vercel request with a JSON body.
 *   res (ServerResponse): Vercel response.
 *
 * Returns:
 *   Promise<void>
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  const action = String(body.action || req.query?.action || '').toLowerCase();
  const tmdbReady = Boolean(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);

  if (action === 'probe') {
    res.status(200).json({
      enabled: hasRedis(),
      tmdbReady,
      maxActive: MAX_ACTIVE,
    });
    return;
  }

  if (!hasRedis()) {
    res.status(200).json({
      enabled: false,
      admitted: true,
      active: 0,
      position: 0,
      waiting: 0,
      known: true,
      sessionId: null,
      maxActive: 0,
      tmdbReady,
    });
    return;
  }

  try {
    if (action === 'join') {
      const sessionId = randomUUID();
      const result = await redisEval(
        JOIN_SCRIPT,
        [ACTIVE_KEY, WAITING_KEY, SESSION_PREFIX + sessionId],
        [
          Date.now(),
          MAX_WAIT_MS,
          LEASE_MS,
          SESSION_TTL,
          MAX_ACTIVE,
          sessionId,
          Number(body.total) || 0,
        ],
      );
      res.status(200).json({ ...queueResponse(result, sessionId), tmdbReady });
      return;
    }

    const sessionId = String(body.sessionId || req.query?.sessionId || '');
    if (!sessionId || sessionId.length > 80 || !/^[a-zA-Z0-9-]+$/.test(sessionId)) {
      res.status(400).json({ error: 'invalid session id' });
      return;
    }

    const keys = [ACTIVE_KEY, WAITING_KEY, SESSION_PREFIX + sessionId];

    if (action === 'status') {
      const result = await redisEval(STATUS_SCRIPT, keys, [Date.now(), sessionId, MAX_ACTIVE, LEASE_MS, SESSION_TTL]);
      res.status(200).json({ ...queueResponse(result, sessionId), tmdbReady });
      return;
    }

    if (action === 'leave') {
      await redisEval(LEAVE_SCRIPT, keys, [sessionId]);
      res.status(200).json({ enabled: true, admitted: false, left: true, tmdbReady });
      return;
    }

    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.warn('queue: redis failed, letting the request through', err?.message || err);
    res.status(200).json({
      enabled: false,
      admitted: true,
      active: 0,
      position: 0,
      waiting: 0,
      known: true,
      sessionId: null,
      maxActive: 0,
      tmdbReady,
    });
  }
}
