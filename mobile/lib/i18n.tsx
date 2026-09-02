import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * App settings for parents & everyone: language (English/Hindi) and text size.
 * The LLM already understands Hinglish input — this makes the *interface* meet
 * people too. Persisted locally; no server involvement.
 */

export type Lang = "en" | "hi";

const STRINGS = {
  // chrome
  appName: { en: "Expense Tracker", hi: "खर्चा ट्रैकर" },
  logout: { en: "Log out", hi: "लॉग आउट" },
  home: { en: "Home", hi: "होम" },
  transactions: { en: "Transactions", hi: "लेन-देन" },
  family: { en: "Family", hi: "परिवार" },
  personal: { en: "Personal", hi: "निजी" },
  settings: { en: "Settings", hi: "सेटिंग्स" },
  language: { en: "Language", hi: "भाषा" },
  textSize: { en: "Text size", hi: "अक्षर आकार" },
  normal: { en: "Normal", hi: "सामान्य" },
  large: { en: "Large", hi: "बड़ा" },
  done: { en: "Done", hi: "हो गया" },
  // add sheet
  addExpense: { en: "Add expense", hi: "खर्चा जोड़ें" },
  addIncome: { en: "Add income", hi: "आमदनी जोड़ें" },
  expense: { en: "Expense", hi: "खर्चा" },
  income: { en: "Income", hi: "आमदनी" },
  smartPlaceholder: {
    en: 'Type it like a text — "250 groceries at More"',
    hi: 'जैसे मैसेज करते हैं — "250 सब्ज़ी" लिखें',
  },
  orFillIn: { en: "or fill it in", hi: "या नीचे भरें" },
  wherePlaceholder: {
    en: "Where / what for? (optional)",
    hi: "कहाँ / किस लिए? (ज़रूरी नहीं)",
  },
  sourcePlaceholder: {
    en: "From where? e.g. Salary (optional)",
    hi: "कहाँ से? जैसे तनख्वाह (ज़रूरी नहीं)",
  },
  today: { en: "Today", hi: "आज" },
  yesterday: { en: "Yesterday", hi: "कल" },
  save: { en: "Save", hi: "सहेजें" },
  splitWithFamily: {
    en: "Split equally with family",
    hi: "परिवार में बराबर बाँटें",
  },
  logged: { en: "Logged", hi: "दर्ज हुआ" },
  removed: { en: "Removed", hi: "हटाया गया" },
  undo: { en: "Undo", hi: "वापस लें" },
  addAnother: { en: "Add another", hi: "और जोड़ें" },
  holdToRecord: { en: "Voice", hi: "बोलें" },
  recording: {
    en: "Listening… tap to finish",
    hi: "सुन रहा हूँ… रोकने के लिए दबाएँ",
  },
  receipt: { en: "Receipt", hi: "रसीद" },
  gallery: { en: "Gallery", hi: "गैलरी" },
  // edit sheet
  editExpense: { en: "Edit expense", hi: "खर्चा बदलें" },
  delete: { en: "Delete", hi: "हटाएँ" },
  partOfSplit: {
    en: "Part of a family split",
    hi: "पारिवारिक बँटवारे का हिस्सा",
  },
  keepDate: { en: "Keep date", hi: "तारीख़ वही" },
  // cards
  budgets: { en: "Budgets", hi: "बजट" },
  setBudgets: { en: "Set budgets", hi: "बजट तय करें" },
  editBudgets: { en: "Edit", hi: "बदलें" },
  overall: { en: "Overall", hi: "कुल" },
  budgetHint: {
    en: "Cap a category (or everything) per month — the bot warns you at 80% and 100%.",
    hi: "महीने की सीमा तय करें — 80% और 100% पर बॉट आगाह करेगा।",
  },
  monthlyCap: { en: "Monthly cap", hi: "मासिक सीमा" },
  remove: { en: "Remove", hi: "हटाएँ" },
  upcoming: { en: "Upcoming", hi: "आने वाले" },
  headsUp: { en: "Heads up", hi: "ध्यान दें" },
  savedThisMonth: { en: "This month", hi: "इस महीने" },
  earned: { en: "Earned", hi: "कमाया" },
  spent: { en: "Spent", hi: "खर्च" },
  kept: { en: "Kept", hi: "बचाया" },
  invested: { en: "Invested", hi: "निवेश" },
  settleUp: { en: "Settle up", hi: "हिसाब बराबर" },
  owes: { en: "owes", hi: "को देने हैं" },
  allSettled: { en: "All settled 🎉", hi: "हिसाब बराबर है 🎉" },
  dueAround: { en: "due around the", hi: "लगभग तारीख़" },
  inDays: { en: "in", hi: "बचे दिन:" },
  days: { en: "days", hi: "" },
  usualPace: { en: "usual by now", hi: "आम तौर पर" },
  // bills
  bills: { en: "Bills", hi: "बिल" },
  addBill: { en: "Add bill", hi: "बिल जोड़ें" },
  editBill: { en: "Edit bill", hi: "बिल बदलें" },
  noBills: {
    en: "Register your monthly bills once — electricity, water, credit card, rent. I'll remind you before they're due, and Pay now opens your UPI app with the amount filled in.",
    hi: "अपने मासिक बिल एक बार जोड़ें — बिजली, पानी, क्रेडिट कार्ड, किराया। समय से पहले याद दिलाऊँगा, और 'अभी चुकाएँ' से UPI ऐप में रकम भरी मिलेगी।",
  },
  payNow: { en: "Pay now", hi: "अभी चुकाएँ" },
  markPaid: { en: "Mark paid", hi: "चुका दिया" },
  paid: { en: "Paid", hi: "चुकाया" },
  dueToday: { en: "Due today", hi: "आज देय" },
  dueIn: { en: "Due in", hi: "देय:" },
  overdue: { en: "overdue", hi: "बाकी" },
  daysShort: { en: "d", hi: " दिन" },
  billName: {
    en: "Bill name, e.g. BSES Electricity",
    hi: "बिल का नाम, जैसे BSES बिजली",
  },
  dueDay: { en: "Due day of month", hi: "महीने की तारीख़" },
  usualAmount: { en: "Usual amount (optional)", hi: "आम रकम (ज़रूरी नहीं)" },
  upiId: {
    en: "UPI ID for Pay now (optional), e.g. biller@upi",
    hi: "UPI ID (ज़रूरी नहीं), जैसे biller@upi",
  },
  payeeName: {
    en: "Payee name (optional)",
    hi: "भुगतान पाने वाला (ज़रूरी नहीं)",
  },
  consumerNo: {
    en: "Consumer / account no. (optional)",
    hi: "उपभोक्ता / खाता संख्या (ज़रूरी नहीं)",
  },
  didYouPay: { en: "Did the payment go through?", hi: "क्या भुगतान हो गया?" },
  notYet: { en: "Not yet", hi: "अभी नहीं" },
  openUpiApp: {
    en: "No UPI ID saved — open your app to pay:",
    hi: "UPI ID नहीं है — ऐप खोलकर चुकाएँ:",
  },
  suggested: { en: "Looks like a monthly bill", hi: "मासिक बिल लगता है" },
  addAsBill: { en: "Add as bill", hi: "बिल बनाएँ" },
  amountPaid: { en: "Amount paid", hi: "चुकाई रकम" },
  undoPaid: { en: "Undo", hi: "वापस लें" },
  kind_electricity: { en: "Electricity", hi: "बिजली" },
  kind_water: { en: "Water", hi: "पानी" },
  kind_gas: { en: "Gas", hi: "गैस" },
  kind_credit_card: { en: "Credit card", hi: "क्रेडिट कार्ड" },
  kind_rent: { en: "Rent", hi: "किराया" },
  kind_internet: { en: "Internet", hi: "इंटरनेट" },
  kind_mobile: { en: "Mobile", hi: "मोबाइल" },
  kind_insurance: { en: "Insurance", hi: "बीमा" },
  kind_other: { en: "Other", hi: "अन्य" },
  // BBPS auto-fetch
  autoFetch: { en: "Auto-fetch", hi: "अपने आप लाएँ" },
  manual: { en: "Manual", hi: "खुद भरें" },
  searchBiller: {
    en: "Search biller — BSES, HDFC card, Airtel…",
    hi: "बिलर खोजें — BSES, HDFC कार्ड, Airtel…",
  },
  allCategories: { en: "All", hi: "सभी" },
  noBillers: { en: "No billers match that.", hi: "कोई बिलर नहीं मिला।" },
  fetchBill: { en: "Fetch bill", hi: "बिल लाएँ" },
  fetching: { en: "Fetching from biller…", hi: "बिलर से ला रहे हैं…" },
  fetchedBill: { en: "Bill found", hi: "बिल मिला" },
  noDues: { en: "No outstanding bill right now", hi: "अभी कोई बकाया नहीं" },
  dueOn: { en: "Due", hi: "देय" },
  changeBiller: { en: "Change", hi: "बदलें" },
  saveBill: { en: "Save bill", hi: "बिल सहेजें" },
  linkedVia: { en: "Auto-fetched", hi: "अपने आप लाया" },
  refresh: { en: "Refresh", hi: "ताज़ा करें" },
  lastFetched: { en: "checked", hi: "जाँचा" },
  justNow: { en: "just now", hi: "अभी" },
  hoursAgo: { en: "h ago", hi: " घंटे पहले" },
  daysAgo: { en: "d ago", hi: " दिन पहले" },
  fetchFailed: { en: "Couldn't fetch", hi: "ला नहीं सके" },
  identifiers: { en: "Your identifiers", hi: "आपकी पहचान संख्या" },
  mockNote: {
    en: "Demo billers until Bharat Connect onboarding completes — numbers ending 00 = no dues, 99 = not found.",
    hi: "Bharat Connect जुड़ने तक डेमो बिलर — 00 पर खत्म = बकाया नहीं, 99 = नहीं मिला।",
  },
  // v7: bills detected from email / notifications
  foundInEmail: { en: "Found in your email", hi: "आपके ईमेल में मिला" },
  foundInNotification: {
    en: "Spotted in a notification",
    hi: "नोटिफिकेशन में दिखा",
  },
  detectedNote: {
    en: "Nothing is added until you confirm.",
    hi: "आपकी पुष्टि के बिना कुछ नहीं जुड़ेगा।",
  },
  confirmAdd: { en: "Add as bill", hi: "बिल बनाएँ" },
  updateExisting: { en: "Update", hi: "अपडेट करें" },
  dismiss: { en: "Not a bill", hi: "बिल नहीं है" },
  unsureAmount: { en: "check the amount", hi: "रकम जाँच लें" },
  connectGmail: { en: "Connect Gmail", hi: "Gmail जोड़ें" },
  disconnectGmail: { en: "Disconnect", hi: "हटाएँ" },
  gmailConnected: { en: "Gmail connected", hi: "Gmail जुड़ा है" },
  gmailBlurb: {
    en: "Read-only. The app looks for bill emails and never sends, labels or deletes anything.",
    hi: "सिर्फ़ पढ़ने के लिए। ऐप बिल वाले ईमेल ढूँढता है — कुछ भेजता या मिटाता नहीं।",
  },
  scanNow: { en: "Scan now", hi: "अभी देखें" },
  scanning: { en: "Scanning your inbox…", hi: "इनबॉक्स देख रहे हैं…" },
  scanFoundNone: { en: "No new bills found.", hi: "कोई नया बिल नहीं मिला।" },
  reconnectGmail: { en: "Reconnect Gmail", hi: "Gmail फिर से जोड़ें" },
  reauthNeeded: {
    en: "Google drops the connection every 7 days until the app is published. Reconnect to keep finding bills.",
    hi: "ऐप प्रकाशित होने तक Google हर 7 दिन में कनेक्शन हटा देता है। बिल ढूँढते रहने के लिए फिर से जोड़ें।",
  },
  // accounts & transfers (v8)
  accounts: { en: "Accounts", hi: "खाते" },
  netWorth: { en: "Net position", hi: "कुल स्थिति" },
  youHold: { en: "You hold", hi: "आपके पास" },
  youOwe: { en: "You owe", hi: "आप पर बकाया" },
  addAccount: { en: "Add account", hi: "खाता जोड़ें" },
  editAccount: { en: "Edit account", hi: "खाता बदलें" },
  accountName: { en: "Account name", hi: "खाते का नाम" },
  accountNamePlaceholder: {
    en: "HDFC Savings, Cash, Paytm…",
    hi: "HDFC बचत, नकद, Paytm…",
  },
  lastDigits: {
    en: "Last 4 digits (optional)",
    hi: "आख़िरी 4 अंक (ज़रूरी नहीं)",
  },
  openingBalance: { en: "Balance today", hi: "आज का बैलेंस" },
  creditLimit: {
    en: "Credit limit (optional)",
    hi: "क्रेडिट सीमा (ज़रूरी नहीं)",
  },
  bank: { en: "Bank", hi: "बैंक" },
  cash: { en: "Cash", hi: "नकद" },
  wallet: { en: "Wallet", hi: "वॉलेट" },
  creditCard: { en: "Credit card", hi: "क्रेडिट कार्ड" },
  defaultAccount: { en: "Default", hi: "मुख्य" },
  makeDefault: { en: "Use as default account", hi: "मुख्य खाता बनाएँ" },
  available: { en: "available", hi: "उपलब्ध" },
  outstanding: { en: "outstanding", hi: "बकाया" },
  archiveAccount: { en: "Archive", hi: "हटाएँ" },
  noAccountsYet: {
    en: "Add your bank, cash and cards to see what you're actually worth.",
    hi: "बैंक, नकद और कार्ड जोड़ें — तभी असली स्थिति दिखेगी।",
  },
  unassignedNote: {
    en: "not linked to an account yet",
    hi: "अभी किसी खाते से नहीं जुड़ा",
  },
  transfer: { en: "Transfer", hi: "ट्रांसफ़र" },
  moveMoney: { en: "Move money", hi: "पैसे भेजें" },
  fromAccount: { en: "From", hi: "से" },
  toAccount: { en: "To", hi: "तक" },
  transferNote: {
    en: "Moving your own money isn't spending — it won't touch your totals.",
    hi: "अपना पैसा इधर-उधर करना खर्चा नहीं है — कुल में नहीं जुड़ेगा।",
  },
  cardPayment: { en: "Card payment", hi: "कार्ड भुगतान" },
  recordTransfer: { en: "Record transfer", hi: "ट्रांसफ़र दर्ज करें" },
  notSpending: {
    en: "Recorded as a transfer, not spending.",
    hi: "ट्रांसफ़र दर्ज हुआ, खर्चा नहीं।",
  },
  payFrom: { en: "Paid from", hi: "किस खाते से" },
} as const;

export type StringKey = keyof typeof STRINGS;

interface Settings {
  lang: Lang;
  scale: number; // 1 or 1.18 (large text)
  t: (key: StringKey) => string;
  fs: (size: number) => number;
  setLang: (l: Lang) => void;
  setLarge: (large: boolean) => void;
}

const SettingsContext = createContext<Settings>({
  lang: "en",
  scale: 1,
  t: (k) => STRINGS[k].en,
  fs: (s) => s,
  setLang: () => {},
  setLarge: () => {},
});

const LANG_KEY = "et_lang";
const SCALE_KEY = "et_large_text";
const LARGE_SCALE = 1.18;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [scale, setScale] = useState(1);

  useEffect(() => {
    AsyncStorage.multiGet([LANG_KEY, SCALE_KEY]).then((pairs) => {
      for (const [key, value] of pairs) {
        if (key === LANG_KEY && (value === "hi" || value === "en"))
          setLangState(value);
        if (key === SCALE_KEY && value === "1") setScale(LARGE_SCALE);
      }
    });
  }, []);

  const value: Settings = {
    lang,
    scale,
    t: (key) => STRINGS[key][lang],
    fs: (size) => Math.round(size * scale * 10) / 10,
    setLang: (l) => {
      setLangState(l);
      AsyncStorage.setItem(LANG_KEY, l);
    },
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
