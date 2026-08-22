import { useMemo } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { ApiData, BOT_URL } from "../lib/api";
import { useSettings } from "../lib/i18n";
import { settleUp } from "../lib/settle";
import { formatINR, memberColor, Palette } from "../lib/theme";
import { Avatar, Card, SectionTitle, TrackBar } from "./ui";

interface Props {
  p: Palette;
  dark: boolean;
  data: ApiData;
  memberName: Map<number, string>;
}

export default function FamilyTab({ p, dark, data, memberName }: Props) {
  const { t, fs } = useSettings();
  const monthPrefix = data.today.slice(0, 7);

  const totals = useMemo(() => {
    const byMember = new Map<number, number>();
    let spent = 0;
    let invested = 0;
    for (const e of data.expenses) {
      if (!e.expense_date.startsWith(monthPrefix) || e.user_id === null) continue;
      if (e.category === "Investments") {
        invested += Number(e.amount);
      } else {
        spent += Number(e.amount);
        byMember.set(e.user_id, (byMember.get(e.user_id) ?? 0) + Number(e.amount));
      }
    }
    return { byMember, spent, invested };
  }, [data.expenses, monthPrefix]);

  if (!data.family) {
    return (
      <Card p={p}>
        <SectionTitle p={p}>Start a family</SectionTitle>
        <Text style={[styles.prose, { color: p.ink2 }]}>
          Track everyone&apos;s spending together — each member logs their own expenses with the
          bot, and the family view rolls it all up.
        </Text>
        <Text style={[styles.prose, { color: p.ink2 }]}>
          1. Open the bot and send{" "}
          <Text style={{ fontWeight: "700" }}>/family create Sharma Family</Text>
          {"\n"}2. Forward the invite link to your family group{"\n"}3. One tap and they&apos;re in
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: p.accent }]} onPress={() => Linking.openURL(BOT_URL)}>
          <Text style={styles.btnText}>Open the Telegram bot</Text>
        </Pressable>
      </Card>
    );
  }

  const inviteUrl = `${BOT_URL}?start=fam_${data.family.invite_code}`;
  const maxMember = Math.max(1, ...data.family.members.map((m) => totals.byMember.get(m.id) ?? 0));
  const balances = settleUp(data.expenses);
  const hasSplits = data.expenses.some((e) => e.split_id);

  return (
    <View style={{ gap: 14 }}>
      {hasSplits && (
        <Card p={p}>
          <SectionTitle p={p}>🤝 {t("settleUp")}</SectionTitle>
          {balances.length === 0 ? (
            <Text style={{ fontSize: fs(14), color: p.ink2 }}>{t("allSettled")}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {balances.map((b) => (
                <View key={`${b.from}-${b.to}`} style={styles.settleRow}>
                  <Text style={{ fontSize: fs(14), color: p.ink, flex: 1 }}>
                    {b.from === data.user.id ? "You" : (memberName.get(b.from) ?? `User ${b.from}`)}{" "}
                    {t("owes")}{" "}
                    <Text style={{ fontWeight: "600" }}>
                      {b.to === data.user.id ? "you" : (memberName.get(b.to) ?? `User ${b.to}`)}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: fs(14.5), fontWeight: "700", color: b.to === data.user.id ? p.good : p.ink }}>
                    {formatINR(b.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}
      <Card p={p}>
        <Text style={{ fontSize: 13, color: p.ink2 }}>👨‍👩‍👧 {data.family.name} · this month</Text>
        <Text style={[styles.hero, { color: p.ink }]}>{formatINR(totals.spent)}</Text>
        <View style={styles.heroSub}>
          <Text style={{ fontSize: 13, color: p.ink2 }}>Invested: {formatINR(totals.invested)}</Text>
          <Text style={{ fontSize: 13, color: p.ink2 }}>{data.family.members.length} members</Text>
        </View>
      </Card>

      <Card p={p}>
        <SectionTitle p={p}>Members</SectionTitle>
        <View style={{ gap: 14 }}>
          {data.family.members.map((m, i) => {
            const spent = totals.byMember.get(m.id) ?? 0;
            return (
              <View key={m.id} style={styles.memberRow}>
                <Avatar color={memberColor(i, dark)} label={m.name.slice(0, 1).toUpperCase()} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: p.ink }}>
                      {m.id === data.user.id ? `${m.name} (you)` : m.name}
                    </Text>
                    {i === 0 && (
                      <Text style={[styles.badge, { color: p.accent, backgroundColor: p.accentSoft }]}>OWNER</Text>
                    )}
                  </View>
                  <TrackBar p={p} fraction={spent / maxMember} color={memberColor(i, dark)} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: p.ink }}>{formatINR(spent)}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card p={p}>
        <SectionTitle p={p}>Add a member</SectionTitle>
        <Text style={[styles.prose, { color: p.ink2 }]}>
          Share this link — one tap in Telegram and they&apos;re part of {data.family.name}.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: p.accent }]}
          onPress={() =>
            Share.share({
              message: `Join our family expense tracker "${data.family!.name}" — tap, press Start, and log your first expense: ${inviteUrl}`,
            })
          }
        >
          <Text style={styles.btnText}>Share invite link</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  prose: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  hero: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5, marginTop: 4 },
  heroSub: { flexDirection: "row", columnGap: 16, marginTop: 10 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  settleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { fontSize: 10, fontWeight: "700", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
