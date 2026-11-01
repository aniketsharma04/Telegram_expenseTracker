import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * App settings: the interface strings (English) and text size. The LLM still
 * understands Hinglish input. Persisted locally; no server involvement.
 */

const STRINGS = {
  // chrome
  appName: "Aaj",
  logout: "Log out",
  home: "Home",
  transactions: "Transactions",
  family: "Family",
  personal: "Personal",
  settings: "Settings",
  textSize: "Text size",
  normal: "Normal",
  large: "Large",
  done: "Done",
  // add sheet
  addExpense: "Add expense",
  addIncome: "Add income",
  expense: "Expense",
  income: "Income",
  smartPlaceholder: 'Type it like a text: "250 groceries at More"',
  orFillIn: "or fill it in",
  wherePlaceholder: "Where / what for? (optional)",
  sourcePlaceholder: "From where? e.g. Salary (optional)",
  today: "Today",
  yesterday: "Yesterday",
  save: "Save",
  splitWithFamily: "Split equally with family",
  logged: "Logged",
  removed: "Removed",
  undo: "Undo",
  addAnother: "Add another",
  holdToRecord: "Voice",
  recording: "Listening… tap to finish",
  receipt: "Receipt",
  gallery: "Gallery",
  // edit sheet
  editExpense: "Edit expense",
  delete: "Delete",
  partOfSplit: "Part of a family split",
  keepDate: "Keep date",
  flipToIncome: "This was money received, not spent",
  flipHint: "Moves it to income. Your spending and savings update.",
  // cards
  budgets: "Budgets",
  setBudgets: "Set budgets",
  editBudgets: "Edit",
  overall: "Overall",
  budgetHint:
    "Cap a category (or everything) per month. You'll get a heads-up at 80% and 100%.",
  monthlyCap: "Monthly cap",
  remove: "Remove",
  upcoming: "Upcoming",
  headsUp: "Heads up",
  savedThisMonth: "This month",
  earned: "Earned",
  spent: "Spent",
  kept: "Kept",
  invested: "Invested",
  settleUp: "Settle up",
  owes: "owes",
  allSettled: "All settled 🎉",
  dueAround: "due around the",
  inDays: "in",
  days: "days",
  usualPace: "usual by now",
  // bills
  bills: "Bills",
  addBill: "Add bill",
  editBill: "Edit bill",
  noBills:
    "Add your monthly bills once: electricity, water, credit card, rent. I'll remind you before they're due, and Pay now opens your UPI app with the amount filled in.",
  payNow: "Pay now",
  markPaid: "Mark paid",
  paid: "Paid",
  dueToday: "Due today",
  dueIn: "Due in",
  overdue: "overdue",
  daysShort: "d",
  billName: "Bill name, e.g. BSES Electricity",
  dueDay: "Due day of month",
  usualAmount: "Usual amount (optional)",
  upiId: "UPI ID for Pay now (optional), e.g. biller@upi",
  payeeName: "Payee name (optional)",
  consumerNo: "Consumer / account no. (optional)",
  didYouPay: "Did the payment go through?",
  notYet: "Not yet",
  openUpiApp: "No UPI ID saved. Open your app to pay:",
  suggested: "Looks like a monthly bill",
  addAsBill: "Add as bill",
  amountPaid: "Amount paid",
  undoPaid: "Undo",
  kind_electricity: "Electricity",
  kind_water: "Water",
  kind_gas: "Gas",
  kind_credit_card: "Credit card",
  kind_rent: "Rent",
  kind_internet: "Internet",
  kind_mobile: "Mobile",
  kind_insurance: "Insurance",
  kind_other: "Other",
  // BBPS auto-fetch
  autoFetch: "Auto-fetch",
  manual: "Manual",
  searchBiller: "Search billers: BSES, HDFC card, Airtel…",
  allCategories: "All",
  noBillers: "No billers match that.",
  fetchBill: "Fetch bill",
  fetching: "Fetching from biller…",
  fetchedBill: "Bill found",
  noDues: "No outstanding bill right now",
  billUnavailable: "Bill not available for this account yet",
  noBillAvailable: "no bill available",
  accountHolder: "Account holder",
  dueOn: "Due",
  changeBiller: "Change",
  saveBill: "Save bill",
  linkedVia: "Auto-fetched",
  refresh: "Refresh",
  lastFetched: "checked",
  justNow: "just now",
  hoursAgo: "h ago",
  daysAgo: "d ago",
  fetchFailed: "Couldn't fetch",
  identifiers: "Your identifiers",
  mockNote:
    "Live bill fetch isn't connected yet, so a new bill shows as not available (₹0). You can still save it and refresh later.",
  // v19: subscriptions
  subscriptions: "Subscriptions",
  subsPerMonth: "a month",
  subsPerYear: "a year",
  subsNote:
    "Repeat charges from your spending. Keep what you use, cancel the rest.",
  subsKeep: "Keep",
  subsCancel: "Cancel it",
  subsKeeping: "Keeping",
  subsCancelling: "Cancelling",
  subsCancelled: "Cancelled",
  subsHowTo: "Cancel now",
  subsUndo: "Keep instead",
  subsNext: "next",
  subsSaved: "Saving",
  subsCancelInApp: "Cancel from its app's account settings.",
  subsCancelHint:
    "I'll remind you 2 days before it renews, and count it as saved once no charge comes.",
  // v7: bills detected from email / notifications
  foundInEmail: "Found in your email",
  foundInNotification: "Spotted in a notification",
  detectedNote: "Nothing is added until you confirm.",
  confirmAdd: "Add as bill",
  updateExisting: "Update",
  dismiss: "Not a bill",
  unsureAmount: "check the amount",
  connectGmail: "Connect Gmail",
  disconnectGmail: "Disconnect",
  gmailConnected: "Gmail connected",
  gmailBlurb:
    "Read-only. The app looks for bill emails and never sends, labels or deletes anything.",
  scanNow: "Scan now",
  scanning: "Scanning your inbox…",
  scanFoundNone: "No new bills found.",
  reconnectGmail: "Reconnect Gmail",
  reauthNeeded:
    "Google drops the connection every 7 days until the app is published. Reconnect to keep finding bills.",
  // accounts & transfers (v8)
  accounts: "Accounts",
  netWorth: "Net position",
  youHold: "You hold",
  youOwe: "You owe",
  addAccount: "Add account",
  editAccount: "Edit account",
  accountName: "Account name",
  accountNamePlaceholder: "HDFC Savings, Cash, Paytm…",
  lastDigits: "Last 4 digits (optional)",
  openingBalance: "Balance today",
  creditLimit: "Credit limit (optional)",
  bank: "Bank",
  cash: "Cash",
  wallet: "Wallet",
  creditCard: "Credit card",
  defaultAccount: "Default",
  makeDefault: "Use as default account",
  available: "available",
  outstanding: "outstanding",
  archiveAccount: "Archive",
  noAccountsYet:
    "Add your bank, cash and cards to see what you're actually worth.",
  unassignedNote: "not linked to an account yet",
  transfer: "Transfer",
  moveMoney: "Move money",
  fromAccount: "From",
  toAccount: "To",
  transferNote:
    "Moving your own money isn't spending, so it won't touch your totals.",
  cardPayment: "Card payment",
  recordTransfer: "Record transfer",
  notSpending: "Recorded as a transfer, not spending.",
  payFrom: "Paid from",
  // itemised receipts (v10)
  billItems: "On this bill",
  billSubtotal: "Subtotal",
  billTax: "Tax & charges",
  billDiscount: "Discount",
  billTip: "Tip",
  billTotal: "Total",
  billPartial:
    "The lines don't add up to the total. Some may have been missed.",
  // auto-capture (v9)
  autoCapture: "Auto-capture from notifications",
  captureBlurb:
    "Read bank SMS alerts as they arrive, so spending logs itself and balances stay right.",
  captureOn: "On. Payments are captured and counted as they happen.",
  // capture setup card (v15) — doubles as the Play "prominent disclosure"
  setupTitle: "Track spending automatically",
  setupDisclosure:
    "To log payments for you, this app reads notifications from your SMS app, bank apps and UPI apps, and only the ones that mention money being debited or credited. The amount, merchant and balance are sent securely to your account to update your budget. Messages containing OTPs or codes are skipped on your phone and never sent. Other notifications (chats, email) are ignored.",
  restrictedTitle: 'Switch greyed out? "Controlled by restricted setting"',
  restrictedSteps:
    "Android blocks this for apps not installed from the Play Store. To allow it:\n1. Tap Open app info below.\n2. Tap ⋮ (top right) → Allow restricted settings, then confirm with your PIN or fingerprint.\n3. Come back here and tap Agree & turn on again.",
  openAppInfo: "Open app info",
  setupStep1: "Allow notification access",
  setupStep2: "Let it run in the background",
  setupStep2Hint:
    "Make sure “Allow background usage” is on for Aaj (on older phones: All apps → Aaj → “Don't optimise”). Already on? Tap “It's on”.",
  alreadyOn: "It's on",
  setupStep3: "Turn on Autostart",
  setupStep3Hint:
    "Your phone stops apps it thinks are idle. In app info, turn on Autostart (or allow background activity).",
  agreeTurnOn: "Agree & turn on",
  open: "Open",
  setupDone: "Done",
  grantAccess: "Grant access",
  grantHint: 'Find "Aaj" in the list and turn it on, then come back.',
  syncNow: "Sync now",
  capturePending: "waiting to upload",
  captureLogged: "logged",
  captureSkipped: "already known",
  captureNothing: "Nothing new to capture.",
  captureFailed: "Couldn't upload. Kept for the next try.",
  bankSays: "Bank says",
  checkDrift: "off from what's logged, so some spending wasn't captured",
  // daily budget (v14)
  dailyBudget: "Daily budget",
  leftToday: "left to spend today",
  overToday: "over today's budget",
  ofToday: "of",
  setUpDaily: "Set up",
  editPlan: "Edit",
  dailyHint:
    "Tell the app your monthly income and fixed costs, and it turns them into one number to spend each day.",
  everydayMoney: "Everyday money",
  last14:
    "Last 14 days: bars are what you spent, the line is that day's budget.",
  daysToGo: "days to go",
  tomorrow: "Tomorrow",
  streakDays: "days in a row under budget",
  notCounted: "Not counted",
  monthlyIncome: "Monthly income",
  savingsGoal: "Savings goal / month",
  payday: "Salary day",
  // your data (Play: export, privacy, in-app deletion)
  yourData: "Your data",
  exportData: "Export",
  privacyPolicy: "Privacy policy",
  deleteAccount: "Delete account",
  deleteConfirm: "Yes, delete everything",
  deleteWarning:
    "This permanently deletes your account and all your expenses, income, plan, goals and notifications. It can't be undone, so export first if you want a copy.",
  exportFailed: "Couldn't export. Try again.",
  deleteFailed: "Couldn't delete. Try again.",
  // Calm redesign (v18)
  goodMorning: "Good morning",
  goodAfternoon: "Good afternoon",
  goodEvening: "Good evening",
  activity: "Activity",
  plan: "Plan",
  insights: "Insights",
  seeAll: "See all",
  leftTodayShort: "left today",
  spentOf: "spent of",
  leftThisMonth: "Left this month",
  daysWord: "days",
  newMonth: "New month",
  nothingToday: "Nothing spent yet today.",
  notCountedOne: "was a fixed cost or from savings, so it isn't counted here.",
  notCountedMany:
    "were fixed costs or from savings, so they aren't counted here.",
  setUpTitle: "Get your daily number",
  profile: "Profile",
  addManually: "Add",
  offlineNote: "Offline · showing data from",
  savePlan: "Save plan",
  saveFailed: "Couldn't save. Check your connection and try again.",
  incomeNeeded: "Add your monthly income, like 1,00,000 or 1 lakh.",
  savingsInvalid: "Savings should be a number below your income.",
  paydayInvalid: "Salary day is a date from 1 to 31.",
  fixedNeeded: "Give the fixed cost a name and an amount.",
  // guided setup (v19)
  setupIncomeTitle: "How much lands in your account each month?",
  setupIncomeHint:
    "Your take-home salary, after tax. You can change it any time.",
  setupFixedTitle: "What goes out every month, no matter what?",
  setupFixedHint:
    "These come off the top, so they never eat into your daily number.",
  setupSaveTitle: "How much do you want to save each month?",
  setupSaveHint:
    "Set it aside before you spend. Slide to see your daily number change.",
  salaryArrives: "Salary arrives on",
  other: "Other",
  amountPerMonth: "Amount per month",
  somethingElse: "Something else",
  fixedEachMonth: "Fixed each month",
  ofIncome: "of income",
  thatLeaves: "That leaves you",
  aDay: "a day",
  continue: "Continue",
  startBudget: "Start my daily budget",
  back: "Back",
  close: "Close",
  setupCta: "Set up in a minute",
  leftTodayCap: "Left today",
  paceOnTrack: "On track",
  offPace: "Off pace",
  aheadAtPace: "ahead of plan at this pace",
  shortAtPace: "short by month-end at this pace",
  last7: "Spending over the last 7 days",
  // goals (v17)
  goals: "Goals",
  addGoal: "Add a goal",
  goalsHint:
    "Saving for a trip, a phone, an emergency fund? Set a goal. Its monthly share is set aside first and added to the goal automatically each month.",
  goalName: "What for? e.g. Goa trip",
  goalTarget: "How much",
  goalBy: "By when (YYYY-MM)",
  goalMonthly: "or ₹ per month",
  perMonth: "/month",
  onTrack: "on track",
  behind: "behind",
  monthsToGo: "months to go",
  reached: "Reached 🎉",
  stopGoal: "Stop goal",
  paydayHint:
    "Your budget month runs from this day to the day before the next one. Leave empty for calendar months.",
  fixedCosts: "Fixed monthly costs",
  fixedHint: "Rent, EMI, SIP and subscriptions stay out of the daily number.",
  suggestedFixed: "Looks like a fixed cost",
  costName: "Name, e.g. Rent",
  add: "Add",
  morningMsg: "Morning message",
  eveningMsg: "Night report",
  liveMsg: "Ping on every spend",
  messagesVia: "These arrive as notifications on this phone.",
  // inbox + push (v15)
  inbox: "Notifications",
  inboxEmpty:
    "Nothing yet. Your morning number, spends and alerts will show up here.",
  movedToSavings: "Moved to savings ✓",
  wasReceived: "This was money received",
  wasSpending: "This was spending",
  flippedToIncome: "Moved to income ✓",
  flippedToSpending: "Moved to spending ✓",
  pushTitle: "Turn on notifications",
  pushHint:
    "A morning brief, a ping when money leaves your account, and a short report at night.",
  pushTurnOn: "Turn on notifications",
  pushBlocked:
    "Notifications are off for this app. Turn them on in Settings to get your daily number.",
  openSettings: "Open settings",
  notNow: "Not now",
  fromSavings: "Paid from savings",
  fromSavingsHint: "Won't touch your daily budget.",
  perDay: "/day",

  // v18: money rules — the salary split and goal rules of thumb
  moneySplit: "Your money split",
  splitNeeds: "Needs",
  splitNeedsHint: "fixed costs",
  splitWants: "Wants",
  splitWantsHint: "everyday money",
  splitSave: "Save & invest",
  splitSaveHint: "savings + goals",
  splitRuleTarget: "rule: {n}%",
  rule503020:
    "The 50/30/20 rule: half your take-home for needs, 30% for wants, and at least 20% saved or invested.",
  rule602020:
    "Your fixed costs are over half your income, common with city rents, so the 60/20/20 rule fits: 60% needs, 20% wants, 20% still saved.",
  splitGood: "You're saving {n}%. That's on track.",
  splitLow: "You're saving {n}% of your income. Aim for 20%.",
  splitHighNeeds:
    "Fixed costs take {n}% of your income. Above 60% leaves little room; a cheaper rent or ending an EMI frees the most.",
  splitApply: "Save {amount} a month",
  rulesNote:
    "Rules of thumb from Indian personal-finance guides, not advice for your exact situation.",
  kind_goal_car: "Car",
  kind_goal_bike: "Bike",
  kind_goal_home: "Home",
  kind_goal_gadget: "Gadget",
  kind_goal_trip: "Trip",
  kind_goal_emergency: "Emergency fund",
  kind_goal_other: "Other",
  ruleVehicleTitle: "The 20/4/10 rule",
  ruleVehicleBody:
    "Pay 20% down ({down}), take a loan of 4 years or less, and keep the EMI under 10% of your income ({cap}).",
  ruleEmiLine: "At about {rate}% for {years} years, the EMI is {emi}.",
  ruleFits: "✓ This fits.",
  ruleVehicleOver:
    "That's over the limit. A price up to {max} fits your income.",
  ruleRunningCosts:
    "Fuel, insurance and service come on top, so keep them in mind.",
  ruleBikeCash:
    "It costs about {n} months of your income. Save and pay in full; skip the loan and its interest.",
  ruleHomeTitle: "The 20/30/40 rule",
  ruleHomeBody:
    "Pay 20% down ({down}), keep the home-loan EMI under 30% of your income ({cap}), and all your EMIs together under 40%.",
  ruleHomeOver: "That's over the limit. A home up to {max} fits your income.",
  ruleHomeYears:
    "The price is {n} years of your income; guides suggest staying near 5 or under.",
  ruleSaveDown: "Save for the {amount} down payment",
  ruleEmergencyTitle: "6 months of expenses",
  ruleEmergencyBody:
    "An emergency fund should cover about 6 months of spending ({monthly} a month here), kept in a savings account or liquid fund. Build it before other goals.",
  ruleUseAmount: "Use {amount}",
  ruleSaveFirstTitle: "Save first, then buy",
  ruleGadgetBody:
    'This is {n} months of your income. Save for it rather than taking an EMI; "no-cost" EMIs often hide the interest in the price or a processing fee.',
  ruleTripBody:
    "This is {n} months of your income. Set a monthly amount and pay for the trip from savings, not a card or loan.",
  ruleNeedIncome:
    "Set up your monthly income in Daily budget to check this goal against the rules.",
  emergencyNudge:
    "Start with an emergency fund: 6 months of spending, about {amount}.",
  emergencyFundName: "Emergency fund",
  ruleAllEmiOk:
    "With the EMIs you already pay ({existing}), all your loans would take {n}% of your income, under the 40% limit.",
  ruleAllEmiOver:
    "With the EMIs you already pay ({existing}), all your loans would take {n}% of your income. Keep all EMIs under 40%: clear one first or pick a cheaper option.",
  splitEmiHigh:
    "Your EMIs take {n}% of your income. Keep all EMIs under 40%, and clear one before taking a new loan.",
} as const;

export type StringKey = keyof typeof STRINGS;

interface Settings {
  scale: number; // 1 or 1.18 (large text)
  t: (key: StringKey) => string;
  fs: (size: number) => number;
  setLarge: (large: boolean) => void;
}

const SettingsContext = createContext<Settings>({
  scale: 1,
  t: (k) => STRINGS[k],
  fs: (s) => s,
  setLarge: () => {},
});

// The Hindi interface was removed; clear the old choice once.
const OLD_LANG_KEY = "et_lang";
const SCALE_KEY = "et_large_text";
const LARGE_SCALE = 1.18;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem(SCALE_KEY).then((value) => {
      if (value === "1") setScale(LARGE_SCALE);
    });
    void AsyncStorage.removeItem(OLD_LANG_KEY);
  }, []);

  const value: Settings = {
    scale,
    t: (key) => STRINGS[key],
    fs: (size) => Math.round(size * scale * 10) / 10,
    setLarge: (large) => {
      setScale(large ? LARGE_SCALE : 1);
      AsyncStorage.setItem(SCALE_KEY, large ? "1" : "0");
    },
  };
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
