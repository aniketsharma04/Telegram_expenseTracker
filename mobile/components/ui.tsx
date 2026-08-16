import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Palette } from "../lib/theme";

export function Card({ p, style, children }: { p: Palette; style?: ViewStyle; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ p, children }: { p: Palette; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: p.ink2 }]}>{children}</Text>;
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

/** Horizontal magnitude bar used for categories, merchants, and members. */
export function TrackBar({ p, fraction, color }: { p: Palette; fraction: number; color: string }) {
  return (
    <View style={[styles.track, { backgroundColor: p.grid }]}>
      <View
        style={[styles.bar, { backgroundColor: color, width: `${Math.max(3, Math.min(100, fraction * 100))}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  track: { height: 7, borderRadius: 4, overflow: "hidden", flex: 1 },
  bar: { height: "100%", borderRadius: 4 },
});
