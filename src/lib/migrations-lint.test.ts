import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

/**
 * Postgres caps a regex repeat count at 255 and only compiles a CHECK's
 * pattern when a row reaches it — so `{2,256}` in v24 passed the migration
 * and then failed every UPI ID save in production (fixed in v26). The
 * in-memory test database doesn't run SQL regexes, so check the text.
 */
it("no migration uses a regex repeat count Postgres rejects", () => {
  const dir = "supabase/migrations";
  const bad: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
    // Comments may quote the old pattern; only statements count.
    const sql = readFileSync(`${dir}/${f}`, "utf8").replace(/--[^\n]*/g, "");
    for (const [quoted] of sql.matchAll(/'[^']*'/g))
      for (const m of quoted.matchAll(/\{(\d+)(?:,(\d*))?\}/g)) {
        const n = Math.max(Number(m[1]), Number(m[2] || 0));
        if (n > 255) bad.push(`${f}: ${quoted}`);
      }
  }
  expect(bad).toEqual([]);
});
