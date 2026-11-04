import { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { Text } from "../Text";
import { Card, Icon, PrimaryButton, type IconName } from "../ui";
import { type Palette } from "../../lib/theme";
import { useSettings } from "../../lib/i18n";
import type {
  Bureau,
  CardsData,
  FreeSource,
  LatestScore,
  ScoreEntry,
  ScoreFactor,
} from "../../lib/cards-api";
import { Chip, OutlineButton, Sheet, cardsAccent, shortDate } from "./parts";

/**
 * Credit score (v22) — see it, save it, track it, understand it.
 *
 * Google Pay, PhonePe, Paytm and CRED show your score because each has a
 * signed bureau agreement; under the RBI's 2025 CIC Directions an app that
 * isn't a lender needs that contract (and a yearly audit) to pull a report.
 * Aaj doesn't pull anything. It opens the free checks in one tap, keeps the
 * number you saw, charts it, sets the card finder's approval band from it,
 * and explains what moves it using what Aaj sees in your messages.
 */

type Accent = ReturnType<typeof cardsAccent>;

const MIN = 300;
const MAX = 900;

function toneColor(p: Palette, score: number): string {
  if (score >= 750) return p.good;
  if (score >= 700) return p.accent;
  if (score >= 650) return p.warn;
  return p.danger;
}

function ageText(days: number): string {
  if (days === 0) return "checked today";
  if (days === 1) return "checked yesterday";
  if (days < 45) return `checked ${days} days ago`;
  return `checked ${Math.round(days / 30)} months ago`;
}

/** Open the app (Android), else its Play Store page, else the web page. */
export async function openSource(src: FreeSource): Promise<void> {
  if (Platform.OS === "android" && src.androidPackage) {
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        packageName: src.androidPackage,
        category: "android.intent.category.LAUNCHER",
      });
      return;
    } catch {
      try {
        await Linking.openURL(`market://details?id=${src.androidPackage}`);
        return;
      } catch {
        // No Play Store: fall through to the web page.
      }
    }
  }
  await Linking.openURL(src.url).catch(() => {});
}

// ── The tile on My cards ────────────────────────────────────────────────────

export function ScoreTile({
  data,
  p,
  accent,
  onOpen,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  onOpen: () => void;
}) {
  const { fs } = useSettings();
  const cur = data.score?.summary.current ?? null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        cur
          ? `Credit score ${cur.score}. Open credit score`
          : "Check your credit score"
      }
    >
      <Card
        p={p}
        style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
      >
        <View style={[s.badge, { backgroundColor: accent.soft }]}>
          {cur ? (
            <Text
              style={{
                color: toneColor(p, cur.score),
                fontSize: fs(19),
                fontWeight: "800",
              }}
            >
              {cur.score}
            </Text>
          ) : (
            <Icon name="activity" size={22} color={accent.accent} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: p.ink, fontSize: fs(15.5), fontWeight: "700" }}>
            {cur
              ? `Credit score · ${data.score?.rating?.label ?? ""}`
              : "Check your credit score"}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(13) }}>
            {cur
              ? `${data.score?.bureaus[cur.bureau] ?? ""}, ${ageText(cur.ageDays)}${data.score?.summary.refreshDue ? " · time to refresh" : ""}`
              : "Free on Google Pay, Paytm or PhonePe. Save it here to track it."}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={p.muted} />
      </Card>
    </Pressable>
  );
}

// ── The screen ──────────────────────────────────────────────────────────────

export function ScoreScreen({
  data,
  p,
  accent,
  onSave,
  onRemove,
}: {
  data: CardsData;
  p: Palette;
  accent: Accent;
  onSave: (entry: {
    score: number;
    bureau: Bureau;
    via: string | null;
  }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const { fs } = useSettings();
  const view = data.score;
  const [adding, setAdding] = useState(false);
  const [fromSource, setFromSource] = useState<FreeSource | null>(null);
  if (!view) return null;
  const cur = view.summary.current;

  return (
    <View style={{ gap: 14 }}>
      {/* The number */}
      <Card p={p} style={{ gap: 12, alignItems: "stretch" }}>
        {cur ? (
          <>
            <ScoreGauge latest={cur} p={p} label={view.rating?.label ?? ""} />
            <Text
              style={{ color: p.ink2, fontSize: fs(13.5), textAlign: "center" }}
            >
              {view.bureaus[cur.bureau]} · {ageText(cur.ageDays)}
              {cur.change != null && cur.change !== 0
                ? ` · ${cur.change > 0 ? "up" : "down"} ${Math.abs(cur.change)} since last time`
                : ""}
            </Text>
            {view.summary.latest.length > 1 && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  justifyContent: "center",
                }}
              >
                {view.summary.latest.slice(1).map((l) => (
                  <Chip
                    key={l.bureau}
                    label={`${view.bureaus[l.bureau]} ${l.score}`}
                    color={p.ink2}
                    bg={p.grid}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ gap: 6, paddingVertical: 6 }}>
            <Text style={{ color: p.ink, fontSize: fs(19), fontWeight: "800" }}>
              Know your credit score
            </Text>
            <Text
              style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}
            >
              Check it free in an app you already have, then save it here. Aaj
              tracks it month to month and uses it for your card approval
              chances.
            </Text>
          </View>
        )}
        <PrimaryButton
          p={p}
          label={cur ? "Save a new score" : "I have my score, save it"}
          onPress={() => {
            setFromSource(null);
            setAdding(true);
          }}
        />
      </Card>

      {/* Where to check, free */}
      <Text
        style={[s.section, { color: p.ink, fontSize: fs(16) }]}
        accessibilityRole="header"
      >
        Check for free
      </Text>
      <Card p={p} style={{ gap: 0, paddingVertical: 4 }}>
        {view.sources.map((src, i) => (
          <SourceRow
            key={src.key}
            src={src}
            p={p}
            accent={accent}
            bureau={view.bureaus[src.bureau]}
            last={i === view.sources.length - 1}
            onOpen={async () => {
              await openSource(src);
              // When they come back with the number, the form is ready.
              setFromSource(src);
              setAdding(true);
            }}
          />
        ))}
      </Card>
      <Text style={{ color: p.muted, fontSize: fs(12), lineHeight: fs(17) }}>
        Checking your own score is a soft enquiry: it never lowers it. Each
        bureau also gives everyone one full report free every year (RBI rule).
      </Text>

      {/* What moves it */}
      <Text
        style={[s.section, { color: p.ink, fontSize: fs(16) }]}
        accessibilityRole="header"
      >
        What moves your score
      </Text>
      {view.factors.map((f) => (
        <FactorCard key={f.key} f={f} p={p} />
      ))}

      {/* History */}
      {view.summary.history.length > 0 && (
        <>
          <Text
            style={[s.section, { color: p.ink, fontSize: fs(16) }]}
            accessibilityRole="header"
          >
            Your scores
          </Text>
          <History
            rows={view.summary.history}
            bureaus={view.bureaus}
            p={p}
            accent={accent}
            onRemove={onRemove}
          />
        </>
      )}

      <Text style={{ color: p.muted, fontSize: fs(12), lineHeight: fs(17) }}>
        Aaj doesn't pull your credit report or share anything with a bureau or
        bank. The scores here are the ones you saved.
      </Text>

      <SaveScoreSheet
        visible={adding}
        p={p}
        accent={accent}
        bureaus={view.bureaus}
        source={fromSource}
        onClose={() => setAdding(false)}
        onSave={async (e) => {
          const ok = await onSave(e);
          if (ok) setAdding(false);
          return ok;
        }}
      />
    </View>
  );
}

function ScoreGauge({
  latest,
  p,
  label,
}: {
  latest: LatestScore;
  p: Palette;
  label: string;
}) {
  const { fs } = useSettings();
  const pct = (latest.score - MIN) / (MAX - MIN);
  const color = toneColor(p, latest.score);
  return (
    <View style={{ alignItems: "center", gap: 10, paddingTop: 6 }}>
      <Text
        style={{
          color,
          fontSize: fs(52),
          fontWeight: "800",
          letterSpacing: -1,
        }}
        accessibilityLabel={`Score ${latest.score}, ${label}`}
      >
        {latest.score}
      </Text>
      <Text style={{ color, fontSize: fs(15), fontWeight: "700" }}>
        {label}
      </Text>
      <View style={[s.track, { backgroundColor: p.grid }]}>
        {/* Bands at the lenders' cut-offs: 650, 700, 750. */}
        {[650, 700, 750].map((cut) => (
          <View
            key={cut}
            style={[
              s.tick,
              {
                left: `${((cut - MIN) / (MAX - MIN)) * 100}%`,
                backgroundColor: p.page,
              },
            ]}
          />
        ))}
        <View
          style={[
            s.fill,
            { width: `${Math.max(3, pct * 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignSelf: "stretch",
        }}
      >
        <Text style={{ color: p.muted, fontSize: fs(11) }}>300</Text>
        <Text style={{ color: p.muted, fontSize: fs(11) }}>650</Text>
        <Text style={{ color: p.muted, fontSize: fs(11) }}>750</Text>
        <Text style={{ color: p.muted, fontSize: fs(11) }}>900</Text>
      </View>
    </View>
  );
}

function SourceRow({
  src,
  p,
  accent,
  bureau,
  last,
  onOpen,
}: {
  src: FreeSource;
  p: Palette;
  accent: Accent;
  bureau: string;
  last: boolean;
  onOpen: () => void;
}) {
  const { fs } = useSettings();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${src.name}`}
      style={({ pressed }) => [
        s.sourceRow,
        {
          borderBottomColor: p.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: p.ink, fontSize: fs(14.5), fontWeight: "700" }}>
          {src.name}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(12.5), lineHeight: fs(17) }}>
          {bureau} ·{" "}
          {src.refresh === "monthly"
            ? "free, refreshed monthly"
            : "free once a year"}
        </Text>
        <Text style={{ color: p.muted, fontSize: fs(12), lineHeight: fs(17) }}>
          {src.how}
        </Text>
      </View>
      <Icon
        name={src.androidPackage ? "external-link" : "globe"}
        size={18}
        color={accent.accent}
      />
    </Pressable>
  );
}

function FactorCard({ f, p }: { f: ScoreFactor; p: Palette }) {
  const { fs } = useSettings();
  const meta: Record<
    ScoreFactor["status"],
    { icon: IconName; color: string; label: string }
  > = {
    good: { icon: "check-circle", color: p.good, label: "Looks fine" },
    watch: { icon: "alert-circle", color: p.warn, label: "Watch this" },
    risk: {
      icon: "alert-triangle",
      color: p.danger,
      label: "Hurting your score",
    },
    unknown: { icon: "info", color: p.muted, label: "Aaj can't see this" },
  };
  const m = meta[f.status];
  return (
    <Card p={p} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={m.icon} size={16} color={m.color} />
        <Text
          style={{
            color: p.ink,
            fontSize: fs(14.5),
            fontWeight: "700",
            flex: 1,
          }}
        >
          {f.title}
        </Text>
        <Text style={{ color: p.muted, fontSize: fs(11.5), fontWeight: "600" }}>
          {f.weight === "high"
            ? "Big effect"
            : f.weight === "medium"
              ? "Some effect"
              : "Small effect"}
        </Text>
      </View>
      <Text style={{ color: m.color, fontSize: fs(12), fontWeight: "700" }}>
        {m.label}
      </Text>
      <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: fs(19) }}>
        {f.text}
      </Text>
    </Card>
  );
}

function History({
  rows,
  bureaus,
  p,
  accent,
  onRemove,
}: {
  rows: ScoreEntry[];
  bureaus: Record<Bureau, string>;
  p: Palette;
  accent: Accent;
  onRemove: (id: string) => void;
}) {
  const { fs } = useSettings();
  const recent = rows.slice(-12);
  const lo = Math.min(...recent.map((r) => r.score)) - 20;
  const hi = Math.max(...recent.map((r) => r.score)) + 20;
  return (
    <Card p={p} style={{ gap: 12 }}>
      {/* A bar per saved score, oldest to newest. */}
      <View style={s.bars} accessibilityLabel="Your saved scores over time">
        {recent.map((r) => (
          <View key={r.id} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Text
              style={{ color: p.ink2, fontSize: fs(10.5), fontWeight: "700" }}
            >
              {r.score}
            </Text>
            <View
              style={{
                width: "70%",
                height: 8 + ((r.score - lo) / Math.max(1, hi - lo)) * 72,
                borderRadius: 6,
                backgroundColor: toneColor(p, r.score),
              }}
            />
          </View>
        ))}
      </View>
      {[...rows].reverse().map((r) => (
        <View
          key={r.id}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Text
            style={{
              color: p.ink,
              fontSize: fs(14),
              fontWeight: "700",
              width: 44,
            }}
          >
            {r.score}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(13), flex: 1 }}>
            {bureaus[r.bureau]} · {shortDate(r.checked_on)}
          </Text>
          <Pressable
            onPress={() => onRemove(r.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Delete the ${r.score} score from ${shortDate(r.checked_on)}`}
          >
            <Icon name="trash-2" size={16} color={accent.accent} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

// ── Saving a score ──────────────────────────────────────────────────────────

const BUREAU_ORDER: Bureau[] = ["cibil", "experian", "crif", "equifax"];

function SaveScoreSheet({
  visible,
  p,
  accent,
  bureaus,
  source,
  onClose,
  onSave,
}: {
  visible: boolean;
  p: Palette;
  accent: Accent;
  bureaus: Record<Bureau, string>;
  source: FreeSource | null;
  onClose: () => void;
  onSave: (e: {
    score: number;
    bureau: Bureau;
    via: string | null;
  }) => Promise<boolean>;
}) {
  const { fs } = useSettings();
  const [text, setText] = useState("");
  const [bureau, setBureau] = useState<Bureau | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = bureau ?? source?.bureau ?? "cibil";
  const n = Number(text);
  const valid = /^\d{3}$/.test(text) && n >= MIN && n <= MAX;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const ok = await onSave({
      score: n,
      bureau: chosen,
      via: source ? source.key : null,
    });
    setBusy(false);
    if (ok) {
      setText("");
      setBureau(null);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      p={p}
      title="Save your score"
      footer={
        <PrimaryButton
          p={p}
          label={busy ? "Saving…" : "Save"}
          onPress={save}
          disabled={!valid || busy}
        />
      }
    >
      <View style={{ gap: 14 }}>
        {source && (
          <Text
            style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: fs(19) }}
          >
            Saw it on {source.name}? Type the number here.
          </Text>
        )}
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.replace(/\D/g, "").slice(0, 3))}
          keyboardType="number-pad"
          placeholder="e.g. 762"
          placeholderTextColor={p.muted}
          accessibilityLabel="Your credit score, 300 to 900"
          style={[
            s.input,
            {
              color: p.ink,
              borderColor: valid || !text ? p.border : p.warn,
              fontSize: fs(28),
            },
          ]}
          maxLength={3}
        />
        {!!text && !valid && (
          <Text style={{ color: p.warn, fontSize: fs(12.5) }}>
            Scores in India run from 300 to 900.
          </Text>
        )}
        <Text style={{ color: p.ink, fontSize: fs(14), fontWeight: "700" }}>
          Which bureau?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {BUREAU_ORDER.map((b) => {
            const on = chosen === b;
            return (
              <Pressable
                key={b}
                onPress={() => setBureau(b)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  s.pill,
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
                  {bureaus[b]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: p.muted, fontSize: fs(12), lineHeight: fs(17) }}>
          Google Pay and Paytm show CIBIL. PhonePe and CRED usually show
          Experian. The app names the bureau next to the score.
        </Text>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontWeight: "800", marginTop: 6 },
  track: {
    height: 10,
    borderRadius: 5,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5 },
  tick: { position: "absolute", top: 0, bottom: 0, width: 2, zIndex: 2 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
});
