const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

/**
 * Tells whether a Redis REST endpoint is configured.
 *
 * Returns:
 *   boolean: True when both URL and token exist.
 */
export function hasRedis() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/**
 * Runs one Redis command through the Upstash REST API.
 *
 * Upstash charges per command, so keep this lean. Any failure throws so the
 * caller can degrade to an unqueued request instead of hanging users.
 *
 * Args:
 *   command (Array): Redis command as an array, e.g. ['ZADD', key, score, id].
 *
 * Returns:
 *   Promise<any>: The raw Redis result.
 *
 * Throws:
 *   Error: When Redis is missing, unreachable or returns an error payload.
 */
export async function redisCommand(command) {
  if (!hasRedis()) throw new Error('redis is not configured');

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) {
    throw new Error(`redis responded with ${response.status}`);
  }

  const payload = await response.json();
  if (payload && payload.error) throw new Error(payload.error);
  return payload?.result ?? null;
}

/**
 * Runs a Lua script with the given keys and args.
 *
 * Args:
 *   script (string): Lua source.
 *   keys (Array<string>): Redis keys referenced by the script.
 *   args (Array<string|number>): Extra args.
 *
 * Returns:
 *   Promise<any>: Script result.
 */
export function redisEval(script, keys, args) {
  return redisCommand(['EVAL', script, String(keys.length), ...keys, ...args.map(String)]);
}
