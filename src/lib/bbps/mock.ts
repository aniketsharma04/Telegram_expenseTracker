import { localDate } from "../parser";
import { addDays } from "../insights";
import type { BbpsProvider, Biller, FetchResult } from "./types";
import {
  DISCOMS,
  GAS_BILLERS,
  WATER_BILLERS,
  type BillerSpec,
} from "../billers";

/**
 * Built-in mock BBPS provider: the real biller directory, but no real bills.
 *
 * Without a live Bharat Connect connection we can't know anyone's bill, so a
 * fetch answers "bill not available" and the card shows ₹0 instead of a
 * made-up amount on a made-up name. Set BBPS_MOCK_BILLS=1 (dev/tests) for
 * deterministic demo bills derived from the consumer number, so the flow
 * (identifiers → amount → pay → mark paid) can still be exercised. Demo bills
 * never carry a customer name: a fake person on a real account number reads
 * as "this is someone else's bill".
 */

const NUM = (
  name: string,
  min: number,
  max: number,
): Biller["params"][number] => ({
  name,
  dataType: "NUMERIC",
  regex: `^[0-9]{${min},${max}}$`,
  minLength: min,
  maxLength: max,
  optional: false,
});
const ALNUM = (
  name: string,
  min: number,
  max: number,
): Biller["params"][number] => ({
  name,
  dataType: "ALPHANUMERIC",
  regex: `^[A-Za-z0-9]{${min},${max}}$`,
  minLength: min,
  maxLength: max,
  optional: false,
});

/** Turn a shared biller spec into the BBPS shape the picker expects. */
function fromSpec(spec: BillerSpec, category: string): Biller {
  const [min, max] = spec.digits;
  return {
    id: spec.id,
    name: spec.name,
    category,
    params: [
      spec.alphanumeric
        ? ALNUM(spec.field, min, max)
        : NUM(spec.field, min, max),
    ],
  };
}

/**
 * Utilities come from the shared list in ../billers so the picker, the email
 * detector and merchant normalisation can never disagree about who exists.
 * The cards and telecom entries below are mock-only.
 */
const UTILITY_BILLERS: Biller[] = [
  ...DISCOMS.map((b) => fromSpec(b, "Electricity")),
  ...GAS_BILLERS.map((b) => fromSpec(b, "Gas")),
  ...WATER_BILLERS.map((b) => fromSpec(b, "Water")),
];

export const MOCK_BILLERS: Biller[] = [
  // Electricity, gas and water: one shared national list.
  ...UTILITY_BILLERS,
  {
    id: "HDFC00000NATCC",
    name: "HDFC Bank Credit Card",
    category: "Credit Card",
    params: [NUM("Card Number", 16, 16), NUM("Registered Mobile", 10, 10)],
  },
  {
    id: "ICIC00000NATCC",
    name: "ICICI Bank Credit Card",
    category: "Credit Card",
    params: [NUM("Card Number", 16, 16)],
  },
  {
    id: "SBIC00000NATCC",
    name: "SBI Card",
    category: "Credit Card",
    params: [NUM("Card Number", 16, 16), NUM("Registered Mobile", 10, 10)],
  },
  {
    id: "AXIS00000NATCC",
    name: "Axis Bank Credit Card",
    category: "Credit Card",
    params: [NUM("Card Number", 16, 16)],
  },
  {
    id: "KOTK00000NATCC",
    name: "Kotak Mahindra Bank Credit Card",
    category: "Credit Card",
    params: [NUM("Card Number", 16, 16)],
  },
  {
    id: "AIRT00000NATPM",
    name: "Airtel Postpaid",
    category: "Mobile Postpaid",
    params: [NUM("Mobile Number", 10, 10)],
  },
  {
    id: "JIOO00000NATPM",
    name: "Jio Postpaid",
    category: "Mobile Postpaid",
    params: [NUM("Mobile Number", 10, 10)],
  },
  {
    id: "VIVO00000NATPM",
    name: "Vi Postpaid",
    category: "Mobile Postpaid",
    params: [NUM("Mobile Number", 10, 10)],
  },
  {
    id: "AIRT00000NATPR",
    name: "Airtel Prepaid",
    category: "Mobile Prepaid",
    params: [NUM("Mobile Number", 10, 10)],
  },
  {
    id: "JIOO00000NATPR",
    name: "Jio Prepaid",
    category: "Mobile Prepaid",
    params: [NUM("Mobile Number", 10, 10)],
  },
  {
    id: "TATA00000NATDT",
    name: "Tata Play (DTH)",
    category: "DTH",
    params: [NUM("Subscriber ID", 10, 10)],
  },
  {
    id: "DISH00000NATDT",
    name: "Dish TV",
    category: "DTH",
    params: [NUM("Viewing Card Number", 11, 11)],
  },
  {
    id: "AIRT00000NATDT",
    name: "Airtel Digital TV",
    category: "DTH",
    params: [NUM("Customer ID", 10, 10)],
  },
  {
    id: "AIRT00000NATBB",
    name: "Airtel Xstream Fiber",
    category: "Broadband",
    params: [NUM("Account Number", 10, 10)],
  },
  {
    id: "JIOO00000NATBB",
    name: "JioFiber",
    category: "Broadband",
    params: [NUM("Service ID", 10, 12)],
  },
  {
    id: "ACTF00000NATBB",
    name: "ACT Fibernet",
    category: "Broadband",
    params: [ALNUM("Account Number", 6, 12)],
  },
  {
    id: "LICI00000NATIN",
    name: "LIC of India",
    category: "Insurance",
    params: [NUM("Policy Number", 9, 9), NUM("Date of Birth (DDMMYYYY)", 8, 8)],
  },
  {
    id: "HDFC00000NATLN",
    name: "HDFC Bank Loan EMI",
    category: "Loan Repayment",
    params: [ALNUM("Loan Account Number", 10, 16)],
  },
  {
    id: "BAJF00000NATLN",
    name: "Bajaj Finserv Loan",
    category: "Loan Repayment",
    params: [ALNUM("Loan Account Number", 10, 16)],
  },
  {
    id: "NHAI00000NATFT",
    name: "FASTag (NHAI)",
    category: "FASTag",
    params: [NUM("Vehicle Number / Wallet ID", 8, 12)],
  },
];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export class MockBbpsProvider implements BbpsProvider {
  readonly name = "mock" as const;
  private demoBills: boolean;

  constructor(opts: { demoBills?: boolean } = {}) {
    this.demoBills = opts.demoBills ?? process.env.BBPS_MOCK_BILLS === "1";
  }

  async categories(): Promise<string[]> {
    return [...new Set(MOCK_BILLERS.map((b) => b.category))];
  }

  async searchBillers(
    query: string,
    category?: string | null,
    limit = 25,
  ): Promise<Biller[]> {
    const q = query.trim().toLowerCase();
    return MOCK_BILLERS.filter(
      (b) =>
        (!category || b.category === category) &&
        (!q ||
          b.name.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)),
    ).slice(0, limit);
  }

  async getBiller(id: string): Promise<Biller | null> {
    return MOCK_BILLERS.find((b) => b.id === id) ?? null;
  }

  async fetchBill(
    billerId: string,
    params: Record<string, string>,
  ): Promise<FetchResult> {
    const biller = await this.getBiller(billerId);
    if (!biller) return { ok: false, code: "invalid", error: "Unknown biller" };
    for (const p of biller.params) {
      const v = params[p.name] ?? "";
      if (!v && !p.optional)
        return { ok: false, code: "invalid", error: `${p.name} is required` };
      if (v && p.regex && !new RegExp(p.regex).test(v))
        return {
          ok: false,
          code: "invalid",
          error: `${p.name} doesn't look right`,
        };
    }
    if (!this.demoBills)
      return {
        ok: false,
        code: "unavailable",
        error: "Bill not available. Live bill fetch isn't connected yet",
      };

    const key = `${billerId}|${Object.values(params).join("|")}`;
    const h = hash(key);
    // Numbers ending in 00 → "no dues"; ending in 99 → "not found" — handy for testing.
    const first = Object.values(params)[0] ?? "";
    if (first.endsWith("99"))
      return {
        ok: false,
        code: "not_found",
        error: "No account found for these details",
      };
    if (first.endsWith("00"))
      return {
        ok: false,
        code: "no_dues",
        error: "No outstanding bill right now",
      };

    const isCard = biller.category === "Credit Card";
    const isLoan = biller.category === "Loan Repayment";
    const base = isCard
      ? 3000 + (h % 40000)
      : isLoan
        ? 5000 + (h % 20000)
        : 200 + (h % 3800);
    const amount = Math.round(base);
    const today = localDate();
    const dueDate = addDays(today, 2 + (h % 18));
    const billDate = addDays(dueDate, -15);
    return {
      ok: true,
      bill: {
        refId: `MOCK${h.toString(16).toUpperCase()}`,
        amount,
        dueDate,
        billDate,
        billNumber: `B${(h % 1_000_000).toString().padStart(6, "0")}`,
        customerName: null,
      },
    };
  }
}
