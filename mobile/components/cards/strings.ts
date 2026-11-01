/**
 * Aaj Cards copy. Kept apart from the main string table
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
  tipsTitle: "Card tips on spend alerts",
  tipsBody:
    "When you pay with one card and another of yours pays clearly more there, the spend alert says which to use next time. Only with two cards named.",
  tipsOn: "On",
  tipsOff: "Off",
  turnOff: "Turn off",
  cancel: "Cancel",
} as const;

export type CardsKey = keyof typeof en;

export function cardsT(
  key: CardsKey,
  vars?: Record<string, string | number>,
): string {
  let s: string = en[key];
  if (vars)
    for (const [k, v] of Object.entries(vars))
      s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useCardsT() {
  return cardsT;
}
