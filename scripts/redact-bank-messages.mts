// One-off: mask the stored text of bank messages captured before masking
// was added (new ones are masked on save, see src/lib/ingest.ts).
// Prints counts only, never message text.
//
//   npx tsx scripts/redact-bank-messages.mts           # dry run
//   npx tsx scripts/redact-bank-messages.mts --apply   # write the masked text
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local or the environment.
import { existsSync, readFileSync } from "fs";
import { redactForAI } from "../src/lib/redact";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed");
const apply = process.argv.includes("--apply");
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

let scanned = 0;
let changed = 0;
for (let from = 0; ; from += 500) {
  const res = await fetch(
    `${url}/rest/v1/bank_messages?select=id,body&body=not.is.null&order=id&offset=${from}&limit=500`,
    { headers },
  );
  if (!res.ok) throw new Error(`read failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ id: string; body: string }>;
  if (!rows.length) break;
  for (const row of rows) {
    scanned++;
    const masked = redactForAI(row.body);
    if (masked === row.body) continue;
    changed++;
    if (!apply) continue;
    const up = await fetch(`${url}/rest/v1/bank_messages?id=eq.${row.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ body: masked }),
    });
    if (!up.ok) throw new Error(`update failed for one row: ${up.status}`);
  }
}
console.log(
  `${scanned} messages checked, ${changed} ${apply ? "masked" : "would be masked (dry run; add --apply)"}`,
);
