"""
Build src/lib/cards/catalog-data.ts from the reward-rules research file.

    python scripts/build-card-catalog.py

Reads the JSON block in research_notes/Aaj Cards app design/card_rules.md and
maps it onto the engine's CardProduct shape:
- a rule with no merchants or categories is the card's capped base rate;
- quarterly/monthly milestones become yearly (x4 / x12), quarterly caps monthly (/3);
- "upi" in a rule's categories makes it a UPI-only rule; reducedRate.upi is the UPI rate;
- unknown buckets ("gift-vouchers", "cash", "gaming") are dropped, "jewellery" -> "gold";
- placeholder rows (no reliable source) are left out.
Hand edits belong in the research file, then re-run this.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "research_notes" / "Aaj Cards app design" / "card_rules.md"
OUT = ROOT / "src" / "lib" / "cards" / "catalog-data.ts"

BUCKETS = {
    "food", "food-delivery", "groceries", "shopping-online", "shopping", "travel",
    "flights", "hotels", "cabs", "fuel", "utilities", "bills", "telecom", "rent",
    "insurance", "education", "entertainment", "ott", "health", "wallet",
    "government", "gold", "emi",
}
ALIAS = {"jewellery": "gold"}
SKIP_KEYS = {"yes-klick"}  # placeholder: no reliable 2026 source

# Official bank sites only — the "Go to bank website" button never carries tracking.
OFFICIAL = re.compile(
    r"^https://(?:www\.)?(?:sbicard\.com|[a-z]+\.bank\.in|hdfcbank\.com|icicibank\.com|axisbank\.com|"
    r"kotak\.com|idfcfirstbank\.com|americanexpress\.com|hsbc\.co\.in|indusind\.com|yesbank\.in|"
    r"bobcard\.co\.in|gokiwi\.in|scapia\.cards|getonecard\.app|jupiter\.money|cred\.club|federalbank\.co\.in)\b"
)
BANK_HOME = {
    "HDFC": "https://www.hdfcbank.com/personal/pay/cards/credit-cards",
    "SBI": "https://www.sbicard.com/en/personal/credit-cards.page",
    "ICICI": "https://www.icicibank.com/personal-banking/cards/credit-card",
    "Axis": "https://www.axisbank.com/retail/cards/credit-card",
    "Kotak": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    "IDFC FIRST": "https://www.idfcfirstbank.com/credit-card",
    "Amex": "https://www.americanexpress.com/in/",
    "HSBC": "https://www.hsbc.co.in/credit-cards/",
    "IndusInd": "https://www.indusind.com/in/en/personal/cards/credit-card.html",
    "YES": "https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards",
    "BOB": "https://www.bobcard.co.in/",
    "Scapia": "https://scapia.cards/",
    "OneCard": "https://www.getonecard.app/",
}


def buckets(values):
    out = []
    for v in values or []:
        v = ALIAS.get(v, v)
        if v in BUCKETS and v not in out:
            out.append(v)
    return out


def num(v):
    return None if v is None else (int(v) if float(v).is_integer() else float(v))


def cash_ratio(c):
    """Points are valued at what most people get: cash or vouchers, not
    airline transfers. Rates in the research are at the best redemption."""
    pv = c.get("pointValue") or {}
    best, cash = pv.get("best"), pv.get("cash")
    if best and cash is not None and best > 0:
        return min(1.0, cash / best)
    return 1.0


def convert(c):
    ratio = cash_ratio(c)
    base_rate = c.get("baseRateCash") if c.get("baseRateCash") is not None else (c.get("baseRate") or 0) * ratio
    base_cap = None
    upi_rate = None
    rules = []
    # Several catch-all rules are spend slabs (1X up to ₹1L, 2X beyond…):
    # keep the published base rate rather than guess which slab applies.
    catch_alls = [
        r for r in c.get("rules") or []
        if r.get("rate") is not None and not (r.get("merchants") or r.get("categories"))
        and "upi" not in (r.get("categories") or [])
    ]
    slabbed = len(catch_alls) > 1
    for r in c.get("rules") or []:
        if r.get("rate") is None:
            continue  # an offer ("₹120 off twice a month"), not a reward rate
        merchants = [m.lower() for m in (r.get("merchants") or [])]
        raw_cats = r.get("categories") or []
        upi_only = "upi" in raw_cats
        cats = buckets(raw_cats)
        cap = r.get("capMonthly")
        if cap is None and r.get("capQuarterly") is not None:
            cap = round(r["capQuarterly"] / 3)
        if not merchants and not cats:
            if upi_only:
                upi_rate = r["rate"] * ratio
            elif not slabbed:
                base_rate = r["rate"] * ratio
                base_cap = None if cap is None else round(cap * ratio)
            continue
        rule = {"label": r["label"], "rate": num(round(r["rate"] * ratio, 3))}
        if merchants:
            rule["merchants"] = merchants
        if cats:
            rule["categories"] = cats
        if cap is not None:
            rule["capMonthly"] = num(round(cap * ratio))
        if upi_only:
            rule["upiOnly"] = True
        rules.append(rule)

    reduced = {}
    for k, v in (c.get("reducedRate") or {}).items():
        if k == "upi":
            upi_rate = v * ratio if upi_rate is None else upi_rate
            continue
        k = ALIAS.get(k, k)
        if k in BUCKETS:
            reduced[k] = num(round(v * ratio, 3))

    milestones = []
    for m in c.get("milestones") or []:
        if not m.get("valueRs"):
            continue  # a benefit with no rupee value (a lounge visit, a voucher of unknown worth)
        if "spendYearly" in m:
            milestones.append({"spendYearly": m["spendYearly"], "valueRs": m["valueRs"], "label": m["label"]})
        elif "spendQuarterly" in m:
            milestones.append({"spendYearly": m["spendQuarterly"] * 4, "valueRs": m["valueRs"] * 4, "label": m["label"]})
        elif "spendMonthly" in m:
            milestones.append({"spendYearly": m["spendMonthly"] * 12, "valueRs": m["valueRs"] * 12, "label": m["label"]})

    status = (c.get("status") or "active").rstrip("?")
    if status not in ("active", "closed-new", "paused"):
        status = "paused"
    url = next((u for u in c.get("sources") or [] if OFFICIAL.match(u)), None) or BANK_HOME.get(c["bank"])

    out = {
        "key": c["key"],
        "bank": c["bank"],
        "name": c["name"],
        "networks": c.get("networks") or [],
        "upi": bool(c.get("upi")),
        "joiningFee": num(c.get("joiningFee") or 0),
        "annualFee": num(c.get("annualFee") or 0),
        "feeWaiverSpend": num(c.get("feeWaiverSpend")),
        "baseRate": num(round(base_rate, 3)),
        "rules": rules,
        "exclusions": buckets(c.get("exclusions")),
        "verified": c.get("verified") or "2026-11-01",
        "confidence": c.get("confidence") or "low",
        "status": status,
    }
    if base_cap is not None:
        out["baseCapMonthly"] = num(base_cap)
    if upi_rate is not None:
        out["upiRate"] = num(round(upi_rate, 3))
    if reduced:
        out["reducedRate"] = reduced
    if milestones:
        out["milestones"] = milestones
    for k in ("loungeDomesticYear", "loungeIntlYear", "forexMarkup", "minIncomeMonthly"):
        if c.get(k) is not None:
            out[k] = num(c[k])
    if url:
        out["url"] = url
    changes = [
        {"date": d["date"], "change": d["change"]}
        for d in c.get("devaluations") or []
        if d.get("date") and d.get("change") and not re.match(r"card launched", d["change"], re.I)
    ]
    if changes:
        out["changes"] = sorted(changes, key=lambda d: d["date"], reverse=True)
    return out


def main():
    text = SRC.read_text(encoding="utf8")
    blocks = re.findall(r"```json\s*(.*?)```", text, re.S)
    cards = [convert(c) for c in json.loads(max(blocks, key=len)) if c["key"] not in SKIP_KEYS]
    body = json.dumps(cards, indent=2, ensure_ascii=False)
    OUT.write_text(
        "// Generated by scripts/build-card-catalog.py from\n"
        "// research_notes/Aaj Cards app design/card_rules.md — edit the research file, then re-run.\n"
        'import type { CardProduct } from "./types";\n\n'
        f"export const CARDS: CardProduct[] = {body};\n",
        encoding="utf8",
    )
    print(f"{len(cards)} cards -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
