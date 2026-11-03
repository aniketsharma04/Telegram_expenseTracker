/**
 * Card art and product pages, straight from each bank's own website.
 *
 * Every image here was found on the issuer's product or card-listing page and
 * checked by eye against the card it's filed under (2026-11-02). Cards with no
 * clean, verified face image are left out: the app draws them instead of
 * showing a picture that might be the wrong card. The app loads these through
 * Aaj's image optimiser (next.config `images.remotePatterns`), which resizes
 * and caches them; the bank sites are hit once per image, not per user.
 *
 * `page` is the plain product page on the bank's site — never an affiliate or
 * tracked link. It replaces catalogue URLs that pointed at PDFs or listings.
 *
 * Card designs belong to the banks; they're shown only to identify the card.
 */

const S7 = "https://s7ap1.scene7.com/is/image/hdfcbankPWS";
const HDFC = "https://www.hdfc.bank.in/credit-cards";
const SBI_IMG = "https://www.sbicard.com/static-resources/img";
const SBI = "https://www.sbicard.com/en/personal/credit-cards";
const ICICI_IMG = "https://www.icici.bank.in/content/dam";
const ICICI = "https://www.icici.bank.in/personal-banking/cards/credit-card";
const AXIS_IMG =
  "https://www.axis.bank.in/images/default-source/creditcard/webp";
const AXIS = "https://www.axis.bank.in/cards/credit-card";
const IDFC_IMG =
  "https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/images/cc-landing-nobs";
const IDFC = "https://www.idfcfirst.bank.in/credit-card";
const INDUS_IMG =
  "https://www.indusind.bank.in/content/dam/indusind-platform-images/carousal-banner-images/credit-card/new-webp-cc-/cards-th-image";
const INDUS = "https://www.indusind.bank.in/in/en/personal/cards/credit-card";
const AMEX_IMG =
  "https://icm.aexp-static.com/Internet/internationalcardshop/en_in/images/cards";

export interface CardArtSource {
  /** The card face, from the bank's site; null when none was verified. */
  image: string | null;
  /** The bank's own product page. */
  page: string | null;
}

export const CARD_ART: Record<string, CardArtSource> = {
  "hdfc-millennia": {
    image: `${S7}/millennia-credit-card?fmt=png-alpha`,
    page: `${HDFC}/millennia-credit-card`,
  },
  "hdfc-regalia-gold": {
    image: `${S7}/regalia-gold-credit-card?fmt=png-alpha`,
    page: `${HDFC}/regalia-gold-credit-card`,
  },
  "hdfc-infinia": {
    image: `${S7}/infinia-credit-card?fmt=png-alpha`,
    page: `${HDFC}/infinia-credit-card`,
  },
  "hdfc-diners-black-metal": {
    image:
      "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/calculators/diners-black-metal-credit-card-calculator/diner_black_metal_fascia.png",
    page: `${HDFC}/diners-club-black-metal-edition-credit-card`,
  },
  "hdfc-swiggy-blck": {
    image: `${S7}/facia-swiggy-blck-cc?fmt=png-alpha`,
    page: `${HDFC}/swiggy-blck-hdfc-bank-credit-card`,
  },
  "hdfc-swiggy-ornge": {
    image: `${S7}/facia?fmt=png-alpha`,
    page: `${HDFC}/swiggy-ornge-hdfc-bank-credit-card`,
  },
  "hdfc-swiggy-legacy": {
    image: `${S7}/card-facia-swiggy?fmt=png-alpha`,
    page: `${HDFC}/swiggy-hdfc-bank-credit-card`,
  },
  // The only Tata Neu faces on HDFC's site are 125×78 thumbnails: drawn instead.
  "hdfc-tata-neu-infinity": {
    image: null,
    page: `${HDFC}/tata-neu-infinity-hdfc-bank-credit-card`,
  },
  "hdfc-tata-neu-plus": {
    image: null,
    page: `${HDFC}/tata-neu-plus-hdfc-bank-credit-card`,
  },
  "hdfc-irctc": {
    image: `${S7}/Card-Facia-IRCTC?fmt=png-alpha`,
    page: `${HDFC}/irctc-credit-card`,
  },
  "hdfc-moneyback-plus": {
    image: `${S7}/moneyback-plus-credit-card?fmt=png-alpha`,
    page: `${HDFC}/moneyback-plus-credit-card`,
  },

  "sbi-cashback": {
    image: `${SBI_IMG}/card/card-face-assets/for-website/front/vertical/cashback-card-face-min.png`,
    page: `${SBI}/cashback-sbi-card.html`,
  },
  "sbi-simplyclick": {
    image: `${SBI_IMG}/card/product-detail-assets/core-cards/simply-click/left-banner/simply-click-card-face.png`,
    page: `${SBI}/simplyclick-sbi-card.html`,
  },
  "sbi-simplysave": {
    image: `${SBI_IMG}/card/product-detail-assets/core-cards/simply-save/left-banner/simply-save-card-face.png`,
    page: `${SBI}/simplysave-sbi-card.html`,
  },
  "sbi-bpcl-octane": {
    image: `${SBI_IMG}/card-face/front/horizontal/bpcl-octane-sbi-card.png`,
    page: `${SBI}/bpcl-sbi-card-octane.html`,
  },
  "sbi-elite": {
    image: `${SBI_IMG}/card/card-face-assets/for-website/front/horizontal/elite-sbi-card.png`,
    page: `${SBI}/sbi-card-elite.html`,
  },
  "sbi-prime": {
    image: `${SBI_IMG}/card/card-face-assets/for-website/front/horizontal/prime-sbi-card.png`,
    page: `${SBI}/sbi-card-prime.html`,
  },
  "sbi-flipkart": {
    image: `${SBI_IMG}/card/card-face-assets/for-website/front/vertical/flipkart-card-face-min.png`,
    page: `${SBI}/flipkart-sbi-card.html`,
  },

  "icici-amazon-pay": {
    image: `${ICICI_IMG}/icicibank/india/managed-assets/revamp-page-images/cards/amazon/amazon-card-banner.webp`,
    page: `${ICICI}/amazon-pay-credit-card`,
  },
  "icici-coral-rupay": {
    image: `${ICICI_IMG}/icicibank-revamp/credit-card/desktop/coral.webp`,
    page: `${ICICI}/coral-rupay-card`,
  },
  "icici-sapphiro": {
    image: `${ICICI_IMG}/icicibank/india/managed-assets/revamp-page-images/cards/sapphiro-credit-card/sapphiro-desktop.webp`,
    page: `${ICICI}/sapphiro-card`,
  },
  "icici-emeralde-private": {
    image: `${ICICI_IMG}/icicibank-revamp/credit-card/desktop/emaralde-private.webp`,
    page: `${ICICI}/emeralde-private-metal-credit-card`,
  },

  "axis-flipkart": {
    image: `${AXIS_IMG}/flipkart.webp`,
    page: `${AXIS}/flipkart-axisbank-credit-card`,
  },
  "axis-ace": {
    image: `${AXIS_IMG}/ace.webp`,
    page: `${AXIS}/axis-bank-ace-credit-card`,
  },
  "axis-myzone": {
    image: `${AXIS_IMG}/myzone.webp`,
    page: `${AXIS}/axis-bank-my-zone-credit-card`,
  },
  "axis-neo": {
    image: `${AXIS_IMG}/neo.webp`,
    page: `${AXIS}/axis-bank-neo-credit-card`,
  },
  "axis-atlas": {
    image: `${AXIS_IMG}/atlas.webp`,
    page: `${AXIS}/axis-bank-atlas-credit-card`,
  },
  "axis-magnus": {
    image: `${AXIS_IMG}/magnus.webp`,
    page: `${AXIS}/axis-bank-magnus-credit-card`,
  },
  "axis-magnus-burgundy": { image: null, page: null },
  "axis-airtel": {
    image: `${AXIS_IMG}/airtel.webp`,
    page: `${AXIS}/airtel-axis-bank-credit-card`,
  },

  "idfc-first-select": {
    image: `${IDFC_IMG}/SELECT-2x-credit-card-image-updated.webp`,
    page: `${IDFC}/select`,
  },
  "idfc-first-wealth": {
    image: `${IDFC_IMG}/WEALTH-2x-credit-card-image-updated.webp`,
    page: `${IDFC}/wealth`,
  },
  // IDFC shows Millennia as a pair of variants in one picture: drawn instead.
  "idfc-first-millennia": { image: null, page: `${IDFC}/millennia` },
  "idfc-first-power-plus": {
    image: `${IDFC_IMG}/POWER-Plus-2x-credit-card-image-updated.webp`,
    page: null,
  },

  "au-lit": {
    image: "https://aemassets.au.bank.in/is/image/aubank/lit?fmt=webp",
    page: "https://www.au.bank.in/personal-banking/credit-cards/lit-credit-card",
  },
  "au-altura": {
    image: null,
    page: "https://www.au.bank.in/personal-banking/credit-cards/altura-credit-card",
  },

  "indusind-tiger": {
    image: `${INDUS_IMG}/Card-Tiger-CC.webp`,
    page: `${INDUS}/tiger-credit-card.html`,
  },
  "indusind-legend": {
    image: `${INDUS_IMG}/Legend_card-image_396x257px.webp`,
    page: `${INDUS}/legend-credit-card.html`,
  },
  "cred-indusind-rupay": {
    image: null,
    page: `${INDUS}/CRED-IndusInd-Bank-ruPay-credit-card.html`,
  },

  "kotak-811": {
    image:
      "https://d2gwgwt9a7yxle.cloudfront.net/FD_Backed_Credit_Card_5063759935.png",
    page: "https://www.kotak.bank.in/en/personal-banking/cards/credit-cards/811-dream-different-credit-card.html",
  },
  "kotak-league-platinum": {
    image: null,
    page: "https://www.kotak.bank.in/en/personal-banking/cards/credit-cards/league-platinum-card.html",
  },

  "amex-mrcc": {
    image: `${AMEX_IMG}/Membership_Rewards_Card.png`,
    page: "https://www.americanexpress.com/in/credit-cards/membership-rewards-card/",
  },
  "amex-platinum-travel": {
    image: `${AMEX_IMG}/Platinum_Travel_Card.png`,
    page: "https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/",
  },
  "amex-gold-charge": {
    image: `${AMEX_IMG}/Gold_Card.png`,
    page: "https://www.americanexpress.com/in/charge-cards/gold-card/",
  },

  "hsbc-live-plus": {
    image: null,
    page: "https://www.hsbc.bank.in/credit-cards/products/live-plus/",
  },
  "hsbc-travelone": {
    image: null,
    page: "https://www.hsbc.bank.in/credit-cards/products/travelone/",
  },
  "yes-marquee": {
    image: null,
    page: "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/marquee-credit-card",
  },
  "bob-eterna": {
    image:
      "https://media.bobcard.co.in//media/b4pj5ukl/bobcard-eterna_1920-x-1253.png",
    page: "https://www.bobcard.co.in/credit-card-types/eterna",
  },
  onecard: { image: null, page: "https://www.getonecard.app/" },
  "scapia-federal": { image: null, page: "https://www.federal.bank.in/scapia" },
  "kiwi-rupay": { image: null, page: "https://gokiwi.in/" },
  "jupiter-edge-plus": {
    image: null,
    page: "https://jupiter.money/edge-plus-upi-rupay-credit-card/",
  },
};

/** Hosts the image optimiser may fetch from — kept in step with CARD_ART. */
export const CARD_ART_HOSTS: string[] = [
  ...new Set(
    Object.values(CARD_ART)
      .map((a) => (a.image ? new URL(a.image).hostname : null))
      .filter((h): h is string => Boolean(h)),
  ),
].sort();
