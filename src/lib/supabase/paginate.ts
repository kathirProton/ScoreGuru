/**
 * Paged reads for Supabase/PostgREST.
 *
 * PostgREST caps every response at `db-max-rows` (1000 on Supabase) and it
 * truncates SILENTLY — no error, no flag, just a short array. Score Guru hit
 * this the moment the `deliveries` table passed 1000 rows: the stats bundle
 * only ever saw the first 1000, so the newest matches' runs and wickets simply
 * never reached the leaderboards.
 *
 * RULE: any read whose row count grows as matches are played must go through
 * `fetchAll` / `fetchAllIn`. A bare `.select()` is only safe for a single row
 * or a hard-bounded set.
 *
 * Isomorphic on purpose — `fetchMatchBundle` runs on the server and in the
 * browser, so nothing here may import `server-only`.
 */

/** Rows requested per request. Termination never relies on this matching the
 *  server's cap: we page until the reported total is reached. */
const PAGE_SIZE = 1000;

/** How many uuids to put in a single `in.(...)` filter. PostgREST takes
 *  filters in the URL, and an unbounded list eventually overflows it (414). */
const IN_CHUNK = 200;

/** Backstop so a bad query can never spin forever. */
const MAX_PAGES = 500;

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/** Structural shape of a supabase-js query builder, before it is awaited. */
export type PageableQuery<T> = {
  range(from: number, to: number): PromiseLike<QueryResult<T>>;
};

/**
 * Run a query to completion, paging past the row cap.
 *
 * `makeQuery` must build a FRESH builder on every call (they are single-use)
 * and must apply a deterministic `.order(...)` on a unique key — without a
 * total order, pages can overlap or skip rows.
 *
 * Pass `{ count: "exact" }` to `.select()` so termination is driven by the
 * server's reported total rather than by guessing at the cap:
 *
 *     fetchAll(() => supabase
 *       .from("deliveries")
 *       .select("*", { count: "exact" })
 *       .order("id"))
 */
export async function fetchAll<T>(makeQuery: () => PageableQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error, count } = await makeQuery().range(
      rows.length,
      rows.length + PAGE_SIZE - 1
    );
    if (error) throw new Error(`Supabase read failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    // Preferred: the server told us the true total (count: "exact").
    if (count != null) {
      if (rows.length >= count) return rows;
      // A page that returns nothing while rows remain means we would loop
      // forever — surface it instead of silently under-reporting.
      if (batch.length === 0) {
        throw new Error(
          `Supabase read stalled at ${rows.length}/${count} rows — is the query ordered by a unique key?`
        );
      }
      continue;
    }
    // Fallback when the caller did not ask for a count: an empty page is the
    // only cap-independent end-of-data signal.
    if (batch.length === 0) return rows;
  }
  throw new Error(
    `Supabase read exceeded ${MAX_PAGES} pages (${rows.length} rows) — is the query ordered by a unique key?`
  );
}

/**
 * `fetchAll` for an `.in(column, ids)` filter, splitting the id list into
 * URL-safe chunks. Returns `[]` for an empty id list without hitting the API.
 *
 *     fetchAllIn((ids) => supabase
 *       .from("deliveries")
 *       .select("*", { count: "exact" })
 *       .in("innings_id", ids)
 *       .order("id"), inningsIds)
 */
export async function fetchAllIn<T>(
  makeQuery: (ids: string[]) => PageableQuery<T>,
  ids: string[]
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    rows.push(...(await fetchAll(() => makeQuery(chunk))));
  }
  return rows;
}
