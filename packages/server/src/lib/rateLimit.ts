interface Bucket {
  count: number;
  resetAt: number;
}

const SWEEP_THRESHOLD = 10_000;

export function createRateLimiter(limit: number, windowMs: number): (key: string) => boolean {
  const buckets = new Map<string, Bucket>();

  function sweepExpired(now: number): void {
    if (buckets.size < SWEEP_THRESHOLD) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return (key: string): boolean => {
    const now = Date.now();
    sweepExpired(now);

    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (bucket.count >= limit) {
      return false;
    }

    bucket.count += 1;
    return true;
  };
}
