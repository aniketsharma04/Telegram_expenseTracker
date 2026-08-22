import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AddExpenseSheet from "./components/AddExpenseSheet";
import FamilyTab from "./components/FamilyTab";
import HomeTab, { RANGE_LABELS, RangeKey } from "./components/HomeTab";
import LoginScreen from "./components/LoginScreen";
import TransactionsTab from "./components/TransactionsTab";
import { Avatar } from "./components/ui";
import { ApiData, Expense, fetchData } from "./lib/api";
import { memberColor, usePalette } from "./lib/theme";

type Tab = "home" | "transactions" | "family";
type Scope = "personal" | "family";

const TOKEN_KEY = "et_token";
const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "transactions", label: "Transactions", icon: "≡" },
  { key: "family", label: "Family", icon: "⚭" },
];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const { p, dark } = usePalette();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<ApiData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [scope, setScope] = useState<Scope>("personal");
  const [member, setMember] = useState<number | "all">("all");
  const [range, setRange] = useState<RangeKey>("month");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((t) => setToken(t));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const result = await fetchData(token);
      if (result === "unauthorized") {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setData(null);
        return;
      }
      setData(result);
    } catch {
      // offline / transient — keep last data
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [token, refresh]);

  const login = useCallback(async (code: string): Promise<string | null> => {
    try {
      const result = await fetchData(code);
      if (result === "unauthorized") return "That code isn't valid (or expired) — send /app to the bot for a fresh one.";
      await AsyncStorage.setItem(TOKEN_KEY, code);
      setData(result);
      setToken(code);
      return null;
    } catch {
      return "Couldn't reach the server — check your connection and try again.";
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setData(null);
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const members = data.family?.members ?? [];
    const memberName = new Map<number, string>(members.map((m) => [m.id, m.name]));
    const memberIndex = new Map<number, number>(members.map((m, i) => [m.id, i]));
    if (!memberName.has(data.user.id)) {
      memberName.set(data.user.id, data.user.name);
      memberIndex.set(data.user.id, 0);
    }

    const activeIds =
      scope === "family" && data.family
        ? member === "all"
          ? members.map((m) => m.id)
          : [member]
        : [data.user.id];
    const idSet = new Set(activeIds);
    const scoped = data.expenses.filter((e) => e.user_id !== null && idSet.has(e.user_id));

    const rangeStart = range === "month" ? `${data.today.slice(0, 7)}-01` : shiftDate(data.today, range === "30d" ? 29 : 89);
    const inRange = scoped.filter((e) => e.expense_date >= rangeStart && e.expense_date <= data.today);

    let prev: Expense[];
    let prevLabel: string;
    if (range === "month") {
      const [y, m] = data.today.slice(0, 7).split("-").map(Number);
      const prevPrefix = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      prev = scoped.filter((e) => e.expense_date.startsWith(prevPrefix));
      prevLabel = "last month";
    } else {
      const days = range === "30d" ? 30 : 90;
      prev = scoped.filter(
        (e) => e.expense_date >= shiftDate(data.today, days * 2 - 1) && e.expense_date < rangeStart
      );
      prevLabel = `previous ${days} days`;
    }

    const colorByCategory: Record<string, string> = {};
    for (const c of data.categories) colorByCategory[c.name] = c.color ?? "#898781";

    return { members, memberName, memberIndex, inRange, prev, prevLabel, colorByCategory };
  }, [data, scope, member, range]);

  if (token === undefined) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: p.page }]}>
        <ActivityIndicator color={p.accent} />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style={dark ? "light" : "dark"} />
        <LoginScreen onLogin={login} />
      </>
    );
  }

  if (!data || !derived) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: p.page }]}>
        <ActivityIndicator color={p.accent} />
        <Text style={{ color: p.muted, marginTop: 12 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const hasFamily = Boolean(data.family);
  const showChips = hasFamily && scope === "family";
  const scopeLabel =
    scope === "family"
      ? member === "all"
        ? data.family!.name
        : derived.memberName.get(member as number) ?? ""
      : "Personal";

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.page }]}>
      <StatusBar style={dark ? "light" : "dark"} />

      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: p.accent }]}>
            <Text style={styles.markText}>₹</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: p.ink }}>Expense Tracker</Text>
        </View>
        <Pressable onPress={logout} style={[styles.logout, { borderColor: p.border, backgroundColor: p.surface }]}>
          <Text style={{ fontSize: 12, color: p.ink2 }}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={p.accent}
          />
        }
      >
        {hasFamily && (
          <View style={styles.scopeRow}>
            <View style={[styles.seg, { backgroundColor: p.surface, borderColor: p.border }]}>
              {(["personal", "family"] as Scope[]).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.segBtn, scope === s && { backgroundColor: p.accent }]}
                  onPress={() => {
                    setScope(s);
                    setMember("all");
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: scope === s ? "600" : "400", color: scope === s ? "#fff" : p.ink2 }}>
                    {s === "personal" ? "Personal" : "Family"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showChips && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => setMember("all")}
              style={[
                styles.chip,
                { borderColor: member === "all" ? p.accent : p.border, backgroundColor: member === "all" ? p.accentSoft : p.surface },
              ]}
            >
              <Text style={{ fontSize: 13, color: p.ink }}>👨‍👩‍👧 {data.family!.name}</Text>
            </Pressable>
            {derived.members.map((m, i) => {
              const active = member === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMember(m.id)}
                  style={[
                    styles.chip,
                    { borderColor: active ? p.accent : p.border, backgroundColor: active ? p.accentSoft : p.surface },
                  ]}
                >
                  <Avatar color={memberColor(i, dark)} label={m.name.slice(0, 1).toUpperCase()} size={22} />
                  <Text style={{ fontSize: 13, color: active ? p.ink : p.ink2, fontWeight: active ? "600" : "400" }}>
                    {m.id === data.user.id ? "You" : m.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {tab === "home" && (
          <HomeTab
            p={p}
            dark={dark}
            inRange={derived.inRange}
            prev={derived.prev}
            prevLabel={derived.prevLabel}
            range={range}
            setRange={setRange}
            today={data.today}
            colorByCategory={derived.colorByCategory}
            scopeLabel={scopeLabel}
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab
            p={p}
            dark={dark}
            expenses={derived.inRange}
            colorByCategory={derived.colorByCategory}
            showMember={scope === "family" && member === "all"}
            memberName={derived.memberName}
            memberIndex={derived.memberIndex}
            today={data.today}
          />
        )}
        {tab === "family" && <FamilyTab p={p} dark={dark} data={data} />}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: p.accent }]}
        onPress={() => setAddOpen(true)}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <AddExpenseSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        token={token}
        categories={data.categories}
        today={data.today}
        p={p}
        dark={dark}
        onLogged={refresh}
      />

      <View style={[styles.tabbar, { backgroundColor: p.surface, borderTopColor: p.border }]}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
            <Text style={{ fontSize: 18, color: tab === t.key ? p.accent : p.muted }}>{t.icon}</Text>
            <Text
              style={{
                fontSize: 11,
                color: tab === t.key ? p.accent : p.muted,
                fontWeight: tab === t.key ? "600" : "400",
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  markText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logout: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 12 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  scopeRow: { alignItems: "center", paddingBottom: 4 },
  seg: { flexDirection: "row", borderRadius: 999, borderWidth: 1, padding: 4, gap: 4 },
  segBtn: { paddingVertical: 7, paddingHorizontal: 24, borderRadius: 999 },
  chips: { gap: 8, paddingBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 14,
  },
  tabbar: { flexDirection: "row", borderTopWidth: 1, paddingBottom: 20, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: "#fff", fontSize: 26, fontWeight: "600", lineHeight: 30 },
});
