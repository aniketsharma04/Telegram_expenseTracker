import { afterEach, describe, expect, it, vi } from "vitest";
import { htmlToPlain, sendExpoPush } from "./push";

const token = (n: number) => `ExponentPushToken[t${n}]`;

afterEach(() => vi.unstubAllGlobals());

describe("sendExpoPush", () => {
  it("sends in batches of at most 100 and reports dead tokens", async () => {
    const calls: unknown[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const batch = JSON.parse(init.body) as Array<{ to: string }>;
        calls.push(batch);
        return new Response(
          JSON.stringify({
            data: batch.map((m) =>
              m.to === token(7)
                ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
                : { status: "ok", id: `r-${m.to}` },
            ),
          }),
          { status: 200 },
        );
      }),
    );

    const messages = Array.from({ length: 150 }, (_, i) => ({
      to: token(i),
      title: "t",
      body: "b",
    }));
    const result = await sendExpoPush(messages);

    expect(calls.map((c) => c.length)).toEqual([100, 50]);
    expect(result.sent).toBe(149);
    expect(result.deadTokens).toEqual([token(7)]);
  });

  it("drops anything that isn't an Expo token without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendExpoPush([{ to: "not-a-token", title: "t", body: "b" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("survives the push service being down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const result = await sendExpoPush([{ to: token(1), title: "t", body: "b" }]);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });
});

describe("htmlToPlain", () => {
  it("turns Telegram HTML into notification text", () => {
    expect(
      htmlToPlain("🔁 Heads up: <b>Netflix</b> (~₹649) &amp; more <code>/paid</code>"),
    ).toBe("🔁 Heads up: Netflix (~₹649) & more /paid");
  });

  it("keeps line breaks and drops bot command hints", () => {
    expect(htmlToPlain("Line one\n<i>Reply /fromsavings</i>")).toBe("Line one\nReply /fromsavings");
  });
});
