/**
 * Normalize a useLoadAction result for safe iteration.
 *
 * Until an action resolves (or while it is disabled), useLoadAction returns
 * its SECOND argument — the while-loading value — not rows. Every call here
 * passes `[]`, so a load reads as "no rows yet"; the placeholders this helper
 * used to meet (`[null]`, `[orderId]`) were ids passed there as if it were a
 * dependency list. rows() keeps only object entries (a primitive is never a
 * row) and anything that is not an array becomes `[]`. Route every action
 * result through rows() before iterating, and check the hook's loading flag
 * before reading an empty list as "none".
 */
export function rows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data.filter(x => x != null && typeof x === 'object') as T[]) : [];
}

/** First row, for single-row lookups (detail queries, settings). */
export function firstRow<T>(data: unknown): T | undefined {
  return rows<T>(data)[0];
}
