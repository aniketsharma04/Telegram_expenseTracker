import type { Metadata } from "next";
import { upiLink, UPI_ID } from "@/lib/split-math";

export const metadata: Metadata = {
  title: "Pay back · Aaj",
  description: "Open your UPI app to pay back your share.",
  robots: { index: false, follow: false },
};

/**
 * "Pay me back" (v24). A friend opens this from a chat; the button opens
 * their own UPI app with the amount filled in. Everything is in the link —
 * nothing is stored, and Aaj never touches the money. WhatsApp doesn't make
 * upi:// links tappable, which is why this page exists.
 *
 * Anyone could build a link like this with any UPI ID, so the page shows
 * the ID plainly and tells the payer to check it.
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const upiId = one("pa");
  const amount = Number(one("am"));
  const name = one("pn").slice(0, 40) || null;
  const note = one("tn").slice(0, 50) || null;
  const valid =
    UPI_ID.test(upiId) &&
    Number.isFinite(amount) &&
    amount >= 1 &&
    amount <= 1_00_000;

  if (!valid)
    return (
      <main className="legal">
        <h1>This payment link isn&apos;t complete</h1>
        <p>Ask the person who sent it for a new one.</p>
      </main>
    );

  const paise = Math.round(amount * 100);
  const href = upiLink({ upiId, name, amount: paise, note });
  const rupees = `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

  return (
    <main className="legal" style={{ maxWidth: 420, textAlign: "center" }}>
      <p className="legal-meta">{note ?? "Your share"}</p>
      <h1 style={{ fontSize: 44, margin: "8px 0" }}>{rupees}</h1>
      <p>
        to <b>{name ?? upiId}</b>
      </p>
      <a
        href={href}
        style={{
          display: "block",
          margin: "24px 0 12px",
          padding: "16px 20px",
          borderRadius: 14,
          background: "#0f766e",
          color: "#fff",
          fontWeight: 700,
          fontSize: 18,
          textDecoration: "none",
        }}
      >
        Pay with a UPI app
      </a>
      <p style={{ fontSize: 14 }}>
        UPI ID: <b style={{ userSelect: "all" }}>{upiId}</b>
      </p>
      <p className="legal-meta" style={{ fontSize: 13 }}>
        Check the UPI ID and name in your UPI app before you pay. Aaj only
        builds this link; it never receives or holds money. On a computer, pay
        to the UPI ID above from your phone.
      </p>
    </main>
  );
}
