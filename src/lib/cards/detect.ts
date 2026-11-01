import { parseBankMessage } from "../bank-message";

/**
 * Which credit cards does this user hold? The bank messages say:
 * "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS". Each
 * (bank, last 4) seen on a credit-card spend is a card to confirm, with a
 * product guess when the message names one ("Amazon Pay ICICI").
 */

const BANKS: Array<[RegExp, string]> = [
  [/\bhdfc\b/i, "HDFC"],
  [/\bsbi\b|state bank/i, "SBI"],
  [/\bicici\b/i, "ICICI"],
  [/\baxis\b/i, "Axis"],
  [/\bkotak\b/i, "Kotak"],
  [/\bidfc\b/i, "IDFC FIRST"],
  [/\bindusind\b/i, "IndusInd"],
  [/\b(?:au small finance|au bank|\bau\b (?:credit )?card)\b/i, "AU"],
  [/\bamex\b|american express/i, "Amex"],
  [/\bhsbc\b/i, "HSBC"],
  [/\byes ?bank\b/i, "YES"],
  [/\brbl\b/i, "RBL"],
  [/\bbob\b|bank of baroda|bobcard/i, "BOB"],
  [/\bfederal\b/i, "Federal"],
  [/\bonecard\b|one card/i, "OneCard"],
  [/\bscapia\b/i, "Scapia"],
  [/\bstandard chartered\b|\bsc bank\b/i, "Standard Chartered"],
  [/\bcanara\b/i, "Canara"],
  [/\bpnb\b|punjab national/i, "PNB"],
  [/\bunion bank\b/i, "Union Bank"],
];

/** Product names banks put in their alerts. Keys are catalogue keys. */
const PRODUCT_HINTS: Array<[RegExp, string]> = [
  [/amazon pay icici/i, "icici-amazon-pay"],
  [/swiggy (?:hdfc )?blck|blck/i, "hdfc-swiggy-blck"],
  [/swiggy (?:hdfc )?ornge|ornge/i, "hdfc-swiggy-ornge"],
  [/swiggy hdfc|hdfc bank swiggy/i, "hdfc-swiggy-legacy"],
  [/tata neu infinity/i, "hdfc-tata-neu-infinity"],
  [/tata neu plus/i, "hdfc-tata-neu-plus"],
  [/flipkart axis|axis bank flipkart/i, "axis-flipkart"],
  [/airtel axis|axis bank airtel/i, "axis-airtel"],
  [/\bmillennia\b/i, "hdfc-millennia"],
  [/regalia gold/i, "hdfc-regalia-gold"],
  [/\binfinia\b/i, "hdfc-infinia"],
  [/simplyclick/i, "sbi-simplyclick"],
  [/simplysave/i, "sbi-simplysave"],
  [/cashback sbi|sbi card cashback|sbi cashback/i, "sbi-cashback"],
  [/bpcl/i, "sbi-bpcl-octane"],
  [/\batlas\b/i, "axis-atlas"],
  [/\bmagnus\b/i, "axis-magnus"],
  [/\bmyzone\b/i, "axis-myzone"],
  [/\bcoral\b/i, "icici-coral-rupay"],
  [/\bsapphiro\b/i, "icici-sapphiro"],
  [/\bscapia\b/i, "scapia-federal"],
  [/\bonecard\b|one card/i, "onecard"],
  [/flipkart sbi|sbi flipkart/i, "sbi-flipkart"],
  [/\bkiwi\b/i, "kiwi-rupay"],
  [/sbi card prime|\bprime\b.{0,20}\bsbi\b/i, "sbi-prime"],
  [/sbi card elite|\belite\b.{0,20}\bsbi\b/i, "sbi-elite"],
  [/\bmrcc\b|membership rewards/i, "amex-mrcc"],
  [/\blive\+|\blive plus\b/i, "hsbc-live-plus"],
];

export interface DetectedCard {
  bank: string;
  last4: string;
  productGuess: string | null;
  spends: number;
  lastSeen: string;
}

export interface CardMessage {
  id: string;
  body: string;
  received_at: string;
  expense_id?: string | null;
}

/** A credit card, not a debit card, prepaid or forex card. */
export function isCreditCardMessage(body: string): boolean {
  if (/\bdebit card\b|\bprepaid\b|\bforex card\b/i.test(body)) return false;
  return /\bcredit card\b|\bcc\b|\bamex\b|american express|\bonecard\b|\bscapia\b/i.test(
    body,
  );
}

export function bankOf(body: string): string | null {
  for (const [re, bank] of BANKS) if (re.test(body)) return bank;
  return null;
}

export function productHint(body: string): string | null {
  for (const [re, key] of PRODUCT_HINTS) if (re.test(body)) return key;
  return null;
}

/** last4 of the card a message is about, when it is a credit card. */
export function cardOf(body: string): { bank: string; last4: string } | null {
  if (!isCreditCardMessage(body)) return null;
  const bank = bankOf(body);
  const hint = parseBankMessage(body)?.accountHint ?? null;
  const last4 = hint?.replace(/\D/g, "").slice(-4) ?? null;
  if (!bank || !last4 || last4.length !== 4) return null;
  return { bank, last4 };
}

export function detectCards(messages: CardMessage[]): DetectedCard[] {
  const found = new Map<string, DetectedCard>();
  for (const m of messages) {
    const card = cardOf(m.body);
    if (!card) continue;
    const key = `${card.bank}|${card.last4}`;
    const d = found.get(key) ?? {
      ...card,
      productGuess: null,
      spends: 0,
      lastSeen: m.received_at,
    };
    d.productGuess ??= productHint(m.body);
    if (m.expense_id) d.spends += 1;
    if (m.received_at > d.lastSeen) d.lastSeen = m.received_at;
    found.set(key, d);
  }
  return [...found.values()].sort((a, b) => b.spends - a.spends);
}
