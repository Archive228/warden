// The public Robinhood Chain RPC is rate-limited (their own docs say so).
// A live audit reproduced an unhandled crash from a single 429 during a run
// of a handful of sequential scans — routine use, not abuse. Every network
// call in this project should go through this rather than a bare await.
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500 }: {
    retries?: number;
    baseDelayMs?: number;
  } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** attempt)
      );
    }
  }
  throw lastError;
}
