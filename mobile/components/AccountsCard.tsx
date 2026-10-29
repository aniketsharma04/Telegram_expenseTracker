import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Account, Position } from "../lib/api";
import { formatINR, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { Card, SectionTitle } from "./ui";
import { ACCOUNT_KIND_ICON } from "../lib/categories";
import { IconBubble } from "./ui";

/**
 * The first screen in the app that answers "where do I stand?" rather than
 * "what did I spend?". Net position on top, then every pocket with its own
 * balance — cards shown as what you owe rather than as a negative asset.
 */

interface Props {
  p: Palette;
  accounts: Account[];
  position: Position | undefined;
  onAdd: () => void;
  onEdit: (account: Account) => void;
  onTransfer: () => void;
}

export default function AccountsCard({
  p,
  accounts,
  position,
  onAdd,
  onEdit,
  onTransfer,
}: Props) {
  const { t, fs } = useSettings();
  const live = accounts.filter((a) => !a.archived);
  const kindLabel: Record<Account["kind"], string> = {
    bank: t("bank"),
    cash: t("cash"),
    wallet: t("wallet"),
    credit_card: t("creditCard"),
  };

  if (!live.length) {
    return (
      <Card p={p}>
        <SectionTitle p={p}>{t("accounts")}</SectionTitle>
        <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: fs(20) }}>
          {t("noAccountsYet")}
        </Text>
        <Pressable
          onPress={onAdd}
          style={[styles.primaryBtn, { backgroundColor: p.accent }]}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}>
            + {t("addAccount")}
          </Text>
        </Pressable>
      </Card>
    );
  }

  const net = position?.net ?? 0;
  const unassigned = position?.unassigned.expenses ?? 0;
  // v9: accounts where the bank's own balance disagrees with our rows.
  const drifting = live.filter(
    (a) => a.drift != null && Math.abs(a.drift) >= 1,
  );

  return (
    <Card p={p}>
      <View style={styles.headRow}>
        <SectionTitle p={p}>{t("accounts")}</SectionTitle>
        <Pressable onPress={onTransfer} hitSlop={8}>
          <Text
            style={{ color: p.accent, fontWeight: "600", fontSize: fs(13) }}
          >
            ⇄ {t("transfer")}
          </Text>
        </Pressable>
      </View>

      <Text style={{ color: p.muted, fontSize: fs(12) }}>{t("netWorth")}</Text>
      <Text
        style={{
          color: net < 0 ? p.danger : p.ink,
          fontSize: fs(30),
          fontWeight: "700",
          marginTop: 2,
        }}
      >
        {formatINR(net)}
      </Text>

      <View style={styles.splitRow}>
        <View style={styles.splitCell}>
          <Text style={{ color: p.muted, fontSize: fs(11.5) }}>
            {t("youHold")}
          </Text>
          <Text style={{ color: p.ink, fontSize: fs(15), fontWeight: "600" }}>
            {formatINR(position?.assets ?? 0)}
          </Text>
        </View>
        <View style={[styles.splitDivider, { backgroundColor: p.grid }]} />
        <View style={styles.splitCell}>
          <Text style={{ color: p.muted, fontSize: fs(11.5) }}>
            {t("youOwe")}
          </Text>
          <Text
            style={{
              color: (position?.liabilities ?? 0) > 0 ? p.danger : p.ink,
              fontSize: fs(15),
              fontWeight: "600",
            }}
          >
            {formatINR(position?.liabilities ?? 0)}
          </Text>
        </View>
      </View>

      <View style={[styles.list, { borderTopColor: p.grid }]}>
        {live.map((a) => {
          const owed = a.kind === "credit_card";
          const shown = owed ? (a.outstanding ?? 0) : a.balance;
          return (
            <Pressable key={a.id} onPress={() => onEdit(a)} style={styles.row}>
              <IconBubble
                name={ACCOUNT_KIND_ICON[a.kind] ?? "briefcase"}
                color={p.accent}
                bg={p.accentSoft}
                size={36}
              />
              <View style={styles.rowMain}>
                <View style={styles.rowTitle}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: p.ink,
                      fontSize: fs(14.5),
                      fontWeight: "600",
                    }}
                  >
                    {a.name}
                  </Text>
                  {a.is_default && (
                    <Text
                      style={[
                        styles.badge,
                        {
                          color: p.accent,
                          backgroundColor: p.accentSoft,
                          fontSize: fs(10),
                        },
                      ]}
                    >
                      {t("defaultAccount")}
                    </Text>
                  )}
                </View>
                <Text style={{ color: p.muted, fontSize: fs(11.5) }}>
                  {kindLabel[a.kind]}
                  {a.identifier ? ` · ${a.identifier}` : ""}
                  {owed && a.available != null
                    ? ` · ${formatINR(a.available)} ${t("available")}`
                    : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color:
                      owed && shown > 0
                        ? p.danger
                        : shown < 0
                          ? p.danger
                          : p.ink,
                    fontSize: fs(14.5),
                    fontWeight: "600",
                  }}
                >
                  {formatINR(shown)}
                </Text>
                {/* v9: what the bank itself last told us, when it disagrees. */}
                {a.drift != null && Math.abs(a.drift) >= 1 && (
                  <Text style={{ color: p.muted, fontSize: fs(10.5) }}>
                    {t("bankSays")} {formatINR(a.reported_balance ?? 0)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {drifting.length > 0 && (
        <Text style={{ color: "#b0740f", fontSize: fs(11.5), marginTop: 10 }}>
          {formatINR(
            Math.abs(drifting.reduce((sum, a) => sum + (a.drift ?? 0), 0)),
          )}{" "}
          {t("checkDrift")}
        </Text>
      )}

      {unassigned > 0 && (
        <Text style={{ color: p.muted, fontSize: fs(11.5), marginTop: 10 }}>
          {formatINR(unassigned)} {t("unassignedNote")}
        </Text>
      )}

      <Pressable
        onPress={onAdd}
        style={[styles.ghostBtn, { borderColor: p.border }]}
      >
        <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(13.5) }}>
          + {t("addAccount")}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 14,
  },
  splitCell: { flex: 1, gap: 2 },
  splitDivider: { width: 1, alignSelf: "stretch" },
  list: { marginTop: 16, borderTopWidth: 1, paddingTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  ghostBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
});
