// ── Rate limiting ──────────────────────────────────────────────────────────────

/** Per-socket sliding-window rate limits: socketId → event → { count, windowStart }. */
export const rateLimits = new Map<string, Map<string, { count: number; windowStart: number }>>();

/**
 * Returns true if the event is allowed under the per-socket sliding-window limit.
 * Automatically resets the window after `windowMs` milliseconds.
 */
export const checkRateLimit = (
  socketId: string,
  event: string,
  maxCount: number,
  windowMs: number,
): boolean => {
  let socketLimits = rateLimits.get(socketId);
  if (!socketLimits) {
    socketLimits = new Map();
    rateLimits.set(socketId, socketLimits);
  }
  const now = Date.now();
  const entry = socketLimits.get(event);
  if (!entry || now - entry.windowStart > windowMs) {
    socketLimits.set(event, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxCount) {
    return false;
  }
  entry.count += 1;
  return true;
};
