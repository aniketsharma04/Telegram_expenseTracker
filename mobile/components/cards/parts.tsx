import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../Text";
import { Icon, IconName, KeyboardAware } from "../ui";
import { formatINR, type Palette } from "../../lib/theme";
import { useSettings } from "../../lib/i18n";
import { cardImageUrl, type Chance } from "../../lib/cards-api";

/**
 * Aaj Cards building blocks. Same surfaces, font and spacing as Aaj; one
 * extra accent (indigo) marks the Cards room, so it feels like its own app
 * without being a different one.
 */

/** "1" when the user turned Aaj Cards off: the tile on Today is hidden. */
export const CARDS_OFF_KEY = "aaj.cards.off";

export function cardsAccent(dark: boolean) {
  return dark
    ? { accent: "#a5b4fc", soft: "rgba(165,180,252,0.14)", on: "#14163a" }
    : { accent: "#4338ca", soft: "#eef0fd", on: "#ffffff" };
}

export const money = (n: number) => formatINR(n);

/** Yearly figures are estimates: round them so they don't look precise. */
export function yearly(n: number): string {
  const step = Math.abs(n) < 10000 ? 100 : 500;
  return formatINR(Math.round(n / step) * step);
}

/** "12 Oct 2026" from YYYY-MM-DD. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
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
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Bank colour families for the generic card art — never the issuer's artwork. */
const BANK_COLORS: Record<string, [string, string]> = {
  HDFC: ["#163a7a", "#2b5cb8"],
  SBI: ["#0f4c81", "#2a86c8"],
  ICICI: ["#7a2414", "#c0502e"],
  Axis: ["#6e1438", "#a8325f"],
  Kotak: ["#8f1022", "#d0303f"],
  "IDFC FIRST": ["#7c1820", "#b3373e"],
  IndusInd: ["#5c2512", "#8f4a2a"],
  AU: ["#4a1f73", "#7a46ad"],
  Amex: ["#1d5c99", "#3b86c9"],
  HSBC: ["#2f3438", "#5b6166"],
  YES: ["#0b3a6b", "#1d6bb5"],
  RBL: ["#1f3b63", "#3d6aa3"],
  OneCard: ["#111111", "#3a3a3a"],
  Scapia: ["#123a33", "#2f7a6a"],
  Federal: ["#183a6b", "#2f63a8"],
};

export function bankColors(bank: string): [string, string] {
  return BANK_COLORS[bank] ?? ["#2c3440", "#4b5563"];
}

/**
 * A card-shaped tile. With `image` it shows the card's real face from the
 * bank's site (through Aaj's image cache); without one, or if the picture
 * fails to load, it draws the card from bank colours, name and last four.
 */
export function CardArt({
  bank,
  name,
  last4,
  size = "md",
  dashed,
  image,
}: {
  bank: string;
  name: string | null;
  last4: string | null;
  size?: "sm" | "md";
  dashed?: boolean;
  image?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [image]);
  if (image && !broken) {
    const sm = size === "sm";
    const [from] = bankColors(bank);
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${bank} ${name ?? ""} ${last4 ? `ending ${last4}` : ""}`}
        style={[
          sm ? styles.artSm : styles.artMd,
          styles.photo,
          !loaded && { backgroundColor: from, opacity: 0.12 },
          dashed && styles.artDashed,
        ]}
      >
        <Image
          source={{ uri: cardImageUrl(image, sm ? 256 : 750) }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
        {last4 && !sm && loaded && (
          <View style={styles.last4}>
            <Text style={styles.last4Text}>•••• {last4}</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <DrawnArt
      bank={bank}
      name={name}
      last4={last4}
      size={size}
      dashed={dashed}
    />
  );
}

function DrawnArt({
  bank,
  name,
  last4,
  size = "md",
  dashed,
}: {
  bank: string;
  name: string | null;
  last4: string | null;
  size?: "sm" | "md";
  dashed?: boolean;
}) {
  const { fs } = useSettings();
  const [from, to] = bankColors(bank);
  const sm = size === "sm";
  return (
    <View
      accessible
      accessibilityLabel={`${bank} ${name ?? ""} ${last4 ? `ending ${last4}` : ""}`}
      style={[
        styles.art,
        sm ? styles.artSm : styles.artMd,
        { backgroundColor: from },
        dashed && styles.artDashed,
      ]}
    >
      {/* A second tone across the corner — depth without an image. */}
      <View style={[styles.artGlow, { backgroundColor: to }]} />
      <Text
        style={{
          color: "#fff",
          opacity: 0.85,
          fontSize: fs(sm ? 10.5 : 12),
          fontWeight: "700",
          letterSpacing: 0.6,
        }}
      >
        {bank.toUpperCase()}
      </Text>
      {!sm && (
        <Text
          numberOfLines={1}
          style={{
            color: "#fff",
            fontSize: fs(16),
            fontWeight: "700",
            marginTop: 4,
          }}
        >
          {name ?? "Credit card"}
        </Text>
      )}
      <View style={{ flex: 1 }} />
      <Text
        style={{
          color: "#fff",
          fontSize: fs(sm ? 11 : 14),
          fontWeight: "600",
          letterSpacing: 2,
        }}
      >
        {last4 ? `•••• ${last4}` : "••••"}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  color,
  bg,
  icon,
}: {
  label: string;
  color: string;
  bg: string;
  icon?: IconName;
}) {
  const { fs } = useSettings();
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={color} />}
      <Text style={{ color, fontSize: fs(12), fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

/** Approval chance: text and an icon, never colour alone. */
export function ChanceChip({
  chance,
  label,
  p,
}: {
  chance: Chance;
  label: string;
  p: Palette;
}) {
  const icon: IconName =
    chance === "likely"
      ? "check-circle"
      : chance === "stretch"
        ? "minus-circle"
        : "pause-circle";
  return (
    <Chip
      label={label}
      icon={icon}
      color={chance === "likely" ? p.good : p.ink2}
      bg={chance === "likely" ? p.accentSoft : p.grid}
    />
  );
}

/** A sheet that slides up from the bottom, for pickers and explanations. */
export function Sheet({
  visible,
  onClose,
  p,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  p: Palette;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { fs } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Rises with the keyboard: the backdrop gives up its space first, then
          the list scrolls, so the search box and Confirm stay in view. */}
      <KeyboardAware style={styles.frame}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: p.border }]} />
          <View style={styles.sheetHead}>
            <Text
              style={{
                color: p.ink,
                fontSize: fs(18),
                fontWeight: "700",
                flex: 1,
              }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="x" size={20} color={p.ink2} />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 520, flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer && (
            <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
              {footer}
            </View>
          )}
        </View>
      </KeyboardAware>
    </Modal>
  );
}

/** Plain secondary button: same size and weight as the primary — no confirm-shaming. */
export function OutlineButton({
  label,
  onPress,
  p,
  color,
  disabled,
}: {
  label: string;
  onPress: () => void;
  p: Palette;
  color?: string;
  disabled?: boolean;
}) {
  const { fs } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.outline,
        { borderColor: p.border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text
        style={{ color: color ?? p.ink, fontWeight: "700", fontSize: fs(15) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({
  left,
  right,
  p,
  strong,
}: {
  left: string;
  right: string;
  p: Palette;
  strong?: boolean;
}) {
  const { fs } = useSettings();
  return (
    <View style={styles.row}>
      <Text
        style={{
          color: strong ? p.ink : p.ink2,
          fontSize: fs(14),
          flex: 1,
          fontWeight: strong ? "700" : "500",
        }}
      >
        {left}
      </Text>
      <Text
        style={{
          color: p.ink,
          fontSize: fs(14),
          fontWeight: strong ? "800" : "600",
        }}
      >
        {right}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  art: { borderRadius: 14, overflow: "hidden", padding: 14 },
  artMd: { width: "100%", aspectRatio: 1.75 },
  artSm: { width: 64, height: 42, borderRadius: 8, padding: 6 },
  artDashed: { opacity: 0.55 },
  photo: { borderRadius: 12, overflow: "hidden" },
  last4: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  last4Text: { color: "#fff", fontWeight: "700", letterSpacing: 1.5 },
  artGlow: {
    position: "absolute",
    width: "120%",
    height: "120%",
    right: "-60%",
    top: "-20%",
    borderRadius: 999,
    opacity: 0.55,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  frame: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    flexShrink: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  outline: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
});
