import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../Text";
import { Card, Icon, IconName, PrimaryButton, PressableScale } from "../ui";
import { elevation, type Palette } from "../../lib/theme";
import { useSettings } from "../../lib/i18n";
import {
  cardAction,
  fetchCards,
  type CardAction,
  type CardsData,
  type CardSuggestion,
  type HeldCardView,
  type MissedLine,
  type NextCardView,
  type ScoreBand,
} from "../../lib/cards-api";
import { useCardsT, type CardsKey } from "./strings";
import {
  CardArt,
  ChanceChip,
  Chip,
  OutlineButton,
  Row,
  Sheet,
  cardsAccent,
  money,
  shortDate,
  yearly,
} from "./parts";

/**
 * Aaj Cards — an app inside the app. Opens full screen over Aaj with its own
 * header (✕ always returns to where you were), three tabs and its own
 * screens. Facts first: what your cards earned and missed; new cards third,
 * ranked only by what they add for you, and never while your messages show
 * debt stress.
 */

type Tab = "wallet" | "missed" | "explore";
type Screen =
  | { kind: "card"; id: string }
  | { kind: "offer"; key: string }
  | { kind: "line"; index: number }
  | { kind: "calc" }
  | { kind: "privacy" };

type Matcher =
  | { mode: "confirm"; queue: CardSuggestion[]; index: number }
  | { mode: "set"; card: HeldCardView }
  | { mode: "add" };

const INTRO_KEY = "aaj.cards.intro.v1";

export default function CardsApp({
  visible,
  onClose,
  p,
  dark,
  token,
  onTurnOff,
}: {
  visible: boolean;
  onClose: () => void;
  p: Palette;
  dark: boolean;
  token: string;
  /** Hide Aaj Cards from Today (Settings turns it back on). */
  onTurnOff?: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const insets = useSafeAreaInsets();
  const c = cardsAccent(dark);

  const [data, setData] = useState<CardsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("wallet");
  const [stack, setStack] = useState<Screen[]>([]);
  const [matcher, setMatcher] = useState<Matcher | null>(null);
  const [explain, setExplain] = useState<MissedLine | null>(null);
  const [leaving, setLeaving] = useState<{ url: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hiddenOffers, setHiddenOffers] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const d = await fetchCards(token);
    setLoading(false);
    if (d) setData(d);
    else setFailed(true);
  }, [token]);

  useEffect(() => {
    if (!visible) {
      setStack([]);
      return;
    }
    void load();
    AsyncStorage.getItem(INTRO_KEY).then((v) => setIntro(!v));
  }, [visible, load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const act = useCallback(
    async (a: CardAction, okText?: string) => {
      const r = await cardAction(token, a);
      if (r.ok) {
        setData(r.data);
        if (okText) setToast(okText);
        return true;
      }
      setToast(r.error ?? t("somethingWrong"));
      return false;
    },
    [token, t],
  );

  const dismissIntro = () => {
    setIntro(false);
    void AsyncStorage.setItem(INTRO_KEY, "1");
  };

  // Back: close a sheet, then pop a screen, then leave Cards.
  const back = () => {
    if (matcher) return setMatcher(null);
    if (explain) return setExplain(null);
    if (leaving) return setLeaving(null);
    if (profileOpen) return setProfileOpen(false);
    if (stack.length) return setStack((s) => s.slice(0, -1));
    onClose();
  };

  const top = stack[stack.length - 1];
  const cardById = (id: string) => data?.cards.find((x) => x.id === id) ?? null;
  const cardName = (id: string) => {
    const h = cardById(id);
    if (!h) return "";
    return `${h.product ? h.product.name : h.bank}${h.last4 ? ` ••${h.last4}` : ""}`;
  };

  const title = top
    ? top.kind === "card"
      ? cardName(top.id)
      : top.kind === "offer"
        ? (data?.next.find((n) => n.product.key === top.key)?.product.name ??
          "")
        : top.kind === "line"
          ? (data?.missed.lines[top.index]?.label ?? "")
          : top.kind === "privacy"
            ? t("privacyTitle")
            : t("calcTitle")
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={back}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: p.page }}>
        {/* Header frame — the same on every Cards screen. */}
        <View
          style={[
            s.header,
            {
              paddingTop: insets.top + 6,
              backgroundColor: p.page,
              borderBottomColor: p.border,
            },
          ]}
        >
          {top ? (
            <Pressable
              onPress={back}
              style={s.headBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("back")}
            >
              <Icon name="chevron-left" size={24} color={p.ink} />
            </Pressable>
          ) : (
            <View style={[s.logo, { backgroundColor: c.soft }]}>
              <Icon name="credit-card" size={16} color={c.accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {title ? (
              <Text
                numberOfLines={1}
                accessibilityRole="header"
                style={{ color: p.ink, fontSize: fs(17), fontWeight: "700" }}
              >
                {title}
              </Text>
            ) : (
              <Text
                accessibilityRole="header"
                style={{ fontSize: fs(19), fontWeight: "800", color: p.ink }}
              >
                {t("brand")}{" "}
                <Text
                  style={{
                    color: c.accent,
                    fontSize: fs(19),
                    fontWeight: "800",
                  }}
                >
                  {t("brandCards")}
                </Text>
              </Text>
            )}
          </View>
          {!top && (
            <Pressable
              onPress={() => setStack([{ kind: "calc" }])}
              style={s.headBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("howCalc")}
            >
              <Icon name="info" size={20} color={p.ink2} />
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            style={s.headBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Icon name="x" size={22} color={p.ink} />
          </Pressable>
        </View>

        {!data ? (
          <View style={s.center}>
            {failed ? (
              <>
                <Text
                  style={{
                    color: p.ink2,
                    fontSize: fs(15),
                    textAlign: "center",
                  }}
                >
                  {t("error")}
                </Text>
                <View style={{ height: 14 }} />
                <OutlineButton label={t("tryAgain")} onPress={load} p={p} />
              </>
            ) : (
              <>
                <ActivityIndicator color={c.accent} />
                <Text
                  style={{ color: p.muted, marginTop: 10, fontSize: fs(14) }}
                >
                  {t("loading")}
                </Text>
              </>
            )}
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{
                padding: 16,
                paddingBottom: 32,
                gap: 14,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={load}
                  tintColor={c.accent}
                  colors={[c.accent]}
                />
              }
            >
              {top?.kind === "card" ? (
                <CardDetail
                  card={cardById(top.id)}
                  data={data}
                  p={p}
                  accent={c}
                  onChange={(card) => setMatcher({ mode: "set", card })}
                  onRemove={async (id) => {
                    if (await act({ action: "hide", id }, t("saved")))
                      setStack([]);
                  }}
                />
              ) : top?.kind === "offer" ? (
                <OfferDetail
                  offer={
                    data.next.find((n) => n.product.key === top.key) ?? null
                  }
                  stressed={data.stress.length > 0}
                  p={p}
                  accent={c}
                  onGo={(url) => setLeaving({ url })}
                  onHide={(key) => {
                    setHiddenOffers((h) => [...h, key]);
                    setStack([]);
                  }}
                />
              ) : top?.kind === "line" ? (
                <LineScreen
                  line={data.missed.lines[top.index] ?? null}
                  data={data}
                  p={p}
                  accent={c}
                  cardName={cardName}
                  onExplain={setExplain}
                />
              ) : top?.kind === "calc" ? (
                <CalcScreen
                  p={p}
                  verified={data.catalogVerified}
                  accent={c}
                  onPrivacy={() =>
                    setStack((st) => [...st, { kind: "privacy" }])
                  }
                />
              ) : top?.kind === "privacy" ? (
                <PrivacyScreen
                  p={p}
                  accent={c}
                  onForget={async () => {
                    if (await act({ action: "forget" }, t("forgetDone")))
                      setStack([]);
                  }}
                  onTurnOff={onTurnOff}
                />
              ) : tab === "wallet" ? (
                <Wallet
                  data={data}
                  p={p}
                  accent={c}
                  onOpenCard={(id) => setStack([{ kind: "card", id }])}
                  onMatch={(sug) =>
                    setMatcher({ mode: "confirm", queue: sug, index: 0 })
                  }
                  onSet={(card) => setMatcher({ mode: "set", card })}
                  onAdd={() => setMatcher({ mode: "add" })}
                  onSeeMissed={() => setTab("missed")}
                  onPrivacy={() => setStack([{ kind: "privacy" }])}
                />
              ) : tab === "missed" ? (
                <Missed
                  data={data}
                  p={p}
                  accent={c}
                  cardName={cardName}
                  onOpenLine={(index) => setStack([{ kind: "line", index }])}
                  onGoWallet={() => setTab("wallet")}
                />
              ) : (
                <Explore
                  data={data}
                  hidden={hiddenOffers}
                  p={p}
                  accent={c}
                  onOpen={(key) => setStack([{ kind: "offer", key }])}
                  onProfile={() => setProfileOpen(true)}
                  onClearStress={() =>
                    act({ action: "clear_stress" }, t("stressCleared"))
                  }
                />
              )}
            </ScrollView>

            {/* Tabs only on the Cards home screens. */}
            {!top && (
              <View
                style={[
                  s.tabs,
                  {
                    backgroundColor: p.surface,
                    borderTopColor: p.border,
                    paddingBottom: insets.bottom + 6,
                  },
                ]}
              >
                {(
                  [
                    ["wallet", "credit-card", "tabWallet"],
                    ["missed", "rotate-ccw", "tabMissed"],
                    ["explore", "compass", "tabExplore"],
                  ] as Array<[Tab, IconName, CardsKey]>
                ).map(([key, icon, label]) => {
                  const on = tab === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setTab(key)}
                      style={s.tab}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <View
                        style={[s.tabPill, on && { backgroundColor: c.soft }]}
                      >
                        <Icon
                          name={icon}
                          size={20}
                          color={on ? c.accent : p.muted}
                        />
                      </View>
                      <Text
                        style={{
                          color: on ? c.accent : p.muted,
                          fontSize: fs(12),
                          fontWeight: on ? "700" : "600",
                        }}
                      >
                        {t(label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {toast && (
          <View
            pointerEvents="none"
            style={[
              s.toast,
              { bottom: insets.bottom + 84, backgroundColor: p.ink },
            ]}
          >
            <Text
              style={{ color: p.page, fontSize: fs(14), fontWeight: "600" }}
            >
              {toast}
            </Text>
          </View>
        )}
      </View>

      {data && intro && (
        <Intro
          data={data}
          p={p}
          accent={c}
          onStart={() => {
            dismissIntro();
            if (data.suggestions.length)
              setMatcher({
                mode: "confirm",
                queue: data.suggestions,
                index: 0,
              });
            else setMatcher({ mode: "add" });
          }}
          onLater={dismissIntro}
        />
      )}

      {data && matcher && (
        <MatcherSheet
          matcher={matcher}
          data={data}
          p={p}
          accent={c}
          onClose={() => setMatcher(null)}
          onDone={async (a, next) => {
            const ok = await act(a, t("saved"));
            if (ok) setMatcher(next);
          }}
        />
      )}

      {data && explain && (
        <ExplainSheet
          line={explain}
          days={data.missed.days}
          cardName={cardName}
          p={p}
          onClose={() => setExplain(null)}
        />
      )}

      <Sheet
        visible={!!leaving}
        onClose={() => setLeaving(null)}
        p={p}
        title={t("leaveTitle")}
        footer={
          <>
            <PrimaryButton
              p={p}
              label={t("leaveGo")}
              onPress={() => {
                if (leaving) void Linking.openURL(leaving.url);
                setLeaving(null);
              }}
            />
            <OutlineButton
              p={p}
              label={t("leaveStay")}
              onPress={() => setLeaving(null)}
            />
          </>
        }
      >
        <Text style={{ color: p.ink2, fontSize: fs(15), lineHeight: fs(22) }}>
          {t("leaveBody")}
        </Text>
        {leaving && (
          <Text style={{ color: p.muted, fontSize: fs(13), marginTop: 8 }}>
            {leaving.url.replace(/^https?:\/\//, "").split("/")[0]}
          </Text>
        )}
      </Sheet>

      {data && (
        <ProfileSheet
          visible={profileOpen}
          data={data}
          p={p}
          onClose={() => setProfileOpen(false)}
          onSave={async (band, income) => {
            if (
              await act(
                { action: "profile", score_band: band, monthly_income: income },
                t("saved"),
              )
            )
              setProfileOpen(false);
          }}
        />
      )}
    </Modal>
  );
}

type Accent = ReturnType<typeof cardsAccent>;

// ── C0. First run ───────────────────────────────────────────────────────────

function Intro({
  data,
  p,
  accent,
  onStart,
  onLater,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  onStart: () => void;
  onLater: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const insets = useSafeAreaInsets();
  const found = data.suggestions
    .map((s) => `${s.bank} ••${s.last4}`)
    .join(", ");
  const rows: Array<[IconName, CardsKey]> = [
    ["rotate-ccw", "introRow1"],
    ["compass", "introRow2"],
    ["shield", "introRow3"],
  ];
  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <ScrollView
        style={{ backgroundColor: p.page }}
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
          gap: 18,
        }}
      >
        <View
          style={{
            height: 150,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 220,
              transform: [{ rotate: "-8deg" }],
              position: "absolute",
              opacity: 0.6,
            }}
          >
            <CardArt bank="Axis" name=" " last4={null} />
          </View>
          <View style={{ width: 220, transform: [{ rotate: "4deg" }] }}>
            <CardArt bank="HDFC" name="Aaj Cards" last4="2026" />
          </View>
        </View>
        <Text
          accessibilityRole="header"
          style={{
            color: p.ink,
            fontSize: fs(24),
            fontWeight: "800",
            lineHeight: fs(31),
          }}
        >
          {t("introTitle")}
        </Text>
        {rows.map(([icon, key]) => (
          <View
            key={key}
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
          >
            <View style={[s.logo, { backgroundColor: accent.soft }]}>
              <Icon name={icon} size={16} color={accent.accent} />
            </View>
            <Text
              style={{
                color: p.ink2,
                fontSize: fs(15),
                lineHeight: fs(22),
                flex: 1,
              }}
            >
              {t(key)}
            </Text>
          </View>
        ))}
        <Card p={p} style={{ padding: 14 }}>
          <Text
            style={{ color: p.ink, fontSize: fs(14.5), lineHeight: fs(21) }}
          >
            {data.suggestions.length
              ? t("introFound", { n: data.suggestions.length, list: found })
              : t("introNone")}
          </Text>
        </Card>
        <PrimaryButton
          p={p}
          label={data.suggestions.length ? t("introStart") : t("addCard")}
          onPress={onStart}
        />
        <OutlineButton p={p} label={t("introLater")} onPress={onLater} />
      </ScrollView>
    </Modal>
  );
}

// ── C1. My cards ────────────────────────────────────────────────────────────

function Wallet({
  data,
  p,
  accent,
  onOpenCard,
  onMatch,
  onSet,
  onAdd,
  onSeeMissed,
  onPrivacy,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  onOpenCard: (id: string) => void;
  onMatch: (queue: CardSuggestion[]) => void;
  onSet: (card: HeldCardView) => void;
  onAdd: () => void;
  onSeeMissed: () => void;
  onPrivacy: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const m = data.missed;
  const known = data.cards.filter((c) => c.product);
  return (
    <>
      <Text style={{ color: p.muted, fontSize: fs(13) }}>
        {data.days >= 30
          ? t("summary", {
              days: Math.min(data.days, 180),
              cards: data.cards.length,
              spend: money(m.cardSpend + m.unknownCardSpend),
            })
          : t("summaryEarly", { days: data.days, cards: data.cards.length })}
      </Text>

      {(data.alerts ?? []).slice(0, 2).map((a) => {
        const card = data.cards.find((x) => x.id === a.cardId);
        const name = card
          ? `${card.product?.name ?? card.bank}${card.last4 ? ` ••${card.last4}` : ""}`
          : "";
        return (
          <PressableScale
            key={`${a.cardId}-${a.date}-${a.change}`}
            onPress={() => onOpenCard(a.cardId)}
            accessibilityRole="button"
          >
            <View
              style={[
                s.alert,
                { backgroundColor: p.surface, borderLeftColor: accent.accent },
                elevation(p),
              ]}
            >
              <Icon name="bell" size={18} color={accent.accent} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    color: p.ink,
                    fontWeight: "700",
                    fontSize: fs(14.5),
                  }}
                >
                  {t("alertTitle", { card: name })}
                </Text>
                <Text
                  style={{
                    color: p.ink2,
                    fontSize: fs(13.5),
                    lineHeight: fs(19),
                  }}
                >
                  {a.change}
                </Text>
                <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
                  {t(a.upcoming ? "alertUpcoming" : "alertFrom", {
                    date: shortDate(a.date),
                  })}
                  {a.affectsYou ? ` · ${t("alertYou")}` : ""}
                </Text>
              </View>
            </View>
          </PressableScale>
        );
      })}

      {known.length > 0 && (
        <Card p={p} style={{ padding: 18, gap: 6 }}>
          <Text style={{ color: p.muted, fontSize: fs(13), fontWeight: "600" }}>
            {t("earnedLabel")}
          </Text>
          <Text style={{ color: p.ink, fontSize: fs(30), fontWeight: "800" }}>
            {money(m.earned)}
          </Text>
          {m.missed > 0 ? (
            <Text
              style={{
                color: accent.accent,
                fontSize: fs(15),
                fontWeight: "600",
                lineHeight: fs(21),
              }}
            >
              {t("couldHave", { amount: money(m.couldHaveEarned) })}
            </Text>
          ) : (
            <Text style={{ color: p.ink2, fontSize: fs(14.5) }}>
              {t("allGood")}
            </Text>
          )}
          {m.missed > 0 && (
            <Pressable
              onPress={onSeeMissed}
              hitSlop={8}
              accessibilityRole="button"
              style={{ marginTop: 4 }}
            >
              <Text
                style={{
                  color: accent.accent,
                  fontWeight: "700",
                  fontSize: fs(14),
                }}
              >
                {t("seeWhere")} →
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      {data.suggestions.length > 0 && (
        <PressableScale
          onPress={() => onMatch(data.suggestions)}
          accessibilityRole="button"
        >
          <View
            style={[
              s.dashed,
              { borderColor: accent.accent, backgroundColor: accent.soft },
            ]}
          >
            <Icon name="plus-circle" size={20} color={accent.accent} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}
              >
                {t("newFound")}:{" "}
                {data.suggestions
                  .map((x) => `${x.bank} ••${x.last4}`)
                  .join(", ")}
              </Text>
              <Text style={{ color: p.ink2, fontSize: fs(13) }}>
                {t("whichCard")}
              </Text>
            </View>
            <Text
              style={{
                color: accent.accent,
                fontWeight: "800",
                fontSize: fs(14),
              }}
            >
              {t("choose")}
            </Text>
          </View>
        </PressableScale>
      )}

      {data.cards.length === 0 && data.suggestions.length === 0 && (
        <Card p={p} style={{ padding: 18, gap: 8 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(16) }}>
            {t("noCards")}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
            {t("noCardsBody")}
          </Text>
        </Card>
      )}

      {data.cards.map((card) => (
        <PressableScale
          key={card.id}
          onPress={() => (card.product ? onOpenCard(card.id) : onSet(card))}
          accessibilityRole="button"
        >
          <View
            style={[s.walletCard, { backgroundColor: p.surface }, elevation(p)]}
          >
            <CardArt
              bank={card.bank}
              name={card.product?.name ?? t("unknownCard")}
              last4={card.last4}
              dashed={!card.product}
            />
            <View style={{ padding: 14, gap: 6 }}>
              {card.product ? (
                <>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {topRules(card).map((r) => (
                      <Chip
                        key={r}
                        label={r}
                        color={accent.accent}
                        bg={accent.soft}
                      />
                    ))}
                  </View>
                  <Text style={{ color: p.muted, fontSize: fs(13) }}>
                    {money(card.spendInWindow)} · ~{money(card.earned)}
                  </Text>
                </>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: p.ink2, fontSize: fs(13.5), flex: 1 }}>
                    {t("unknownRough")}
                  </Text>
                  <Text
                    style={{
                      color: accent.accent,
                      fontWeight: "800",
                      fontSize: fs(14),
                    }}
                  >
                    {t("choose")}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </PressableScale>
      ))}

      {data.useFor.length > 0 && (
        <Card p={p} style={{ padding: 16, gap: 2 }}>
          <Text
            style={{
              color: p.ink,
              fontWeight: "700",
              fontSize: fs(15),
              marginBottom: 6,
            }}
          >
            {t("useFor")}
          </Text>
          {data.useFor.map((u) => {
            const card = data.cards.find((c) => c.id === u.cardId);
            return (
              <View
                key={u.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{ color: p.ink2, fontSize: fs(14), flex: 1 }}
                  numberOfLines={1}
                >
                  {u.label}
                </Text>
                <Icon name="arrow-right" size={14} color={p.muted} />
                <Text
                  style={{
                    color: p.ink,
                    fontSize: fs(14),
                    fontWeight: "700",
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {card?.product?.name ?? card?.bank ?? ""}
                  {card?.last4 ? ` ••${card.last4}` : ""} · {trimRate(u.rate)}%
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      <OutlineButton
        p={p}
        label={`+ ${t("addCard")}`}
        onPress={onAdd}
        color={accent.accent}
      />
      <Pressable
        onPress={onPrivacy}
        hitSlop={8}
        accessibilityRole="button"
        style={{ alignSelf: "center", paddingVertical: 6 }}
      >
        <Text
          style={{
            color: accent.accent,
            fontWeight: "700",
            fontSize: fs(13.5),
          }}
        >
          {t("privacyLink")}
        </Text>
      </Pressable>
      <Footer p={p} verified={data.catalogVerified} />
    </>
  );
}

function topRules(card: HeldCardView): string[] {
  const p = card.product;
  if (!p) return [];
  const rules = [...p.rules]
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 2)
    .map((r) => `${trimRate(r.rate)}% ${shortLabel(r.label)}`);
  return rules.length ? rules : [`${trimRate(p.baseRate)}% everywhere`];
}

function shortLabel(label: string): string {
  return label
    .replace(/^\s*\d+(?:\.\d+)?%\s*(?:on\s+)?/i, "")
    .split(/[(,;]/)[0]
    .trim()
    .slice(0, 28);
}

function trimRate(n: number): string {
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(n < 1 ? 2 : 1).replace(/0$/, "");
}

// ── C2. Card detail ─────────────────────────────────────────────────────────

function CardDetail({
  card,
  data,
  p,
  accent,
  onChange,
  onRemove,
}: {
  card: HeldCardView | null;
  data: CardsData;
  p: Palette;
  accent: Accent;
  onChange: (card: HeldCardView) => void;
  onRemove: (id: string) => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  if (!card) return null;
  const prod = card.product;
  const health = card.health;
  return (
    <>
      <CardArt
        bank={card.bank}
        name={prod?.name ?? t("unknownCard")}
        last4={card.last4}
      />
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: p.ink2, fontSize: fs(14), flex: 1 }}>
          {t("detailSpent", {
            days: Math.min(data.days, 180),
            spend: money(card.spendInWindow),
            earned: money(card.earned),
          })}
        </Text>
        <Pressable
          onPress={() => onChange(card)}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: accent.accent,
              fontWeight: "700",
              fontSize: fs(14),
            }}
          >
            {t("change")}
          </Text>
        </Pressable>
      </View>
      {prod && (
        <>
          <Rules prod={prod} p={p} />
          <Card p={p} style={{ padding: 16, gap: 8 }}>
            <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
              {t("fees")}
            </Text>
            <Row
              p={p}
              left={t("annual")}
              right={
                prod.annualFee
                  ? `${money(prod.annualFee)} ${t("plusGst")}`
                  : "₹0"
              }
            />
            <Text style={{ color: p.muted, fontSize: fs(13) }}>
              {prod.feeWaiverSpend
                ? t("waiver", { amount: money(prod.feeWaiverSpend) })
                : prod.annualFee
                  ? t("noWaiver")
                  : ""}
            </Text>
          </Card>
          {health && (health.feeWaiver || health.milestones.length > 0) && (
            <Card p={p} style={{ padding: 16, gap: 10 }}>
              <Text
                style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}
              >
                {t("trackTitle")}
              </Text>
              <Text style={{ color: p.ink2, fontSize: fs(13.5) }}>
                {t("trackPace", { amount: money(health.yearlyPace) })}
              </Text>
              {health.feeWaiver && (
                <Track
                  label={t("annual")}
                  pace={health.feeWaiver.pace}
                  target={health.feeWaiver.target}
                  onTrack={health.feeWaiver.onTrack}
                  p={p}
                  color={accent.accent}
                />
              )}
              {health.milestones.map((m) => (
                <Track
                  key={m.label}
                  label={t("milestone", {
                    label: m.label,
                    value: money(m.valueRs),
                  })}
                  pace={m.pace}
                  target={m.target}
                  onTrack={m.onTrack}
                  p={p}
                  color={accent.accent}
                />
              ))}
              <Text style={{ color: p.muted, fontSize: fs(12) }}>
                {t("trackNote")}
              </Text>
            </Card>
          )}
          <Card p={p} style={{ padding: 16, gap: 8 }}>
            <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
              {t("changesTitle")}
            </Text>
            {health && health.changes.length > 0 ? (
              health.changes.map((ch) => (
                <View key={`${ch.date}-${ch.change}`} style={{ gap: 2 }}>
                  <Text
                    style={{
                      color: p.ink2,
                      fontSize: fs(14),
                      lineHeight: fs(20),
                    }}
                  >
                    • {ch.change}
                  </Text>
                  <Text
                    style={{
                      color: p.muted,
                      fontSize: fs(12.5),
                      marginLeft: 10,
                    }}
                  >
                    {t(ch.upcoming ? "alertUpcoming" : "alertFrom", {
                      date: shortDate(ch.date),
                    })}
                    {ch.affectsYou ? ` · ${t("alertYou")}` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: p.muted, fontSize: fs(13.5) }}>
                {t("changesNone")}
              </Text>
            )}
          </Card>
          <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
            {t("checked", { date: shortDate(prod.verified) })}
          </Text>
        </>
      )}
      <OutlineButton
        p={p}
        label={t("removeCard")}
        onPress={() => onRemove(card.id)}
      />
    </>
  );
}

function Track({
  label,
  pace,
  target,
  onTrack,
  p,
  color,
}: {
  label: string;
  pace: number;
  target: number;
  onTrack: boolean;
  p: Palette;
  color: string;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const pct = Math.max(0, Math.min(1, pace / target));
  return (
    <View
      style={{ gap: 5 }}
      accessible
      accessibilityLabel={`${label}: ${money(pace)} / ${money(target)}`}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Text
          style={{ color: p.ink2, fontSize: fs(13.5), flex: 1 }}
          numberOfLines={2}
        >
          {label}
        </Text>
        <Text
          style={{
            color: onTrack ? color : p.muted,
            fontSize: fs(13),
            fontWeight: "700",
          }}
        >
          {onTrack
            ? t("trackOnTrack")
            : t("trackShort", { amount: money(target - pace) })}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: p.grid,
          overflow: "hidden",
        }}
      >
        <View
          style={{ width: `${pct * 100}%`, height: 8, backgroundColor: color }}
        />
      </View>
      <Text style={{ color: p.muted, fontSize: fs(12) }}>
        ~{money(pace)} / {money(target)}
      </Text>
    </View>
  );
}

function Rules({
  prod,
  p,
}: {
  prod: NonNullable<HeldCardView["product"]>;
  p: Palette;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  return (
    <Card p={p} style={{ padding: 16, gap: 6 }}>
      <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
        {t("rewards")}
      </Text>
      {[...prod.rules]
        .sort((a, b) => b.rate - a.rate)
        .map((r, i) => (
          <Text
            key={i}
            style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}
          >
            • {r.label}
            {r.capMonthly ? ` (${t("cap", { cap: money(r.capMonthly) })})` : ""}
          </Text>
        ))}
      <Text style={{ color: p.ink2, fontSize: fs(14) }}>
        • {t("base", { rate: trimRate(prod.baseRate) })}
      </Text>
      {prod.upi && (
        <Text style={{ color: p.ink2, fontSize: fs(14) }}>• {t("onUpi")}</Text>
      )}
      {prod.confidence === "low" && (
        <Text style={{ color: p.muted, fontSize: fs(12.5), marginTop: 4 }}>
          {t("confidenceLow")}
        </Text>
      )}
    </Card>
  );
}

// ── C4. Missed rewards ──────────────────────────────────────────────────────

function Missed({
  data,
  p,
  accent,
  cardName,
  onOpenLine,
  onGoWallet,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  cardName: (id: string) => string;
  onOpenLine: (index: number) => void;
  onGoWallet: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const m = data.missed;
  const known = data.cards.some((c) => c.product);
  if (!known)
    return (
      <Card p={p} style={{ padding: 18, gap: 10 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(16) }}>
          {t("needCards")}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
          {t("needCardsBody")}
        </Text>
        <OutlineButton
          p={p}
          label={t("tabWallet")}
          onPress={onGoWallet}
          color={accent.accent}
        />
      </Card>
    );
  const badge =
    m.days < 30
      ? t("badgeEarly", { days: m.days })
      : m.unknownCardSpend > 0
        ? t("badgeSome")
        : t("badgeGood", { n: m.lines.reduce((s, l) => s + l.count, 0) });
  return (
    <>
      <Card p={p} style={{ padding: 18, gap: 8 }}>
        <Text
          style={{
            color: p.ink,
            fontSize: fs(18),
            fontWeight: "700",
            lineHeight: fs(25),
          }}
        >
          {t("missedHead", {
            earned: money(m.earned),
            could: money(m.couldHaveEarned),
          })}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
          {m.days >= 30 && m.missed > 0
            ? t("missedSub", { yearly: yearly((m.missed * 365) / m.days) })
            : t("missedSubEarly", { days: m.days })}
        </Text>
        <Chip label={badge} icon="database" color={p.ink2} bg={p.grid} />
      </Card>

      {m.lines.length === 0 ? (
        <Card p={p} style={{ padding: 18, gap: 6 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(16) }}>
            {t("nothingMissed")}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(14) }}>
            {t("nothingMissedBody")}
          </Text>
        </Card>
      ) : (
        m.lines.map((l, i) => (
          <PressableScale
            key={`${l.label}-${i}`}
            onPress={() => onOpenLine(i)}
            accessibilityRole="button"
          >
            <View
              style={[s.line, { backgroundColor: p.surface }, elevation(p)]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}
                >
                  {l.label} · {money(l.spend)}
                </Text>
                <Text
                  style={{
                    color: p.muted,
                    fontSize: fs(13),
                    lineHeight: fs(18),
                  }}
                >
                  {t("paidWith", {
                    card: cardName(l.paidWith),
                    best: cardName(l.bestCard),
                  })}
                </Text>
              </View>
              <Text
                style={{
                  color: accent.accent,
                  fontWeight: "800",
                  fontSize: fs(16),
                }}
              >
                +{money(l.missed)}
              </Text>
            </View>
          </PressableScale>
        ))
      )}

      {m.upi && (
        <Card p={p} style={{ padding: 16, gap: 6 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
            {t("upiTitle")}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
            {t("upiBody", {
              spend: money(m.upi.spend),
              value: money(m.upi.value),
              card: cardName(m.upi.cardId),
            })}
          </Text>
        </Card>
      )}
      <Footer p={p} verified={data.catalogVerified} />
    </>
  );
}

// ── C5. One place you spend: every card side by side ────────────────────────

function LineScreen({
  line,
  data,
  p,
  accent,
  cardName,
  onExplain,
}: {
  line: MissedLine | null;
  data: CardsData;
  p: Palette;
  accent: Accent;
  cardName: (id: string) => string;
  onExplain: (l: MissedLine) => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  if (!line) return null;
  return (
    <>
      <Card p={p} style={{ padding: 18, gap: 6 }}>
        <Text style={{ color: p.ink2, fontSize: fs(14) }}>
          {t("breakdownHead", { spend: money(line.spend), n: line.count })}
        </Text>
        <Text
          style={{
            color: p.ink,
            fontSize: fs(17),
            fontWeight: "700",
            lineHeight: fs(24),
          }}
        >
          {t("breakdownTip", {
            label: line.label,
            card: cardName(line.bestCard),
          })}
        </Text>
        <Text
          style={{ color: accent.accent, fontSize: fs(15), fontWeight: "700" }}
        >
          +{money(line.missed)}
        </Text>
        <Pressable
          onPress={() => onExplain(line)}
          hitSlop={8}
          accessibilityRole="button"
          style={{ marginTop: 2 }}
        >
          <Text
            style={{
              color: accent.accent,
              fontWeight: "700",
              fontSize: fs(14),
            }}
          >
            {t("howWorked")} →
          </Text>
        </Pressable>
      </Card>

      <Card p={p} style={{ padding: 16, gap: 4 }}>
        <Text
          style={{
            color: p.ink,
            fontWeight: "700",
            fontSize: fs(15),
            marginBottom: 6,
          }}
        >
          {t("breakdownCards")}
        </Text>
        {(line.options ?? []).map((o) => {
          const best = o.cardId === line.bestCard;
          const used = o.cardId === line.paidWith;
          return (
            <View
              key={o.cardId}
              style={[
                s.option,
                {
                  borderColor: best ? accent.accent : p.border,
                  backgroundColor: best ? accent.soft : "transparent",
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: p.ink,
                    fontWeight: "700",
                    fontSize: fs(14.5),
                  }}
                  numberOfLines={1}
                >
                  {cardName(o.cardId)}
                </Text>
                <Text
                  style={{ color: p.muted, fontSize: fs(12.5) }}
                  numberOfLines={2}
                >
                  {o.why}
                </Text>
                {(best || used) && (
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                    {best && (
                      <Chip
                        label={t("breakdownBest")}
                        color={accent.accent}
                        bg={p.surface}
                      />
                    )}
                    {used && (
                      <Chip
                        label={t("breakdownUsed")}
                        color={p.ink2}
                        bg={p.grid}
                      />
                    )}
                  </View>
                )}
              </View>
              <Text
                style={{
                  color: best ? accent.accent : p.ink,
                  fontWeight: "800",
                  fontSize: fs(16),
                }}
              >
                {trimRate(o.rate)}%
              </Text>
            </View>
          );
        })}
      </Card>

      {(line.spends ?? []).length > 0 && (
        <Card p={p} style={{ padding: 16, gap: 2 }}>
          <Text
            style={{
              color: p.ink,
              fontWeight: "700",
              fontSize: fs(15),
              marginBottom: 6,
            }}
          >
            {t("breakdownSpends")}
          </Text>
          {line.spends.map((sp, i) => (
            <Row
              key={`${sp.date}-${i}`}
              p={p}
              left={shortDate(sp.date)}
              right={money(sp.amount)}
            />
          ))}
        </Card>
      )}
      <Footer p={p} verified={data.catalogVerified} />
    </>
  );
}

// ── C11. Privacy & data ─────────────────────────────────────────────────────

function PrivacyScreen({
  p,
  accent,
  onForget,
  onTurnOff,
}: {
  p: Palette;
  accent: Accent;
  onForget: () => void | Promise<void>;
  onTurnOff?: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const [confirm, setConfirm] = useState<"forget" | "off" | null>(null);
  const list = (keys: CardsKey[], icon: IconName, color: string) =>
    keys.map((k) => (
      <View
        key={k}
        style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
      >
        <Icon name={icon} size={16} color={color} />
        <Text
          style={{
            color: p.ink2,
            fontSize: fs(14),
            lineHeight: fs(20),
            flex: 1,
          }}
        >
          {t(k)}
        </Text>
      </View>
    ));
  return (
    <>
      <Card p={p} style={{ padding: 18, gap: 10 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
          {t("privacyUses")}
        </Text>
        {list(
          ["privacyUses1", "privacyUses2", "privacyUses3"],
          "check",
          accent.accent,
        )}
      </Card>
      <Card p={p} style={{ padding: 18, gap: 10 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
          {t("privacyNever")}
        </Text>
        {list(
          ["privacyNever1", "privacyNever2", "privacyNever3"],
          "x",
          p.muted,
        )}
      </Card>

      <Card p={p} style={{ padding: 18, gap: 8 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
          {t("forgetTitle")}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
          {t("forgetBody")}
        </Text>
        {confirm === "forget" ? (
          <View style={{ gap: 8 }}>
            <PrimaryButton
              p={p}
              label={t("forgetConfirm")}
              onPress={() => {
                setConfirm(null);
                void onForget();
              }}
            />
            <OutlineButton
              p={p}
              label={t("cancel")}
              onPress={() => setConfirm(null)}
            />
          </View>
        ) : (
          <OutlineButton
            p={p}
            label={t("forgetTitle")}
            onPress={() => setConfirm("forget")}
          />
        )}
      </Card>

      {onTurnOff && (
        <Card p={p} style={{ padding: 18, gap: 8 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
            {t("turnOffTitle")}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
            {t("turnOffBody")}
          </Text>
          {confirm === "off" ? (
            <View style={{ gap: 8 }}>
              <PrimaryButton p={p} label={t("turnOff")} onPress={onTurnOff} />
              <OutlineButton
                p={p}
                label={t("cancel")}
                onPress={() => setConfirm(null)}
              />
            </View>
          ) : (
            <OutlineButton
              p={p}
              label={t("turnOffTitle")}
              onPress={() => setConfirm("off")}
            />
          )}
        </Card>
      )}
    </>
  );
}

// ── C6. Explain this number ─────────────────────────────────────────────────

function ExplainSheet({
  line,
  days,
  cardName,
  p,
  onClose,
}: {
  line: MissedLine;
  days: number;
  cardName: (id: string) => string;
  p: Palette;
  onClose: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  return (
    <Sheet
      visible
      onClose={onClose}
      p={p}
      title={t("explainTitle", { amount: money(line.missed) })}
    >
      <Row
        p={p}
        left={t("explainSpend", { label: line.label, days })}
        right={money(line.spend)}
      />
      <Row
        p={p}
        left={`${t("explainBest", { card: cardName(line.bestCard) })}${line.why ? ` · ${line.why}` : ""}`}
        right={money(line.bestValue)}
      />
      <Row
        p={p}
        left={`− ${t("explainActual", { card: cardName(line.paidWith) })}`}
        right={money(line.earned)}
      />
      <View
        style={{ height: 1, backgroundColor: p.border, marginVertical: 4 }}
      />
      <Row
        p={p}
        strong
        left={`= ${t("explainExtra")}`}
        right={money(line.missed)}
      />
      <Text
        style={{
          color: p.ink,
          fontWeight: "700",
          fontSize: fs(14),
          marginTop: 14,
        }}
      >
        {t("assumptions")}
      </Text>
      {(["assume1", "assume2", "assume3"] as const).map((k) => (
        <Text
          key={k}
          style={{
            color: p.ink2,
            fontSize: fs(13.5),
            lineHeight: fs(19),
            marginTop: 4,
          }}
        >
          • {t(k)}
        </Text>
      ))}
    </Sheet>
  );
}

// ── C7. Explore ─────────────────────────────────────────────────────────────

function Explore({
  data,
  hidden,
  p,
  accent,
  onOpen,
  onProfile,
  onClearStress,
}: {
  data: CardsData;
  hidden: string[];
  p: Palette;
  accent: Accent;
  onOpen: (key: string) => void;
  onProfile: () => void;
  onClearStress: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  if (data.stress.length) {
    const what = [
      ...new Set(data.stress.map((x) => x.text.toLowerCase())),
    ].join("; ");
    return (
      <Card p={p} style={{ padding: 18, gap: 10 }}>
        <View style={[s.logo, { backgroundColor: accent.soft }]}>
          <Icon name="anchor" size={16} color={accent.accent} />
        </View>
        <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(18) }}>
          {t("stressTitle")}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
          {t("stressBody", { what })}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
          {t("stressActions")}
        </Text>
        <Pressable
          onPress={onClearStress}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: accent.accent,
              fontWeight: "700",
              fontSize: fs(14),
            }}
          >
            {t("stressWrong")}
          </Text>
        </Pressable>
      </Card>
    );
  }
  const offers = data.next.filter(
    (n) =>
      !hidden.includes(n.product.key) && n.eligibility.chance !== "unlikely",
  );
  const chanceLabel = {
    likely: t("likely"),
    stretch: t("stretch"),
    unlikely: t("unlikely"),
  };
  return (
    <>
      <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
        {t("exploreIntro")}
      </Text>
      <View style={[s.disclosure, { backgroundColor: accent.soft }]}>
        <Icon name="info" size={14} color={accent.accent} />
        <Text
          style={{
            color: p.ink,
            fontSize: fs(13),
            flex: 1,
            lineHeight: fs(18),
          }}
        >
          {t("disclosure")}
        </Text>
      </View>

      {offers.length === 0 ? (
        <Card p={p} style={{ padding: 18 }}>
          <Text style={{ color: p.ink, fontSize: fs(15), lineHeight: fs(22) }}>
            {t("noNeed")}
          </Text>
        </Card>
      ) : (
        offers.map((o, i) => (
          <OfferCard
            key={o.product.key}
            rank={i + 1}
            o={o}
            p={p}
            accent={accent}
            chanceLabel={chanceLabel[o.eligibility.chance]}
            onOpen={() => onOpen(o.product.key)}
          />
        ))
      )}

      <PressableScale onPress={onProfile} accessibilityRole="button">
        <View style={[s.line, { backgroundColor: p.surface }, elevation(p)]}>
          <Icon name="sliders" size={18} color={accent.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: p.ink, fontWeight: "700", fontSize: fs(14.5) }}
            >
              {t("improveTitle")}
            </Text>
            <Text
              style={{ color: p.muted, fontSize: fs(12.5), lineHeight: fs(17) }}
            >
              {t("improveBody")}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={p.muted} />
        </View>
      </PressableScale>
      <Footer p={p} verified={data.catalogVerified} />
    </>
  );
}

function feeLine(o: NextCardView, t: ReturnType<typeof useCardsT>): string {
  if (o.product.annualFee === 0) return t("noFee");
  if (o.feeWaived) return t("feeWaived");
  return t("afterFee", { fee: money(o.feeYearly) });
}

function OfferCard({
  rank,
  o,
  p,
  accent,
  chanceLabel,
  onOpen,
}: {
  rank: number;
  o: NextCardView;
  p: Palette;
  accent: Accent;
  chanceLabel: string;
  onOpen: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  return (
    <Card p={p} style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Text style={{ color: p.muted, fontWeight: "800", fontSize: fs(15) }}>
          {rank}
        </Text>
        <CardArt
          bank={o.product.bank}
          name={o.product.name}
          last4={null}
          size="sm"
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: p.ink, fontWeight: "700", fontSize: fs(15.5) }}
            numberOfLines={2}
          >
            {o.product.name}
          </Text>
          <Text style={{ color: p.muted, fontSize: fs(13) }}>
            {o.product.bank}
          </Text>
        </View>
      </View>
      <View>
        <Text
          style={{ color: accent.accent, fontWeight: "800", fontSize: fs(24) }}
        >
          {t("perYear", { amount: yearly(o.netYearly) })}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(13) }}>{feeLine(o, t)}</Text>
      </View>
      {o.wins.length > 0 && (
        <Text style={{ color: p.ink2, fontSize: fs(13.5) }}>
          {t("mostlyFrom", { list: o.wins.map((w) => w.label).join(", ") })}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <ChanceChip chance={o.eligibility.chance} label={chanceLabel} p={p} />
        <Text style={{ color: p.muted, fontSize: fs(12) }}>
          {t("chanceNote")}
        </Text>
      </View>
      <OutlineButton
        p={p}
        label={t("whyCard")}
        onPress={onOpen}
        color={accent.accent}
      />
    </Card>
  );
}

// ── C8. Why this card ───────────────────────────────────────────────────────

function OfferDetail({
  offer,
  stressed,
  p,
  accent,
  onGo,
  onHide,
}: {
  offer: NextCardView | null;
  stressed: boolean;
  p: Palette;
  accent: Accent;
  onGo: (url: string) => void;
  onHide: (key: string) => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  if (!offer) return null;
  const prod = offer.product;
  const hint = {
    likely: t("likelyHint"),
    stretch: t("stretchHint"),
    unlikely: t("unlikelyHint"),
  }[offer.eligibility.chance];
  const label = {
    likely: t("likely"),
    stretch: t("stretch"),
    unlikely: t("unlikely"),
  }[offer.eligibility.chance];
  return (
    <>
      <CardArt bank={prod.bank} name={prod.name} last4={null} />
      {prod.pitch && (
        <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
          {prod.pitch}
        </Text>
      )}

      <Card p={p} style={{ padding: 16, gap: 2 }}>
        <Text
          style={{
            color: p.ink,
            fontWeight: "700",
            fontSize: fs(15),
            marginBottom: 4,
          }}
        >
          {t("fees")}
        </Text>
        <Row
          p={p}
          left={t("joining")}
          right={
            prod.joiningFee ? `${money(prod.joiningFee)} ${t("plusGst")}` : "₹0"
          }
        />
        <Row
          p={p}
          left={t("annual")}
          right={
            prod.annualFee ? `${money(prod.annualFee)} ${t("plusGst")}` : "₹0"
          }
        />
        <Text style={{ color: p.muted, fontSize: fs(13) }}>
          {prod.feeWaiverSpend
            ? t("waiver", { amount: money(prod.feeWaiverSpend) })
            : prod.annualFee
              ? t("noWaiver")
              : ""}
        </Text>
      </Card>

      <Card p={p} style={{ padding: 16, gap: 2 }}>
        <Text
          style={{
            color: p.ink,
            fontWeight: "700",
            fontSize: fs(15),
            marginBottom: 4,
          }}
        >
          {t("yourSpend")}
        </Text>
        <Row
          p={p}
          left={t("rewardsYear")}
          right={`+${money(offer.rewardsYearly)}`}
        />
        {offer.milestonesYearly > 0 && (
          <Row
            p={p}
            left={t("milestonesYear")}
            right={`+${money(offer.milestonesYearly)}`}
          />
        )}
        <Row
          p={p}
          left={t("feeYear")}
          right={offer.feeYearly ? `−${money(offer.feeYearly)}` : "₹0"}
        />
        <View
          style={{ height: 1, backgroundColor: p.border, marginVertical: 4 }}
        />
        <Row
          p={p}
          strong
          left={t("netYear")}
          right={t("perYear", { amount: yearly(offer.netYearly) })}
        />
        {offer.wins.map((w) => (
          <Text key={w.label} style={{ color: p.muted, fontSize: fs(13) }}>
            {w.label}: +{money(w.valueYearly)}
          </Text>
        ))}
      </Card>

      <Rules prod={prod} p={p} />

      {(prod.loungeDomesticYear ||
        prod.loungeIntlYear ||
        prod.forexMarkup != null) && (
        <Card p={p} style={{ padding: 16, gap: 4 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
            {t("perks")}
          </Text>
          {prod.loungeDomesticYear || prod.loungeIntlYear ? (
            <Text style={{ color: p.ink2, fontSize: fs(14) }}>
              •{" "}
              {t("lounge", {
                d: prod.loungeDomesticYear ?? 0,
                i: prod.loungeIntlYear ?? 0,
              })}
            </Text>
          ) : null}
          {prod.forexMarkup != null && (
            <Text style={{ color: p.ink2, fontSize: fs(14) }}>
              • {t("forex", { x: prod.forexMarkup })}
            </Text>
          )}
        </Card>
      )}

      <Card p={p} style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15) }}>
          {t("approval")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ChanceChip chance={offer.eligibility.chance} label={label} p={p} />
          <Text style={{ color: p.ink2, fontSize: fs(13.5), flex: 1 }}>
            {hint}
          </Text>
        </View>
        {offer.eligibility.reasons.map((r) => (
          <Text key={r} style={{ color: p.muted, fontSize: fs(13) }}>
            • {r}
          </Text>
        ))}
        <Text
          style={{ color: p.muted, fontSize: fs(12.5), lineHeight: fs(18) }}
        >
          {t("approvalNote")}
        </Text>
      </Card>

      <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
        {t("checked", { date: shortDate(prod.verified) })}
      </Text>
      {!stressed && prod.url && (
        <PrimaryButton
          p={p}
          label={t("goBank")}
          onPress={() => onGo(prod.url!)}
        />
      )}
      <OutlineButton
        p={p}
        label={t("notInterested")}
        onPress={() => onHide(prod.key)}
      />
    </>
  );
}

// ── C3. Which card is this? ─────────────────────────────────────────────────

function MatcherSheet({
  matcher,
  data,
  p,
  accent,
  onClose,
  onDone,
}: {
  matcher: Matcher;
  data: CardsData;
  p: Palette;
  accent: Accent;
  onClose: () => void;
  onDone: (a: CardAction, next: Matcher | null) => Promise<void>;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const current =
    matcher.mode === "confirm"
      ? matcher.queue[matcher.index]
      : matcher.mode === "set"
        ? matcher.card
        : null;
  const bank = current?.bank ?? null;
  const [bankFilter, setBankFilter] = useState<string | null>(bank);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(
    matcher.mode === "confirm"
      ? (current as CardSuggestion).productGuess
      : matcher.mode === "set"
        ? (matcher.card.product?.key ?? null)
        : null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBankFilter(bank);
    setQuery("");
    setPicked(
      matcher.mode === "confirm"
        ? (current as CardSuggestion).productGuess
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matcher]);

  const banks = useMemo(
    () => [...new Set(data.catalog.map((c) => c.bank))].sort(),
    [data.catalog],
  );
  const list = data.catalog.filter(
    (c) =>
      (!bankFilter || c.bank === bankFilter) &&
      (!query.trim() ||
        `${c.bank} ${c.name}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );

  const nextOf = (): Matcher | null =>
    matcher.mode === "confirm" && matcher.index + 1 < matcher.queue.length
      ? { ...matcher, index: matcher.index + 1 }
      : null;

  const run = async (a: CardAction) => {
    setBusy(true);
    await onDone(a, nextOf());
    setBusy(false);
  };

  const confirm = () => {
    if (matcher.mode === "confirm" && current && "last4" in current)
      return run({
        action: "confirm",
        bank: current.bank,
        last4: current.last4!,
        product_key: picked,
      });
    if (matcher.mode === "set")
      return run({
        action: "set_product",
        id: matcher.card.id,
        product_key: picked,
      });
    if (matcher.mode === "add" && picked) {
      const prod = data.catalog.find((c) => c.key === picked);
      if (prod)
        return run({ action: "add", bank: prod.bank, product_key: picked });
    }
  };

  const title =
    matcher.mode === "add"
      ? t("matchTitleAdd")
      : t("matchTitle", { bank: bank ?? "", last4: current?.last4 ?? "" });

  return (
    <Sheet
      visible
      onClose={onClose}
      p={p}
      title={title}
      footer={
        <>
          <PrimaryButton
            p={p}
            label={t("matchConfirm")}
            onPress={confirm}
            disabled={!picked}
            busy={busy}
          />
          {matcher.mode !== "add" && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <OutlineButton
                  p={p}
                  label={t("matchNotSure")}
                  disabled={busy}
                  onPress={() =>
                    matcher.mode === "confirm" && current?.last4
                      ? run({
                          action: "confirm",
                          bank: current.bank,
                          last4: current.last4,
                          product_key: null,
                        })
                      : matcher.mode === "set"
                        ? run({
                            action: "set_product",
                            id: matcher.card.id,
                            product_key: null,
                          })
                        : undefined
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <OutlineButton
                  p={p}
                  label={t("matchNotMine")}
                  disabled={busy}
                  onPress={() =>
                    matcher.mode === "confirm" && current?.last4
                      ? run({
                          action: "dismiss",
                          bank: current.bank,
                          last4: current.last4,
                        })
                      : matcher.mode === "set"
                        ? run({ action: "hide", id: matcher.card.id })
                        : undefined
                  }
                />
              </View>
            </View>
          )}
          {matcher.mode === "confirm" && matcher.queue.length > 1 && (
            <Text
              style={{
                color: p.muted,
                fontSize: fs(12.5),
                textAlign: "center",
              }}
            >
              {t("matchProgress", {
                i: matcher.index + 1,
                n: matcher.queue.length,
              })}
            </Text>
          )}
        </>
      }
    >
      {matcher.mode === "confirm" && (
        <Text
          style={{
            color: p.ink2,
            fontSize: fs(14),
            lineHeight: fs(20),
            marginBottom: 10,
          }}
        >
          {t("matchContext", { n: (current as CardSuggestion).spends })}
        </Text>
      )}
      <View
        style={[s.search, { borderColor: p.border, backgroundColor: p.page }]}
      >
        <Icon name="search" size={16} color={p.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("matchSearch")}
          placeholderTextColor={p.muted}
          style={{
            flex: 1,
            color: p.ink,
            fontSize: fs(15),
            paddingVertical: 10,
          }}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
      >
        {[null, ...banks].map((b) => {
          const on = bankFilter === b;
          return (
            <Pressable
              key={b ?? "all"}
              onPress={() => setBankFilter(b)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                s.bankChip,
                {
                  borderColor: on ? accent.accent : p.border,
                  backgroundColor: on ? accent.soft : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: on ? accent.accent : p.ink2,
                  fontWeight: "700",
                  fontSize: fs(13),
                }}
              >
                {b ?? t("matchAllBanks")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {list.map((c) => {
        const on = picked === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => setPicked(c.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[s.option, { borderColor: on ? accent.accent : p.border }]}
          >
            <CardArt bank={c.bank} name={c.name} last4={null} size="sm" />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: p.ink, fontWeight: "700", fontSize: fs(14.5) }}
              >
                {c.name}
              </Text>
              <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
                {c.bank}
              </Text>
            </View>
            <Icon
              name={on ? "check-circle" : "circle"}
              size={20}
              color={on ? accent.accent : p.border}
            />
          </Pressable>
        );
      })}
      <Text
        style={{
          color: p.muted,
          fontSize: fs(12.5),
          lineHeight: fs(18),
          marginTop: 8,
        }}
      >
        {t("matchHelp")}
      </Text>
    </Sheet>
  );
}

// ── Profile (for approval chances) ──────────────────────────────────────────

const BANDS: ScoreBand[] = [
  "750+",
  "700-749",
  "650-699",
  "below-650",
  "unknown",
];

function ProfileSheet({
  visible,
  data,
  p,
  onClose,
  onSave,
}: {
  visible: boolean;
  data: CardsData;
  p: Palette;
  onClose: () => void;
  onSave: (band: ScoreBand, income: number | null) => Promise<void>;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  const [band, setBand] = useState<ScoreBand>(data.profile.score_band);
  const [income, setIncome] = useState(
    data.profile.monthly_income ? String(data.profile.monthly_income) : "",
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setBand(data.profile.score_band);
    setIncome(
      data.profile.monthly_income ? String(data.profile.monthly_income) : "",
    );
  }, [visible, data.profile]);
  const parsed = income.trim() ? Number(income.replace(/[^\d.]/g, "")) : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      p={p}
      title={t("improveTitle")}
      footer={
        <PrimaryButton
          p={p}
          label={t("save")}
          busy={busy}
          disabled={parsed !== null && !Number.isFinite(parsed)}
          onPress={async () => {
            setBusy(true);
            await onSave(band, parsed);
            setBusy(false);
          }}
        />
      }
    >
      <Text
        style={{
          color: p.ink2,
          fontSize: fs(13.5),
          lineHeight: fs(19),
          marginBottom: 12,
        }}
      >
        {t("improveBody")}
      </Text>
      <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(14) }}>
        {t("income")}
      </Text>
      <TextInput
        value={income}
        onChangeText={setIncome}
        keyboardType="numeric"
        placeholder="50000"
        placeholderTextColor={p.muted}
        style={[
          s.input,
          { borderColor: p.border, color: p.ink, fontSize: fs(16) },
        ]}
      />
      {data.profile.estimatedIncome != null && (
        <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
          {t("incomeFromSalary", {
            amount: money(data.profile.estimatedIncome),
          })}
        </Text>
      )}
      <Text
        style={{
          color: p.ink,
          fontWeight: "700",
          fontSize: fs(14),
          marginTop: 16,
        }}
      >
        {t("score")}
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}
      >
        {BANDS.map((b) => {
          const on = band === b;
          return (
            <Pressable
              key={b}
              onPress={() => setBand(b)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[
                s.bankChip,
                {
                  borderColor: on ? p.accent : p.border,
                  backgroundColor: on ? p.accentSoft : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: on ? p.accent : p.ink2,
                  fontWeight: "700",
                  fontSize: fs(13),
                }}
              >
                {b === "unknown"
                  ? t("scoreUnknown")
                  : b === "below-650"
                    ? "< 650"
                    : b}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

// ── C10. How we calculate ───────────────────────────────────────────────────

function CalcScreen({
  p,
  verified,
  accent,
  onPrivacy,
}: {
  p: Palette;
  verified: string;
  accent: Accent;
  onPrivacy: () => void;
}) {
  const t = useCardsT();
  const { fs } = useSettings();
  return (
    <Card p={p} style={{ padding: 18, gap: 12 }}>
      <Pressable
        onPress={onPrivacy}
        hitSlop={8}
        accessibilityRole="button"
        style={{ alignSelf: "flex-start" }}
      >
        <Text
          style={{ color: accent.accent, fontWeight: "700", fontSize: fs(14) }}
        >
          {t("privacyLink")} →
        </Text>
      </Pressable>
      {(["calcBody1", "calcBody2", "calcBody3", "calcBody4"] as const).map(
        (k) => (
          <Text
            key={k}
            style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(22) }}
          >
            {t(k)}
          </Text>
        ),
      )}
      <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
        {t("checked", { date: shortDate(verified) })}
      </Text>
    </Card>
  );
}

function Footer({ p, verified }: { p: Palette; verified: string }) {
  const t = useCardsT();
  const { fs } = useSettings();
  return (
    <Text
      style={{
        color: p.muted,
        fontSize: fs(12),
        lineHeight: fs(17),
        textAlign: "center",
        marginTop: 4,
      }}
    >
      {t("footerRules", { date: shortDate(verified) })}
    </Text>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  tabs: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 52 },
  tabPill: { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 999 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  walletCard: { borderRadius: 18, overflow: "hidden", padding: 0 },
  dashed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  alert: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    alignItems: "flex-start",
  },
  disclosure: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 36,
    justifyContent: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 6,
  },
});
