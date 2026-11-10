import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "./Text";
import { Card, CardHeader, Icon } from "./ui";
import { Sheet } from "./cards/parts";
import { parseAmount } from "../lib/amount";
import { useSettings } from "../lib/i18n";
import {
  balancesWithMe,
  ME,
  upiLink,
  UPI_ID,
  type SplitLike,
} from "../lib/split-math";
import {
  deleteSplit,
  dismissRepayment,
  payPageLink,
  Person,
  recordPayment,
  removePerson,
  RepaymentPrompt,
  setMyUpiId,
  SplitRecord,
  SplitsSummary,
  updatePerson,
} from "../lib/splits-api";
import { formatINR, Palette } from "../lib/theme";

const r = (paise: number) => formatINR(Math.abs(paise) / 100);
/** UPI's usual per-payment limit, in paise. */
const UPI_LIMIT = 1_00_000_00;
const toLike = (s: SplitRecord): SplitLike => ({
  kind: s.kind,
  total: s.total,
  members: s.members.map((m) => ({
    key: m.person_id ?? ME,
    paid: m.paid,
    owed: m.owed,
  })),
});

/**
 * Activity tab: who owes whom, at a glance. Tap a person to settle up.
 * Empty state is one quiet button, so it costs nothing until it's used.
 */
export function SplitsCard({
  p,
  token,
  summary,
  myName,
  onSplitNew,
  onChanged,
}: {
  p: Palette;
  token: string;
  summary: SplitsSummary | null;
  myName: string;
  onSplitNew: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [open, setOpen] = useState<Person | null>(null);
  const [all, setAll] = useState(false);
  if (!summary) return null;
  const withMoney = summary.people.filter((x) => x.balance !== 0);

  if (!summary.people.length && !summary.recent.length)
    return (
      <Pressable
        onPress={onSplitNew}
        accessibilityRole="button"
        style={[
          styles.quiet,
          { borderColor: p.border, backgroundColor: p.surface },
        ]}
      >
        <Icon name="users" size={18} color={p.accent} />
        <Text
          style={{ flex: 1, color: p.ink, fontSize: fs(14), fontWeight: "600" }}
        >
          {t("splitABill")}
        </Text>
        <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
          {t("splitQuietHint")}
        </Text>
      </Pressable>
    );

  const shown = all ? summary.people : withMoney.slice(0, 4);
  return (
    <Card p={p}>
      <CardHeader
        p={p}
        title={t("splitsTitle")}
        action={t("splitABill")}
        onAction={onSplitNew}
      />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Total
            p={p}
            label={t("splitOwedToYou")}
            value={summary.owedToMe}
            good
          />
          <Total p={p} label={t("splitYouOweTotal")} value={summary.iOwe} />
        </View>
        {shown.length === 0 ? (
          <Text style={{ color: p.ink2, fontSize: fs(13.5) }}>
            {t("splitAllSquare")}
          </Text>
        ) : (
          shown.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => setOpen(person)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`${person.name}, ${balanceWords(person.balance, t)}`}
            >
              <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                <Text
                  style={{
                    color: p.accent,
                    fontWeight: "800",
                    fontSize: fs(14),
                  }}
                >
                  {person.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  color: p.ink,
                  fontSize: fs(15),
                  fontWeight: "600",
                }}
                numberOfLines={1}
              >
                {person.name}
              </Text>
              <Text
                style={{
                  color:
                    person.balance > 0
                      ? p.accent
                      : person.balance < 0
                        ? p.warn
                        : p.muted,
                  fontSize: fs(13.5),
                  fontWeight: "700",
                }}
              >
                {balanceWords(person.balance, t)}
              </Text>
            </Pressable>
          ))
        )}
        {(summary.people.length > shown.length || all) && (
          <Pressable onPress={() => setAll(!all)} hitSlop={8}>
            <Text
              style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}
            >
              {all
                ? t("splitShowLess")
                : `${t("splitShowAll")} (${summary.people.length})`}
            </Text>
          </Pressable>
        )}
      </View>
      {open && (
        <PersonSheet
          p={p}
          token={token}
          person={summary.people.find((x) => x.id === open.id) ?? open}
          history={summary.recent.filter((s) =>
            s.members.some((m) => m.person_id === open.id),
          )}
          myUpiId={summary.myUpiId}
          myName={myName}
          onClose={() => setOpen(null)}
          onChanged={onChanged}
        />
      )}
    </Card>
  );
}

function balanceWords(b: number, t: (k: any) => string) {
  if (b > 0) return `${t("splitOwesYou")} ${r(b)}`;
  if (b < 0) return `${t("splitYouOwe")} ${r(b)}`;
  return t("splitSquare");
}

function Total({
  p,
  label,
  value,
  good,
}: {
  p: Palette;
  label: string;
  value: number;
  good?: boolean;
}) {
  const { fs } = useSettings();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: p.muted, fontSize: fs(12) }}>{label}</Text>
      <Text
        style={{
          color: value ? (good ? p.accent : p.warn) : p.ink,
          fontSize: fs(18),
          fontWeight: "800",
        }}
      >
        {r(value)}
      </Text>
    </View>
  );
}

/** One person: settle up, ask to be paid, history, edit. */
function PersonSheet({
  p,
  token,
  person,
  history,
  myUpiId,
  myName,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  person: Person;
  history: SplitRecord[];
  myUpiId: string | null;
  myName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "record" | "myupi" | "edit">(null);
  const [amount, setAmount] = useState(
    String(Math.abs(person.balance) / 100 || ""),
  );
  const [upi, setUpi] = useState(myUpiId ?? "");
  const [theirUpi, setTheirUpi] = useState(person.upi_id ?? "");
  const [name, setName] = useState(person.name);
  const owesMe = person.balance > 0;
  const iOwe = person.balance < 0;

  const run = async (
    work: () => Promise<{ ok: boolean; error?: string }>,
    after?: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await work();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("saveFailed"));
    onChanged();
    after?.();
  };

  const askToPay = async (vpa: string) => {
    // UPI caps a payment at ₹1 lakh: ask for that much now, the rest after.
    const now = Math.min(person.balance, UPI_LIMIT);
    const link = payPageLink({
      upiId: vpa,
      name: myName,
      amount: now,
      note: t("splitPayNote"),
    });
    const part =
      now < person.balance ? ` ${t("splitFirstPart")} ${r(now)}.` : "";
    await Share.share({
      message: `${t("splitHi")} ${person.name}, ${t("splitShareMsg")} ${r(person.balance)}.${part} ${link}\n${t("splitUpiIdIs")} ${vpa}`,
    }).catch(() => {});
  };

  const payThem = () => {
    if (!person.upi_id) return setMode("edit");
    Linking.openURL(
      upiLink({
        upiId: person.upi_id,
        name: person.name,
        amount: Math.min(-person.balance, UPI_LIMIT),
        note: t("splitPayNote"),
      }),
    ).catch(() => setError(t("splitNoUpiApp")));
  };

  const input = [
    styles.input,
    { borderColor: p.grid, backgroundColor: p.page, color: p.ink },
  ];
  const btn = (primary: boolean) => [
    styles.btn,
    primary
      ? { backgroundColor: p.accent }
      : { borderWidth: 1, borderColor: p.border },
  ];
  const btnText = (primary: boolean) => ({
    color: primary ? p.onAccent : p.ink,
    fontWeight: "700" as const,
    fontSize: fs(14),
  });

  return (
    <Sheet visible onClose={onClose} p={p} title={person.name}>
      <View style={{ gap: 14, paddingBottom: 8 }}>
        <Text
          style={{
            fontSize: fs(22),
            fontWeight: "800",
            color: owesMe ? p.accent : iOwe ? p.warn : p.ink,
          }}
        >
          {balanceWords(person.balance, t)}
        </Text>

        {owesMe && mode === null && (
          <View style={{ gap: 8 }}>
            <Pressable
              style={btn(true)}
              accessibilityRole="button"
              onPress={() => (myUpiId ? askToPay(myUpiId) : setMode("myupi"))}
            >
              <Text style={btnText(true)}>{t("splitAskBack")}</Text>
            </Pressable>
            <Pressable
              style={btn(false)}
              accessibilityRole="button"
              onPress={() => setMode("record")}
            >
              <Text style={btnText(false)}>{t("splitTheyPaid")}</Text>
            </Pressable>
          </View>
        )}
        {iOwe && mode === null && (
          <View style={{ gap: 8 }}>
            <Pressable
              style={btn(true)}
              accessibilityRole="button"
              onPress={payThem}
            >
              <Text style={btnText(true)}>
                {t("splitPayThem")} {r(person.balance)}
              </Text>
            </Pressable>
            <Pressable
              style={btn(false)}
              accessibilityRole="button"
              onPress={() => setMode("record")}
            >
              <Text style={btnText(false)}>{t("splitIPaid")}</Text>
            </Pressable>
          </View>
        )}

        {mode === "myupi" && (
          <View style={{ gap: 8 }}>
            <Text
              style={{ color: p.ink2, fontSize: fs(13), lineHeight: fs(19) }}
            >
              {t("splitMyUpiHint")}
            </Text>
            <TextInput
              style={[...input, { fontSize: fs(15) }]}
              value={upi}
              onChangeText={setUpi}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="yourname@okhdfcbank"
              placeholderTextColor={p.muted}
            />
            <Pressable
              style={btn(true)}
              accessibilityRole="button"
              onPress={() => {
                const v = upi.trim();
                if (!UPI_ID.test(v)) return setError(t("splitBadUpi"));
                run(
                  () => setMyUpiId(token, v),
                  () => {
                    setMode(null);
                    askToPay(v);
                  },
                );
              }}
            >
              <Text style={btnText(true)}>{t("splitSaveAndShare")}</Text>
            </Pressable>
          </View>
        )}

        {mode === "record" && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: p.ink2, fontSize: fs(13) }}>
              {owesMe ? t("splitHowMuchTheyPaid") : t("splitHowMuchYouPaid")}
            </Text>
            <TextInput
              style={[...input, { fontSize: fs(18), fontWeight: "700" }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <Pressable
              style={btn(true)}
              accessibilityRole="button"
              onPress={() => {
                const a = parseAmount(amount);
                if (!a || a <= 0) return setError(t("splitNeedAmount"));
                run(
                  () =>
                    recordPayment(token, {
                      personId: person.id,
                      direction: owesMe ? "they_paid" : "i_paid",
                      amount: a,
                    }),
                  () => setMode(null),
                );
              }}
            >
              <Text style={btnText(true)}>{t("splitRecord")}</Text>
            </Pressable>
          </View>
        )}

        {mode === "edit" && (
          <View style={{ gap: 8 }}>
            <TextInput
              style={[...input, { fontSize: fs(15) }]}
              value={name}
              onChangeText={setName}
              placeholder={t("splitName")}
              placeholderTextColor={p.muted}
            />
            <TextInput
              style={[...input, { fontSize: fs(15) }]}
              value={theirUpi}
              onChangeText={setTheirUpi}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("splitTheirUpi")}
              placeholderTextColor={p.muted}
            />
            <Pressable
              style={btn(true)}
              accessibilityRole="button"
              onPress={() => {
                const v = theirUpi.trim();
                if (v && !UPI_ID.test(v)) return setError(t("splitBadUpi"));
                run(
                  () =>
                    updatePerson(token, person.id, {
                      name: name.trim(),
                      upi_id: v || null,
                    }),
                  () => setMode(null),
                );
              }}
            >
              <Text style={btnText(true)}>{t("splitSavePerson")}</Text>
            </Pressable>
          </View>
        )}

        {busy && <ActivityIndicator />}
        {error && (
          <Text style={{ color: p.warn, fontSize: fs(13) }}>{error}</Text>
        )}

        {history.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(14) }}>
              {t("splitHistory")}
            </Text>
            {history.map((s) => {
              const effect = balancesWithMe([toLike(s)]).get(person.id) ?? 0;
              return (
                <View key={s.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: p.ink, fontSize: fs(14) }}
                      numberOfLines={1}
                    >
                      {s.description ||
                        s.category ||
                        (s.kind === "payment"
                          ? t("splitPayment")
                          : t("splitsTitle"))}
                    </Text>
                    <Text style={{ color: p.muted, fontSize: fs(12) }}>
                      {s.split_date} · {formatINR(s.total / 100)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color:
                        effect > 0 ? p.accent : effect < 0 ? p.warn : p.muted,
                      fontWeight: "700",
                      fontSize: fs(13),
                    }}
                  >
                    {effect > 0 ? "+" : effect < 0 ? "−" : ""}
                    {r(effect)}
                  </Text>
                  <Pressable
                    onPress={() => run(() => deleteSplit(token, s.id))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("splitUndo")}
                  >
                    <Icon name="x" size={16} color={p.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 18 }}>
          <Pressable
            onPress={() => setMode(mode === "edit" ? null : "edit")}
            hitSlop={8}
          >
            <Text
              style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}
            >
              {t("splitEditPerson")}
            </Text>
          </Pressable>
          {person.balance === 0 && (
            <Pressable
              onPress={() => run(() => removePerson(token, person.id), onClose)}
              hitSlop={8}
            >
              <Text
                style={{ color: p.warn, fontSize: fs(13), fontWeight: "600" }}
              >
                {t("splitRemovePerson")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Today: "₹750 from RAHUL K SHARMA — Rahul paying you back?" Yes records the
 * repayment (and learns the name); No keeps it as income and stops asking.
 */
export function RepaymentCard({
  p,
  token,
  prompt,
  onChanged,
}: {
  p: Palette;
  token: string;
  prompt: RepaymentPrompt | undefined;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!prompt) return null;

  const answer = async (yes: boolean) => {
    if (busy) return;
    setBusy(yes ? "yes" : "no");
    setError(null);
    const res = yes
      ? await recordPayment(token, {
          personId: prompt.personId,
          direction: "they_paid",
          incomeId: prompt.incomeId,
        })
      : await dismissRepayment(token, prompt.incomeId);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    onChanged();
  };

  return (
    <Card p={p}>
      <View style={{ gap: 12 }}>
        <View style={styles.row}>
          <Icon name="users" size={18} color={p.accent} />
          <Text
            style={{
              flex: 1,
              color: p.ink,
              fontSize: fs(15),
              fontWeight: "700",
            }}
          >
            {r(prompt.amount)}
            {prompt.bankName
              ? ` ${t("splitFrom")} ${prompt.bankName}`
              : ""} — {prompt.personName} {t("splitPayingBack")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => answer(true)}
            style={[styles.btn, { flex: 1, backgroundColor: p.accent }]}
            accessibilityRole="button"
          >
            {busy === "yes" ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text
                style={{
                  color: p.onAccent,
                  fontWeight: "700",
                  fontSize: fs(14),
                }}
              >
                {t("confirmYes")} {prompt.personName}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => answer(false)}
            style={[
              styles.btn,
              { flex: 1, borderWidth: 1, borderColor: p.border },
            ]}
            accessibilityRole="button"
          >
            {busy === "no" ? (
              <ActivityIndicator color={p.ink} />
            ) : (
              <Text
                style={{ color: p.ink, fontWeight: "600", fontSize: fs(14) }}
              >
                {t("splitNotRepayment")}
              </Text>
            )}
          </Pressable>
        </View>
        {error && (
          <Text style={{ color: p.warn, fontSize: fs(12.5) }}>{error}</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  quiet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
});
