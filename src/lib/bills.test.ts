import { describe, expect, it } from "vitest";
import {
  billStatuses,
  dueDateFor,
  monthAdd,
  reminderText,
  upiLink,
  type Bill,
} from "./bills";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1",
  user_id: 1,
  name: "BSES Electricity",
  kind: "electricity",
  category: "Utilities & bills",
  due_day: 25,
  amount: 1200,
  upi_id: null,
  payee_name: null,
  consumer_number: null,
  biller_id: null,
  active: true,
  ...over,
});

describe("dueDateFor / monthAdd", () => {
  it("clamps day 31 to short months and rolls years", () => {
    expect(dueDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateFor("2026-04", 31)).toBe("2026-04-30");
    expect(monthAdd("2026-12", 1)).toBe("2027-01");
    expect(monthAdd("2026-01", -2)).toBe("2025-11");
  });
});

describe("billStatuses", () => {
  it("reports days until due in the current cycle", () => {
    const [s] = billStatuses([bill()], [], "2026-08-22");
    expect(s.dueDate).toBe("2026-08-25");
    expect(s.daysUntil).toBe(3);
    expect(s.paidThisMonth).toBeNull();
  });

  it("rolls to next month once this cycle is paid", () => {
    const [s] = billStatuses(
      [bill()],
      [
        {
          id: "p1",
          bill_id: "b1",
          month: "2026-08",
          amount: 1180,
          paid_on: "2026-08-20",
          expense_id: null,
        },
      ],
      "2026-08-22",
    );
    expect(s.cycleMonth).toBe("2026-09");
    expect(s.dueDate).toBe("2026-09-25");
    expect(s.paidThisMonth?.amount).toBe(1180);
  });

  it("flags overdue with negative days and sorts soonest first", () => {
    const list = billStatuses(
      [bill({ id: "late", due_day: 10 }), bill({ id: "soon", due_day: 28 })],
      [],
      "2026-08-22",
    );
    expect(list[0].id).toBe("late");
    expect(list[0].daysUntil).toBe(-12);
    expect(list[1].daysUntil).toBe(6);
  });

  it("skips inactive bills", () => {
    expect(
      billStatuses([bill({ active: false })], [], "2026-08-22"),
    ).toHaveLength(0);
  });
});

describe("upiLink", () => {
  it("builds a generic UPI intent with amount", () => {
    const link = upiLink(
      { upi_id: "bses@icici", payee_name: "BSES", name: "Electricity" },
      1234.5,
    );
    expect(link).toBe(
      "upi://pay?pa=bses%40icici&pn=BSES&cu=INR&tn=Electricity+bill&am=1234.50",
    );
  });
  it("is null without a UPI id", () => {
    expect(
      upiLink({ upi_id: null, payee_name: null, name: "x" }, 100),
    ).toBeNull();
  });
});

describe("reminderText", () => {
  it("fires only on the exact reminder days", () => {
    const mk = (daysUntil: number) =>
      reminderText({
        ...billStatuses([bill()], [], "2026-08-22")[0],
        daysUntil,
      });
    expect(mk(3)).toContain("3 days");
    expect(mk(0)).toContain("due today");
    expect(mk(-2)).toContain("overdue");
    expect(mk(1)).toBeNull();
    expect(mk(5)).toBeNull();
  });
});
