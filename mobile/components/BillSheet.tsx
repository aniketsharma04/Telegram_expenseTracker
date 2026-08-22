import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Biller,
  BillInput,
  BillKind,
  BillStatus,
  FetchedBill,
  deleteBill,
  previewFetch,
  saveBill,
  searchBillers,
} from "../lib/api";
import { StringKey, useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";

/**
 * Add / edit a bill. Two modes:
 *  - Auto-fetch: search a Bharat Connect biller → enter your identifiers
 *    (consumer/card number) → the amount + due date come from the biller.
 *  - Manual: the classic form (name, due day, usual amount, UPI id).
 */

const KIND_ICON: Record<BillKind, string> = {
  electricity: "⚡",
  water: "💧",
  gas: "🔥",
  credit_card: "💳",
  rent: "🏠",
  internet: "🌐",
  mobile: "📱",
  insurance: "🛡️",
  other: "🧾",
};
const KINDS = Object.keys(KIND_ICON) as BillKind[];
const KIND_CATEGORY: Record<BillKind, string> = {
  electricity: "Utilities & bills",
  water: "Utilities & bills",
  gas: "Utilities & bills",
  credit_card: "Loans & EMI",
  rent: "Utilities & bills",
  internet: "Utilities & bills",
  mobile: "Utilities & bills",
  insurance: "Utilities & bills",
  other: "Utilities & bills",
};

/** Map a BBPS category label to our bill kind. */
function kindForCategory(category: string): BillKind {
  const c = category.toLowerCase();
  if (c.includes("electric")) return "electricity";
  if (c.includes("water")) return "water";
  if (c.includes("gas") || c.includes("lpg")) return "gas";
  if (c.includes("credit")) return "credit_card";
  if (c.includes("broadband") || c.includes("landline") || c.includes("fiber"))
    return "internet";
  if (c.includes("mobile") || c.includes("dth") || c.includes("cable"))
    return "mobile";
  if (c.includes("insurance")) return "insurance";
  if (c.includes("loan") || c.includes("emi")) return "credit_card";
  if (c.includes("rent") || c.includes("housing")) return "rent";
  return "other";
}

type Mode = "auto" | "manual";

export default function BillSheet({
  p,
  token,
  categories,
  bill,
  prefill,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  categories: Array<{ name: string; color: string | null }>;
  bill?: BillStatus;
  prefill?: Partial<BillInput>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const editingLinked = Boolean(bill?.linked && bill.biller_id);
  const [mode, setMode] = useState<Mode>(
    bill ? (editingLinked ? "auto" : "manual") : "auto",
  );

  // shared fields
  const src = bill ?? prefill;
  const [name, setName] = useState(src?.name ?? "");
  const [kind, setKind] = useState<BillKind>(src?.kind ?? "electricity");
  const [category, setCategory] = useState(
    src?.category ?? KIND_CATEGORY[src?.kind ?? "electricity"],
  );
  const [categoryTouched, setCategoryTouched] = useState(!!src?.category);
  const [upi, setUpi] = useState(src?.upi_id ?? "");
  const [payee, setPayee] = useState(src?.payee_name ?? "");
  // manual-only
  const [dueDay, setDueDay] = useState(src?.due_day ? String(src.due_day) : "");
  const [amount, setAmount] = useState(src?.amount ? String(src.amount) : "");
  const [consumer, setConsumer] = useState(src?.consumer_number ?? "");
  // auto-only
  const [query, setQuery] = useState("");
  const [bbpsCategory, setBbpsCategory] = useState<string | null>(null);
  const [bbpsCategories, setBbpsCategories] = useState<string[]>([]);
  const [results, setResults] = useState<Biller[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [biller, setBiller] = useState<Biller | null>(null);
  const [params, setParams] = useState<Record<string, string>>(
    bill?.fetch_params ?? {},
  );
  const [fetching, setFetching] = useState(false);
  const [preview, setPreview] = useState<FetchedBill | null>(null);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!categoryTouched) setCategory(KIND_CATEGORY[kind]);
  }, [kind, categoryTouched]);

  // Editing a linked bill: rebuild the biller from the saved record so identifiers show.
  useEffect(() => {
    if (editingLinked && bill?.biller_id && !biller) {
      setBiller({
        id: bill.biller_id,
        name: bill.biller_name ?? bill.name,
        category: "",
        params: Object.keys(bill.fetch_params ?? {}).map((n) => ({
          name: n,
          dataType: "ALPHANUMERIC",
          optional: false,
        })),
      });
    }
  }, [editingLinked, bill, biller]);

  // Debounced biller search.
  useEffect(() => {
    if (mode !== "auto" || biller) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      async () => {
        setSearching(true);
        const r = await searchBillers(token, query, bbpsCategory).catch(
          () => null,
        );
        setSearching(false);
        if (r) {
          setResults(r.billers);
          setBbpsCategories(r.categories);
          setProvider(r.provider);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [mode, query, bbpsCategory, biller, token]);

  const pickBiller = (b: Biller) => {
    setBiller(b);
    setParams({});
    setPreview(null);
    setPreviewMsg(null);
    setError(null);
    if (!name) setName(b.name);
    const k = kindForCategory(b.category);
    setKind(k);
    if (!categoryTouched) setCategory(KIND_CATEGORY[k]);
  };

  const paramsReady =
    !!biller &&
    biller.params.every(
      (pr) => pr.optional || (params[pr.name] ?? "").trim().length > 0,
    );

  const doFetch = async () => {
    if (!biller || !paramsReady || fetching) return;
    setFetching(true);
    setPreview(null);
    setPreviewMsg(null);
    setError(null);
    const r = await previewFetch(token, biller.id, params).catch(() => null);
    setFetching(false);
    if (!r) setError(`${t("fetchFailed")} — check your connection.`);
    else if (r.ok) setPreview(r.bill);
    else if (r.code === "no_dues") setPreviewMsg(t("noDues"));
    else setError(r.error);
  };

  // ── Save ──
  const parsedDay = parseInt(dueDay, 10);
  const parsedAmt = amount.trim() ? parseFloat(amount.replace(/,/g, "")) : null;
  const manualReady =
    name.trim().length > 0 &&
    Number.isInteger(parsedDay) &&
    parsedDay >= 1 &&
    parsedDay <= 31 &&
    (parsedAmt === null || (Number.isFinite(parsedAmt) && parsedAmt > 0));
  const autoReady =
    !!biller &&
    paramsReady &&
    (preview !== null || previewMsg !== null || editingLinked);
  const ready = mode === "auto" ? autoReady : manualReady;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const base = {
      name: name.trim() || biller?.name || "",
      kind,
      category,
      upi_id: upi.trim() || null,
      payee_name: payee.trim() || null,
    };
    const input: BillInput =
      mode === "auto"
        ? {
            ...base,
            due_day: preview?.dueDate
              ? Number(preview.dueDate.slice(8))
              : (bill?.due_day ?? 1),
            amount: preview?.amount ?? null,
            consumer_number: Object.values(params)[0] ?? null,
            biller_id: biller!.id,
            fetch_params: params,
          }
        : {
            ...base,
            due_day: parsedDay,
            amount: parsedAmt,
            consumer_number: consumer.trim() || null,
            biller_id: null,
            fetch_params: null,
          };
    const result = await saveBill(token, input, bill?.id).catch(() => null);
    setBusy(false);
    if (result === "unauthorized")
      setError("Session expired — get a fresh /app code from the bot.");
    else if (!result)
      setError("Couldn't save — check the fields and try again.");
    else {
      onChanged();
      onClose();
    }
  };

  const remove = async () => {
    if (!bill || busy) return;
    setBusy(true);
    const ok = await deleteBill(token, bill.id).catch(() => false);
    setBusy(false);
    if (ok) {
      onChanged();
      onClose();
    } else setError("Couldn't delete that bill.");
  };

  const inputStyle = [
    styles.input,
    {
      borderColor: p.grid,
      backgroundColor: p.page,
      color: p.ink,
      fontSize: fs(14),
    },
  ];
  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      borderColor: active ? p.accent : p.border,
      backgroundColor: active ? p.accentSoft : p.page,
    },
  ];
  const chipText = (active: boolean) => ({
    fontSize: fs(13),
    color: active ? p.ink : p.ink2,
    fontWeight: active ? ("600" as const) : ("400" as const),
  });
  const expenseChips = categories.filter((c) => c.name !== "Uncategorized");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropCol}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12 }}
          >
            <View style={styles.headRow}>
              <Text
                style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}
              >
                {bill ? t("editBill") : t("addBill")}
              </Text>
              {!bill && (
                <View
                  style={[
                    styles.seg,
                    { backgroundColor: p.page, borderColor: p.border },
                  ]}
                >
                  {(["auto", "manual"] as Mode[]).map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.segBtn,
                        mode === m && { backgroundColor: p.accent },
                      ]}
                      onPress={() => setMode(m)}
                    >
                      <Text
                        style={{
                          fontSize: fs(12.5),
                          fontWeight: mode === m ? "600" : "400",
                          color: mode === m ? "#fff" : p.ink2,
                        }}
                      >
                        {m === "auto"
                          ? `🔎 ${t("autoFetch")}`
                          : `✍️ ${t("manual")}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {mode === "auto" && !biller && (
              <>
                <TextInput
                  style={inputStyle}
                  placeholder={t("searchBiller")}
                  placeholderTextColor={p.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  autoCorrect={false}
                />
                {bbpsCategories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    <Pressable
                      style={chipStyle(bbpsCategory === null)}
                      onPress={() => setBbpsCategory(null)}
                    >
                      <Text style={chipText(bbpsCategory === null)}>
                        {t("allCategories")}
                      </Text>
                    </Pressable>
                    {bbpsCategories.map((c) => (
                      <Pressable
                        key={c}
                        style={chipStyle(bbpsCategory === c)}
                        onPress={() => setBbpsCategory(c)}
                      >
                        <Text style={chipText(bbpsCategory === c)}>{c}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                {provider === "mock" && (
                  <Text
                    style={{
                      fontSize: fs(11.5),
                      color: p.muted,
                      lineHeight: 16,
                    }}
                  >
                    ℹ️ {t("mockNote")}
                  </Text>
                )}
                {searching && <ActivityIndicator color={p.accent} />}
                {!searching && results.length === 0 && (
                  <Text style={{ fontSize: fs(13), color: p.ink2 }}>
                    {t("noBillers")}
                  </Text>
                )}
                <View style={{ gap: 6 }}>
                  {results.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => pickBiller(b)}
                      style={[
                        styles.resultRow,
                        { borderColor: p.border, backgroundColor: p.page },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>
                        {KIND_ICON[kindForCategory(b.category)]}
                      </Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: fs(14),
                            fontWeight: "500",
                            color: p.ink,
                          }}
                          numberOfLines={1}
                        >
                          {b.name}
                        </Text>
                        <Text style={{ fontSize: fs(12), color: p.muted }}>
                          {b.category}
                        </Text>
                      </View>
                      <Text style={{ color: p.accent, fontSize: fs(16) }}>
                        ›
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {mode === "auto" && biller && (
              <>
                <View
                  style={[
                    styles.billerCard,
                    { borderColor: p.accent, backgroundColor: p.accentSoft },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{KIND_ICON[kind]}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: fs(14),
                        fontWeight: "600",
                        color: p.ink,
                      }}
                      numberOfLines={1}
                    >
                      {biller.name}
                    </Text>
                    {!!biller.category && (
                      <Text style={{ fontSize: fs(12), color: p.ink2 }}>
                        {biller.category}
                      </Text>
                    )}
                  </View>
                  {!editingLinked && (
                    <Pressable
                      onPress={() => {
                        setBiller(null);
                        setPreview(null);
                        setPreviewMsg(null);
                      }}
                    >
                      <Text
                        style={{
                          color: p.accent,
                          fontSize: fs(13),
                          fontWeight: "600",
                        }}
                      >
                        {t("changeBiller")}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <Text
                  style={{
                    fontSize: fs(12.5),
                    color: p.muted,
                    fontWeight: "600",
                  }}
                >
                  {t("identifiers")}
                </Text>
                {biller.params.map((pr) => (
                  <TextInput
                    key={pr.name}
                    style={inputStyle}
                    placeholder={pr.name + (pr.optional ? " (optional)" : "")}
                    placeholderTextColor={p.muted}
                    value={params[pr.name] ?? ""}
                    onChangeText={(v) => {
                      setParams({ ...params, [pr.name]: v });
                      setPreview(null);
                      setPreviewMsg(null);
                    }}
                    keyboardType={
                      pr.dataType === "NUMERIC" ? "number-pad" : "default"
                    }
                    maxLength={pr.maxLength ?? 64}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                ))}

                {!preview && !previewMsg && (
                  <Pressable
                    style={[
                      styles.btn,
                      {
                        backgroundColor: p.accent,
                        opacity: paramsReady && !fetching ? 1 : 0.5,
                      },
                    ]}
                    onPress={doFetch}
                    disabled={!paramsReady || fetching}
                  >
                    {fetching ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <ActivityIndicator color="#fff" />
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "600",
                            fontSize: fs(14),
                          }}
                        >
                          {t("fetching")}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: fs(15),
                        }}
                      >
                        🔎 {t("fetchBill")}
                      </Text>
                    )}
                  </Pressable>
                )}

                {preview && (
                  <View style={[styles.previewCard, { borderColor: p.good }]}>
                    <Text
                      style={{
                        fontSize: fs(12.5),
                        color: p.good,
                        fontWeight: "700",
                      }}
                    >
                      ✅ {t("fetchedBill")}
                    </Text>
                    <Text
                      style={{
                        fontSize: fs(26),
                        fontWeight: "800",
                        color: p.ink,
                      }}
                    >
                      {formatINR(preview.amount)}
                    </Text>
                    <Text style={{ fontSize: fs(13), color: p.ink2 }}>
                      {preview.customerName ? `${preview.customerName} · ` : ""}
                      {preview.dueDate
                        ? `${t("dueOn")} ${preview.dueDate}`
                        : ""}
                      {preview.billNumber ? ` · #${preview.billNumber}` : ""}
                    </Text>
                  </View>
                )}
                {previewMsg && (
                  <View style={[styles.previewCard, { borderColor: p.border }]}>
                    <Text style={{ fontSize: fs(14), color: p.ink2 }}>
                      ✅ {previewMsg}
                    </Text>
                  </View>
                )}

                {(preview || previewMsg || editingLinked) && (
                  <TextInput
                    style={inputStyle}
                    placeholder={t("billName")}
                    placeholderTextColor={p.muted}
                    value={name}
                    onChangeText={setName}
                  />
                )}
              </>
            )}

            {mode === "manual" && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {KINDS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      style={chipStyle(kind === k)}
                    >
                      <Text style={chipText(kind === k)}>
                        {KIND_ICON[k]} {t(`kind_${k}` as StringKey)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  style={inputStyle}
                  placeholder={t("billName")}
                  placeholderTextColor={p.muted}
                  value={name}
                  onChangeText={setName}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[...inputStyle, { flex: 1 }]}
                    placeholder={t("dueDay")}
                    placeholderTextColor={p.muted}
                    value={dueDay}
                    onChangeText={setDueDay}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TextInput
                    style={[...inputStyle, { flex: 1.4 }]}
                    placeholder={t("usualAmount")}
                    placeholderTextColor={p.muted}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                </View>
                <TextInput
                  style={inputStyle}
                  placeholder={t("consumerNo")}
                  placeholderTextColor={p.muted}
                  value={consumer}
                  onChangeText={setConsumer}
                />
              </>
            )}

            {(mode === "manual" || preview || previewMsg || editingLinked) && (
              <>
                <TextInput
                  style={inputStyle}
                  placeholder={t("upiId")}
                  placeholderTextColor={p.muted}
                  value={upi}
                  onChangeText={setUpi}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!upi.trim() && (
                  <TextInput
                    style={inputStyle}
                    placeholder={t("payeeName")}
                    placeholderTextColor={p.muted}
                    value={payee}
                    onChangeText={setPayee}
                  />
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {expenseChips.map((c) => (
                    <Pressable
                      key={c.name}
                      onPress={() => {
                        setCategory(c.name);
                        setCategoryTouched(true);
                      }}
                      style={chipStyle(category === c.name)}
                    >
                      <Text style={chipText(category === c.name)}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {error && (
              <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>
            )}

            {(mode === "manual" || preview || previewMsg || editingLinked) && (
              <View style={styles.row}>
                {bill && (
                  <Pressable
                    style={styles.btnDanger}
                    onPress={remove}
                    disabled={busy}
                  >
                    <Text
                      style={{
                        color: "#d03b3b",
                        fontWeight: "600",
                        fontSize: fs(14),
                      }}
                    >
                      🗑️ {t("delete")}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.btn,
                    {
                      backgroundColor: p.accent,
                      flex: 1,
                      opacity: ready && !busy ? 1 : 0.5,
                    },
                  ]}
                  onPress={save}
                  disabled={!ready || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: fs(15),
                      }}
                    >
                      {t("saveBill")}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropCol: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  seg: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segBtn: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  billerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  previewCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 4 },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  btnDanger: { paddingVertical: 12, paddingHorizontal: 10 },
  error: { color: "#d03b3b", textAlign: "center" },
});
