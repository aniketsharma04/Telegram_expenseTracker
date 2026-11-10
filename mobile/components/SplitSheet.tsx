import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Text";
import { Sheet } from "./cards/parts";
import { Expense } from "../lib/api";
import { parseAmount } from "../lib/amount";
import { pickable } from "../lib/categories";
import { useSettings } from "../lib/i18n";
import { allocate, ME, toPaise } from "../lib/split-math";
import { addPerson, createSplit, Person } from "../lib/splits-api";
import { formatINR, Palette } from "../lib/theme";

type Method = "equal" | "exact" | "shares";

/**
 * Split a bill (v24). Opened on an expense you already have ("you paid",
 * amount fixed) or empty, for a bill someone else paid. Shares are worked out
 * on the phone with the same maths the server uses, so what you see is what
 * gets saved.
 */
export default function SplitSheet({
  p,
  token,
  expense,
  people,
  categories,
  today,
  onClose,
  onDone,
}: {
  p: Palette;
  token: string;
  /** Split this existing expense (you paid it). Omit for a new bill. */
  expense?: Expense | null;
  people: Person[];
  categories: { name: string }[];
  today: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, fs } = useSettings();
  const [known, setKnown] = useState<Person[]>(people);
  const [selected, setSelected] = useState<string[]>([ME]);
  const [paidBy, setPaidBy] = useState<string>(ME);
  const [method, setMethod] = useState<Method>("equal");
  const [values, setValues] = useState<Record<string, string>>({});
  const [amountText, setAmountText] = useState("");
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState<string>("Dining out");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixed = !!expense;
  const total = toPaise(
    fixed ? Number(expense!.amount) : (parseAmount(amountText) ?? 0),
  );
  const nameOf = (k: string) =>
    k === ME ? t("splitYou") : (known.find((x) => x.id === k)?.name ?? "?");

  const toggle = (k: string) => {
    if (selected.includes(k) && k === paidBy) setPaidBy(ME);
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  const add = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    const res = await addPerson(token, { name });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    const person = { ...res.data.person, balance: 0 };
    setKnown((k) => (k.some((x) => x.id === person.id) ? k : [...k, person]));
    setSelected((s) => (s.includes(person.id) ? s : [...s, person.id]));
    setNewName("");
  };

  // The payer goes first so leftover paise land on them (as on the server).
  const ordered = useMemo(
    () =>
      [...selected].sort((a, b) => (a === paidBy ? -1 : b === paidBy ? 1 : 0)),
    [selected, paidBy],
  );

  const preview = useMemo((): {
    shares: Map<string, number> | null;
    problem: string | null;
  } => {
    if (!(total > 0))
      return { shares: null, problem: fixed ? null : t("splitNeedAmount") };
    if (!ordered.some((k) => k !== ME))
      return { shares: null, problem: t("splitNeedPeople") };
    // Someone else paid and you're not in it: nothing of yours to track.
    if (paidBy !== ME && !ordered.includes(ME))
      return { shares: null, problem: t("splitNeedYou") };
    try {
      if (method === "exact") {
        const given = ordered.map((k) => ({
          key: k,
          value: toPaise(parseAmount(values[k] ?? "") ?? 0),
        }));
        const sum = given.reduce((a, g) => a + g.value, 0);
        if (sum !== total)
          return {
            shares: null,
            problem:
              sum < total
                ? `${formatINR((total - sum) / 100)} ${t("splitLeftToAssign")}`
                : `${formatINR((sum - total) / 100)} ${t("splitTooMuch")}`,
          };
        return { shares: allocate(total, "exact", given), problem: null };
      }
      const shares = allocate(
        total,
        method,
        ordered.map((k) => ({
          key: k,
          value: method === "shares" ? Number(values[k] || "1") : undefined,
        })),
      );
      return { shares, problem: null };
    } catch {
      return { shares: null, problem: t("splitCheckShares") };
    }
  }, [total, ordered, method, values, fixed, paidBy]);

  const save = async () => {
    if (busy || !preview.shares) return;
    setBusy(true);
    setError(null);
    const res = await createSplit(token, {
      ...(fixed
        ? { expenseId: expense!.id }
        : {
            amount: total / 100,
            category,
            merchant: what.trim() || null,
            description: what.trim() || null,
            date: today,
          }),
      paidBy: fixed ? ME : paidBy,
      method,
      shares: ordered.map((k) => ({
        person: k,
        value:
          method === "exact"
            ? (parseAmount(values[k] ?? "") ?? 0)
            : method === "shares"
              ? Number(values[k] || "1")
              : undefined,
      })),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone();
    onClose();
  };

  const chip = (on: boolean) => [
    styles.chip,
    {
      borderColor: on ? p.accent : p.border,
      backgroundColor: on ? p.accentSoft : p.page,
    },
  ];
  const chipText = (on: boolean) => ({
    color: on ? p.ink : p.ink2,
    fontSize: fs(13.5),
    fontWeight: (on ? "600" : "400") as "600" | "400",
  });
  const input = [
    styles.input,
    { borderColor: p.grid, backgroundColor: p.page, color: p.ink },
  ];

  return (
    <Sheet
      visible
      onClose={onClose}
      p={p}
      title={
        fixed
          ? `${t("splitTitle")} ${formatINR(Number(expense!.amount))}`
          : t("splitNewTitle")
      }
      footer={
        <View style={{ gap: 8 }}>
          {(error || preview.problem) && (
            <Text
              style={{
                color: error ? p.warn : p.muted,
                fontSize: fs(13),
                textAlign: "center",
              }}
            >
              {error ?? preview.problem}
            </Text>
          )}
          <Pressable
            onPress={save}
            disabled={busy || !preview.shares}
            accessibilityRole="button"
            style={[
              styles.save,
              {
                backgroundColor: p.accent,
                opacity: busy || !preview.shares ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text
                style={{
                  color: p.onAccent,
                  fontWeight: "700",
                  fontSize: fs(15),
                }}
              >
                {t("splitSaveSplit")}
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {fixed ? (
          <Text style={{ color: p.ink2, fontSize: fs(13.5) }}>
            {expense!.merchant || expense!.category} · {expense!.expense_date}
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[
                  ...input,
                  { flex: 1, fontSize: fs(18), fontWeight: "700" },
                ]}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="numeric"
                placeholder="₹ 0"
                placeholderTextColor={p.muted}
                accessibilityLabel={t("splitAmount")}
              />
              <TextInput
                style={[...input, { flex: 1.4, fontSize: fs(15) }]}
                value={what}
                onChangeText={setWhat}
                placeholder={t("splitWhat")}
                placeholderTextColor={p.muted}
              />
            </View>
            <View style={styles.wrap}>
              {categories
                .filter(pickable)
                .slice(0, 10)
                .map((c) => (
                  <Pressable
                    key={c.name}
                    onPress={() => setCategory(c.name)}
                    style={chip(category === c.name)}
                  >
                    <Text style={chipText(category === c.name)}>{c.name}</Text>
                  </Pressable>
                ))}
            </View>
          </>
        )}

        <Section p={p} title={t("splitWith")}>
          <View style={styles.wrap}>
            {[ME, ...known.map((x) => x.id)].map((k) => (
              <Pressable
                key={k}
                onPress={() => toggle(k)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.includes(k) }}
                style={chip(selected.includes(k))}
              >
                <Text style={chipText(selected.includes(k))}>
                  {selected.includes(k) ? "✓ " : ""}
                  {nameOf(k)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[...input, { flex: 1, fontSize: fs(14) }]}
              value={newName}
              onChangeText={setNewName}
              placeholder={t("splitAddPerson")}
              placeholderTextColor={p.muted}
              onSubmitEditing={add}
              returnKeyType="done"
            />
            <Pressable
              onPress={add}
              style={[styles.addBtn, { borderColor: p.accent }]}
              accessibilityRole="button"
            >
              <Text
                style={{ color: p.accent, fontWeight: "700", fontSize: fs(13) }}
              >
                {t("add")}
              </Text>
            </Pressable>
          </View>
          {selected.includes(ME) ? null : (
            <Text style={{ color: p.muted, fontSize: fs(12) }}>
              {t("splitNotMe")}
            </Text>
          )}
        </Section>

        {!fixed && (
          <Section p={p} title={t("splitPaidBy")}>
            <View style={styles.wrap}>
              {[ME, ...selected.filter((k) => k !== ME)].map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setPaidBy(k)}
                  style={chip(paidBy === k)}
                  accessibilityRole="radio"
                >
                  <Text style={chipText(paidBy === k)}>{nameOf(k)}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        <Section p={p} title={t("splitHow")}>
          <View
            style={[
              styles.seg,
              { borderColor: p.border, backgroundColor: p.page },
            ]}
          >
            {(["equal", "exact", "shares"] as Method[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[
                  styles.segBtn,
                  method === m && { backgroundColor: p.accent },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: method === m }}
              >
                <Text
                  style={{
                    color: method === m ? p.onAccent : p.ink2,
                    fontWeight: "600",
                    fontSize: fs(13),
                  }}
                >
                  {m === "equal"
                    ? t("splitEqual")
                    : m === "exact"
                      ? t("splitAmounts")
                      : t("splitShares")}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 10 }}>
            {ordered.map((k) => (
              <View key={k} style={styles.row}>
                <Text
                  style={{ flex: 1, color: p.ink, fontSize: fs(14.5) }}
                  numberOfLines={1}
                >
                  {nameOf(k)}
                  {k === paidBy && !fixed ? ` · ${t("splitPaid")}` : ""}
                </Text>
                {method !== "equal" && (
                  <TextInput
                    style={[...input, styles.small, { fontSize: fs(14) }]}
                    value={values[k] ?? ""}
                    onChangeText={(v) => setValues((s) => ({ ...s, [k]: v }))}
                    keyboardType="numeric"
                    placeholder={method === "shares" ? "1" : "₹"}
                    placeholderTextColor={p.muted}
                    accessibilityLabel={`${nameOf(k)} ${method === "shares" ? t("splitShares") : t("splitAmounts")}`}
                  />
                )}
                <Text
                  style={{
                    minWidth: 76,
                    textAlign: "right",
                    color: p.ink,
                    fontWeight: "700",
                    fontSize: fs(14.5),
                  }}
                >
                  {preview.shares
                    ? formatINR((preview.shares.get(k) ?? 0) / 100)
                    : "–"}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {preview.shares && (
          <Text
            style={{ color: p.ink2, fontSize: fs(12.5), lineHeight: fs(18) }}
          >
            {fixed || paidBy === ME
              ? `${t("splitYourShare")} ${formatINR((preview.shares.get(ME) ?? 0) / 100)}. ${t("splitRestLent")}`
              : `${t("splitYourShare")} ${formatINR((preview.shares.get(ME) ?? 0) / 100)}. ${t("splitYouOwe")} ${nameOf(paidBy)}.`}
          </Text>
        )}
      </View>
    </Sheet>
  );
}

function Section({
  p,
  title,
  children,
}: {
  p: Palette;
  title: string;
  children: React.ReactNode;
}) {
  const { fs } = useSettings();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(14) }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  small: { width: 84, textAlign: "right", paddingVertical: 8 },
  addBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  seg: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 3 },
  segBtn: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  save: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
});
