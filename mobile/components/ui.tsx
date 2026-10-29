import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { elevation, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { Text } from "./Text";

/**
 * Lifts its content above the on-screen keyboard by padding the bottom by the
 * keyboard's height. Used in place of KeyboardAvoidingView: the app draws
 * edge-to-edge on Android, so the window no longer shrinks for the keyboard
 * and KeyboardAvoidingView (behavior undefined there) left sheets underneath it.
 */
export function KeyboardAware({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [inset, setInset] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setInset(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setInset(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return <View style={[style, { paddingBottom: inset }]}>{children}</View>;
}

/** Line icons (Feather) — the one icon set across the app. */
export type IconName = React.ComponentProps<typeof Feather>["name"];

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}

/** A lifted surface: soft shadow in light mode, hairline border in dark. */
export function Card({
  p,
  style,
  children,
}: {
  p: Palette;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[styles.card, { backgroundColor: p.surface }, elevation(p), style]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  p,
  children,
}: {
  p: Palette;
  children: React.ReactNode;
}) {
  const { fs } = useSettings();
  return (
    <Text style={[styles.sectionTitle, { color: p.ink, fontSize: fs(16) }]}>
      {children}
    </Text>
  );
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
      <Text
        style={{ color: p.ink, fontSize: fs(16), fontWeight: "700", flex: 1 }}
      >
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text
            style={{ color: p.accent, fontSize: fs(13.5), fontWeight: "700" }}
          >
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Rounded tinted square holding an icon — the leading element of list rows. */
export function IconBubble({
  name,
  color,
  bg,
  size = 42,
}: {
  name: IconName;
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.31,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={size * 0.48} color={color} />
    </View>
  );
}

export function Avatar({
  color,
  label,
  size = 34,
}: {
  color: string;
  label: string;
  size?: number;
}) {
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
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>
        {label}
      </Text>
    </View>
  );
}

/** Horizontal magnitude bar used for categories, merchants, goals and members. */
export function TrackBar({
  p,
  fraction,
  color,
}: {
  p: Palette;
  fraction: number;
  color: string;
}) {
  return (
    <View style={[styles.track, { backgroundColor: p.grid }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: color,
            width: `${Math.max(3, Math.min(100, fraction * 100))}%`,
          },
        ]}
      />
    </View>
  );
}

/**
 * Ease from the previous value to `target`. A plain timer rather than
 * Animated/requestAnimationFrame: it drives SVG props and text the same way on
 * every platform, and still lands exactly on the target.
 */
function useTween(target: number, duration = 900): number {
  const [value, setValue] = useState(target === 0 ? 0 : 0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const begin = from.current;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(begin + (target - begin) * eased);
      if (t >= 1) {
        clearInterval(id);
        from.current = target;
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return value;
}

/**
 * The daily-budget ring: `fraction` of the circle drawn from 12 o'clock.
 * Sweeps to its value on mount and whenever the value changes.
 */
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
  const f = useTween(Math.max(0, Math.min(1, fraction)));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        {f > 0.002 && (
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
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** A number that counts up to `target` — for the hero amount. */
export function useCountUp(target: number, duration = 900): number {
  return Math.round(useTween(target, duration));
}

/** Pressable that gives a little under the finger — the feel of a real button. */
// One animated element carries both the layout style and the press scale, so
// percentage widths and flex work exactly as they would on a plain Pressable.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  style,
  children,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        to(0.97);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        props.onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}

/** Primary button: full width, accent fill, soft accent glow. */
export function PrimaryButton({
  p,
  label,
  onPress,
  disabled,
  busy,
}: {
  p: Palette;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { fs } = useSettings();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={[
        styles.primary,
        {
          backgroundColor: p.accent,
          opacity: disabled ? 0.45 : 1,
          shadowColor: p.accent,
        },
      ]}
    >
      <Text style={{ color: p.onAccent, fontWeight: "700", fontSize: fs(16) }}>
        {busy ? "…" : label}
      </Text>
    </PressableScale>
  );
}

/** Grey placeholder block that gently pulses while data loads. */
export function Skeleton({
  p,
  height,
  width = "100%",
  radius = 14,
}: {
  p: Palette;
  height: number;
  width?: number | `${number}%`;
  radius?: number;
}) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        height,
        width,
        borderRadius: radius,
        backgroundColor: p.grid,
        opacity: pulse,
      }}
    />
  );
}

/** The deep-teal gradient behind the Today hero. */
export function HeroBackground({ p }: { p: Palette }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <Defs>
        <LinearGradient id="hero" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={p.heroFrom} />
          <Stop offset="1" stopColor={p.heroTo} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#hero)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 18 },
  sectionTitle: { fontWeight: "700", marginBottom: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  // flexGrow (not flex: 1) — flex: 1 sets a zero basis, which collapses the bar
  // to nothing when it sits in a column (goals, budgets) instead of a row.
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    flexGrow: 1,
    alignSelf: "stretch",
  },
  bar: { height: "100%", borderRadius: 4 },
  primary: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
