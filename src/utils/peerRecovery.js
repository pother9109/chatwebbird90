const TRANSIENT_PEER_ERRORS = new Set([
  'network',
  'socket-error',
  'socket-closed',
  'disconnected',
  'server-error'
]);

export function isTransientPeerError(err) {
  return TRANSIENT_PEER_ERRORS.has(err?.type);
}

export function getRetryDelay(attempt, { baseMs = 1200, maxMs = 12000 } = {}) {
  const safeAttempt = Math.max(0, attempt);
  const exponentialDelay = baseMs * (2 ** Math.min(safeAttempt, 4));
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(maxMs, exponentialDelay + jitter);
}

export function clearRetryTimer(timerRef) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}
