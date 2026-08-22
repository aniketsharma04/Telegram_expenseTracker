/** Provider-neutral BBPS (Bharat Connect) shapes. Amounts are in rupees here. */

export interface BillerParam {
  name: string; // e.g. "Consumer Number", "Card Number"
  dataType: "NUMERIC" | "ALPHANUMERIC";
  regex?: string;
  minLength?: number | null;
  maxLength?: number | null;
  optional: boolean;
}

export interface Biller {
  id: string;
  name: string;
  category: string; // "Electricity", "Credit Card", "DTH", …
  params: BillerParam[];
}

export interface FetchedBill {
  refId: string | null; // provider reference, used later to pay via BBPS
  amount: number; // rupees
  dueDate: string | null; // YYYY-MM-DD
  billDate: string | null;
  billNumber: string | null;
  customerName: string | null;
}

export type FetchResult =
  | { ok: true; bill: FetchedBill }
  | {
      ok: false;
      error: string;
      code: "not_found" | "no_dues" | "provider" | "invalid";
    };

export interface BbpsProvider {
  readonly name: "mock" | "setu";
  categories(): Promise<string[]>;
  searchBillers(
    query: string,
    category?: string | null,
    limit?: number,
  ): Promise<Biller[]>;
  getBiller(id: string): Promise<Biller | null>;
  fetchBill(
    billerId: string,
    params: Record<string, string>,
    customerMobile: string | null,
  ): Promise<FetchResult>;
}
