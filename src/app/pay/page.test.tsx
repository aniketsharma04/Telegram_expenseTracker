import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PayPage from "./page";

const render = async (q: Record<string, string>) =>
  renderToStaticMarkup(await PayPage({ searchParams: Promise.resolve(q) }));

describe("/pay", () => {
  it("shows the amount, the UPI ID and a button that opens a UPI app", async () => {
    const html = await render({
      pa: "aniket@oksbi",
      pn: "Aniket",
      am: "750.00",
      tn: "Toit dinner",
    });
    expect(html).toContain("₹750");
    expect(html).toContain("aniket@oksbi");
    expect(html).toContain(
      'href="upi://pay?pa=aniket%40oksbi&amp;pn=Aniket&amp;am=750.00&amp;cu=INR&amp;tn=Toit%20dinner"',
    );
    expect(html).toMatch(/Check the UPI ID/);
  });

  it("keeps paise", async () => {
    expect(await render({ pa: "ab@okaxis", am: "333.34" })).toContain(
      "₹333.34",
    );
  });

  it("refuses links that aren't complete or sensible", async () => {
    const bad: Record<string, string>[] = [
      {},
      { pa: "aniket@oksbi" },
      { pa: "not a vpa", am: "100" },
      { pa: "a@okaxis", am: "100" }, // one-letter name: not a real UPI ID
      { pa: "ab@okaxis", am: "0" },
      { pa: "ab@okaxis", am: "-5" },
      { pa: "ab@okaxis", am: "500000" }, // over ₹1 lakh: UPI's limit
      { pa: "ab@okaxis", am: "abc" },
    ];
    for (const q of bad)
      expect(await render(q)).toContain("isn&#x27;t complete");
  });

  it("escapes whatever is in the note and name", async () => {
    const html = await render({
      pa: "ab@okaxis",
      am: "10",
      pn: "<script>x</script>",
      tn: '"><img src=x>',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
});
