interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const SWEEP_THRESHOLD = 10_000;

function sweepExpired(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function createRateLimiter(limit: number, windowMs: number): (key: string) => boolean {
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
