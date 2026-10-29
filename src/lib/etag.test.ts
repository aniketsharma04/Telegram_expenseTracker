import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { respondWithEtag } from "./etag";

const req = (etag?: string) =>
  new NextRequest("https://x.test/api/data", {
    headers: etag ? { "if-none-match": etag } : {},
  });

describe("respondWithEtag", () => {
  it("sends the body with an ETag the first time", async () => {
    const res = respondWithEtag(req(), { a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toMatch(/^W\/".+"$/);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("answers 304 with no body when the client already has it", async () => {
    const etag = respondWithEtag(req(), { a: 1 }).headers.get("etag")!;
    const res = respondWithEtag(req(etag), { a: 1 });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("sends the new body when the data changed", () => {
    const etag = respondWithEtag(req(), { a: 1 }).headers.get("etag")!;
    expect(respondWithEtag(req(etag), { a: 2 }).status).toBe(200);
  });
});
