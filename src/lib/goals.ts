import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Goals (v17) — the "ahead" part of planning.
 *
 * A goal's monthly amount comes off the top, like the savings goal, so the
 * daily number already leaves room for it. When a budget month closes the
 * goals are credited automatically — nobody moves money by hand in this app —
 * and an overspent month takes its overspend out of those credits, so the
 * progress bar never shows money that was actually spent on Swiggy.
 */

export interface GoalLike {
  id: string;
  name: string;
  target_amount: number;
  saved: number;
  monthly: number;
  target_date: string | null;
  created_at: string;
}

export interface Goal extends GoalLike {
  user_id: number;
  achieved_at: string | null;
  /** v18: which rule of thumb applies; null = guess from the name. */
  kind?: GoalKind | null;
}

/** v18: what a goal is for, so the app applies the right rule of thumb. */
export const GOAL_KINDS = [
  "car",
  "bike",
  "home",
  "gadget",
  "trip",
  "emergency",
  "other",
] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

/** Whole budget months from `today` to `date`, counting the current one. */
function monthsUntil(today: string, date: string): number {
  const [y1, m1] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [y2, m2] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

/** What to set aside each month to reach `target` by `date`. */
export function monthlyFor(
  target: number,
  saved: number,
  date: string,
  today: string,
): number {
  const left = Math.max(0, target - saved);
  if (left === 0) return 0;
  return Math.ceil(left / monthsUntil(today, date) / 100) * 100;
}

/**
 * Credits for a month that just closed. `poolLeft` is that month's unspent
 * everyday money: negative means the month overspent, and the overspend is
 * taken out of the goal credits in proportion.
 */
export function cycleCredits(
  goals: GoalLike[],
  poolLeft: number,
  cycleEnd: string,
): Array<{ goalId: string; amount: number }> {
  const eligible = goals.filter(
    (g) =>
      g.created_at.slice(0, 10) <= cycleEnd &&
      g.monthly > 0 &&
      g.saved < g.target_amount,
  );
  const planned = eligible.reduce((s, g) => s + g.monthly, 0);
  if (planned === 0) return [];
  const shortfall = Math.max(0, -poolLeft);
  const factor = Math.max(0, (planned - shortfall) / planned);
  return eligible.map((g) => ({
    goalId: g.id,
    amount: Math.min(Math.round(g.monthly * factor), g.target_amount - g.saved),
  }));
}

export interface GoalOutlook {
  pct: number;
  /** Months until reached at the current monthly amount; null if nothing is set aside. */
  monthsLeft: number | null;
  /** Against the target date; null when there isn't one. */
  onTrack: boolean | null;
}

export function goalOutlook(g: GoalLike, today: string): GoalOutlook {
  const left = Math.max(0, g.target_amount - g.saved);
  const pct =
    g.target_amount > 0
      ? Math.min(100, Math.round((g.saved / g.target_amount) * 100))
      : 0;
  const monthsLeft =
    left === 0 ? 0 : g.monthly > 0 ? Math.ceil(left / g.monthly) : null;
  const onTrack =
    g.target_date == null
      ? null
      : monthsLeft !== null && monthsLeft <= monthsUntil(today, g.target_date);
  return { pct, monthsLeft, onTrack };
}

// ── DB ──────────────────────────────────────────────────────────────────────

const COLUMNS =
  "id, user_id, name, target_amount, saved, monthly, target_date, created_at, achieved_at, kind";
/** Pre-v18 shape, for databases without the kind column. */
const COLUMNS_V17 =
  "id, user_id, name, target_amount, saved, monthly, target_date, created_at, achieved_at";

const toGoal = (r: Record<string, unknown>): Goal =>
  ({
    ...r,
    target_amount: Number(r.target_amount),
    saved: Number(r.saved),
    monthly: Number(r.monthly),
  }) as Goal;

export async function getGoals(
  supabase: SupabaseClient,
  userId: number,
): Promise<Goal[]> {
  try {
    const query = (cols: string) =>
      supabase
        .from("goals")
        .select(cols)
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at");
    let { data, error } = await query(COLUMNS);
    if (error) ({ data, error } = await query(COLUMNS_V17));
    if (error) throw error;
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
      toGoal,
    );
  } catch (err) {
    console.error("getGoals failed (v17 migration applied?)", err);
    return [];
  }
}

/** Monthly amount all active, unreached goals take off the top. */
export const goalsMonthly = (goals: GoalLike[]) =>
  goals
    .filter((g) => g.saved < g.target_amount)
    .reduce((s, g) => s + g.monthly, 0);

export async function saveGoal(
  supabase: SupabaseClient,
  userId: number,
  g: {
    id?: string;
    name: string;
    target_amount: number;
    monthly: number;
    target_date: string | null;
    /** Left out = unchanged. */
    kind?: GoalKind | null;
  },
): Promise<Goal> {
  const base = {
    name: g.name.trim().slice(0, 60),
    target_amount: g.target_amount,
    monthly: g.monthly,
    target_date: g.target_date,
  };
  const write = (row: Record<string, unknown>, cols: string) => {
    const q = g.id
      ? supabase.from("goals").update(row).eq("id", g.id).eq("user_id", userId)
      : supabase.from("goals").insert({ user_id: userId, ...row });
    return q.select(cols).single();
  };
  let { data, error } = await write(
    g.kind === undefined ? base : { ...base, kind: g.kind },
    COLUMNS,
  );
  // v18 migration not applied yet: save without the kind.
  if (error) ({ data, error } = await write(base, COLUMNS_V17));
  if (error) throw error;
  return toGoal(data as unknown as Record<string, unknown>);
}

export async function archiveGoal(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("goals")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Apply a closed month's credits once. The (goal, cycle) primary key on
 * goal_credits makes a re-run of the cron a no-op. Returns what was credited.
 */
export async function creditGoals(
  supabase: SupabaseClient,
  goals: Goal[],
  credits: Array<{ goalId: string; amount: number }>,
  cycleStart: string,
): Promise<Array<{ goal: Goal; amount: number }>> {
  const applied: Array<{ goal: Goal; amount: number }> = [];
  for (const c of credits) {
    const goal = goals.find((g) => g.id === c.goalId);
    if (!goal) continue;
    const { error: dup } = await supabase
      .from("goal_credits")
      .insert({ goal_id: goal.id, cycle_start: cycleStart, amount: c.amount });
    if (dup) continue; // already credited for this month
    const saved = goal.saved + c.amount;
    await supabase
      .from("goals")
      .update({
        saved,
        achieved_at:
          saved >= goal.target_amount ? new Date().toISOString() : null,
      })
      .eq("id", goal.id);
    applied.push({ goal: { ...goal, saved }, amount: c.amount });
  }
  return applied;
}
