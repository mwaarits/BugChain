// ponytail: single-instance fixed-window limiter. Per-process (backend is one
// node); upgrade to a shared store if the backend ever scales horizontally.
export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function take(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= opts.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { take };
}