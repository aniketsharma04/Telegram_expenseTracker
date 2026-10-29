import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./components/Text";
import AddExpenseSheet from "./components/AddExpenseSheet";
import BillsTab from "./components/BillsTab";
import EditExpenseSheet from "./components/EditExpenseSheet";
import FamilyTab from "./components/FamilyTab";
import HomeTab, { RANGE_LABELS, RangeKey } from "./components/HomeTab";
import LoginScreen from "./components/LoginScreen";
import {
  BudgetsCard,
  InsightsCards,
  SavingsCard,
} from "./components/MoneyCards";
import SettingsSheet from "./components/SettingsSheet";
import AccountsCard from "./components/AccountsCard";
import AccountSheet from "./components/AccountSheet";
import TransferSheet from "./components/TransferSheet";
import TransactionsTab from "./components/TransactionsTab";
import { Avatar, Icon, IconName, Skeleton } from "./components/ui";
import TodayTab from "./components/TodayTab";
import { useFonts } from "expo-font";
import { FONT_ASSETS, setFontsReady } from "./components/Text";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Account, ApiData, Expense, fetchData } from "./lib/api";
import { PlanSummaryCard } from "./components/DailyBudgetCard";
import { InboxBell, InboxSheet, PushPromptCard } from "./components/Inbox";
import { CaptureSetupCard } from "./components/CaptureSetupCard";
import { GoalsCard } from "./components/GoalsCard";
import { MoneySplitCard } from "./components/MoneySplitCard";
import { emiCommitments } from "./lib/money-rules";
import { PushState, registerForPush, unregisterPush } from "./lib/push";
import { connectCapture, syncCaptures } from "./lib/capture";
import {
  CachedData,
  clearCache,
  fetchDataCached,
  readCache,
  savedTime,
} from "./lib/cache";
import { SettingsProvider, StringKey, useSettings } from "./lib/i18n";
import { elevation, memberColor, usePalette } from "./lib/theme";

type Tab = "today" | "activity" | "plan" | "insights";
type Scope = "personal" | "family";

const TOKEN_KEY = "et_token";
const PUSH_PROMPT_DISMISSED_KEY = "et_push_prompt_dismissed";
const TABS: Array<{ key: Tab; label: StringKey; icon: IconName }> = [
  { key: "today", label: "today", icon: "sun" },
  { key: "activity", label: "activity", icon: "list" },
  { key: "plan", label: "plan", icon: "target" },
  { key: "insights", label: "insights", icon: "bar-chart-2" },
];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  setFontsReady(fontsLoaded);
  // A blank frame for the moment fonts load, rather than a flash of the system font.
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppInner />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const { p, dark } = usePalette();
  const { t, fs } = useSettings();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<ApiData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [scope, setScope] = useState<Scope>("personal");
  const [member, setMember] = useState<number | "all">("all");
  const [range, setRange] = useState<RangeKey>("month");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // v8: "new" opens a blank account form, an Account object edits that one.
  const [accountTarget, setAccountTarget] = useState<Account | "new" | null>(
    null,
  );
  const [transferOpen, setTransferOpen] = useState(false);
  // v15: notifications — the inbox sheet, and whether this phone can be pinged.
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>("unavailable");
  const [pushPromptDismissed, setPushPromptDismissed] = useState(true);
  const handledColdStart = useRef(false);
  // v18 offline-first: the cached payload, and whether the last refresh failed.
  const cacheRef = useRef<CachedData | null>(null);
  const lastRefresh = useRef(0);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);

  useEffect(() => {
    // Token and cached data together, so a signed-in user opens straight onto numbers.
    Promise.all([AsyncStorage.getItem(TOKEN_KEY), readCache()]).then(
      ([t, cached]) => {
        if (t && cached) {
          cacheRef.current = cached;
          setData(cached.data);
        }
        setToken(t);
      },
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    lastRefresh.current = Date.now();
    const outcome = await fetchDataCached(token, cacheRef.current);
    if (outcome.kind === "unauthorized") {
      await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), clearCache()]);
      cacheRef.current = null;
      setToken(null);
      setData(null);
      return;
    }
    if (outcome.kind === "offline") {
      // Keep showing what we have; say how old it is.
      setOfflineSince(cacheRef.current?.savedAt ?? Date.now());
      return;
    }
    cacheRef.current = outcome.entry;
    setOfflineSince(null);
    if (outcome.kind === "fresh") setData(outcome.entry.data);
  }, [token]);

  // Refresh when it matters: now, on return to the app, when a push lands,
  // and every 5 minutes while open (the ETag makes unchanged polls nearly free).
  useEffect(() => {
    if (!token) return;
    refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, 5 * 60_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastRefresh.current > 30_000)
        refresh();
    });
    const pushes = Notifications.addNotificationReceivedListener(() =>
      refresh(),
    );
    return () => {
      clearInterval(interval);
      appState.remove();
      pushes.remove();
    };
  }, [token, refresh]);

  // v15: register this phone for pushes on every launch (a cheap upsert —
  // tokens rotate). Never prompts here; the prompt card asks with a reason.
  useEffect(() => {
    if (!token) return;
    // Captures upload in the background as this user from now on.
    connectCapture(token);
    registerForPush(token, { ask: false }).then(setPushState);
    AsyncStorage.getItem(PUSH_PROMPT_DISMISSED_KEY).then((v) =>
      setPushPromptDismissed(v === "1"),
    );
  }, [token]);

  // Tapping a push opens the inbox — also when the tap launched the app.
  useEffect(() => {
    if (!token) return;
    const open = () => {
      setInboxOpen(true);
      refresh();
    };
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((r) => {
          if (r) open();
        })
        .catch(() => {});
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [token, refresh]);

  // v9: the notification listener queues bank alerts while the app is closed.
  // Drain and upload them on open and on every return to the foreground —
  // with an empty queue this touches no network at all.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const drain = async () => {
      const result = await syncCaptures(token);
      if (!cancelled && result.logged > 0) refresh();
    };

    drain();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") drain();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [token, refresh]);

  const login = useCallback(async (code: string): Promise<string | null> => {
    try {
      const result = await fetchData(code);
      if (result === "unauthorized")
        return "That code isn't valid (or expired). Send /app to the bot for a fresh one.";
      await AsyncStorage.setItem(TOKEN_KEY, code);
      setData(result);
      setToken(code);
      return null;
    } catch {
      return "Couldn't reach the server. Check your connection and try again.";
    }
  }, []);

  const logout = useCallback(async () => {
    // This phone must stop getting the old account's notices.
    if (token) await unregisterPush(token);
    connectCapture(null);
    cacheRef.current = null;
    await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), clearCache()]);
    setToken(null);
    setData(null);
  }, [token]);

  const derived = useMemo(() => {
    if (!data) return null;
    const members = data.family?.members ?? [];
    const memberName = new Map<number, string>(
      members.map((m) => [m.id, m.name]),
    );
    const memberIndex = new Map<number, number>(
      members.map((m, i) => [m.id, i]),
    );
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
    const scoped = data.expenses.filter(
      (e) => e.user_id !== null && idSet.has(e.user_id),
    );

    const rangeStart =
      range === "month"
        ? `${data.today.slice(0, 7)}-01`
        : shiftDate(data.today, range === "30d" ? 29 : 89);
    const inRange = scoped.filter(
      (e) => e.expense_date >= rangeStart && e.expense_date <= data.today,
    );

    let prev: Expense[];
    let prevLabel: string;
    if (range === "month") {
      const [y, m] = data.today.slice(0, 7).split("-").map(Number);
      const prevPrefix =
        m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      prev = scoped.filter((e) => e.expense_date.startsWith(prevPrefix));
      prevLabel = "last month";
    } else {
      const days = range === "30d" ? 30 : 90;
      prev = scoped.filter(
        (e) =>
          e.expense_date >= shiftDate(data.today, days * 2 - 1) &&
          e.expense_date < rangeStart,
      );
      prevLabel = `previous ${days} days`;
    }

    const colorByCategory: Record<string, string> = {};
    for (const c of data.categories)
      colorByCategory[c.name] = c.color ?? "#898781";

    // Calendar-month personal totals for the savings card (independent of range).
    const monthPrefix = data.today.slice(0, 7);
    let monthSpent = 0;
    let monthInvested = 0;
    for (const e of data.expenses) {
      if (e.user_id !== data.user.id || !e.expense_date.startsWith(monthPrefix))
        continue;
      if (e.category === "Investments") monthInvested += Number(e.amount);
      else monthSpent += Number(e.amount);
    }

    return {
      members,
      memberName,
      memberIndex,
      inRange,
      prev,
      prevLabel,
      colorByCategory,
      monthSpent,
      monthInvested,
    };
  }, [data, scope, member, range]);

  if (token === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: p.page }]}>
        <ActivityIndicator color={p.accent} />
      </View>
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
      <View
        style={{ flex: 1, backgroundColor: p.page }}
        accessibilityLabel="Loading"
      >
        <View
          style={{
            height: 380 + insets.top,
            backgroundColor: p.heroFrom,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        />
        <View style={{ marginTop: -30, paddingHorizontal: 16, gap: 12 }}>
          <Skeleton p={p} height={150} radius={22} />
          <Skeleton p={p} height={84} radius={22} />
        </View>
      </View>
    );
  }

  const hasFamily = Boolean(data.family);
  const showChips = hasFamily && scope === "family";
  const scopeLabel =
    scope === "family"
      ? member === "all"
        ? data.family!.name
        : (derived.memberName.get(member as number) ?? "")
      : "Personal";
  const firstName = (data.user.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("goodMorning")
      : hour < 17
        ? t("goodAfternoon")
        : t("goodEvening");

  // Personal / family switch and member chips — on Activity and Insights only.
  const scopePicker = hasFamily ? (
    <View style={{ gap: 10 }}>
      <View
        style={[
          styles.seg,
          { backgroundColor: p.surface, borderColor: p.border },
        ]}
      >
        {(["personal", "family"] as Scope[]).map((s) => (
          <Pressable
            key={s}
            style={[
              styles.segBtn,
              scope === s && { backgroundColor: p.accent },
            ]}
            onPress={() => {
              setScope(s);
              setMember("all");
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: scope === s }}
          >
            <Text
              style={{
                fontSize: fs(13.5),
                fontWeight: "600",
                color: scope === s ? p.onAccent : p.ink2,
              }}
            >
              {s === "personal" ? t("personal") : t("family")}
            </Text>
          </Pressable>
        ))}
      </View>
      {showChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setMember("all")}
            style={[
              styles.chip,
              {
                borderColor: member === "all" ? p.accent : p.border,
                backgroundColor: member === "all" ? p.accentSoft : p.surface,
              },
            ]}
          >
            <Icon name="users" size={16} color={p.ink2} />
            <Text style={{ fontSize: fs(13), color: p.ink }}>
              {data.family!.name}
            </Text>
          </Pressable>
          {derived.members.map((m, i) => {
            const active = member === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMember(m.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? p.accent : p.border,
                    backgroundColor: active ? p.accentSoft : p.surface,
                  },
                ]}
              >
                <Avatar
                  color={memberColor(i, dark)}
                  label={m.name.slice(0, 1).toUpperCase()}
                  size={22}
                />
                <Text
                  style={{
                    fontSize: fs(13),
                    color: active ? p.ink : p.ink2,
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {m.id === data.user.id ? "You" : m.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  ) : null;

  const goals = data.goals ?? [];
  // v18: what the goal rules check against. Spending = needs + wants, i.e.
  // income less what's already set aside.
  const daily = data.daily?.ready ? data.daily : null;
  const goalMoney = {
    income: daily?.income ?? 0,
    monthlySpend: daily
      ? Math.max(0, daily.income - daily.savingsGoal - (daily.goals ?? 0))
      : 0,
    // Fixed costs named "... EMI" or "... loan", for the 40% all-EMI limit.
    existingEmi: daily ? emiCommitments(daily.commitments ?? []) : 0,
  };
  const offline =
    offlineSince !== null ? (
      <View
        style={[styles.offline, { backgroundColor: p.warnSoft }]}
        accessibilityLiveRegion="polite"
      >
        <Icon name="wifi-off" size={14} color={p.warn} />
        <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>
          {t("offlineNote")} {savedTime(offlineSince)}
        </Text>
      </View>
    ) : null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: p.page,
          paddingTop: tab === "today" ? 0 : insets.top,
        },
      ]}
    >
      <StatusBar style={tab === "today" || dark ? "light" : "dark"} />

      {tab !== "today" && (
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: fs(13), color: p.muted }}>
              {longDate(data.today)}
            </Text>
            <Text
              style={{
                fontSize: fs(28),
                fontWeight: "800",
                color: p.ink,
                letterSpacing: -0.6,
              }}
              numberOfLines={1}
            >
              {t(TABS.find((x) => x.key === tab)!.label)}
            </Text>
          </View>
          <InboxBell
            p={p}
            unread={data.inbox_unread ?? 0}
            onPress={() => setInboxOpen(true)}
          />
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={[styles.avatarBtn, { backgroundColor: p.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t("profile")}
          >
            <Text
              style={{ color: p.onAccent, fontWeight: "700", fontSize: fs(16) }}
            >
              {(firstName || "?").slice(0, 1).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      )}

      {tab !== "today" && offline}

      <ScrollView
        contentContainerStyle={
          tab === "today" ? styles.scrollToday : styles.scroll
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={p.accent}
            colors={[p.accent]}
          />
        }
      >
        {tab === "today" && (
          <TodayTab
            p={p}
            dark={dark}
            data={data}
            token={token}
            colorByCategory={derived.colorByCategory}
            greeting={`${greeting}${firstName ? `, ${firstName}` : ""}`}
            dateLabel={longDate(data.today)}
            unread={data.inbox_unread ?? 0}
            onBell={() => setInboxOpen(true)}
            onProfile={() => setSettingsOpen(true)}
            onChanged={refresh}
            onSeeAll={() => setTab("activity")}
            onEdit={(e) => {
              if (e.user_id === data.user.id) setEditTarget(e);
            }}
            top={
              <>
                {offline}
                <CaptureSetupCard p={p} token={token} />
                {!pushPromptDismissed && (
                  <PushPromptCard
                    p={p}
                    state={pushState}
                    token={token}
                    onResult={setPushState}
                    onDismiss={() => {
                      setPushPromptDismissed(true);
                      AsyncStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
                    }}
                  />
                )}
              </>
            }
            bottom={
              goals.length > 0 ? (
                <GoalsCard
                  p={p}
                  goals={goals}
                  token={token}
                  {...goalMoney}
                  onChanged={refresh}
                />
              ) : null
            }
          />
        )}

        {tab === "activity" && (
          <>
            {scopePicker}
            <View style={styles.sectionRow}>
              <Text style={{ flex: 1, fontSize: fs(13), color: p.muted }}>
                {scopeLabel} · {RANGE_LABELS[range].toLowerCase()}
              </Text>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={[
                  styles.addBtn,
                  { borderColor: p.border, backgroundColor: p.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("addExpense")}
              >
                <Icon name="plus" size={16} color={p.accent} />
                <Text
                  style={{
                    color: p.accent,
                    fontWeight: "600",
                    fontSize: fs(13.5),
                  }}
                >
                  {t("addManually")}
                </Text>
              </Pressable>
            </View>
            <TransactionsTab
              p={p}
              dark={dark}
              expenses={derived.inRange}
              colorByCategory={derived.colorByCategory}
              showMember={scope === "family" && member === "all"}
              memberName={derived.memberName}
              memberIndex={derived.memberIndex}
              today={data.today}
              onEdit={(e) => {
                if (e.user_id === data.user.id) setEditTarget(e);
              }}
            />
          </>
        )}

        {tab === "plan" && (
          <>
            <PlanSummaryCard
              p={p}
              daily={data.daily}
              token={token}
              onChanged={refresh}
            />
            <MoneySplitCard
              p={p}
              daily={data.daily}
              token={token}
              onChanged={refresh}
            />
            <GoalsCard
              p={p}
              goals={goals}
              token={token}
              {...goalMoney}
              onChanged={refresh}
            />
            <BudgetsCard
              p={p}
              budgets={data.budgets ?? []}
              categories={data.categories}
              token={token}
              onChanged={refresh}
            />
            <BillsTab
              p={p}
              token={token}
              bills={data.bills ?? []}
              detected={data.detected_bills ?? []}
              recurring={data.insights?.recurring ?? []}
              categories={data.categories}
              today={data.today}
              onChanged={refresh}
            />
            <AccountsCard
              p={p}
              accounts={data.accounts ?? []}
              position={data.position}
              onAdd={() => setAccountTarget("new")}
              onEdit={(a) => setAccountTarget(a)}
              onTransfer={() => setTransferOpen(true)}
            />
          </>
        )}

        {tab === "insights" && (
          <>
            {scopePicker}
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
              extraCards={
                scope === "personal" ? (
                  <>
                    <SavingsCard
                      p={p}
                      incomes={data.incomes ?? []}
                      spent={derived.monthSpent}
                      invested={derived.monthInvested}
                      monthPrefix={data.today.slice(0, 7)}
                    />
                    <InsightsCards
                      p={p}
                      recurring={data.insights?.recurring ?? []}
                      anomalies={data.insights?.anomalies ?? []}
                    />
                  </>
                ) : null
              }
            />
            {scope === "family" && (
              <FamilyTab
                p={p}
                dark={dark}
                data={data}
                memberName={derived.memberName}
              />
            )}
          </>
        )}
      </ScrollView>

      <AddExpenseSheet
        accounts={data.accounts ?? []}
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        token={token}
        categories={data.categories}
        today={data.today}
        hasFamily={hasFamily && (data.family?.members.length ?? 0) > 1}
        p={p}
        dark={dark}
        onLogged={refresh}
      />

      <EditExpenseSheet
        expense={editTarget}
        onClose={() => setEditTarget(null)}
        token={token}
        categories={data.categories}
        today={data.today}
        p={p}
        dark={dark}
        onChanged={refresh}
      />

      <AccountSheet
        account={accountTarget}
        onClose={() => setAccountTarget(null)}
        onChanged={refresh}
        token={token}
        p={p}
      />

      <TransferSheet
        visible={transferOpen}
        accounts={data.accounts ?? []}
        onClose={() => setTransferOpen(false)}
        onDone={refresh}
        token={token}
        today={data.today}
        p={p}
      />

      {inboxOpen && (
        <InboxSheet
          p={p}
          token={token}
          onClose={() => setInboxOpen(false)}
          onChanged={refresh}
        />
      )}
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        p={p}
        token={token}
        gmail={data.gmail}
        onChanged={refresh}
        onAccountDeleted={logout}
        onLogout={logout}
      />

      <View
        style={[
          styles.tabbar,
          {
            backgroundColor: p.surface,
            bottom: Math.max(insets.bottom, 10) + 6,
          },
          elevation(p, 2),
        ]}
        accessibilityRole="tablist"
      >
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              style={[
                styles.tabItem,
                active && { backgroundColor: p.accentSoft, flex: 1.6 },
              ]}
              onPress={() => setTab(tb.key)}
              accessibilityRole="tab"
              accessibilityLabel={t(tb.label)}
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={tb.icon}
                size={20}
                color={active ? p.accent : p.muted}
              />
              {active && (
                <Text
                  style={{
                    fontSize: fs(13),
                    color: p.accent,
                    fontWeight: "700",
                  }}
                >
                  {t(tb.label)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Saturday, 24 October" from the server's YYYY-MM-DD. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom padding clears the floating tab bar.
  scroll: { paddingHorizontal: 16, paddingBottom: 110, gap: 14 },
  scrollToday: { paddingBottom: 110 },
  seg: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segBtn: { paddingVertical: 8, paddingHorizontal: 22, borderRadius: 999 },
  chips: { gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  tabbar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
