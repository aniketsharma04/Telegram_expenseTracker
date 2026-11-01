import { useSettings, type Lang } from "../../lib/i18n";

/**
 * Aaj Cards copy, English and Hindi. Kept apart from the main string table
 * so the mini app can grow without crowding it. {x} placeholders are filled
 * by `t(key, { x })`.
 */
const en = {
  brand: "Aaj",
  brandCards: "Cards",
  tabWallet: "My cards",
  tabMissed: "Missed",
  tabExplore: "Explore",
  close: "Close",
  back: "Back",

  introTitle: "Get more from the cards you already have",
  introRow1: "See rewards you missed on your real spends",
  introRow2: "Find the card that pays most where you spend",
  introRow3:
    "Aaj never applies for anything for you and never sends your details to a bank",
  introFound: "We found {n} credit card(s) in your messages: {list}.",
  introNone:
    "We haven't seen a credit-card alert yet. You can add a card by hand.",
  introStart: "Set up my cards",
  introLater: "Not now",

  summary: "Last {days} days · {cards} card(s) · {spend} spent on cards",
  summaryEarly: "First {days} days · {cards} card(s)",
  earnedLabel: "Rewards you earned",
  couldHave: "You could have earned {amount} with the cards you already have",
  allGood: "You used your best card every time. Nice.",
  seeWhere: "See where",
  howWorked: "How is this worked out?",
  whichCard: "Which card is this?",
  choose: "Choose",
  unknownCard: "Card type unknown",
  unknownRough: "Numbers for this card are rough until you choose it.",
  addCard: "Add a card",
  useFor: "Use this card for…",
  footerRules:
    "Reward rules last checked {date}. Banks change rules; check your card's terms.",
  howCalc: "How we calculate",
  noCards: "No cards yet",
  noCardsBody:
    "When a credit-card alert arrives, Aaj will ask which card it is. You can also add one now.",
  newFound: "New card found",

  missedTitle: "Missed rewards",
  missedHead: "You earned {earned}. You could have earned {could}.",
  missedSub:
    "Using only the cards you already have. That's about {yearly} a year.",
  missedSubEarly: "Using only the cards you already have, in {days} days.",
  badgeGood: "Good data · {n} card spends",
  badgeSome: "Some estimates · pick your card type for exact numbers",
  badgeEarly: "Early estimate · {days} days of spending",
  paidWith: "Paid with {card} · {best} pays more",
  upiTitle: "Your UPI spends could earn too",
  upiBody:
    "{spend} paid by UPI could have earned {value} on your {card}, which works on UPI.",
  nothingMissed: "Nothing missed",
  nothingMissedBody: "Every card spend went on your best card for it.",
  needCards: "Tell us which cards you have",
  needCardsBody:
    "Missed rewards compare your own cards. Choose your card types on My cards first.",

  exploreTitle: "Explore",
  exploreIntro:
    "Cards that would pay you more on your spending, compared with what your cards earn now.",
  disclosure:
    "Ranked only by extra ₹ a year for you. Aaj earns nothing if you apply.",
  perYear: "+{amount} a year",
  afterFee: "after {fee} annual fee incl. GST",
  feeWaived: "annual fee waived at your spending",
  noFee: "no annual fee",
  mostlyFrom: "Mostly from {list}",
  whyCard: "Why this card",
  likely: "Likely",
  stretch: "Stretch",
  unlikely: "Unlikely",
  chanceNote: "Our guess, not the bank's decision.",
  likelyHint: "Worth a look.",
  stretchHint: "You may be asked for income proof or get a lower limit.",
  unlikelyHint: "We'd suggest waiting.",
  noNeed: "Your current cards already suit how you spend. No new card needed.",
  improveTitle: "Better approval estimates",
  improveBody:
    "Optional. Used only to show likely / stretch / unlikely. Never sent to a bank.",
  income: "Monthly take-home income (₹)",
  incomeFromSalary: "From your salary credits: about {amount} a month",
  score: "Credit score band",
  scoreUnknown: "Don't know",
  save: "Save",
  saved: "Saved. Numbers updated.",

  stressTitle: "Let's make your current cards work first",
  stressBody:
    "Your recent messages show: {what}. Paying the full bill on time saves more than any new card earns, so Aaj won't suggest new cards for now.",
  stressActions: "Missed rewards still work — they help without adding credit.",
  stressWrong: "This is wrong",
  stressCleared: "Thanks. We'll set those messages aside.",

  fees: "Fees",
  joining: "Joining fee",
  annual: "Annual fee",
  waiver: "Waived if you spend {amount} in a year",
  noWaiver: "Not waived by spending",
  plusGst: "+ 18% GST",
  rewards: "Rewards",
  base: "{rate}% on everything else",
  cap: "up to {cap}/month",
  perks: "Perks",
  lounge: "{d} domestic · {i} international lounge visits a year",
  forex: "{x}% forex markup",
  onUpi: "Works on UPI (RuPay)",
  yourSpend: "On your spending",
  rewardsYear: "Extra rewards a year",
  milestonesYear: "Milestone benefits",
  feeYear: "Annual fee incl. GST",
  netYear: "You'd gain about",
  checked: "Rules checked {date}",
  confidenceLow:
    "Some of these rules couldn't be fully confirmed — check the bank's terms.",
  approval: "Approval chances",
  approvalNote:
    "Based on your income and score band. We don't check your credit score. Only the bank decides, and applying may lead to a credit enquiry.",
  goBank: "Go to bank website",
  notInterested: "Not interested",

  leaveTitle: "You're going to the bank's website",
  leaveBody:
    "Aaj doesn't fill in or send your details. The bank will run its own checks.",
  leaveGo: "Continue to bank",
  leaveStay: "Stay in Aaj",

  matchTitle: "Which {bank} card ends in {last4}?",
  matchTitleAdd: "Add a card",
  matchContext:
    "Seen in {n} spend alert(s). Picking the right card makes your numbers accurate.",
  matchSearch: "Search cards",
  matchNotSure: "I'm not sure",
  matchNotMine: "Not a credit card / not mine",
  matchConfirm: "Confirm",
  matchHelp:
    "The card's name is printed on its front, e.g. “Millennia” or “Regalia”. Or open your bank app → Cards.",
  matchAllBanks: "All banks",
  matchProgress: "{i} of {n}",
  skip: "Skip",

  detailSpent: "In the last {days} days: spent {spend} · earned about {earned}",
  change: "Change",
  removeCard: "Remove this card",

  explainTitle: "How we got {amount}",
  explainSpend: "{label} spend ({days} days)",
  explainBest: "On {card}",
  explainActual: "What {card} earned",
  explainExtra: "Extra you could have earned",
  assumptions: "Assumptions",
  assume1:
    "Points are valued at what you'd get as cash or vouchers. Airline-mile transfers can be worth more.",
  assume2:
    "Monthly caps and excluded spends (fuel, rent, wallet loads…) are applied.",
  assume3: "Only your own captured spends are used; nothing is sent anywhere.",

  calcTitle: "How we calculate",
  calcBody1:
    "Aaj reads the card alerts it already captures, works out what each spend earned on the card you used, and what the best card you hold would have earned — with monthly caps, exclusions and fees.",
  calcBody2:
    "For new cards, we add each card to your wallet and put every spend on whichever card pays most. The gain over today, minus the annual fee with 18% GST (unless your spending waives it), is the number you see.",
  calcBody3:
    "Reward rules come from the banks' own terms, checked on the date shown. Points are valued at their cash or voucher value, so travel-transfer fans may get more. Banks change rules often, so treat numbers as estimates.",
  calcBody4:
    "Ranking is by your gain only. Aaj takes no money from banks and adds no tracking to bank links.",
  loading: "Loading your cards…",
  error: "Couldn't load your cards. Pull down to try again.",
  tryAgain: "Try again",
  somethingWrong: "Something went wrong. Try again.",

  alertTitle: "Rule change on {card}",
  alertUpcoming: "From {date}",
  alertFrom: "Since {date}",
  alertYou: "Touches where you spend",
  changesTitle: "Recent rule changes",
  changesNone: "No rule changes we know of in the last year.",
  trackTitle: "Fee waiver and milestones",
  trackPace: "At your pace: about {amount} a year on this card",
  trackOnTrack: "On track",
  trackShort: "{amount} short a year",
  trackNote:
    "We don't know your card's anniversary, so this uses your spending pace.",
  milestone: "{label} · worth {value}",
  breakdownHead: "{spend} over {n} spend(s)",
  breakdownCards: "What each of your cards pays here",
  breakdownBest: "Best",
  breakdownUsed: "You used",
  breakdownSpends: "Spends",
  breakdownTip: "Next time at {label}, use {card}.",
  privacyTitle: "Privacy & data",
  privacyLink: "Privacy & data",
  privacyUses: "What Cards uses",
  privacyUses1:
    "Spends and bank messages Aaj already captured. Nothing new is read.",
  privacyUses2:
    "Your card's bank and last 4 digits, which you confirm. Never the full number, CVV or PIN.",
  privacyUses3:
    "Income and score band only if you enter them, only for likely / stretch / unlikely.",
  privacyNever: "What Cards never does",
  privacyNever1: "Send your details to a bank or anyone else",
  privacyNever2: "Apply for a card or check your credit score",
  privacyNever3:
    "Earn money when you apply. Links go to the bank's own site with no tracking",
  forgetTitle: "Forget my cards",
  forgetBody:
    "Removes your saved cards, income and score band. Your spends and messages stay in Aaj.",
  forgetConfirm: "Yes, forget my cards",
  forgetDone: "Your cards are forgotten.",
  turnOffTitle: "Turn off Aaj Cards",
  turnOffBody: "Hides Cards from Today. Turn it back on any time in Settings.",
  turnOff: "Turn off",
  cancel: "Cancel",
} as const;

export type CardsKey = keyof typeof en;

const hi: Partial<Record<CardsKey, string>> = {
  brandCards: "कार्ड्स",
  tabWallet: "मेरे कार्ड",
  tabMissed: "छूटे रिवॉर्ड",
  tabExplore: "नए कार्ड",
  close: "बंद करें",
  back: "पीछे",

  introTitle: "अपने कार्ड्स से ज़्यादा पाएँ",
  introRow1: "देखें आपके असली खर्च पर कौन-से रिवॉर्ड छूट गए",
  introRow2: "वह कार्ड ढूँढें जो आपके खर्च पर सबसे ज़्यादा देता है",
  introRow3:
    "Aaj आपके लिए कभी आवेदन नहीं करता और आपकी जानकारी किसी बैंक को नहीं भेजता",
  introFound: "आपके मैसेज में {n} क्रेडिट कार्ड मिले: {list}.",
  introNone:
    "अभी तक कोई क्रेडिट कार्ड अलर्ट नहीं मिला। आप खुद कार्ड जोड़ सकते हैं।",
  introStart: "मेरे कार्ड सेट करें",
  introLater: "अभी नहीं",

  summary: "पिछले {days} दिन · {cards} कार्ड · कार्ड से {spend} खर्च",
  summaryEarly: "पहले {days} दिन · {cards} कार्ड",
  earnedLabel: "आपने कमाए रिवॉर्ड",
  couldHave: "आपके पास मौजूद कार्ड्स से {amount} मिल सकते थे",
  allGood: "आपने हर बार सबसे अच्छा कार्ड इस्तेमाल किया। बढ़िया!",
  seeWhere: "कहाँ, देखें",
  howWorked: "यह कैसे निकाला?",
  whichCard: "यह कौन-सा कार्ड है?",
  choose: "चुनें",
  unknownCard: "कार्ड का प्रकार पता नहीं",
  unknownRough: "कार्ड चुनने तक इसके आँकड़े अंदाज़े हैं।",
  addCard: "कार्ड जोड़ें",
  useFor: "यह कार्ड इसके लिए इस्तेमाल करें…",
  footerRules:
    "रिवॉर्ड नियम आख़िरी बार {date} को जाँचे गए। बैंक नियम बदलते हैं; अपने कार्ड की शर्तें देखें।",
  howCalc: "हम कैसे गिनते हैं",
  noCards: "अभी कोई कार्ड नहीं",
  noCardsBody:
    "क्रेडिट कार्ड अलर्ट आने पर Aaj पूछेगा कि यह कौन-सा कार्ड है। आप अभी भी कार्ड जोड़ सकते हैं।",
  newFound: "नया कार्ड मिला",

  missedTitle: "छूटे रिवॉर्ड",
  missedHead: "आपने {earned} कमाए। {could} कमा सकते थे।",
  missedSub: "सिर्फ़ आपके मौजूदा कार्ड्स से। साल में लगभग {yearly}।",
  missedSubEarly: "सिर्फ़ आपके मौजूदा कार्ड्स से, {days} दिनों में।",
  badgeGood: "अच्छा डेटा · कार्ड से {n} खर्च",
  badgeSome: "कुछ अंदाज़े · सही आँकड़ों के लिए कार्ड का प्रकार चुनें",
  badgeEarly: "शुरुआती अंदाज़ा · {days} दिन का खर्च",
  paidWith: "{card} से भुगतान · {best} ज़्यादा देता है",
  upiTitle: "आपके UPI खर्च पर भी कमाई हो सकती है",
  upiBody:
    "UPI से दिए {spend} पर आपके {card} से {value} मिल सकते थे, यह UPI पर चलता है।",
  nothingMissed: "कुछ नहीं छूटा",
  nothingMissedBody: "हर खर्च सबसे अच्छे कार्ड से हुआ।",
  needCards: "बताएँ आपके पास कौन-से कार्ड हैं",
  needCardsBody:
    "छूटे रिवॉर्ड आपके अपने कार्ड्स की तुलना करते हैं। पहले मेरे कार्ड में कार्ड का प्रकार चुनें।",

  exploreTitle: "नए कार्ड",
  exploreIntro:
    "वे कार्ड जो आपके खर्च पर आपके मौजूदा कार्ड्स से ज़्यादा देंगे।",
  disclosure:
    "सिर्फ़ आपके सालाना फ़ायदे से क्रम। आवेदन करने पर Aaj कुछ नहीं कमाता।",
  perYear: "+{amount} सालाना",
  afterFee: "GST सहित {fee} सालाना फ़ीस के बाद",
  feeWaived: "आपके खर्च पर सालाना फ़ीस माफ़",
  noFee: "कोई सालाना फ़ीस नहीं",
  mostlyFrom: "ज़्यादातर {list} से",
  whyCard: "यह कार्ड क्यों",
  likely: "संभावित",
  stretch: "मुश्किल",
  unlikely: "असंभावित",
  chanceNote: "यह हमारा अनुमान है, बैंक का फ़ैसला नहीं।",
  likelyHint: "देखने लायक।",
  stretchHint: "आय का सबूत माँगा जा सकता है या कम लिमिट मिल सकती है।",
  unlikelyHint: "हमारी सलाह है कि अभी रुकें।",
  noNeed:
    "आपके मौजूदा कार्ड आपके खर्च के लिए पहले से सही हैं। नए कार्ड की ज़रूरत नहीं।",
  improveTitle: "बेहतर अनुमान",
  improveBody:
    "वैकल्पिक। सिर्फ़ संभावित / मुश्किल / असंभावित दिखाने के लिए। किसी बैंक को नहीं भेजा जाता।",
  income: "महीने की इन-हैंड आय (₹)",
  incomeFromSalary: "आपकी सैलरी से: लगभग {amount} महीना",
  score: "क्रेडिट स्कोर रेंज",
  scoreUnknown: "पता नहीं",
  save: "सेव करें",
  saved: "सेव हो गया।",

  stressTitle: "पहले मौजूदा कार्ड्स को सही चलाएँ",
  stressBody:
    "आपके हाल के मैसेज में दिखा: {what}। पूरा बिल समय पर भरना किसी भी नए कार्ड से ज़्यादा बचाता है, इसलिए Aaj अभी नए कार्ड नहीं सुझाएगा।",
  stressActions: "छूटे रिवॉर्ड अब भी काम करते हैं, बिना नया क्रेडिट लिए।",
  stressWrong: "यह गलत है",
  stressCleared: "धन्यवाद। हम उन मैसेज को अलग रख देंगे।",

  fees: "फ़ीस",
  joining: "जॉइनिंग फ़ीस",
  annual: "सालाना फ़ीस",
  waiver: "साल में {amount} खर्च पर माफ़",
  noWaiver: "खर्च से माफ़ नहीं होती",
  plusGst: "+ 18% GST",
  rewards: "रिवॉर्ड",
  base: "बाकी सब पर {rate}%",
  cap: "महीने में {cap} तक",
  perks: "फ़ायदे",
  lounge: "साल में {d} घरेलू · {i} अंतरराष्ट्रीय लाउंज विज़िट",
  forex: "{x}% फ़ॉरेक्स मार्कअप",
  onUpi: "UPI पर चलता है (RuPay)",
  yourSpend: "आपके खर्च पर",
  rewardsYear: "साल में अतिरिक्त रिवॉर्ड",
  milestonesYear: "माइलस्टोन फ़ायदे",
  feeYear: "GST सहित सालाना फ़ीस",
  netYear: "आपका लगभग फ़ायदा",
  checked: "नियम {date} को जाँचे गए",
  confidenceLow:
    "इनमें से कुछ नियम पूरी तरह पक्के नहीं हो सके, बैंक की शर्तें देखें।",
  approval: "मंज़ूरी की संभावना",
  approvalNote:
    "आपकी आय और स्कोर रेंज पर आधारित। हम आपका क्रेडिट स्कोर नहीं देखते। फ़ैसला सिर्फ़ बैंक करता है, और आवेदन से क्रेडिट जाँच हो सकती है।",
  goBank: "बैंक की वेबसाइट पर जाएँ",
  notInterested: "दिलचस्पी नहीं",

  leaveTitle: "आप बैंक की वेबसाइट पर जा रहे हैं",
  leaveBody:
    "Aaj आपकी जानकारी न भरता है, न भेजता है। बैंक अपनी जाँच खुद करेगा।",
  leaveGo: "बैंक पर जाएँ",
  leaveStay: "Aaj में रहें",

  matchTitle: "{last4} पर ख़त्म होने वाला {bank} कार्ड कौन-सा है?",
  matchTitleAdd: "कार्ड जोड़ें",
  matchContext:
    "{n} खर्च अलर्ट में दिखा। सही कार्ड चुनने से आँकड़े सटीक होते हैं।",
  matchSearch: "कार्ड खोजें",
  matchNotSure: "पक्का नहीं पता",
  matchNotMine: "क्रेडिट कार्ड नहीं / मेरा नहीं",
  matchConfirm: "पक्का करें",
  matchHelp:
    "कार्ड का नाम उसके सामने छपा होता है, जैसे Millennia या Regalia। या बैंक ऐप में Cards खोलें।",
  matchAllBanks: "सभी बैंक",
  matchProgress: "{n} में से {i}",
  skip: "छोड़ें",

  detailSpent: "पिछले {days} दिन: {spend} खर्च · लगभग {earned} कमाए",
  change: "बदलें",
  removeCard: "यह कार्ड हटाएँ",

  explainTitle: "{amount} कैसे निकला",
  explainSpend: "{label} खर्च ({days} दिन)",
  explainBest: "{card} पर",
  explainActual: "{card} ने कमाए",
  explainExtra: "आप इतना ज़्यादा कमा सकते थे",
  assumptions: "मान्यताएँ",
  assume1:
    "पॉइंट्स की क़ीमत कैश या वाउचर के हिसाब से है। एयरलाइन माइल्स में ज़्यादा हो सकती है।",
  assume2:
    "महीने की सीमा और बाहर रखे खर्च (फ़्यूल, किराया, वॉलेट लोड…) लागू हैं।",
  assume3:
    "सिर्फ़ आपके अपने दर्ज खर्च इस्तेमाल होते हैं; कुछ भी कहीं नहीं भेजा जाता।",

  calcTitle: "हम कैसे गिनते हैं",
  calcBody1:
    "Aaj पहले से दर्ज कार्ड अलर्ट पढ़ता है, देखता है कि हर खर्च पर इस्तेमाल कार्ड ने क्या दिया, और आपके सबसे अच्छे कार्ड ने क्या दिया होता, महीने की सीमा, छूट और फ़ीस के साथ।",
  calcBody2:
    "नए कार्ड के लिए, हम हर कार्ड को आपके वॉलेट में जोड़कर हर खर्च सबसे ज़्यादा देने वाले कार्ड पर रखते हैं। आज से ज़्यादा फ़ायदा, 18% GST सहित सालाना फ़ीस घटाकर (अगर खर्च से माफ़ न हो), वही संख्या दिखती है।",
  calcBody3:
    "रिवॉर्ड नियम बैंकों की अपनी शर्तों से हैं, दिखाई गई तारीख़ पर जाँचे गए। पॉइंट्स की क़ीमत कैश या वाउचर के हिसाब से है। बैंक अक्सर नियम बदलते हैं, इसलिए इन्हें अंदाज़ा मानें।",
  calcBody4:
    "क्रम सिर्फ़ आपके फ़ायदे से है। Aaj बैंकों से कोई पैसा नहीं लेता और बैंक लिंक में कोई ट्रैकिंग नहीं जोड़ता।",
  loading: "आपके कार्ड लोड हो रहे हैं…",
  error: "आपके कार्ड लोड नहीं हो सके। फिर से कोशिश करने के लिए नीचे खींचें।",
  tryAgain: "फिर कोशिश करें",
  somethingWrong: "कुछ गड़बड़ हुई। फिर कोशिश करें।",

  alertTitle: "{card} के नियम बदले",
  alertUpcoming: "{date} से",
  alertFrom: "{date} से लागू",
  alertYou: "आपके खर्च से जुड़ा",
  changesTitle: "हाल के नियम बदलाव",
  changesNone: "पिछले साल में हमें कोई बदलाव नहीं पता।",
  trackTitle: "फ़ीस माफ़ी और माइलस्टोन",
  trackPace: "आपकी रफ़्तार से: इस कार्ड पर साल में लगभग {amount}",
  trackOnTrack: "सही राह पर",
  trackShort: "साल में {amount} कम",
  trackNote:
    "हमें आपके कार्ड की सालगिरह नहीं पता, इसलिए यह आपके खर्च की रफ़्तार से है।",
  milestone: "{label} · क़ीमत {value}",
  breakdownHead: "{n} खर्च में {spend}",
  breakdownCards: "आपका हर कार्ड यहाँ क्या देता है",
  breakdownBest: "सबसे अच्छा",
  breakdownUsed: "आपने इस्तेमाल किया",
  breakdownSpends: "खर्च",
  breakdownTip: "अगली बार {label} पर {card} इस्तेमाल करें।",
  privacyTitle: "प्राइवेसी और डेटा",
  privacyLink: "प्राइवेसी और डेटा",
  privacyUses: "Cards क्या इस्तेमाल करता है",
  privacyUses1:
    "Aaj में पहले से दर्ज खर्च और बैंक मैसेज। कुछ नया नहीं पढ़ा जाता।",
  privacyUses2:
    "आपके कार्ड का बैंक और आख़िरी 4 अंक, जिन्हें आप पक्का करते हैं। कभी पूरा नंबर, CVV या PIN नहीं।",
  privacyUses3:
    "आय और स्कोर रेंज सिर्फ़ अगर आप डालें, सिर्फ़ संभावना दिखाने के लिए।",
  privacyNever: "Cards कभी नहीं करता",
  privacyNever1: "आपकी जानकारी किसी बैंक या किसी और को भेजना",
  privacyNever2: "कार्ड के लिए आवेदन या आपका क्रेडिट स्कोर जाँचना",
  privacyNever3:
    "आपके आवेदन से पैसा कमाना। लिंक बिना ट्रैकिंग के बैंक की अपनी साइट पर जाते हैं",
  forgetTitle: "मेरे कार्ड भूल जाएँ",
  forgetBody:
    "आपके सेव कार्ड, आय और स्कोर रेंज हटा देता है। आपके खर्च और मैसेज Aaj में रहते हैं।",
  forgetConfirm: "हाँ, मेरे कार्ड भूल जाएँ",
  forgetDone: "आपके कार्ड भुला दिए गए।",
  turnOffTitle: "Aaj कार्ड्स बंद करें",
  turnOffBody: "Today से Cards छिप जाएगा। Settings में कभी भी फिर चालू करें।",
  turnOff: "बंद करें",
  cancel: "रद्द करें",
};

const TABLES: Record<Lang, Partial<Record<CardsKey, string>>> = { en, hi };

export function cardsT(
  lang: Lang,
  key: CardsKey,
  vars?: Record<string, string | number>,
): string {
  let s = TABLES[lang][key] ?? en[key];
  if (vars)
    for (const [k, v] of Object.entries(vars))
      s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useCardsT() {
  const { lang } = useSettings();
  return (key: CardsKey, vars?: Record<string, string | number>) =>
    cardsT(lang, key, vars);
}
