import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The keyboard-covers-the-sheet bug, kept from coming back.
 *
 * The app draws edge-to-edge on Android, so the window doesn't shrink for the
 * keyboard: a bottom sheet with a text box must wrap itself in KeyboardAware
 * (components/ui.tsx), or the keyboard opens on top of the box being typed in.
 * Every new sheet used to re-learn this by hand. This test reads the source:
 *
 *  - A file that opens a <Modal> and has a <TextInput> must use KeyboardAware.
 *  - Exception: inputs placed inside the shared Cards <Sheet>, which handles
 *    the keyboard itself (and is checked here too).
 */

const MOBILE = fileURLToPath(new URL("..", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

const files = [
  ...sources(join(MOBILE, "components")),
  join(MOBILE, "App.tsx"),
].map((path) => ({
  path: relative(MOBILE, path).replace(/\\/g, "/"),
  code: readFileSync(path, "utf8"),
}));

describe("sheets with text boxes stay above the keyboard", () => {
  it("the shared Cards sheet handles the keyboard", () => {
    const parts = files.find((f) => f.path === "components/cards/parts.tsx");
    expect(parts?.code).toMatch(/export function Sheet\(/);
    expect(parts?.code).toMatch(/<KeyboardAware\b/);
  });

  const risky = files.filter(
    (f) => /<Modal\b/.test(f.code) && /<TextInput\b/.test(f.code),
  );

  it("finds the sheets to check", () => {
    expect(risky.length).toBeGreaterThan(5);
  });

  for (const f of risky)
    it(`${f.path} lifts its text boxes above the keyboard`, () => {
      const handled =
        /<KeyboardAware\b/.test(f.code) ||
        // Inputs only inside the shared Cards <Sheet>, which is keyboard-aware.
        (/<Sheet\b/.test(f.code) && /from "\.\/parts"/.test(f.code));
      expect(
        handled,
        `${f.path} has a <Modal> and a <TextInput> but no KeyboardAware: wrap the sheet in <KeyboardAware> (components/ui.tsx)`,
      ).toBe(true);
    });
});
