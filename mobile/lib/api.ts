/** Same API the web dashboard uses — the app is just another skin over it. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://telegram-expense-tracker-nu.vercel.app";

export const BOT_URL = "https://t.me/Aniket_financial_expense_bot";

export interface Expense {
  id: string;
  user_id: number | null;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
  logged_at: string;
  source: string;
  paid_by?: number | null;
  split_id?: string | null;
  /** v14: daily / fixed / savings — null lets the app decide. */
  budget_scope?: BudgetScope | null;
}

export type BudgetScope = "daily" | "fixed" | "savings";

export interface BudgetProgress {
  id: string;
  category: string | null; // null = overall
  monthly_cap: number;
  spent: number;
  pct: number;
}

export interface IncomeEntry {
  id: string;
  amount: number;
  source: string | null;
  income_date: string;
}

export interface RecurringCharge {
  merchant: string;
  category: string;
  amount: number;
  nextDate: string;
  daysUntil: number;
}

export type BillKind =
  | "electricity"
  | "water"
  | "gas"
  | "credit_card"
  | "rent"
  | "internet"
  | "mobile"
  | "insurance"
  | "other";

export interface BillPayment {
  id: string;
  bill_id: string;
  month: string;
  amount: number;
  paid_on: string;
  expense_id: string | null;
}

export interface BillStatus {
  id: string;
  name: string;
  kind: BillKind;
  category: string;
  due_day: number;
  amount: number | null;
  upi_id: string | null;
  payee_name: string | null;
  consumer_number: string | null;
  cycleMonth: string;
  dueDate: string;
  daysUntil: number;
  paidThisMonth: BillPayment | null;
  lastPaid: BillPayment | null;
  upiLink: string | null;
  linked: boolean;
  biller_id?: string | null;
  biller_name?: string | null;
  fetch_params?: Record<string, string> | null;
  fetched_amount?: number | null;
  fetched_due_date?: string | null;
  fetched_bill_number?: string | null;
  fetched_customer_name?: string | null;
  fetched_at?: string | null;
  fetch_error?: string | null;
}

export interface BillerParam {
  name: string;
  dataType: "NUMERIC" | "ALPHANUMERIC";
  regex?: string;
  minLength?: number | null;
  maxLength?: number | null;
  optional: boolean;
}

export interface Biller {
  id: string;
  name: string;
  category: string;
  params: BillerParam[];
}

export interface FetchedBill {
  refId: string | null;
  amount: number;
  dueDate: string | null;
  billDate: string | null;
  billNumber: string | null;
  customerName: string | null;
}

export type FetchResult =
  | { ok: true; bill: FetchedBill }
  | {
      ok: false;
      code: "not_found" | "no_dues" | "provider" | "invalid";
      error: string;
    };

export interface BillInput {
  name: string;
  kind: BillKind;
  category?: string;
  due_day: number;
  amount: number | null;
  upi_id: string | null;
  payee_name: string | null;
  consumer_number: string | null;
  biller_id?: string | null;
  fetch_params?: Record<string, string> | null;
}

export interface DetectedBill {
  id: string;
  source: "gmail" | "notification";
  biller_name: string;
  kind: BillKind;
  amount: number | null;
  due_date: string | null;
  bill_date: string | null;
  account_hint: string | null;
  subject: string | null;
  snippet: string | null;
  confidence: "high" | "low";
  detected_at: string;
}

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  last_sync_at: string | null;
  configured?: boolean;
  last_error?: string | null;
  /** Google dropped the consent (every 7 days while the app is unpublished). */
  needs_reauth?: boolean;
}

export interface Anomaly {
  category: string;
  mtd: number;
  expected: number;
}

export interface ApiMember {
  id: number;
  name: string;
}

export type AccountKind = "bank" | "cash" | "wallet" | "credit_card";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  identifier: string | null;
  opening_balance: number;
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
  is_default: boolean;
  archived: boolean;
  /** Signed: negative on a card means money owed. */
  balance: number;
  outstanding: number | null;
  available: number | null;
  /** v9: the balance the bank itself last reported, and when. */
  reported_balance?: number | null;
  reported_at?: string | null;
  /** reported − computed. Non-zero means something wasn't captured. */
  drift: number | null;
}

/** What you're worth right now: what you hold minus what you owe. */
export interface Position {
  assets: number;
  liabilities: number;
  net: number;
  unassigned: { expenses: number; incomes: number };
}

export interface Transfer {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  transfer_date: string;
  kind: "transfer" | "card_payment";
  note: string | null;
}

export interface ApiData {
  user: { id: number; name: string };
  family: {
    id: string;
    name: string;
    role: string;
    invite_code: string;
    members: ApiMember[];
  } | null;
  categories: Array<{ name: string; color: string | null }>;
  expenses: Expense[];
  today: string;
  budgets?: BudgetProgress[];
  incomes?: IncomeEntry[];
  bills?: BillStatus[];
  detected_bills?: DetectedBill[];
  gmail?: GmailStatus;
  insights?: { recurring: RecurringCharge[]; anomalies: Anomaly[] };
  accounts?: Account[];
  position?: Position;
  transfers?: Transfer[];
  daily?: DailyStatus | null;
}

// ── Daily budget (v14) ──────────────────────────────────────────────────────

export interface DailyPlan {
  monthly_income: number | null;
  savings_goal: number;
  morning_brief: boolean;
  evening_report: boolean;
  live_updates: boolean;
}

export interface Commitment {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  match: string | null;
}

export interface CommitmentSuggestion {
  name: string;
  amount: number;
  category: string | null;
  match: string | null;
  from: "recurring" | "bill";
}

export interface DailySpend {
  id?: string;
  amount: number;
  category: string;
  merchant: string | null;
  scope: BudgetScope;
  dailyAmount: number;
}

export interface DailyStatus {
  ready: boolean;
  reason: "no_income" | null;
  income: number;
  incomeSource: "plan" | "last_month" | null;
  fixed: number;
  savingsGoal: number;
  pool: number;
  baseDaily: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  todayBudget: number;
  todaySpent: number;
  todayLeft: number;
  poolSpent: number;
  poolLeft: number;
  tomorrowBudget: number | null;
  projectedLeftover: number;
  streak: number;
  savedFromSavings: number;
  commitments: Array<{ id: string; name: string; amount: number; paid: number }>;
  history: Array<{ date: string; budget: number; spent: number }>;
  today: DailySpend[];
  plan: DailyPlan | null;
  commitment_list: Commitment[];
}

export async function fetchPlan(token: string): Promise<{
  daily: DailyStatus;
  plan: DailyPlan | null;
  commitments: Commitment[];
  suggestions: CommitmentSuggestion[];
} | null> {
  const res = await fetch(`${API_BASE}/api/plan`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  return res.ok ? res.json() : null;
}

export async function savePlan(
  token: string,
  patch: Partial<DailyPlan>,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export async function addCommitment(
  token: string,
  c: { name: string; amount: number; category?: string | null; match?: string | null },
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/commitments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(c),
  });
  return res.ok;
}

export async function removeCommitment(token: string, id: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/commitments?id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.trim()}` } },
  );
  return res.ok;
}

export async function fetchData(
  token: string,
): Promise<ApiData | "unauthorized"> {
  const res = await fetch(`${API_BASE}/api/data`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ApiData;
}

export interface LoggedExpense {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
}

export type AddResult =
  | {
      status: "logged";
      expense: LoggedExpense;
      nudge: boolean;
      alerts?: string[];
      transcript?: string;
      split?: { perHead: number; count: number; total: number };
    }
  | { status: "need_amount"; question: string | null; alerts?: string[] }
  | {
      /** Your own money moved between your own accounts — not spending. */
      status: "transferred";
      transfer: {
        id: string;
        amount: number;
        transfer_date: string;
        kind: "transfer" | "card_payment";
      };
      from: string | null;
      to: string | null;
      reason: string;
    };

export type AddBody =
  | { text: string }
  | {
      amount: number;
      category: string;
      merchant?: string;
      expense_date?: string;
      split?: boolean;
      account_id?: string;
    };

/** Log an expense — free text (bot brain) or structured form fields. */
export async function addExpense(
  token: string,
  body: AddBody,
): Promise<AddResult | "unauthorized"> {
  const res = await fetch(`${API_BASE}/api/expense`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AddResult;
}

/** Undo: delete one of your own expenses. */
export async function deleteExpense(
  token: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/expense?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.trim()}` },
    },
  );
  if (!res.ok) return false;
  const json = (await res.json()) as { deleted: boolean };
  return json.deleted;
}

/** Edit one of your own expenses in place. */
export async function patchExpense(
  token: string,
  id: string,
  patch: {
    amount?: number;
    category?: string;
    merchant?: string | null;
    expense_date?: string;
    budget_scope?: BudgetScope | null;
  },
): Promise<
  | { status: "updated"; expense: LoggedExpense; alerts?: string[] }
  | "unauthorized"
  | null
> {
  const res = await fetch(`${API_BASE}/api/expense`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, ...patch }),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) return null;
  return (await res.json()) as {
    status: "updated";
    expense: LoggedExpense;
    alerts?: string[];
  };
}

/** Voice note or receipt photo → same brains as the bot. */
export async function uploadMedia(
  token: string,
  kind: "voice" | "receipt",
  file: { uri: string; name: string; type: string },
  caption?: string,
): Promise<AddResult | "unauthorized"> {
  const form = new FormData();
  form.append("kind", kind);
  // React Native's FormData takes {uri, name, type} for files.
  form.append("file", file as unknown as Blob);
  if (caption) form.append("caption", caption);
  const res = await fetch(`${API_BASE}/api/expense/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.trim()}` },
    body: form,
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AddResult;
}

export async function addIncome(
  token: string,
  body: {
    amount: number;
    source?: string;
    income_date?: string;
    account_id?: string;
  },
): Promise<{ status: "logged"; income: IncomeEntry } | "unauthorized" | null> {
  const res = await fetch(`${API_BASE}/api/income`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) return null;
  return (await res.json()) as { status: "logged"; income: IncomeEntry };
}

export async function deleteIncome(
  token: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/income?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.trim()}` },
    },
  );
  if (!res.ok) return false;
  return ((await res.json()) as { deleted: boolean }).deleted;
}

export async function saveBudget(
  token: string,
  category: string | null,
  monthly_cap: number,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/budget`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category, monthly_cap }),
  });
  return res.ok;
}

export async function removeBudget(
  token: string,
  category: string | null,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/budget?category=${encodeURIComponent(category ?? "overall")}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.trim()}` } },
  );
  return res.ok;
}

// ── Bills ───────────────────────────────────────────────────────────────────

async function jsonOrNull<T>(
  res: Response,
): Promise<T | "unauthorized" | null> {
  if (res.status === 401) return "unauthorized";
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function saveBill(token: string, input: BillInput, id?: string) {
  return fetch(`${API_BASE}/api/bills`, {
    method: id ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(id ? { id, ...input } : input),
  }).then((r) => jsonOrNull<{ status: string; bill: { id: string } }>(r));
}

export async function deleteBill(token: string, id: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/bills?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.trim()}` },
    },
  );
  return res.ok;
}

export function payBill(
  token: string,
  bill_id: string,
  amount: number,
  paid_on?: string,
) {
  return fetch(`${API_BASE}/api/bills/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bill_id, amount, paid_on }),
  }).then((r) =>
    jsonOrNull<{ status: "paid"; payment: BillPayment; alerts: string[] }>(r),
  );
}

export async function unpayBill(
  token: string,
  paymentId: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/bills/pay?id=${encodeURIComponent(paymentId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.trim()}` },
    },
  );
  return res.ok;
}

// ── BBPS (auto-fetch) ───────────────────────────────────────────────────────

export async function searchBillers(
  token: string,
  q: string,
  category?: string | null,
): Promise<{
  provider: string;
  billers: Biller[];
  categories: string[];
} | null> {
  const url = `${API_BASE}/api/bbps/billers?q=${encodeURIComponent(q)}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    provider: string;
    billers: Biller[];
    categories: string[];
  };
}

export async function previewFetch(
  token: string,
  biller_id: string,
  params: Record<string, string>,
): Promise<FetchResult | null> {
  const res = await fetch(`${API_BASE}/api/bbps/fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ biller_id, params }),
  });
  if (!res.ok) return null;
  return (await res.json()) as FetchResult;
}

export async function refreshBillFetch(
  token: string,
  id: string,
): Promise<{ fetch: FetchResult; bill: BillStatus | null } | null> {
  const res = await fetch(`${API_BASE}/api/bills/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { fetch: FetchResult; bill: BillStatus | null };
}

// ── Detected bills (v7: Gmail / notifications) ──────────────────────────────

const auth = (token: string) => ({ Authorization: `Bearer ${token.trim()}` });
const authJson = (token: string) => ({
  ...auth(token),
  "Content-Type": "application/json",
});

export async function gmailStatus(token: string): Promise<GmailStatus | null> {
  const res = await fetch(`${API_BASE}/api/gmail`, { headers: auth(token) });
  if (!res.ok) return null;
  return (await res.json()) as GmailStatus;
}

/** Consent URL to open in a system browser; null when Google keys aren't set. */
export async function gmailConnectUrl(token: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/gmail/connect?json=1`, {
    headers: auth(token),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { url?: string }).url ?? null;
}

export async function gmailSync(token: string): Promise<{
  detected: number;
  scanned: number;
  detected_bills: DetectedBill[];
} | null> {
  const res = await fetch(`${API_BASE}/api/gmail`, {
    method: "POST",
    headers: auth(token),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    detected: number;
    scanned: number;
    detected_bills: DetectedBill[];
  };
}

export async function gmailDisconnect(token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/gmail`, {
    method: "DELETE",
    headers: auth(token),
  });
  return res.ok;
}

/** Confirm a detection — with `bill_id` it updates that bill, else creates one. */
export async function confirmDetected(
  token: string,
  id: string,
  opts: {
    bill_id?: string;
    name?: string;
    kind?: BillKind;
    amount?: number;
    due_day?: number;
  } = {},
): Promise<{ bill: BillStatus | null } | null> {
  const res = await fetch(`${API_BASE}/api/detected-bills`, {
    method: "POST",
    headers: authJson(token),
    body: JSON.stringify({ id, ...opts }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { bill: BillStatus | null };
}

export async function dismissDetected(
  token: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/detected-bills?id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: auth(token) },
  );
  return res.ok;
}

// ── Accounts & transfers (v8) ───────────────────────────────────────────────

export interface BalanceSheet extends Position {
  accounts: Account[];
}

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token.trim()}`,
  "Content-Type": "application/json",
});

export async function fetchAccounts(
  token: string,
): Promise<BalanceSheet | "unauthorized"> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as BalanceSheet;
}

export interface AccountInput {
  name: string;
  kind: AccountKind;
  identifier?: string | null;
  opening_balance?: number;
  credit_limit?: number | null;
  statement_day?: number | null;
  due_day?: number | null;
  is_default?: boolean;
}

export async function createAccount(
  token: string,
  body: AccountInput,
): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await errorText(res)) ?? `HTTP ${res.status}`);
  return ((await res.json()) as { account: Account }).account;
}

export async function updateAccount(
  token: string,
  id: string,
  patch: Partial<AccountInput> & { archived?: boolean },
): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ id, ...patch }),
  });
  if (!res.ok) throw new Error((await errorText(res)) ?? `HTTP ${res.status}`);
  return ((await res.json()) as { account: Account }).account;
}

export async function archiveAccount(
  token: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/accounts?id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.trim()}` } },
  );
  return res.ok;
}

export async function createTransfer(
  token: string,
  body: {
    from_account_id: string | null;
    to_account_id: string | null;
    amount: number;
    transfer_date?: string;
    kind?: "transfer" | "card_payment";
    note?: string | null;
  },
): Promise<{ transfer: Transfer; balances: BalanceSheet }> {
  const res = await fetch(`${API_BASE}/api/transfers`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await errorText(res)) ?? `HTTP ${res.status}`);
  return (await res.json()) as { transfer: Transfer; balances: BalanceSheet };
}

export async function deleteTransfer(
  token: string,
  id: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/transfers?id=${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.trim()}` } },
  );
  return res.ok;
}

/** Server error messages are far more useful than "HTTP 400" in a toast. */
async function errorText(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? null;
  } catch {
    return null;
  }
}

// ── Itemised receipts (v10) ─────────────────────────────────────────────────

export interface ReceiptItem {
  line_no: number;
  name: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
}

export interface Receipt {
  expense_id: string;
  merchant: string | null;
  bill_number: string | null;
  bill_date: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  currency: string;
  items_total: number | null;
  /** False when the lines don't add up to the total — show it as partial. */
  reconciled: boolean;
  items: ReceiptItem[];
}

/** The bill behind one expense. Null is normal: most expenses are typed in. */
export async function fetchReceipt(
  token: string,
  expenseId: string,
): Promise<Receipt | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/receipt?expense_id=${encodeURIComponent(expenseId)}`,
      { headers: { Authorization: `Bearer ${token.trim()}` } },
    );
    if (!res.ok) return null;
    return ((await res.json()) as { receipt: Receipt | null }).receipt;
  } catch {
    return null;
  }
}

/** What you actually order, ranked by spend, across every stored bill. */
export async function fetchTopItems(
  token: string,
  days = 90,
): Promise<Array<{ name: string; times: number; total: number }>> {
  try {
    const res = await fetch(`${API_BASE}/api/receipt?top=1&days=${days}`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!res.ok) return [];
    return (
      (await res.json()) as {
        items: Array<{ name: string; times: number; total: number }>;
      }
    ).items;
  } catch {
    return [];
  }
}

// ── Email sign-in (v12) ─────────────────────────────────────────────────────

export interface EmailSignIn {
  token: string;
  user: { id: number; name: string | null; email: string | null };
  telegram_linked: boolean;
}

/** Ask for a 6-digit code. Answers the same whether or not an account exists. */
export async function requestLoginCode(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error ?? `Couldn't send the code (HTTP ${res.status}).`,
    };
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the server — check your connection.",
    };
  }
}

/** Exchange the code for a 30-day session token. */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<{ ok: true; session: EmailSignIn } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const body = (await res
      .json()
      .catch(() => ({}))) as Partial<EmailSignIn> & {
      error?: string;
    };
    if (!res.ok || !body.token) {
      return { ok: false, error: body.error ?? "That code didn't work." };
    }
    return {
      ok: true,
      session: {
        token: body.token,
        user: body.user ?? { id: 0, name: null, email },
        telegram_linked: Boolean(body.telegram_linked),
      },
    };
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the server — check your connection.",
    };
  }
}

// ── Accounts you can sign in to without Telegram (v12) ─────────────────────

export interface SignInResult {
  status: "code_sent" | "signed_in";
  token?: string;
  created?: boolean;
  user?: { id: number; name: string; email: string | null };
}

/** Step 1: ask for a code. Step 2: send the code back to get a token. */
export async function emailSignIn(
  email: string,
  code?: string,
): Promise<SignInResult | { error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(code ? { email, code } : { email }),
    });
    const body = (await res.json()) as SignInResult & { error?: string };
    if (!res.ok) return { error: body.error ?? `HTTP ${res.status}` };
    return body;
  } catch {
    return { error: "Couldn't reach the server — check your connection." };
  }
}

export interface AccountInfo {
  account: {
    id: number;
    name: string;
    email: string | null;
    telegram_linked: boolean;
    consent_at: string | null;
  };
  usage: Array<{ kind: string; used: number; limit: number }>;
}

export async function fetchAccount(token: string): Promise<AccountInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/account`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AccountInfo;
  } catch {
    return null;
  }
}

/** A short code to send to the bot, so alerts can reach a Telegram chat. */
export async function requestTelegramLinkCode(
  token: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { code: string }).code;
  } catch {
    return null;
  }
}

/** Everything we hold about this account, as JSON the user can keep. */
export async function exportMyData(token: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${API_BASE}/api/account?export=1`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteMyAccount(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/api/account?confirm=delete-my-account`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.trim()}` },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
