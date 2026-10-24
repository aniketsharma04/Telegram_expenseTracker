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
    en: 'Type it like a text: "250 groceries at More"',
    hi: 'जैसे मैसेज करते हैं, वैसे "250 सब्ज़ी" लिखें',
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
    en: "Cap a category (or everything) per month. You'll get a heads-up at 80% and 100%.",
    hi: "महीने की सीमा तय करें। 80% और 100% पर आपको बताया जाएगा।",
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
    en: "Add your monthly bills once: electricity, water, credit card, rent. I'll remind you before they're due, and Pay now opens your UPI app with the amount filled in.",
    hi: "अपने मासिक बिल एक बार जोड़ें: बिजली, पानी, क्रेडिट कार्ड, किराया। समय से पहले याद दिलाऊँगा, और 'अभी चुकाएँ' से UPI ऐप में रकम भरी मिलेगी।",
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
    en: "No UPI ID saved. Open your app to pay:",
    hi: "UPI ID नहीं है। ऐप खोलकर चुकाएँ:",
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
    en: "Search billers: BSES, HDFC card, Airtel…",
    hi: "बिलर खोजें: BSES, HDFC कार्ड, Airtel…",
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
    en: "Demo billers until Bharat Connect is live. Numbers ending in 00 have no dues; 99 means not found.",
    hi: "Bharat Connect जुड़ने तक डेमो बिलर। 00 पर खत्म = बकाया नहीं, 99 = नहीं मिला।",
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
    hi: "सिर्फ़ पढ़ने के लिए। ऐप बिल वाले ईमेल ढूँढता है, कुछ भेजता या मिटाता नहीं।",
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
    hi: "बैंक, नकद और कार्ड जोड़ें, तभी असली स्थिति दिखेगी।",
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
    en: "Moving your own money isn't spending, so it won't touch your totals.",
    hi: "अपना पैसा इधर-उधर करना खर्चा नहीं है, कुल में नहीं जुड़ेगा।",
  },
  cardPayment: { en: "Card payment", hi: "कार्ड भुगतान" },
  recordTransfer: { en: "Record transfer", hi: "ट्रांसफ़र दर्ज करें" },
  notSpending: {
    en: "Recorded as a transfer, not spending.",
    hi: "ट्रांसफ़र दर्ज हुआ, खर्चा नहीं।",
  },
  payFrom: { en: "Paid from", hi: "किस खाते से" },
  // itemised receipts (v10)
  billItems: { en: "On this bill", hi: "इस बिल में" },
  billSubtotal: { en: "Subtotal", hi: "उप-योग" },
  billTax: { en: "Tax & charges", hi: "कर व शुल्क" },
  billDiscount: { en: "Discount", hi: "छूट" },
  billTip: { en: "Tip", hi: "टिप" },
  billTotal: { en: "Total", hi: "कुल" },
  billPartial: {
    en: "The lines don't add up to the total. Some may have been missed.",
    hi: "लाइनें कुल से मेल नहीं खातीं। कुछ छूट गई होंगी।",
  },
  // auto-capture (v9)
  autoCapture: {
    en: "Auto-capture from notifications",
    hi: "सूचनाओं से अपने-आप दर्ज",
  },
  captureBlurb: {
    en: "Read bank SMS alerts as they arrive, so spending logs itself and balances stay right.",
    hi: "बैंक के SMS अपने-आप पढ़े जाएँगे, जिससे खर्चे खुद दर्ज हों और बैलेंस सही रहे।",
  },
  captureOn: {
    en: "On. Payments are captured and counted as they happen.",
    hi: "चालू है। पेमेंट होते ही दर्ज और गिने जाते हैं।",
  },
  // capture setup card (v15) — doubles as the Play "prominent disclosure"
  setupTitle: { en: "Track spending automatically", hi: "खर्चे अपने-आप ट्रैक करें" },
  setupDisclosure: {
    en: "To log payments for you, this app reads notifications from your SMS app, bank apps and UPI apps, and only the ones that mention money being debited or credited. The amount, merchant and balance are sent securely to your account to update your budget. Messages containing OTPs or codes are skipped on your phone and never sent. Other notifications (chats, email) are ignored.",
    hi: "आपके पेमेंट दर्ज करने के लिए यह ऐप SMS, बैंक और UPI ऐप्स की सूचनाएँ पढ़ता है, सिर्फ़ वे जिनमें पैसे कटने या आने की बात हो। रकम, दुकान और बैलेंस आपके खाते में सुरक्षित भेजे जाते हैं। OTP या कोड वाले मैसेज फ़ोन पर ही छोड़ दिए जाते हैं, कभी भेजे नहीं जाते। बाकी सूचनाएँ (चैट, ईमेल) अनदेखी की जाती हैं।",
  },
  setupStep1: { en: "Allow notification access", hi: "सूचना पढ़ने की अनुमति दें" },
  setupStep2: { en: "Let it run in the background", hi: "बैकग्राउंड में चलने दें" },
  setupStep2Hint: {
    en: "Choose “All apps”, find Expense Tracker, set it to “Don't optimise”.",
    hi: "“सभी ऐप्स” चुनें, Expense Tracker ढूँढें, “Don't optimise” चुनें।",
  },
  setupStep3: { en: "Turn on Autostart", hi: "ऑटोस्टार्ट चालू करें" },
  setupStep3Hint: {
    en: "Your phone stops apps it thinks are idle. In app info, turn on Autostart (or allow background activity).",
    hi: "आपका फ़ोन बंद पड़े ऐप रोक देता है। ऐप इंफ़ो में ऑटोस्टार्ट (या बैकग्राउंड गतिविधि) चालू करें।",
  },
  agreeTurnOn: { en: "Agree & turn on", hi: "सहमत हूँ, चालू करें" },
  open: { en: "Open", hi: "खोलें" },
  setupDone: { en: "Done", hi: "हो गया" },
  grantAccess: { en: "Grant access", hi: "अनुमति दें" },
  grantHint: {
    en: 'Find "Expense Tracker" in the list and turn it on, then come back.',
    hi: 'सूची में "Expense Tracker" चुनकर चालू करें, फिर वापस आएँ।',
  },
  syncNow: { en: "Sync now", hi: "अभी सिंक करें" },
  capturePending: { en: "waiting to upload", hi: "अपलोड बाकी" },
  captureLogged: { en: "logged", hi: "दर्ज हुए" },
  captureSkipped: { en: "already known", hi: "पहले से दर्ज" },
  captureNothing: { en: "Nothing new to capture.", hi: "कुछ नया नहीं मिला।" },
  captureFailed: {
    en: "Couldn't upload. Kept for the next try.",
    hi: "अपलोड नहीं हुआ। अगली बार फिर कोशिश होगी।",
  },
  bankSays: { en: "Bank says", hi: "बैंक के अनुसार" },
  checkDrift: {
    en: "off from what's logged, so some spending wasn't captured",
    hi: "दर्ज रकम से अंतर, कुछ खर्चे दर्ज नहीं हुए",
  },
  // daily budget (v14)
  dailyBudget: { en: "Daily budget", hi: "रोज़ का बजट" },
  leftToday: { en: "left to spend today", hi: "आज खर्च के लिए बचे" },
  overToday: { en: "over today's budget", hi: "आज के बजट से ज़्यादा" },
  ofToday: { en: "of", hi: "में से" },
  setUpDaily: { en: "Set up", hi: "सेट करें" },
  editPlan: { en: "Plan", hi: "प्लान" },
  dailyHint: {
    en: "Tell the app your monthly income and fixed costs, and it turns them into one number to spend each day.",
    hi: "अपनी महीने की आमदनी और तय खर्चे बताइए। ऐप उन्हें रोज़ खर्च करने लायक एक रकम में बदल देगा।",
  },
  everydayMoney: { en: "Everyday money left", hi: "रोज़मर्रा के लिए बचे" },
  daysToGo: { en: "days to go", hi: "दिन बाकी" },
  tomorrow: { en: "Tomorrow", hi: "कल" },
  streakDays: { en: "day streak under budget", hi: "दिन से बजट के अंदर" },
  notCounted: { en: "Not counted", hi: "गिना नहीं गया" },
  monthlyIncome: { en: "Monthly income", hi: "महीने की आमदनी" },
  savingsGoal: { en: "Savings goal / month", hi: "महीने की बचत का लक्ष्य" },
  payday: { en: "Salary day", hi: "तनख्वाह का दिन" },
  // your data (Play: export, privacy, in-app deletion)
  yourData: { en: "Your data", hi: "आपका डेटा" },
  exportData: { en: "Export", hi: "एक्सपोर्ट" },
  privacyPolicy: { en: "Privacy policy", hi: "प्राइवेसी नीति" },
  deleteAccount: { en: "Delete account", hi: "खाता हटाएँ" },
  deleteConfirm: { en: "Yes, delete everything", hi: "हाँ, सब हटा दें" },
  deleteWarning: {
    en: "This permanently deletes your account and all your expenses, income, plan, goals and notifications. It can't be undone, so export first if you want a copy.",
    hi: "यह आपका खाता और सारे खर्चे, आमदनी, प्लान, लक्ष्य और सूचनाएँ हमेशा के लिए हटा देगा। वापस नहीं होगा, इसलिए कॉपी चाहिए तो पहले एक्सपोर्ट करें।",
  },
  exportFailed: { en: "Couldn't export. Try again.", hi: "एक्सपोर्ट नहीं हुआ। फिर कोशिश करें।" },
  deleteFailed: { en: "Couldn't delete. Try again.", hi: "हटाया नहीं जा सका। फिर कोशिश करें।" },
  // goals (v17)
  goals: { en: "Goals", hi: "लक्ष्य" },
  addGoal: { en: "Add a goal", hi: "लक्ष्य जोड़ें" },
  goalsHint: {
    en: "Saving for a trip, a phone, an emergency fund? Set a goal. Its monthly share is set aside first and added to the goal automatically each month.",
    hi: "ट्रिप, फ़ोन, इमरजेंसी फ़ंड के लिए बचत? लक्ष्य बनाइए। हर महीने का हिस्सा पहले अलग होता है और अपने-आप जुड़ता है।",
  },
  goalName: { en: "What for? e.g. Goa trip", hi: "किसके लिए? जैसे गोवा ट्रिप" },
  goalTarget: { en: "How much", hi: "कितना" },
  goalBy: { en: "By when (YYYY-MM)", hi: "कब तक (YYYY-MM)" },
  goalMonthly: { en: "or ₹ per month", hi: "या ₹ हर महीने" },
  perMonth: { en: "/month", hi: "/महीना" },
  onTrack: { en: "on track", hi: "समय पर" },
  behind: { en: "behind", hi: "पीछे" },
  monthsToGo: { en: "months to go", hi: "महीने बाकी" },
  reached: { en: "Reached 🎉", hi: "पूरा हुआ 🎉" },
  stopGoal: { en: "Stop goal", hi: "लक्ष्य बंद करें" },
  paydayHint: {
    en: "Your budget month runs from this day to the day before the next one. Leave empty for calendar months.",
    hi: "आपका बजट महीना इस दिन से अगली तनख्वाह से एक दिन पहले तक चलता है। खाली छोड़ें तो कैलेंडर महीना।",
  },
  fixedCosts: { en: "Fixed monthly costs", hi: "हर महीने के तय खर्चे" },
  fixedHint: {
    en: "Rent, EMI, SIP and subscriptions stay out of the daily number.",
    hi: "किराया, EMI, SIP और सब्सक्रिप्शन रोज़ के बजट में नहीं गिने जाते।",
  },
  suggestedFixed: { en: "Looks like a fixed cost", hi: "तय खर्चा लगता है" },
  costName: { en: "Name, e.g. Rent", hi: "नाम, जैसे किराया" },
  add: { en: "Add", hi: "जोड़ें" },
  morningMsg: { en: "Morning message", hi: "सुबह का मैसेज" },
  eveningMsg: { en: "Night report", hi: "रात की रिपोर्ट" },
  liveMsg: { en: "Ping on every spend", hi: "हर खर्चे पर मैसेज" },
  messagesVia: {
    en: "These arrive as notifications on this phone.",
    hi: "ये इस फ़ोन पर नोटिफ़िकेशन की तरह आते हैं।",
  },
  // inbox + push (v15)
  inbox: { en: "Notifications", hi: "सूचनाएँ" },
  inboxEmpty: {
    en: "Nothing yet. Your morning number, spends and alerts will show up here.",
    hi: "अभी कुछ नहीं। सुबह का बजट, खर्चे और अलर्ट यहाँ दिखेंगे।",
  },
  movedToSavings: { en: "Moved to savings ✓", hi: "बचत में डाला ✓" },
  pushTitle: { en: "Get your daily number", hi: "रोज़ का बजट पाएँ" },
  pushHint: {
    en: "A morning brief, a ping when money leaves your account, and a short report at night.",
    hi: "सुबह का बजट, पैसा कटने पर सूचना, और रात को छोटी रिपोर्ट।",
  },
  pushTurnOn: { en: "Turn on notifications", hi: "सूचनाएँ चालू करें" },
  pushBlocked: {
    en: "Notifications are off for this app. Turn them on in Settings to get your daily number.",
    hi: "इस ऐप की सूचनाएँ बंद हैं। रोज़ का बजट पाने के लिए सेटिंग्स में चालू करें।",
  },
  openSettings: { en: "Open settings", hi: "सेटिंग्स खोलें" },
  notNow: { en: "Not now", hi: "अभी नहीं" },
  fromSavings: { en: "Paid from savings", hi: "बचत से दिया" },
  fromSavingsHint: {
    en: "Won't touch your daily budget.",
    hi: "रोज़ के बजट पर असर नहीं होगा।",
  },
  perDay: { en: "/day", hi: "/दिन" },
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
