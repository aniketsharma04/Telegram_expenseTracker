import { describe, expect, it } from "vitest";
import { noticeFromHtml } from "./notify";

describe("noticeFromHtml", () => {
  it("uses a short first line as the title", () => {
    const n = noticeFromHtml(
      "📅 <b>Bills due</b>\nElectricity ₹1,200 tomorrow",
      "alerts",
    );
    expect(n).toMatchObject({
      kind: "alerts",
      title: "📅 Bills due",
      body: "Electricity ₹1,200 tomorrow",
    });
    expect(n.html).toContain("<b>");
  });

  it("falls back to a kind title for a one-liner", () => {
    const n = noticeFromHtml(
      "🔁 Heads up: <b>Netflix</b> (~₹649) hits in 2 days.",
    );
    expect(n.title).toBe("Heads up");
    expect(n.body).toBe("🔁 Heads up: Netflix (~₹649) hits in 2 days.");
  });

  it("labels the monthly digest", () => {
    expect(
      noticeFromHtml(
        "A long first line that is definitely more than seventy characters long, yes\nmore",
        "digest",
      ).title,
    ).toBe("Your month");
  });
});
