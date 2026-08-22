import { Expense } from "./api";

/** Net pairwise "who owes whom" from split rows (mirror of the server's settleUp). */
export interface SettleEntry {
  from: number;
  to: number;
  amount: number;
}

export function settleUp(expenses: Expense[]): SettleEntry[] {
  const balance = new Map<string, number>();
  for (const e of expenses) {
    const debtor = e.user_id;
    const payer = e.paid_by;
    if (debtor == null || payer == null || debtor === payer) continue;
    const [a, b] = debtor < payer ? [debtor, payer] : [payer, debtor];
    const sign = debtor < payer ? 1 : -1;
    const key = `${a}|${b}`;
    balance.set(key, (balance.get(key) ?? 0) + sign * Number(e.amount));
  }
  const out: SettleEntry[] = [];
  for (const [key, net] of balance) {
    if (Math.round(net) === 0) continue;
    const [a, b] = key.split("|").map(Number);
    out.push(
      net > 0
        ? { from: a, to: b, amount: Math.round(net) }
        : { from: b, to: a, amount: Math.round(-net) },
    );
  }
  return out.sort((x, y) => y.amount - x.amount);
}
