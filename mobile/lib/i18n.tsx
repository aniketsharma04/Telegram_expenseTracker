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
  wherePlaceholder: { en: "Where / what for? (optional)", hi: "कहाँ / किस लिए? (ज़रूरी नहीं)" },
  sourcePlaceholder: { en: "From where? e.g. Salary (optional)", hi: "कहाँ से? जैसे तनख्वाह (ज़रूरी नहीं)" },
  today: { en: "Today", hi: "आज" },
  yesterday: { en: "Yesterday", hi: "कल" },
  save: { en: "Save", hi: "सहेजें" },
  splitWithFamily: { en: "Split equally with family", hi: "परिवार में बराबर बाँटें" },
  logged: { en: "Logged", hi: "दर्ज हुआ" },
  removed: { en: "Removed", hi: "हटाया गया" },
  undo: { en: "Undo", hi: "वापस लें" },
  addAnother: { en: "Add another", hi: "और जोड़ें" },
  holdToRecord: { en: "Voice", hi: "बोलें" },
  recording: { en: "Listening… tap to finish", hi: "सुन रहा हूँ… रोकने के लिए दबाएँ" },
  receipt: { en: "Receipt", hi: "रसीद" },
  gallery: { en: "Gallery", hi: "गैलरी" },
  // edit sheet
  editExpense: { en: "Edit expense", hi: "खर्चा बदलें" },
  delete: { en: "Delete", hi: "हटाएँ" },
  partOfSplit: { en: "Part of a family split", hi: "पारिवारिक बँटवारे का हिस्सा" },
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
        if (key === LANG_KEY && (value === "hi" || value === "en")) setLangState(value);
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
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
