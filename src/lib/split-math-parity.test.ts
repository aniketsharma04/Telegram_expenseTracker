import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// The app ships its own copy of the split maths (it can't import server
// code). Shares shown before saving must be the shares the server saves.
it("the app's split maths is an exact copy of the server's", () => {
  const server = readFileSync("src/lib/split-math.ts", "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const app = readFileSync("mobile/lib/split-math.ts", "utf8").replace(
    /\r\n/g,
    "\n",
  );
  expect(app.split("\n").slice(3).join("\n")).toBe(server);
});
