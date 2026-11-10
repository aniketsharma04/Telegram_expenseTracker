import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, TextInput } from "./Text";
import { Card, CardHeader } from "./ui";
import { Sheet } from "./cards/parts";
import { parseAmount } from "../lib/amount";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import {
  compareRegimes,
  LIMITS,
  nextAdvanceTax,
  TAX_YEAR,
  type TaxInput,
} from "../lib/tax";

/** Saved on the phone only: income and deductions never leave the device. */
const KEY = "et_tax_inputs_v1";

type Fields = {
  gross: string;
  salaried: boolean;
  sec80C: string;
  sec80D: string;
  nps: string;
  homeLoanInterest: string;
  hraExempt: string;
};
const EMPTY: Fields = {
  gross: "",
  salaried: true,
  sec80C: "",
  sec80D: "",
  nps: "",
  homeLoanInterest: "",
  hraExempt: "",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const short = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function toInput(f: Fields): TaxInput | null {
  const gross = parseAmount(f.gross);
  if (!gross || gross <= 0) return null;
  const n = (s: string) => (s.trim() ? (parseAmount(s) ?? 0) : 0);
  return {
    gross,
    salaried: f.salaried,
    sec80C: n(f.sec80C),
    sec80D: n(f.sec80D),
    nps: n(f.nps),
    homeLoanInterest: n(f.homeLoanInterest),
    hraExempt: n(f.hraExempt),
  };
}

/**
 * Plan tab: old vs new regime from the user's own numbers, and the next
 * advance-tax date. Generic tax information, not advice.
 */
export function TaxCard({ p, today }: { p: Palette; today: string }) {
  const { t, fs } = useSettings();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setFields({ ...EMPTY, ...JSON.parse(raw) }))
      .catch(() => {});
  }, []);

  const save = (next: Fields) => {
    setFields(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const input = toInput(fields);
  const result = useMemo(
    () => (input ? compareRegimes(input) : null),
    [fields],
  );
  const due = nextAdvanceTax(today);

  return (
    <Card p={p}>
      <CardHeader
        p={p}
        title={`${t("taxTitle")} · ${TAX_YEAR}`}
        action={result ? t("editPlan") : t("taxCompare")}
        onAction={() => setOpen(true)}
      />
      <View style={{ gap: 10 }}>
        {result ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
            <Verdict p={p} r={result} />
          </Pressable>
        ) : (
          <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: fs(20) }}>
            {t("taxHint")}
          </Text>
        )}
        <Text
          style={{ color: p.muted, fontSize: fs(12.5), lineHeight: fs(18) }}
        >
          {t("advanceTaxNext")} {short(due.date)} ({Math.round(due.share * 100)}
          % {t("advanceTaxShare")}). {t("advanceTaxWho")}
        </Text>
      </View>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        p={p}
        title={`${t("taxTitle")} · ${TAX_YEAR}`}
      >
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Money
            p={p}
            label={t("taxGross")}
            hint={t("taxGrossHint")}
            value={fields.gross}
            onChange={(v) => save({ ...fields, gross: v })}
          />
          <View style={styles.chips}>
            {[true, false].map((s) => {
              const on = fields.salaried === s;
              return (
                <Pressable
                  key={String(s)}
                  onPress={() => save({ ...fields, salaried: s })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? p.accent : p.border,
                      backgroundColor: on ? p.accentSoft : p.page,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: on ? p.ink : p.ink2,
                      fontSize: fs(13),
                      fontWeight: on ? "600" : "400",
                    }}
                  >
                    {s ? t("taxSalaried") : t("taxNotSalaried")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={{
              color: p.ink,
              fontSize: fs(14),
              fontWeight: "700",
              marginTop: 4,
            }}
          >
            {t("taxOldDeductions")}
          </Text>
          <Text style={{ color: p.muted, fontSize: fs(12) }}>
            {t("taxOldDeductionsHint")}
          </Text>
          <Money
            p={p}
            label={`${t("tax80C")} (max ${formatINR(LIMITS.sec80C)})`}
            value={fields.sec80C}
            onChange={(v) => save({ ...fields, sec80C: v })}
          />
          <Money
            p={p}
            label={t("tax80D")}
            value={fields.sec80D}
            onChange={(v) => save({ ...fields, sec80D: v })}
          />
          <Money
            p={p}
            label={`${t("taxNps")} (max ${formatINR(LIMITS.nps80CCD1B)})`}
            value={fields.nps}
            onChange={(v) => save({ ...fields, nps: v })}
          />
          <Money
            p={p}
            label={`${t("taxHomeLoan")} (max ${formatINR(LIMITS.homeLoanInterest)})`}
            value={fields.homeLoanInterest}
            onChange={(v) => save({ ...fields, homeLoanInterest: v })}
          />
          <Money
            p={p}
            label={t("taxHra")}
            value={fields.hraExempt}
            onChange={(v) => save({ ...fields, hraExempt: v })}
          />

          {result && (
            <View
              style={[
                styles.result,
                { borderColor: p.grid, backgroundColor: p.page },
              ]}
            >
              <View style={styles.cols}>
                <Col
                  p={p}
                  label={t("taxNew")}
                  value={result.newRegime.total}
                  win={result.better === "new"}
                />
                <Col
                  p={p}
                  label={t("taxOld")}
                  value={result.oldRegime.total}
                  win={result.better === "old"}
                />
              </View>
              <Verdict p={p} r={result} />
              <Text style={{ color: p.muted, fontSize: fs(12) }}>
                {t("taxTaxable")}: {formatINR(result.newRegime.taxable)}{" "}
                {t("taxNew").toLowerCase()} ·{" "}
                {formatINR(result.oldRegime.taxable)}{" "}
                {t("taxOld").toLowerCase()}
              </Text>
            </View>
          )}
          <Text
            style={{ color: p.muted, fontSize: fs(11.5), lineHeight: fs(17) }}
          >
            {t("taxDisclaimer")}
          </Text>
        </View>
      </Sheet>
    </Card>
  );
}

function Verdict({
  p,
  r,
}: {
  p: Palette;
  r: ReturnType<typeof compareRegimes>;
}) {
  const { t, fs } = useSettings();
  const best = r.better === "old" ? r.oldRegime : r.newRegime;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: p.ink, fontSize: fs(15), fontWeight: "700" }}>
        {r.better === "same"
          ? `${t("taxSame")} ${formatINR(best.total)}`
          : `${r.better === "new" ? t("taxNew") : t("taxOld")}: ${formatINR(best.total)} · ${t("taxSaves")} ${formatINR(r.saving)}`}
      </Text>
      {r.surchargeApplies && (
        <Text style={{ color: p.warn, fontSize: fs(12.5) }}>
          {t("taxSurcharge")}
        </Text>
      )}
    </View>
  );
}

function Col({
  p,
  label,
  value,
  win,
}: {
  p: Palette;
  label: string;
  value: number;
  win: boolean;
}) {
  const { fs } = useSettings();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text
        style={{
          color: win ? p.accent : p.ink2,
          fontSize: fs(12.5),
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text style={{ color: p.ink, fontSize: fs(18), fontWeight: "800" }}>
        {formatINR(value)}
      </Text>
    </View>
  );
}

function Money({
  p,
  label,
  hint,
  value,
  onChange,
}: {
  p: Palette;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { fs } = useSettings();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: p.ink2, fontSize: fs(13) }}>{label}</Text>
      <View
        style={[styles.input, { borderColor: p.grid, backgroundColor: p.page }]}
      >
        <Text style={{ color: p.muted, fontSize: fs(16), fontWeight: "700" }}>
          ₹
        </Text>
        <TextInput
          style={{
            flex: 1,
            color: p.ink,
            fontSize: fs(16),
            fontWeight: "600",
            paddingVertical: 10,
          }}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={p.muted}
          accessibilityLabel={label}
        />
      </View>
      {hint ? (
        <Text style={{ color: p.muted, fontSize: fs(12) }}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  result: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cols: { flexDirection: "row", gap: 12 },
});
