import { localDate } from "../parser";
import { addDays } from "../insights";
import type { BbpsProvider, Biller, FetchResult } from "./types";

/**
 * Built-in mock BBPS provider: realistic billers and deterministic fake
 * bills derived from the consumer number, so the whole flow (search →
 * identifiers → fetched amount → pay → mark paid) works before Setu
 * onboarding. Same consumer number always returns the same bill.
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

export const MOCK_BILLERS: Biller[] = [
  {
    id: "BSES00000DEL01",
    name: "BSES Rajdhani Power Limited",
    category: "Electricity",
    params: [NUM("CA Number", 9, 9)],
  },
  {
    id: "BSES00000DEL02",
    name: "BSES Yamuna Power Limited",
    category: "Electricity",
    params: [NUM("CA Number", 9, 9)],
  },
  {
    id: "TATA00000DEL01",
    name: "Tata Power Delhi Distribution",
    category: "Electricity",
    params: [NUM("CA Number", 11, 11)],
  },
  {
    id: "MSED00000MAH01",
    name: "Maharashtra State Electricity (MSEDCL)",
    category: "Electricity",
    params: [NUM("Consumer Number", 12, 12)],
  },
  {
    id: "UPPC00000UTP01",
    name: "UPPCL (Uttar Pradesh Power)",
    category: "Electricity",
    params: [NUM("Account Number", 10, 12)],
  },
  {
    id: "BESC00000KAR01",
    name: "BESCOM (Bangalore Electricity)",
    category: "Electricity",
    params: [ALNUM("Account ID", 8, 12)],
  },
  {
    id: "DJBO00000DEL01",
    name: "Delhi Jal Board",
    category: "Water",
    params: [ALNUM("K Number", 8, 12)],
  },
  {
    id: "BMCW00000MAH01",
    name: "BMC Water (Mumbai)",
    category: "Water",
    params: [ALNUM("Consumer Number", 8, 14)],
  },
  {
    id: "IGLC00000DEL01",
    name: "Indraprastha Gas (IGL)",
    category: "Gas",
    params: [NUM("BP Number", 10, 10)],
  },
  {
    id: "MGLC00000MAH01",
    name: "Mahanagar Gas (MGL)",
    category: "Gas",
    params: [NUM("CA Number", 12, 12)],
  },
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

const NAMES = [
  "Aniket Sharma",
  "Mridul Sharma",
  "Sunita Sharma",
  "Rajesh Kumar",
  "Priya Verma",
  "Amit Gupta",
];

export class MockBbpsProvider implements BbpsProvider {
  readonly name = "mock" as const;

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
        customerName: NAMES[h % NAMES.length],
      },
    };
  }
}
