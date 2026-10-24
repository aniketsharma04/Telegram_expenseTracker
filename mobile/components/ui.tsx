import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";

/** Line icons (Feather) — the one icon set across the app. */
export type IconName = React.ComponentProps<typeof Feather>["name"];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function Card({ p, style, children }: { p: Palette; style?: ViewStyle; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ p, children }: { p: Palette; children: React.ReactNode }) {
  const { fs } = useSettings();
  return <Text style={[styles.sectionTitle, { color: p.ink, fontSize: fs(16) }]}>{children}</Text>;
}

/** A card's title row: name on the left, an optional text action on the right. */
export function CardHeader({
  p,
  title,
  action,
  onAction,
}: {
  p: Palette;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { fs } = useSettings();
  return (
    <View style={styles.headerRow}>
      <Text style={{ color: p.ink, fontSize: fs(16), fontWeight: "600", flex: 1 }}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={{ color: p.accent, fontSize: fs(13.5), fontWeight: "600" }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Rounded tinted square holding an icon — the leading element of list rows. */
export function IconBubble({ name, color, bg, size = 40 }: { name: IconName; color: string; bg: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function Avatar({ color, label, size = 34 }: { color: string; label: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>{label}</Text>
    </View>
  );
}

/** Horizontal magnitude bar used for categories, merchants, goals and members. */
export function TrackBar({ p, fraction, color }: { p: Palette; fraction: number; color: string }) {
  return (
    <View style={[styles.track, { backgroundColor: p.grid }]}>
      <View
        style={[styles.bar, { backgroundColor: color, width: `${Math.max(3, Math.min(100, fraction * 100))}%` }]}
      />
    </View>
  );
}

/** The daily-budget ring: `fraction` of the circle drawn, starting at 12 o'clock. */
export function Ring({
  size,
  stroke,
  fraction,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {f > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * f} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  sectionTitle: { fontWeight: "600", marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", flex: 1 },
  bar: { height: "100%", borderRadius: 4 },
});
