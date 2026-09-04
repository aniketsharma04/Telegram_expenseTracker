/**
 * India's utility billers, in one place (v11).
 *
 * Three features need to know these names and they kept drifting apart:
 *   • the biller picker (BBPS mock today, Setu later)
 *   • email/SMS bill detection — "is this an electricity bill?"
 *   • merchant normalisation — "DHBVN" and "Dakshin Haryana Bijli" are one thing
 *
 * So the list lives here and the three read from it.
 *
 * A note on `digits`: identifier formats are per-DISCOM and not published in
 * any single place, so these are sensible ranges rather than gospel. They
 * only gate what the mock provider accepts — once BBPS is live the biller
 * registry supplies the real regex per biller.
 */

export interface BillerSpec {
  /** Stable id, mirroring the BBPS shape so the mock and the real thing agree. */
  id: string;
  name: string;
  /** Short form people actually type and that appears in bill emails. */
  aliases: string[];
  state: string;
  /** Label for the consumer identifier, as printed on that provider's bill. */
  field: string;
  digits: [min: number, max: number];
  /** True when the identifier can contain letters. */
  alphanumeric?: boolean;
}

/**
 * Electricity distribution companies. Covers every state's main DISCOM plus
 * the private distributors in the metros.
 */
export const DISCOMS: BillerSpec[] = [
  // ── North ───────────────────────────────────────────────────────────────
  {
    id: "BSES00000DEL01",
    name: "BSES Rajdhani Power",
    aliases: ["bses rajdhani", "bses"],
    state: "Delhi",
    field: "CA Number",
    digits: [9, 9],
  },
  {
    id: "BSES00000DEL02",
    name: "BSES Yamuna Power",
    aliases: ["bses yamuna"],
    state: "Delhi",
    field: "CA Number",
    digits: [9, 9],
  },
  {
    id: "TATA00000DEL01",
    name: "Tata Power Delhi (TPDDL)",
    aliases: ["tata power delhi", "tpddl", "ndpl"],
    state: "Delhi",
    field: "CA Number",
    digits: [11, 11],
  },
  {
    id: "DHBV00000HAR01",
    name: "DHBVN (Dakshin Haryana)",
    aliases: ["dhbvn", "dakshin haryana bijli", "dakshin haryana"],
    state: "Haryana",
    field: "Account Number",
    digits: [8, 12],
  },
  {
    id: "UHBV00000HAR01",
    name: "UHBVN (Uttar Haryana)",
    aliases: ["uhbvn", "uttar haryana bijli", "uttar haryana"],
    state: "Haryana",
    field: "Account Number",
    digits: [8, 12],
  },
  {
    id: "PSPC00000PUN01",
    name: "PSPCL (Punjab)",
    aliases: ["pspcl", "punjab state power"],
    state: "Punjab",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "HPSE00000HIP01",
    name: "HPSEBL (Himachal Pradesh)",
    aliases: ["hpsebl", "hpseb", "himachal pradesh state electricity"],
    state: "Himachal Pradesh",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "UPCL00000UTT01",
    name: "UPCL (Uttarakhand)",
    aliases: ["upcl", "uttarakhand power"],
    state: "Uttarakhand",
    field: "Service Connection No",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "JKPD00000JKD01",
    name: "JKPDD (Jammu & Kashmir)",
    aliases: ["jkpdd", "kashmir power development"],
    state: "Jammu & Kashmir",
    field: "Consumer ID",
    digits: [8, 14],
    alphanumeric: true,
  },

  // ── Uttar Pradesh (UPPCL's five distribution arms) ──────────────────────
  {
    id: "UPPC00000UTP01",
    name: "UPPCL (Uttar Pradesh)",
    aliases: ["uppcl", "uttar pradesh power"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "PVVN00000UTP02",
    name: "PVVNL (Meerut)",
    aliases: ["pvvnl", "paschimanchal"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "MVVN00000UTP03",
    name: "MVVNL (Lucknow)",
    aliases: ["mvvnl", "madhyanchal"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "PUVV00000UTP04",
    name: "PuVVNL (Varanasi)",
    aliases: ["puvvnl", "purvanchal"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "DVVN00000UTP05",
    name: "DVVNL (Agra)",
    aliases: ["dvvnl", "dakshinanchal"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [10, 12],
  },
  {
    id: "KESC00000UTP06",
    name: "KESCO (Kanpur)",
    aliases: ["kesco", "kanpur electricity"],
    state: "Uttar Pradesh",
    field: "Account Number",
    digits: [8, 12],
  },

  // ── Rajasthan ───────────────────────────────────────────────────────────
  {
    id: "JVVN00000RAJ01",
    name: "JVVNL (Jaipur)",
    aliases: ["jvvnl", "jaipur vidyut"],
    state: "Rajasthan",
    field: "K Number",
    digits: [10, 12],
  },
  {
    id: "AVVN00000RAJ02",
    name: "AVVNL (Ajmer)",
    aliases: ["avvnl", "ajmer vidyut"],
    state: "Rajasthan",
    field: "K Number",
    digits: [10, 12],
  },
  {
    id: "JDVV00000RAJ03",
    name: "JdVVNL (Jodhpur)",
    aliases: ["jdvvnl", "jodhpur vidyut"],
    state: "Rajasthan",
    field: "K Number",
    digits: [10, 12],
  },

  // ── West ────────────────────────────────────────────────────────────────
  {
    id: "MSED00000MAH01",
    name: "MSEDCL (Maharashtra)",
    aliases: ["msedcl", "mahadiscom", "mseb"],
    state: "Maharashtra",
    field: "Consumer Number",
    digits: [12, 12],
  },
  {
    id: "ADAN00000MAH02",
    name: "Adani Electricity (Mumbai)",
    aliases: ["adani electricity", "adani power mumbai"],
    state: "Maharashtra",
    field: "Consumer Number",
    digits: [9, 12],
  },
  {
    id: "TATA00000MAH03",
    name: "Tata Power (Mumbai)",
    aliases: ["tata power mumbai"],
    state: "Maharashtra",
    field: "Consumer Number",
    digits: [9, 12],
  },
  {
    id: "BEST00000MAH04",
    name: "BEST (Mumbai)",
    aliases: ["best undertaking", "best mumbai"],
    state: "Maharashtra",
    field: "Consumer Number",
    digits: [9, 12],
  },
  {
    id: "TORR00000GUJ01",
    name: "Torrent Power",
    aliases: ["torrent power"],
    state: "Gujarat",
    field: "Service Number",
    digits: [8, 12],
  },
  {
    id: "DGVC00000GUJ02",
    name: "DGVCL (South Gujarat)",
    aliases: ["dgvcl"],
    state: "Gujarat",
    field: "Consumer Number",
    digits: [8, 12],
  },
  {
    id: "MGVC00000GUJ03",
    name: "MGVCL (Central Gujarat)",
    aliases: ["mgvcl"],
    state: "Gujarat",
    field: "Consumer Number",
    digits: [8, 12],
  },
  {
    id: "PGVC00000GUJ04",
    name: "PGVCL (Paschim Gujarat)",
    aliases: ["pgvcl"],
    state: "Gujarat",
    field: "Consumer Number",
    digits: [8, 12],
  },
  {
    id: "UGVC00000GUJ05",
    name: "UGVCL (Uttar Gujarat)",
    aliases: ["ugvcl"],
    state: "Gujarat",
    field: "Consumer Number",
    digits: [8, 12],
  },
  {
    id: "MPPK00000MDP01",
    name: "MP Paschim (Indore)",
    aliases: ["mppkvvcl", "mp paschim", "madhya pradesh paschim"],
    state: "Madhya Pradesh",
    field: "IVRS Number",
    digits: [10, 12],
  },
  {
    id: "MPMK00000MDP02",
    name: "MP Poorv (Jabalpur)",
    aliases: ["mpmkvvcl", "mp poorv", "madhya pradesh poorv"],
    state: "Madhya Pradesh",
    field: "IVRS Number",
    digits: [10, 12],
  },
  {
    id: "MPMD00000MDP03",
    name: "MP Madhya (Bhopal)",
    aliases: ["mp madhya", "madhya kshetra"],
    state: "Madhya Pradesh",
    field: "IVRS Number",
    digits: [10, 12],
  },
  {
    id: "CSPD00000CHT01",
    name: "CSPDCL (Chhattisgarh)",
    aliases: ["cspdcl", "chhattisgarh state power"],
    state: "Chhattisgarh",
    field: "BP Number",
    digits: [9, 12],
  },
  {
    id: "GOAE00000GOA01",
    name: "Goa Electricity Department",
    aliases: ["goa electricity"],
    state: "Goa",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },

  // ── East ────────────────────────────────────────────────────────────────
  {
    id: "WBSE00000WBL01",
    name: "WBSEDCL (West Bengal)",
    aliases: ["wbsedcl", "west bengal state electricity"],
    state: "West Bengal",
    field: "Consumer ID",
    digits: [10, 12],
  },
  {
    id: "CESC00000WBL02",
    name: "CESC (Kolkata)",
    aliases: ["cesc kolkata", "cesc"],
    state: "West Bengal",
    field: "Consumer Number",
    digits: [9, 12],
  },
  {
    id: "NBPD00000BIH01",
    name: "NBPDCL (North Bihar)",
    aliases: ["nbpdcl", "north bihar power"],
    state: "Bihar",
    field: "CA Number",
    digits: [10, 12],
  },
  {
    id: "SBPD00000BIH02",
    name: "SBPDCL (South Bihar)",
    aliases: ["sbpdcl", "south bihar power"],
    state: "Bihar",
    field: "CA Number",
    digits: [10, 12],
  },
  {
    id: "JBVN00000JHK01",
    name: "JBVNL (Jharkhand)",
    aliases: ["jbvnl", "jharkhand bijli"],
    state: "Jharkhand",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "TPCO00000ODS01",
    name: "TP Central Odisha (TPCODL)",
    aliases: ["tpcodl", "tp central odisha"],
    state: "Odisha",
    field: "Consumer Number",
    digits: [10, 12],
  },
  {
    id: "TPNO00000ODS02",
    name: "TP Northern Odisha (TPNODL)",
    aliases: ["tpnodl"],
    state: "Odisha",
    field: "Consumer Number",
    digits: [10, 12],
  },
  {
    id: "TPWO00000ODS03",
    name: "TP Western Odisha (TPWODL)",
    aliases: ["tpwodl"],
    state: "Odisha",
    field: "Consumer Number",
    digits: [10, 12],
  },
  {
    id: "TPSO00000ODS04",
    name: "TP Southern Odisha (TPSODL)",
    aliases: ["tpsodl"],
    state: "Odisha",
    field: "Consumer Number",
    digits: [10, 12],
  },
  {
    id: "APDC00000ASM01",
    name: "APDCL (Assam)",
    aliases: ["apdcl", "assam power distribution"],
    state: "Assam",
    field: "Consumer ID",
    digits: [9, 12],
  },

  // ── South ───────────────────────────────────────────────────────────────
  {
    id: "BESC00000KAR01",
    name: "BESCOM (Bengaluru)",
    aliases: ["bescom", "bangalore electricity"],
    state: "Karnataka",
    field: "Account ID",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "MESC00000KAR02",
    name: "MESCOM (Mangaluru)",
    aliases: ["mescom"],
    state: "Karnataka",
    field: "Account ID",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "HESC00000KAR03",
    name: "HESCOM (Hubballi)",
    aliases: ["hescom"],
    state: "Karnataka",
    field: "Account ID",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "GESC00000KAR04",
    name: "GESCOM (Kalaburagi)",
    aliases: ["gescom"],
    state: "Karnataka",
    field: "Account ID",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "CHES00000KAR05",
    name: "CESC Mysuru",
    aliases: ["cesc mysore", "cesc mysuru"],
    state: "Karnataka",
    field: "Account ID",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "TANG00000TND01",
    name: "TANGEDCO (Tamil Nadu)",
    aliases: ["tangedco", "tneb", "tamil nadu electricity"],
    state: "Tamil Nadu",
    field: "Service Number",
    digits: [12, 12],
  },
  {
    id: "KSEB00000KER01",
    name: "KSEB (Kerala)",
    aliases: ["kseb", "kerala state electricity"],
    state: "Kerala",
    field: "Consumer Number",
    digits: [9, 13],
    alphanumeric: true,
  },
  {
    id: "TGSP00000TEL01",
    name: "TGSPDCL (South Telangana)",
    aliases: ["tgspdcl", "tsspdcl", "southern power telangana"],
    state: "Telangana",
    field: "Unique Service Number",
    digits: [9, 12],
    alphanumeric: true,
  },
  {
    id: "TGNP00000TEL02",
    name: "TGNPDCL (North Telangana)",
    aliases: ["tgnpdcl", "tsnpdcl"],
    state: "Telangana",
    field: "Unique Service Number",
    digits: [9, 12],
    alphanumeric: true,
  },
  {
    id: "APSP00000AND01",
    name: "APSPDCL (South AP)",
    aliases: ["apspdcl"],
    state: "Andhra Pradesh",
    field: "Service Number",
    digits: [9, 13],
    alphanumeric: true,
  },
  {
    id: "APEP00000AND02",
    name: "APEPDCL (East AP)",
    aliases: ["apepdcl"],
    state: "Andhra Pradesh",
    field: "Service Number",
    digits: [9, 13],
    alphanumeric: true,
  },
  {
    id: "APCP00000AND03",
    name: "APCPDCL (Central AP)",
    aliases: ["apcpdcl"],
    state: "Andhra Pradesh",
    field: "Service Number",
    digits: [9, 13],
    alphanumeric: true,
  },
];

/** Piped gas and water utilities, same shape. */
export const GAS_BILLERS: BillerSpec[] = [
  {
    id: "IGLC00000DEL01",
    name: "Indraprastha Gas (IGL)",
    aliases: ["indraprastha gas", "igl"],
    state: "Delhi NCR",
    field: "BP Number",
    digits: [10, 10],
  },
  {
    id: "MGLC00000MAH01",
    name: "Mahanagar Gas (MGL)",
    aliases: ["mahanagar gas", "mgl"],
    state: "Maharashtra",
    field: "CA Number",
    digits: [12, 12],
  },
  {
    id: "ADTG00000GUJ01",
    name: "Adani Total Gas",
    aliases: ["adani total gas", "adani gas"],
    state: "Gujarat",
    field: "Customer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "GUJG00000GUJ02",
    name: "Gujarat Gas",
    aliases: ["gujarat gas"],
    state: "Gujarat",
    field: "Customer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "TORG00000GUJ03",
    name: "Torrent Gas",
    aliases: ["torrent gas"],
    state: "Gujarat",
    field: "Customer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "HCGL00000HAR01",
    name: "Haryana City Gas",
    aliases: ["haryana city gas"],
    state: "Haryana",
    field: "Customer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
];

export const WATER_BILLERS: BillerSpec[] = [
  {
    id: "DJBO00000DEL01",
    name: "Delhi Jal Board",
    aliases: ["delhi jal board", "djb"],
    state: "Delhi",
    field: "K Number",
    digits: [8, 12],
    alphanumeric: true,
  },
  {
    id: "BMCW00000MAH01",
    name: "BMC Water (Mumbai)",
    aliases: ["bmc water"],
    state: "Maharashtra",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "BWSS00000KAR01",
    name: "BWSSB (Bengaluru)",
    aliases: ["bwssb", "bangalore water"],
    state: "Karnataka",
    field: "RR Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "HMWS00000TEL01",
    name: "HMWSSB (Hyderabad)",
    aliases: ["hmwssb", "hyderabad water"],
    state: "Telangana",
    field: "CAN Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "CMWS00000TND01",
    name: "Chennai Metro Water",
    aliases: ["chennai metro water", "cmwssb"],
    state: "Tamil Nadu",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
  {
    id: "PHED00000HAR01",
    name: "Haryana Public Health (PHED)",
    aliases: ["phed haryana", "public health engineering haryana"],
    state: "Haryana",
    field: "Consumer Number",
    digits: [8, 14],
    alphanumeric: true,
  },
];

/** Every alias for one biller kind — used by the email/SMS bill detector. */
export function aliasesFor(specs: BillerSpec[]): string[] {
  return [...new Set(specs.flatMap((b) => b.aliases))];
}

/** Canonical display name for a raw biller string, or null when unknown. */
export function matchBiller(text: string): BillerSpec | null {
  const haystack = text.toLowerCase();
  const all = [...DISCOMS, ...GAS_BILLERS, ...WATER_BILLERS];
  // Longest alias first, so "adani total gas" beats "adani".
  const ranked = all
    .flatMap((b) => b.aliases.map((alias) => ({ b, alias })))
    .sort((x, y) => y.alias.length - x.alias.length);
  return ranked.find(({ alias }) => haystack.includes(alias))?.b ?? null;
}
