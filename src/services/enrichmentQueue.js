const QUEUE_ENDPOINT = '/api/queue';
const POLL_MS = 2000;
const HEARTBEAT_MS = 20000;
const QUEUE_AVAILABLE = import.meta.env.PROD || import.meta.env.VITE_TMDB_PROXY === 'true';

/**
 * Calls the queue API and parses its JSON response.
 *
 * Args:
 *   action (string): One of probe, join, status or leave.
 *   payload (Object, optional): Extra fields, usually sessionId or total.
 *
 * Returns:
 *   Promise<Object>: Queue snapshot from the server.
 *
 * Throws:
 *   Error: When the endpoint is missing or returns a non JSON failure.
 */
async function queueRequest(action, payload = {}) {
  const response = await fetch(QUEUE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`queue responded with ${response.status}`);
  return response.json();
}

/**
 * Wraps the raw queue response in a small session controller.
 *
 * The controller polls while the user is waiting, starts a heartbeat once
 * admitted and cleans everything up when enrichment finishes. If the API is
 * unavailable the session is admitted immediately so the app never gets stuck
 * behind a queue that does not exist.
 *
 * Args:
 *   initial (Object): Raw join response.
 *
 * Returns:
 *   Object: Session with waitForTurn, leave and snapshot methods.
 */
function createSession(initial) {
  let state = {
    enabled: Boolean(initial?.enabled),
    admitted: initial?.admitted !== false,
    position: Number(initial?.position) || 0,
    waiting: Number(initial?.waiting) || 0,
    active: Number(initial?.active) || 0,
    maxActive: Number(initial?.maxActive) || 0,
    known: initial?.known !== false,
    sessionId: initial?.sessionId || null,
    tmdbReady: typeof initial?.tmdbReady === 'boolean' ? initial.tmdbReady : undefined,
  };

  let pollTimer = 0;
  let heartbeatTimer = 0;
  let stopped = false;

  /**
   * Stops the heartbeat timer.
   *
   * Returns:
   *   void
   */
  function stopHeartbeat() {
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }

  /**
   * Keeps the active lease alive while enrichment is running.
   *
   * Returns:
   *   void
   */
  function startHeartbeat() {
    if (heartbeatTimer || stopped || !state.enabled || !state.sessionId) return;
    heartbeatTimer = window.setInterval(async () => {
      try {
        const next = await queueRequest('status', { sessionId: state.sessionId });
        state = { ...state, ...next };
        if (next.enabled === false) stopHeartbeat();
      } catch {
        // a missed heartbeat is fine, the lease just expires a bit earlier
      }
    }, HEARTBEAT_MS);
  }

  /**
   * Asks the server to drop this session.
   *
   * Returns:
   *   Promise<void>
   */
  async function leave() {
    stopped = true;
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = 0;
    stopHeartbeat();
    if (!state.enabled || !state.sessionId) return;
    try {
      await queueRequest('leave', { sessionId: state.sessionId });
    } catch {
      // the lease will expire on its own, no need to make noise
    }
  }

  /**
   * Waits until the server admits this session.
   *
   * Args:
   *   onUpdate (Function, optional): Called with every queue snapshot.
   *
   * Returns:
   *   Promise<Object>: Final admitted snapshot.
   */
  function waitForTurn(onUpdate) {
    if (!state.enabled || state.admitted) {
      if (state.admitted) startHeartbeat();
      onUpdate?.(state);
      return Promise.resolve(state);
    }

    onUpdate?.(state);

    return new Promise((resolve) => {
      const tick = async () => {
        if (stopped) {
          resolve(state);
          return;
        }

        try {
          let next = await queueRequest('status', { sessionId: state.sessionId });

          // the session vanished, probably expired while the tab slept
          if (next.enabled && next.known === false && !next.admitted) {
            next = await queueRequest('join', { total: initial?.total || 0 });
          }

          state = { ...state, ...next };
          onUpdate?.(state);

          if (state.admitted || state.enabled === false) {
            if (state.admitted) startHeartbeat();
            resolve(state);
            return;
          }
        } catch {
          // if the queue API dies, let people enrich instead of blocking them
          state = { ...state, enabled: false, admitted: true };
          onUpdate?.(state);
          resolve(state);
          return;
        }

        if (stopped) {
          resolve(state);
          return;
        }

        pollTimer = window.setTimeout(tick, POLL_MS);
      };

      pollTimer = window.setTimeout(tick, POLL_MS);
    });
  }

  /**
   * Returns the current queue snapshot.
   *
   * Returns:
   *   Object: Copy of the internal state.
   */
  function snapshot() {
    return { ...state };
  }

  // if we got a spot straight away there is no waitForTurn call to kick the
  // heartbeat off, so start it here or the lease dies mid enrichment
  if (state.enabled && state.admitted) startHeartbeat();

  return { waitForTurn, leave, snapshot };
}

/**
 * Joins the shared enrichment queue.
 *
 * Args:
 *   total (number): Number of movies about to be enriched, used for stats.
 *   options (Object, optional): `skip` bypasses the queue for cached imports.
 *
 * Returns:
 *   Promise<Object>: Queue session controller.
 */
export async function joinEnrichmentQueue(total, options = {}) {
  if (options.skip || !QUEUE_AVAILABLE) return createSession({ enabled: false, admitted: true });

  try {
    const initial = await queueRequest('join', { total });
    return createSession({ ...initial, total });
  } catch {
    // Vercel functions are down or the endpoint moved, never block the import
    return createSession({ enabled: false, admitted: true });
  }
}
