/**
 * Lightweight development / PERF_TIMING instrumentation.
 * Never logs emails, tokens, user ids, or secrets.
 */

export function isPerfTimingEnabled(): boolean {
  return (
    process.env.PERF_TIMING === "1" ||
    process.env.NODE_ENV === "development"
  );
}

/** Format a Server-Timing metric value (name + duration in ms). */
export function serverTimingMetric(name: string, durationMs: number): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `${safe};dur=${Math.max(0, durationMs).toFixed(1)}`;
}

export function appendServerTiming(existing: string | null, metric: string): string {
  return existing ? `${existing}, ${metric}` : metric;
}

/**
 * Time an async operation. In development (or PERF_TIMING=1) logs
 * `[perf] <name>: <ms>ms` without any user payload.
 */
export async function timed<T>(
  name: string,
  fn: () => PromiseLike<T> | T
): Promise<T> {
  if (!isPerfTimingEnabled()) return await fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - start;
    console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`);
  }
}

/** Synchronous variant for short CPU sections. */
export function timedSync<T>(name: string, fn: () => T): T {
  if (!isPerfTimingEnabled()) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    const ms = performance.now() - start;
    console.info(`[perf] ${name}: ${ms.toFixed(1)}ms`);
  }
}
