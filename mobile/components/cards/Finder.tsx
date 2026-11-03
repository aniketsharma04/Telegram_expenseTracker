import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import {
  Card,
  Icon,
  PrimaryButton,
  PressableScale,
  type IconName,
} from "../ui";
import { elevation, type Palette } from "../../lib/theme";
import { useSettings } from "../../lib/i18n";
import type {
  CardsData,
  FinderAnswers,
  FinderFee,
  FinderGoal,
  FinderPick,
  FinderPlatform,
  FinderResult,
  FinderSpend,
} from "../../lib/cards-api";
import {
  CardArt,
  ChanceChip,
  Chip,
  OutlineButton,
  Row,
  cardsAccent,
  money,
  shortDate,
  yearly,
} from "./parts";

/**
 * Card Finder — "which one card suits me best?"
 *
 * Monzy asks six multiple-choice questions and matches card attributes. Aaj
 * asks five and then scores every card in rupees: on the user's real spending
 * when there's enough of it, otherwise on a pattern built from the answers.
 * One clear best match, two runners-up, a side-by-side compare, and the
 * reasons and catches for each. No bank pays Aaj; links are plain links.
 */

type Accent = ReturnType<typeof cardsAccent>;

export const FINDER_KEY = "aaj.cards.finder.v1";

const CHANCE_LABEL = {
  likely: "Likely",
  stretch: "Stretch",
  unlikely: "Unlikely",
} as const;

// ── The questions ───────────────────────────────────────────────────────────

interface Option<T> {
  value: T;
  label: string;
  sub?: string;
  icon?: IconName;
}

const GOALS: Option<FinderGoal>[] = [
  {
    value: "shopping",
    label: "Save on shopping",
    sub: "Amazon, Flipkart, Myntra and stores",
    icon: "shopping-bag",
  },
  {
    value: "food",
    label: "Food and dining",
    sub: "Swiggy, Zomato, eating out",
    icon: "coffee",
  },
  {
    value: "travel",
    label: "Travel and lounges",
    sub: "Flights, hotels, airport lounges, forex",
    icon: "navigation",
  },
  { value: "fuel", label: "Fuel", sub: "Petrol and diesel", icon: "droplet" },
  {
    value: "bills",
    label: "Bills and everyday UPI",
    sub: "Electricity, phone, groceries, UPI",
    icon: "zap",
  },
  {
    value: "value",
    label: "Most value overall",
    sub: "Whatever pays the most back",
    icon: "star",
  },
];

const PLATFORMS: Option<FinderPlatform>[] = [
  { value: "amazon", label: "Amazon" },
  { value: "flipkart", label: "Flipkart" },
  { value: "myntra", label: "Myntra" },
  { value: "food-apps", label: "Swiggy and Zomato" },
  { value: "tata", label: "Tata Neu apps", sub: "BigBasket, Croma, Tata CLiQ" },
  { value: "mix", label: "A bit of everything" },
];

const FEES: Option<FinderFee>[] = [
  { value: "free", label: "No fee, ever" },
  { value: "500", label: "Up to ₹500 a year" },
  { value: "2000", label: "Up to ₹2,000 a year" },
  { value: "5000", label: "Up to ₹5,000 a year" },
  { value: "any", label: "Any fee, if it pays for itself" },
];

const SPENDS: Option<FinderSpend>[] = [
  { value: "lt15", label: "Under ₹15,000" },
  { value: "15-50", label: "₹15,000 – ₹50,000" },
  { value: "50-100", label: "₹50,000 – ₹1 lakh" },
  { value: "100plus", label: "More than ₹1 lakh" },
];

function bandOf(monthly: number | null | undefined): FinderSpend {
  if (!monthly || monthly < 15000) return "lt15";
  if (monthly < 50000) return "15-50";
  if (monthly < 100000) return "50-100";
  return "100plus";
}

type Step = "goal" | "platform" | "fee" | "upi" | "spend";
const STEPS: Step[] = ["goal", "platform", "fee", "upi", "spend"];

// ── Entry tile (top of Explore) ─────────────────────────────────────────────

export function FinderEntry({
  data,
  p,
  accent,
  hasResult,
  onStart,
  onResult,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  hasResult: boolean;
  onStart: () => void;
  onResult: () => void;
}) {
  const { fs } = useSettings();
  const real = data.finder?.realSpending;
  return (
    <Card p={p} style={{ padding: 18, gap: 12, overflow: "hidden" }}>
      <View style={styles.entryArt}>
        {["hdfc-millennia", "axis-atlas", "sbi-cashback"].map((key, i) => {
          const c = data.catalog.find((x) => x.key === key);
          if (!c) return null;
          return (
            <View
              key={key}
              style={[
                styles.entryCard,
                {
                  transform: [{ rotate: `${(i - 1) * 7}deg` }],
                  zIndex: i === 1 ? 2 : 1,
                },
              ]}
            >
              <CardArt
                bank={c.bank}
                name={c.name}
                last4={null}
                image={c.image}
              />
            </View>
          );
        })}
      </View>
      <Text
        accessibilityRole="header"
        style={{ color: p.ink, fontSize: fs(20), fontWeight: "800" }}
      >
        Find your best card
      </Text>
      <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
        Five quick questions. Then we work out what each of{" "}
        {data.catalog.length} cards would pay you in a year, after fees,{" "}
        {real ? "on your own spending." : "on the spending you describe."}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Chip
          label="No sign-up with banks"
          color={accent.accent}
          bg={accent.soft}
          icon="lock"
        />
        <Chip
          label="No bank pays us"
          color={accent.accent}
          bg={accent.soft}
          icon="shield"
        />
        <Chip
          label="1 minute"
          color={accent.accent}
          bg={accent.soft}
          icon="clock"
        />
      </View>
      <PrimaryButton
        p={p}
        label={hasResult ? "Start again" : "Find my card"}
        onPress={onStart}
      />
      {hasResult && (
        <OutlineButton
          p={p}
          label="See my last result"
          onPress={onResult}
          color={accent.accent}
        />
      )}
    </Card>
  );
}

// ── The quiz ────────────────────────────────────────────────────────────────

export function FinderQuiz({
  data,
  initial,
  p,
  accent,
  onDone,
}: {
  data: CardsData;
  initial: FinderAnswers | null;
  p: Palette;
  accent: Accent;
  onDone: (a: FinderAnswers) => Promise<void>;
}) {
  const { fs } = useSettings();
  const real = Boolean(data.finder?.realSpending);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<FinderAnswers>(
    initial ?? {
      goal: "value",
      fee: "2000",
      platform: "mix",
      upi: false,
      spend: bandOf(data.finder?.monthlySpend),
      useMySpending: real,
    },
  );
  const [pickBand, setPickBand] = useState(!real || !a.useMySpending);
  const step = STEPS[i];

  const next = async (patch: Partial<FinderAnswers>) => {
    const merged = { ...a, ...patch };
    setA(merged);
    if (i < STEPS.length - 1) return setI(i + 1);
    setBusy(true);
    await onDone(merged);
    setBusy(false);
  };

  if (busy)
    return (
      <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
        <ActivityIndicator color={accent.accent} />
        <Text style={{ color: p.ink2, fontSize: fs(15), textAlign: "center" }}>
          Working out what {data.catalog.length} cards would pay you…
        </Text>
      </View>
    );

  const q = {
    goal: "What do you want most from a card?",
    platform: "Where do you shop online the most?",
    fee: "How much yearly fee is OK?",
    upi: "Do you want to pay by UPI with this card?",
    spend: "How much do you spend in a month?",
  }[step];
  const hint = {
    goal: "Pick one. We'll still count everything you spend.",
    platform: "Cards pay most on their partner apps.",
    fee: "Fees are counted with 18% GST. Many are waived when you spend enough, and we count that too.",
    upi: "Only RuPay credit cards work on UPI. Saying yes leaves out Visa, Mastercard and Amex cards.",
    spend: real
      ? `From your messages, you spend about ${money(data.finder?.monthlySpend ?? 0)} a month on things a card could pay for.`
      : "Everything you could pay by card or UPI: shopping, food, bills, fuel, travel.",
  }[step];

  return (
    <>
      {/* Progress */}
      <View style={{ gap: 8 }}>
        <View style={[styles.track, { backgroundColor: p.border }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: accent.accent,
                width: `${((i + 1) / STEPS.length) * 100}%`,
              },
            ]}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {i > 0 ? (
            <Pressable
              onPress={() => setI(i - 1)}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: accent.accent,
                  fontWeight: "700",
                  fontSize: fs(13.5),
                }}
              >
                ‹ Back
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={{ color: p.muted, fontSize: fs(13) }}>
            {i + 1} of {STEPS.length}
          </Text>
        </View>
      </View>

      <Text
        accessibilityRole="header"
        style={{
          color: p.ink,
          fontSize: fs(22),
          fontWeight: "800",
          lineHeight: fs(29),
        }}
      >
        {q}
      </Text>
      <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
        {hint}
      </Text>

      <View style={{ gap: 10 }}>
        {step === "goal" &&
          GOALS.map((o) => (
            <Choice
              key={o.value}
              o={o}
              on={a.goal === o.value}
              p={p}
              accent={accent}
              onPress={() => next({ goal: o.value })}
            />
          ))}
        {step === "platform" &&
          PLATFORMS.map((o) => (
            <Choice
              key={o.value}
              o={o}
              on={a.platform === o.value}
              p={p}
              accent={accent}
              onPress={() => next({ platform: o.value })}
            />
          ))}
        {step === "fee" &&
          FEES.map((o) => (
            <Choice
              key={o.value}
              o={o}
              on={a.fee === o.value}
              p={p}
              accent={accent}
              onPress={() => next({ fee: o.value })}
            />
          ))}
        {step === "upi" && (
          <>
            <Choice
              o={{
                value: "yes",
                label: "Yes, I want it on UPI",
                sub: "RuPay credit cards only",
                icon: "smartphone",
              }}
              on={a.upi}
              p={p}
              accent={accent}
              onPress={() => next({ upi: true })}
            />
            <Choice
              o={{
                value: "no",
                label: "Doesn't matter",
                sub: "Show me every card",
                icon: "credit-card",
              }}
              on={!a.upi}
              p={p}
              accent={accent}
              onPress={() => next({ upi: false })}
            />
          </>
        )}
        {step === "spend" &&
          (real && !pickBand ? (
            <>
              <Choice
                o={{
                  value: "real",
                  label: "Use my real spending",
                  sub: "Recommended: every card is scored on what you actually spend, where",
                  icon: "activity",
                }}
                on={a.useMySpending}
                p={p}
                accent={accent}
                onPress={() =>
                  next({
                    useMySpending: true,
                    spend: bandOf(data.finder?.monthlySpend),
                  })
                }
              />
              <Choice
                o={{
                  value: "band",
                  label: "Use a number instead",
                  sub: "If your messages don't show all your spending",
                  icon: "edit-3",
                }}
                on={false}
                p={p}
                accent={accent}
                onPress={() => setPickBand(true)}
              />
            </>
          ) : (
            SPENDS.map((o) => (
              <Choice
                key={o.value}
                o={o}
                on={!a.useMySpending && a.spend === o.value}
                p={p}
                accent={accent}
                onPress={() => next({ spend: o.value, useMySpending: false })}
              />
            ))
          ))}
      </View>
    </>
  );
}

function Choice<T>({
  o,
  on,
  p,
  accent,
  onPress,
}: {
  o: Option<T>;
  on: boolean;
  p: Palette;
  accent: Accent;
  onPress: () => void;
}) {
  const { fs } = useSettings();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={o.sub ? `${o.label}. ${o.sub}` : o.label}
      style={[
        styles.choice,
        {
          backgroundColor: on ? accent.soft : p.surface,
          borderColor: on ? accent.accent : p.border,
        },
      ]}
    >
      {o.icon && (
        <View
          style={[
            styles.choiceIcon,
            { backgroundColor: on ? accent.accent : accent.soft },
          ]}
        >
          <Icon
            name={o.icon}
            size={18}
            color={on ? accent.on : accent.accent}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(15.5) }}>
          {o.label}
        </Text>
        {o.sub && (
          <Text
            style={{ color: p.muted, fontSize: fs(13), lineHeight: fs(18) }}
          >
            {o.sub}
          </Text>
        )}
      </View>
      <Icon
        name="chevron-right"
        size={18}
        color={on ? accent.accent : p.muted}
      />
    </PressableScale>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

const RELAX_TEXT: Record<FinderResult["relaxed"][number], string> = {
  goal: "cards that aren't specially strong at what you picked",
  fee: "cards above your fee limit",
  upi: "cards that don't work on UPI",
};

export function FinderResults({
  result,
  data,
  p,
  accent,
  onOpen,
  onCompare,
  onRedo,
}: {
  result: FinderResult;
  data: CardsData;
  p: Palette;
  accent: Accent;
  onOpen: (key: string) => void;
  onCompare: () => void;
  onRedo: () => void;
}) {
  const { fs } = useSettings();
  const [more, setMore] = useState(false);

  if (result.stressed)
    return (
      <Card p={p} style={{ padding: 18, gap: 10 }}>
        <Icon name="anchor" size={20} color={accent.accent} />
        <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(18) }}>
          Let's make your current cards work first
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
          Your recent messages show a late fee or a minimum-due payment. Paying
          the full bill on time saves more than any new card earns, so Aaj won't
          suggest a new card for now. The Explore tab has the details.
        </Text>
      </Card>
    );

  if (!result.picks.length)
    return (
      <Card p={p} style={{ padding: 18, gap: 12 }}>
        <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(18) }}>
          No card pays for itself here
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
          At this spending, every card that matches your answers would cost more
          in fees than it gives back. Try a wider fee limit, or skip a new card
          for now.
        </Text>
        <OutlineButton
          p={p}
          label="Change my answers"
          onPress={onRedo}
          color={accent.accent}
        />
      </Card>
    );

  const [best, ...rest] = result.picks;
  return (
    <>
      <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
        {result.basis === "real"
          ? `Scored on your real spending: about ${money(result.monthlySpend)} a month, from your last ${data.days} days.`
          : `Scored on the spending you described: about ${money(result.monthlySpend)} a month.`}
      </Text>

      {/* The best match */}
      <View style={[styles.hero, { backgroundColor: p.surface }, elevation(p)]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Chip
            label={
              best.held
                ? "You already have it"
                : best.closestFit
                  ? "Closest match"
                  : "Your best match"
            }
            color={accent.on}
            bg={accent.accent}
            icon={best.held ? "check" : "award"}
          />
        </View>
        <View style={{ paddingHorizontal: 8 }}>
          <CardArt
            bank={best.product.bank}
            name={best.product.name}
            last4={null}
            image={best.product.image}
          />
        </View>
        <View>
          <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(20) }}>
            {best.product.name}
          </Text>
          <Text style={{ color: p.muted, fontSize: fs(13.5) }}>
            {best.product.bank}
          </Text>
        </View>
        <View>
          <Text
            style={{
              color: accent.accent,
              fontWeight: "800",
              fontSize: fs(30),
            }}
          >
            {yearly(best.netYearly)}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(13.5) }}>
            a year back, after fees · about {best.effectiveRate}% of your
            spending
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          {best.fits.slice(0, 4).map((f) => (
            <View
              key={f}
              style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}
            >
              <Icon name="check" size={16} color={p.good} />
              <Text style={{ color: p.ink, fontSize: fs(14), flex: 1 }}>
                {f}
              </Text>
            </View>
          ))}
          {best.wins.length > 0 && (
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}
            >
              <Icon name="trending-up" size={16} color={p.good} />
              <Text style={{ color: p.ink, fontSize: fs(14), flex: 1 }}>
                Earns most on{" "}
                {best.wins
                  .map((w) => `${w.label} (${yearly(w.valueYearly)})`)
                  .join(", ")}
              </Text>
            </View>
          )}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <ChanceChip
            chance={best.eligibility.chance}
            label={CHANCE_LABEL[best.eligibility.chance]}
            p={p}
          />
          <Text style={{ color: p.muted, fontSize: fs(12) }}>
            Approval chance: our guess, not the bank's decision.
          </Text>
        </View>
        <PrimaryButton
          p={p}
          label="Why this card"
          onPress={() => onOpen(best.product.key)}
        />
      </View>

      {result.relaxed.length > 0 && (
        <View style={[styles.note, { backgroundColor: p.warnSoft }]}>
          <Icon name="info" size={14} color={p.warn} />
          <Text
            style={{
              color: p.ink,
              fontSize: fs(13),
              flex: 1,
              lineHeight: fs(18),
            }}
          >
            Too few cards matched every answer, so the list also has{" "}
            {result.relaxed.map((r) => RELAX_TEXT[r]).join(" and ")}. They're
            marked "closest match".
          </Text>
        </View>
      )}

      {rest.length > 0 && (
        <Text
          style={{
            color: p.ink,
            fontWeight: "800",
            fontSize: fs(16),
            marginTop: 4,
          }}
        >
          Also worth a look
        </Text>
      )}
      {rest.map((x, n) => (
        <PickRow
          key={x.product.key}
          rank={n + 2}
          x={x}
          p={p}
          onPress={() => onOpen(x.product.key)}
        />
      ))}

      {result.picks.length > 1 && (
        <OutlineButton
          p={p}
          label={`Compare these ${result.picks.length} side by side`}
          onPress={onCompare}
          color={accent.accent}
        />
      )}

      {result.more.length > 0 &&
        (more ? (
          result.more.map((x, n) => (
            <PickRow
              key={x.product.key}
              rank={n + 2 + rest.length}
              x={x}
              p={p}
              onPress={() => onOpen(x.product.key)}
            />
          ))
        ) : (
          <Pressable
            onPress={() => setMore(true)}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: "center", padding: 6 }}
          >
            <Text
              style={{
                color: accent.accent,
                fontWeight: "700",
                fontSize: fs(14),
              }}
            >
              See {result.more.length} more cards
            </Text>
          </Pressable>
        ))}

      <View style={[styles.note, { backgroundColor: accent.soft }]}>
        <Icon name="shield" size={14} color={accent.accent} />
        <Text
          style={{
            color: p.ink,
            fontSize: fs(13),
            flex: 1,
            lineHeight: fs(18),
          }}
        >
          Ranked only by ₹ a year for you. No bank pays Aaj, and nothing about
          you is sent to a bank. Links open the bank's own page.
        </Text>
      </View>
      <OutlineButton p={p} label="Change my answers" onPress={onRedo} />
    </>
  );
}

function PickRow({
  rank,
  x,
  p,
  onPress,
}: {
  rank: number;
  x: FinderPick;
  p: Palette;
  onPress: () => void;
}) {
  const { fs } = useSettings();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${x.product.name}, ${yearly(x.netYearly)} a year`}
    >
      <View style={[styles.row, { backgroundColor: p.surface }, elevation(p)]}>
        <Text
          style={{
            color: p.muted,
            fontWeight: "800",
            fontSize: fs(15),
            width: 18,
          }}
        >
          {rank}
        </Text>
        <View style={{ width: 84 }}>
          <CardArt
            bank={x.product.bank}
            name={x.product.name}
            last4={null}
            image={x.product.image}
            size="sm"
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{ color: p.ink, fontWeight: "700", fontSize: fs(14.5) }}
          >
            {x.product.name}
          </Text>
          <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
            {x.product.bank}
            {x.held ? " · you have it" : x.closestFit ? " · closest match" : ""}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(15) }}>
              {yearly(x.netYearly)}
            </Text>
            <Text style={{ color: p.muted, fontSize: fs(12) }}>
              a year · {CHANCE_LABEL[x.eligibility.chance]}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={p.muted} />
      </View>
    </PressableScale>
  );
}

// ── One pick, in full ───────────────────────────────────────────────────────

export function PickDetail({
  x,
  p,
  accent,
  onGo,
}: {
  x: FinderPick | null;
  p: Palette;
  accent: Accent;
  onGo: (url: string) => void;
}) {
  const { fs } = useSettings();
  if (!x) return null;
  const prod = x.product;
  const head = (s: string) => (
    <Text
      style={{
        color: p.ink,
        fontWeight: "700",
        fontSize: fs(15),
        marginBottom: 4,
      }}
    >
      {s}
    </Text>
  );
  return (
    <>
      <CardArt
        bank={prod.bank}
        name={prod.name}
        last4={null}
        image={prod.image}
      />
      {prod.pitch && (
        <Text style={{ color: p.ink2, fontSize: fs(14.5), lineHeight: fs(21) }}>
          {prod.pitch}
        </Text>
      )}
      {x.held && (
        <View style={[styles.note, { backgroundColor: accent.soft }]}>
          <Icon name="check-circle" size={14} color={accent.accent} />
          <Text style={{ color: p.ink, fontSize: fs(13.5), flex: 1 }}>
            You already have this card. Keep using it where it earns most; no
            new card needed.
          </Text>
        </View>
      )}

      <Card p={p} style={{ padding: 16, gap: 2 }}>
        {head("What it would pay you in a year")}
        <Row
          p={p}
          left="Rewards on your spending"
          right={`+${money(x.rewardsYearly)}`}
        />
        {x.milestonesYearly > 0 && (
          <Row
            p={p}
            left="Milestone benefits"
            right={`+${money(x.milestonesYearly)}`}
          />
        )}
        <Row
          p={p}
          left={
            x.feeWaived && prod.annualFee > 0
              ? "Annual fee (waived at your spending)"
              : "Annual fee with GST"
          }
          right={x.feeYearly ? `−${money(x.feeYearly)}` : "₹0"}
        />
        <View
          style={{ height: 1, backgroundColor: p.border, marginVertical: 4 }}
        />
        <Row
          p={p}
          strong
          left="You keep"
          right={`${yearly(x.netYearly)} a year`}
        />
        {x.wins.map((w) => (
          <Text key={w.label} style={{ color: p.muted, fontSize: fs(13) }}>
            {w.label}: +{money(w.valueYearly)}
          </Text>
        ))}
      </Card>

      {x.fits.length > 0 && (
        <Card p={p} style={{ padding: 16, gap: 6 }}>
          {head("Why it fits you")}
          {x.fits.map((f) => (
            <View key={f} style={{ flexDirection: "row", gap: 8 }}>
              <Icon name="check" size={16} color={p.good} />
              <Text style={{ color: p.ink2, fontSize: fs(14), flex: 1 }}>
                {f}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {x.watchOuts.length > 0 && (
        <Card p={p} style={{ padding: 16, gap: 6 }}>
          {head("Things to keep in mind")}
          {x.watchOuts.map((w) => (
            <View key={w} style={{ flexDirection: "row", gap: 8 }}>
              <Icon name="alert-circle" size={16} color={p.warn} />
              <Text
                style={{
                  color: p.ink2,
                  fontSize: fs(14),
                  flex: 1,
                  lineHeight: fs(20),
                }}
              >
                {w}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card p={p} style={{ padding: 16, gap: 4 }}>
        {head("How it earns")}
        {prod.rules.map((r) => (
          <Text
            key={r.label}
            style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}
          >
            • {r.label}
            {r.capMonthly != null
              ? ` (up to ${money(r.capMonthly)} a month)`
              : ""}
          </Text>
        ))}
        <Text style={{ color: p.ink2, fontSize: fs(14) }}>
          • {prod.baseRate}% back on other spends
        </Text>
        {prod.loungeDomesticYear || prod.loungeIntlYear ? (
          <Text style={{ color: p.ink2, fontSize: fs(14) }}>
            • Airport lounges: {prod.loungeDomesticYear ?? 0} in India,{" "}
            {prod.loungeIntlYear ?? 0} abroad a year
          </Text>
        ) : null}
        {prod.forexMarkup != null && (
          <Text style={{ color: p.ink2, fontSize: fs(14) }}>
            • {prod.forexMarkup}% on foreign spends
          </Text>
        )}
        <Text style={{ color: p.ink2, fontSize: fs(14) }}>
          • Fees:{" "}
          {prod.joiningFee
            ? `${money(prod.joiningFee)} to join, `
            : "free to join, "}
          {prod.annualFee
            ? `${money(prod.annualFee)} a year + GST`
            : "no annual fee"}
          {prod.feeWaiverSpend
            ? `, waived on ${money(prod.feeWaiverSpend)} a year`
            : ""}
        </Text>
      </Card>

      <Card p={p} style={{ padding: 16, gap: 8 }}>
        {head("Your chance of approval")}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ChanceChip
            chance={x.eligibility.chance}
            label={CHANCE_LABEL[x.eligibility.chance]}
            p={p}
          />
        </View>
        {x.eligibility.reasons.map((r) => (
          <Text key={r} style={{ color: p.muted, fontSize: fs(13) }}>
            • {r}
          </Text>
        ))}
        <Text
          style={{ color: p.muted, fontSize: fs(12.5), lineHeight: fs(18) }}
        >
          A guess from your income and score band, never a pre-approval. Every
          application is a hard check on your credit report, so apply for one
          card at a time.
        </Text>
      </Card>

      <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
        Rules checked on {shortDate(prod.verified)}. Card image and details from{" "}
        {prod.bank}'s website.
      </Text>
      {prod.url && !x.held && (
        <PrimaryButton
          p={p}
          label={`Open ${prod.bank}'s page`}
          onPress={() => onGo(prod.url!)}
        />
      )}
    </>
  );
}

// ── Side by side ────────────────────────────────────────────────────────────

export function CompareScreen({
  picks,
  p,
  accent,
  onOpen,
}: {
  picks: FinderPick[];
  p: Palette;
  accent: Accent;
  onOpen: (key: string) => void;
}) {
  const { fs } = useSettings();
  const best = Math.max(...picks.map((x) => x.netYearly));
  const rows: Array<
    [string, (x: FinderPick) => string, ((x: FinderPick) => boolean)?]
  > = [
    [
      "You keep a year",
      (x) => yearly(x.netYearly),
      (x) => x.netYearly === best,
    ],
    ["Rewards", (x) => money(x.rewardsYearly)],
    [
      "Milestones",
      (x) => (x.milestonesYearly ? money(x.milestonesYearly) : "—"),
    ],
    [
      "Fee with GST",
      (x) =>
        x.feeYearly
          ? money(x.feeYearly)
          : x.product.annualFee
            ? "Waived"
            : "Free",
    ],
    ["Back on spending", (x) => `${x.effectiveRate}%`],
    ["Works on UPI", (x) => (x.product.upi ? "Yes" : "No")],
    [
      "Airport lounges",
      (x) => {
        const n =
          (x.product.loungeDomesticYear ?? 0) + (x.product.loungeIntlYear ?? 0);
        return n >= 50 ? "50+" : n ? `${n} a year` : "None";
      },
    ],
    [
      "Forex markup",
      (x) =>
        x.product.forexMarkup != null ? `${x.product.forexMarkup}%` : "—",
    ],
    ["Approval", (x) => CHANCE_LABEL[x.eligibility.chance]],
    ["Earns most on", (x) => x.wins[0]?.label ?? "—"],
  ];
  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {picks.map((x) => (
          <Pressable
            key={x.product.key}
            onPress={() => onOpen(x.product.key)}
            style={{ flex: 1, gap: 6 }}
            accessibilityRole="button"
          >
            <CardArt
              bank={x.product.bank}
              name={x.product.name}
              last4={null}
              image={x.product.image}
            />
            <Text
              numberOfLines={2}
              style={{ color: p.ink, fontWeight: "700", fontSize: fs(13) }}
            >
              {x.product.name}
            </Text>
            <Text style={{ color: p.muted, fontSize: fs(11.5) }}>
              {x.product.bank}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card p={p} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
        {rows.map(([label, value, win], n) => (
          <View
            key={label}
            style={[
              styles.cmpRow,
              n > 0 && {
                borderTopColor: p.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text
              style={{
                color: p.muted,
                fontSize: fs(12),
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              {label}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {picks.map((x) => {
                const on = win?.(x);
                return (
                  <Text
                    key={x.product.key}
                    style={{
                      flex: 1,
                      color: on ? accent.accent : p.ink,
                      fontWeight: on ? "800" : "600",
                      fontSize: fs(14),
                    }}
                  >
                    {value(x)}
                  </Text>
                );
              })}
            </View>
          </View>
        ))}
      </Card>
      <Text style={{ color: p.muted, fontSize: fs(12.5), lineHeight: fs(18) }}>
        Yearly figures are estimates from the same spending for every card. Tap
        a card for the full picture.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  entryArt: {
    height: 120,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  entryCard: { width: 132, marginHorizontal: -22 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 60,
  },
  choiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { borderRadius: 20, padding: 16, gap: 12 },
  note: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
  },
  cmpRow: { paddingVertical: 9 },
});
