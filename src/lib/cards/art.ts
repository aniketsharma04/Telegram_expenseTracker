/**
 * Card art and product pages, from each bank's own website.
 *
 * Every catalogue card has a face image in public/cards/<key>.webp, served by
 * Aaj itself (and resized by its image optimiser), so the app never depends
 * on a bank site staying up or keeping a file name. Each was cut from the
 * image at `source` on the issuer's site, trimmed, straightened where the bank
 * shows the card at an angle, and checked by eye against the card it's filed
 * under (2026-11-04). Re-run the check when the catalogue is reviewed.
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

interface CardArtEntry {
  /** Where the card face was taken from on the bank's site (provenance). */
  source: string;
  /** The bank's own product page. */
  page: string | null;
}

export interface CardArtSource extends CardArtEntry {
  /** The card face, served by Aaj itself from public/cards/<key>.webp. */
  image: string;
}

const SOURCES: Record<string, CardArtEntry> = {
  "hdfc-millennia": {
    source: `${S7}/millennia-credit-card?fmt=png-alpha`,
    page: `${HDFC}/millennia-credit-card`,
  },
  "hdfc-regalia-gold": {
    source: `${S7}/regalia-gold-credit-card?fmt=png-alpha`,
    page: `${HDFC}/regalia-gold-credit-card`,
  },
  "hdfc-infinia": {
    source: `${S7}/infinia-credit-card?fmt=png-alpha`,
    page: `${HDFC}/infinia-credit-card`,
  },
  "hdfc-diners-black-metal": {
    source:
      "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/calculators/diners-black-metal-credit-card-calculator/diner_black_metal_fascia.png",
    page: `${HDFC}/diners-club-black-metal-edition-credit-card`,
  },
  "hdfc-swiggy-blck": {
    source: `${S7}/facia-swiggy-blck-cc?fmt=png-alpha`,
    page: `${HDFC}/swiggy-blck-hdfc-bank-credit-card`,
  },
  "hdfc-swiggy-ornge": {
    source: `${S7}/facia?fmt=png-alpha`,
    page: `${HDFC}/swiggy-ornge-hdfc-bank-credit-card`,
  },
  "hdfc-swiggy-legacy": {
    source: `${S7}/card-facia-swiggy?fmt=png-alpha`,
    page: `${HDFC}/swiggy-hdfc-bank-credit-card`,
  },
  "hdfc-tata-neu-infinity": {
    source: `${S7}/Tata-Neu-Infinity1?fmt=png&wid=1920`,
    page: `${HDFC}/tata-neu-infinity-hdfc-bank-credit-card`,
  },
  "hdfc-tata-neu-plus": {
    source: `${S7}/Tata-Neu-Plus1?fmt=png&wid=1920`,
    page: `${HDFC}/tata-neu-plus-hdfc-bank-credit-card`,
  },
  "hdfc-irctc": {
    source: `${S7}/Card-Facia-IRCTC?fmt=png-alpha`,
    page: `${HDFC}/irctc-credit-card`,
  },
  "hdfc-moneyback-plus": {
    source: `${S7}/moneyback-plus-credit-card?fmt=png-alpha`,
    page: `${HDFC}/moneyback-plus-credit-card`,
  },

  "sbi-cashback": {
    source: `${SBI_IMG}/card/card-face-assets/for-website/front/vertical/cashback-card-face-min.png`,
    page: `${SBI}/cashback-sbi-card.html`,
  },
  "sbi-simplyclick": {
    source: `${SBI_IMG}/card/product-detail-assets/core-cards/simply-click/left-banner/simply-click-card-face.png`,
    page: `${SBI}/simplyclick-sbi-card.html`,
  },
  "sbi-simplysave": {
    source: `${SBI_IMG}/card/product-detail-assets/core-cards/simply-save/left-banner/simply-save-card-face.png`,
    page: `${SBI}/simplysave-sbi-card.html`,
  },
  "sbi-bpcl-octane": {
    source: `${SBI_IMG}/card-face/front/horizontal/bpcl-octane-sbi-card.png`,
    page: `${SBI}/bpcl-sbi-card-octane.html`,
  },
  "sbi-elite": {
    source: `${SBI_IMG}/card/card-face-assets/for-website/front/horizontal/elite-sbi-card.png`,
    page: `${SBI}/sbi-card-elite.html`,
  },
  "sbi-prime": {
    source: `${SBI_IMG}/card/card-face-assets/for-website/front/horizontal/prime-sbi-card.png`,
    page: `${SBI}/sbi-card-prime.html`,
  },
  "sbi-flipkart": {
    source: `${SBI_IMG}/card/card-face-assets/for-website/front/vertical/flipkart-card-face-min.png`,
    page: `${SBI}/flipkart-sbi-card.html`,
  },

  "icici-amazon-pay": {
    source: `${ICICI_IMG}/icicibank/india/managed-assets/revamp-page-images/cards/amazon/amazon-card-banner.webp`,
    page: `${ICICI}/amazon-pay-credit-card`,
  },
  "icici-coral-rupay": {
    source: `${ICICI_IMG}/icicibank-revamp/credit-card/desktop/coral.webp`,
    page: `${ICICI}/coral-rupay-card`,
  },
  "icici-sapphiro": {
    source: `${ICICI_IMG}/icicibank/india/managed-assets/revamp-page-images/cards/sapphiro-credit-card/sapphiro-desktop.webp`,
    page: `${ICICI}/sapphiro-card`,
  },
  "icici-emeralde-private": {
    source: `${ICICI_IMG}/icicibank-revamp/credit-card/desktop/emaralde-private.webp`,
    page: `${ICICI}/emeralde-private-metal-credit-card`,
  },

  "axis-flipkart": {
    source: `${AXIS_IMG}/flipkart.webp`,
    page: `${AXIS}/flipkart-axisbank-credit-card`,
  },
  "axis-ace": {
    source: `${AXIS_IMG}/ace.webp`,
    page: `${AXIS}/axis-bank-ace-credit-card`,
  },
  "axis-myzone": {
    source: `${AXIS_IMG}/myzone.webp`,
    page: `${AXIS}/axis-bank-my-zone-credit-card`,
  },
  "axis-neo": {
    source: `${AXIS_IMG}/neo.webp`,
    page: `${AXIS}/axis-bank-neo-credit-card`,
  },
  "axis-atlas": {
    source: `${AXIS_IMG}/atlas.webp`,
    page: `${AXIS}/axis-bank-atlas-credit-card`,
  },
  "axis-magnus": {
    source: `${AXIS_IMG}/magnus.webp`,
    page: `${AXIS}/axis-bank-magnus-credit-card`,
  },
  "axis-magnus-burgundy": {
    source:
      "https://www.axis.bank.in/images/default-source/burgundy/png/magnus-desk.png",
    page: null,
  },
  "axis-airtel": {
    source: `${AXIS_IMG}/airtel.webp`,
    page: `${AXIS}/airtel-axis-bank-credit-card`,
  },

  "idfc-first-select": {
    source: `${IDFC_IMG}/SELECT-2x-credit-card-image-updated.webp`,
    page: `${IDFC}/select`,
  },
  "idfc-first-wealth": {
    source: `${IDFC_IMG}/WEALTH-2x-credit-card-image-updated.webp`,
    page: `${IDFC}/wealth`,
  },
  "idfc-first-millennia": {
    source: `${IDFC_IMG}/MILLENNIA-2x-credit-card-image-updated.webp`,
    page: `${IDFC}/millennia`,
  },
  "idfc-first-power-plus": {
    source: `${IDFC_IMG}/POWER-Plus-2x-credit-card-image-updated.webp`,
    page: null,
  },

  "au-lit": {
    source: "https://aemassets.au.bank.in/is/image/aubank/lit?fmt=webp",
    page: "https://www.au.bank.in/personal-banking/credit-cards/lit-credit-card",
  },
  "au-altura": {
    source:
      "https://www.au.bank.in/content/dam/aubank/in/en/au-0101/banners/all-credit-cards/Card-faces-500x250-Altura.jpg",
    page: "https://www.au.bank.in/personal-banking/credit-cards/altura-credit-card",
  },

  "indusind-tiger": {
    source: `${INDUS_IMG}/Card-Tiger-CC.webp`,
    page: `${INDUS}/tiger-credit-card.html`,
  },
  "indusind-legend": {
    source: `${INDUS_IMG}/Legend_card-image_396x257px.webp`,
    page: `${INDUS}/legend-credit-card.html`,
  },
  "cred-indusind-rupay": {
    source:
      "https://www.indusind.bank.in/content/dam/indusind-platform-images/banner-images/cred-indusind-bank-rupay-credit-card/card-image.webp",
    page: `${INDUS}/CRED-IndusInd-Bank-ruPay-credit-card.html`,
  },

  "kotak-811": {
    source:
      "https://d2gwgwt9a7yxle.cloudfront.net/FD_Backed_Credit_Card_5063759935.png",
    page: "https://www.kotak.bank.in/en/personal-banking/cards/credit-cards/811-dream-different-credit-card.html",
  },
  "kotak-league-platinum": {
    source:
      "https://www.kotak.bank.in/content/dam/Kotak/mobile_images/Website-640-x-430-18.jpg",
    page: "https://www.kotak.bank.in/en/personal-banking/cards/credit-cards/league-platinum-card.html",
  },

  "amex-mrcc": {
    source: `${AMEX_IMG}/Membership_Rewards_Card.png`,
    page: "https://www.americanexpress.com/in/credit-cards/membership-rewards-card/",
  },
  "amex-platinum-travel": {
    source: `${AMEX_IMG}/Platinum_Travel_Card.png`,
    page: "https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/",
  },
  "amex-gold-charge": {
    source: `${AMEX_IMG}/Gold_Card.png`,
    page: "https://www.americanexpress.com/in/charge-cards/gold-card/",
  },

  "hsbc-live-plus": {
    source:
      "https://www.hsbc.bank.in/content/dam/hsbc/in/images/16-9/21398-live-plus-visa-infinite-2000X1125.jpg",
    page: "https://www.hsbc.bank.in/credit-cards/products/live-plus/",
  },
  "hsbc-travelone": {
    source:
      "https://www.hsbc.bank.in/content/dam/hsbc/in/images/16-9/15957-hsbc-travelone-credit-t1-front-1280x720.jpg",
    page: "https://www.hsbc.bank.in/credit-cards/products/travelone/",
  },
  "yes-marquee": {
    source:
      "https://www.yes.bank.in/sites/web/content/management/api/v1.1/assets/CONT6938F3CFB422440E9E581D06EDB4CCBD/native/marquee-card-img.png",
    page: "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/marquee-credit-card",
  },
  "bob-eterna": {
    source:
      "https://media.bobcard.co.in//media/b4pj5ukl/bobcard-eterna_1920-x-1253.png",
    page: "https://www.bobcard.co.in/credit-card-types/eterna",
  },
  onecard: {
    source: "https://www.getonecard.app/images/feature/metal.gif",
    page: "https://www.getonecard.app/",
  },
  "scapia-federal": {
    source:
      "https://www.scapia.cards/home/images/KzvOOlH4zIeP8QjjijaWMQsg0__width_494.webp",
    page: "https://www.federal.bank.in/scapia",
  },
  "kiwi-rupay": {
    source: "https://gokiwi.in/og-gokiwi.png",
    page: "https://gokiwi.in/",
  },
  "jupiter-edge-plus": {
    source:
      "https://jupiter.money/content/images/2025/06/Edge---Credit-Card.png",
    page: "https://jupiter.money/edge-plus-upi-rupay-credit-card/",
  },
};

export const CARD_ART: Record<string, CardArtSource> = Object.fromEntries(
  Object.entries(SOURCES).map(([key, a]) => [
    key,
    { ...a, image: `/cards/${key}.webp` },
  ]),
);

/** Card faces live in public/cards; none is fetched from a bank at runtime. */
export const CARD_ART_HOSTS: string[] = [];
