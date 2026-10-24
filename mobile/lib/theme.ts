import { useColorScheme } from "react-native";

/**
 * "Calm" design (v18): warm off-white ground, white cards, one deep-teal
 * accent; orange only for "over". Muted text is dark enough for 4.5:1 on
 * both the ground and cards — small grey labels must still be readable.
 */
export const palettes = {
  light: {
    page: "#f6f5f2",
    surface: "#ffffff",
    ink: "#141414",
    ink2: "#55544f",
    muted: "#6b6a65",
    grid: "#ece9e2",
    border: "#e4e2dc",
    accent: "#0f766e",
    accentSoft: "#e7f3ef",
    good: "#0f766e",
    warn: "#c2410c",
    warnSoft: "#fdf0e6",
    danger: "#b91c1c",
    onAccent: "#ffffff",
  },
  dark: {
    page: "#0f0f0e",
    surface: "#1b1b19",
    ink: "#f4f4f1",
    ink2: "#c4c3bc",
    muted: "#a09f98",
    grid: "#2c2c29",
    border: "#2a2a27",
    accent: "#2bb3a3",
    accentSoft: "rgba(43,179,163,0.16)",
    good: "#34c3a0",
    warn: "#f0884d",
    warnSoft: "rgba(240,136,77,0.16)",
    danger: "#f16b6b",
    onAccent: "#0b1f1d",
  },
};

export type Palette = typeof palettes.light;

export function usePalette(): { p: Palette; dark: boolean } {
  const dark = useColorScheme() === "dark";
  return { p: dark ? palettes.dark : palettes.light, dark };
}

const MEMBER_SLOTS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export function memberColor(index: number, dark: boolean): string {
  const slots = dark ? MEMBER_SLOTS.dark : MEMBER_SLOTS.light;
  return slots[index % slots.length];
}

/** Category colors come from the API as light-mode hex; map to dark steps. */
const DARK_VARIANT: Record<string, string> = {
  "#2a78d6": "#3987e5",
  "#eb6834": "#d95926",
  "#1baf7a": "#199e70",
  "#eda100": "#c98500",
  "#e87ba4": "#d55181",
  "#008300": "#008300",
  "#4a3aa7": "#9085e9",
  "#e34948": "#e66767",
  "#898781": "#898781",
  "#d55181": "#d55181",
  "#104281": "#5598e7",
  "#86b6ef": "#86b6ef",
  "#199e70": "#199e70",
  "#9085e9": "#9085e9",
  "#c98500": "#c98500",
};

export const FALLBACK_COLOR = "#898781";

export function seriesColor(lightHex: string | null | undefined, dark: boolean): string {
  const hex = (lightHex ?? FALLBACK_COLOR).toLowerCase();
  return dark ? (DARK_VARIANT[hex] ?? hex) : hex;
}

/** Indian digit grouping without relying on Intl availability in Hermes. */
export function formatINR(n: number): string {
  const negative = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${negative ? "-" : ""}₹${grouped}`;
}
