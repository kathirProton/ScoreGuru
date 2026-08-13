/**
 * Guard against the silent-truncation bug.
 *
 * PostgREST caps every response at 1000 rows and truncates with NO error, so a
 * plain `.select()` over a table that grows with usage quietly starts dropping
 * rows — which is exactly how completed matches went missing from the
 * leaderboards once `deliveries` passed 1000 rows.
 *
 * This flags reads of a growing table that are neither paged nor bounded:
 *   paged   — fetchAll / fetchAllIn (src/lib/supabase/paginate.ts)
 *   bounded — .single() / .maybeSingle() / .limit() / { head: true },
 *             or filtered to one parent row via .eq("<...>_id", …)
 *
 *   npm run check:reads
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** Tables whose row count grows as matches are played. */
const GROWING = [
  "deliveries",
  "batting_events",
  "match_players",
  "team_players",
  "dropped_catches",
  "innings",
  "matches",
  "players",
  "teams",
];

/** The paging helpers themselves. */
const EXEMPT = new Set(["src/lib/supabase/paginate.ts"]);

const PAGED = new Set(["fetchAll", "fetchAllIn"]);
const BOUNDED = [
  /\.single\(\)/,
  /\.maybeSingle\(\)/,
  /\.limit\(/,
  /head:\s*true/,
  /\.eq\("(?:id|[a-z_]*_id)"/, // scoped to one parent row
  // Primary-key lookup: bounded by the caller's id list, one row per id. (A
  // list of >1000 ids would still need fetchAllIn's chunking — none exist here.)
  /\.in\("id",/,
];
const WRITE = [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/];

/**
 * Names of the calls enclosing `idx`, found by walking backwards through
 * unmatched `(`. Paren-balanced rather than a fixed window, so a neighbouring
 * statement can never be mistaken for a wrapper.
 */
function enclosingCalls(src, idx) {
  const names = [];
  let depth = 0;
  for (let i = idx; i >= 0 && names.length < 5; i--) {
    const c = src[i];
    if (c === ")") depth++;
    else if (c === "(") {
      if (depth > 0) depth--;
      else {
        const before = src.slice(Math.max(0, i - 60), i);
        // Allow an explicit type argument list: `fetchAllIn<Delivery>(`
        const m = /([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*$/.exec(before);
        if (m) names.push(m[1]);
      }
    }
  }
  return names;
}

/** The method chain starting at `idx`, stopped at the end of its own expression. */
function chainAt(src, idx) {
  let depth = 0;
  for (let i = idx; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") {
      if (depth === 0) return src.slice(idx, i); // closing paren of the wrapper
      depth--;
    } else if (depth === 0 && (c === ";" || c === ",")) return src.slice(idx, i);
  }
  return src.slice(idx);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? walk(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (EXEMPT.has(rel)) continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  for (const table of GROWING) {
    const needle = `.from("${table}")`;
    let at = -1;
    while ((at = src.indexOf(needle, at + 1)) !== -1) {
      const chain = chainAt(src, at);
      if (!chain.includes(".select(")) continue; // not a read
      if (WRITE.some((re) => re.test(chain))) continue; // write with a returning clause
      if (enclosingCalls(src, at).some((n) => PAGED.has(n))) continue;
      if (BOUNDED.some((re) => re.test(chain))) continue;

      const line = src.slice(0, at).split("\n").length;
      violations.push(
        `${rel}:${line}  unpaged read of "${table}"\n      ${lines[line - 1].trim()}`
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} unpaged read(s) of a growing table.\n\n` +
      `  PostgREST returns at most 1000 rows and truncates SILENTLY, so these\n` +
      `  will start losing data as the table grows. Wrap them in fetchAll /\n` +
      `  fetchAllIn from src/lib/supabase/paginate.ts, or bound them with\n` +
      `  .single() / .maybeSingle() / .limit() / { head: true }.\n`
  );
  for (const v of violations) console.error("  " + v + "\n");
  process.exit(1);
}

console.log(
  `✓ every read of a growing table is paged or bounded (${GROWING.length} tables checked)`
);
