import { useColorScheme } from "react-native";

/** Same validated design tokens as the web dashboard — one design system, two skins. */
export const palettes = {
  light: {
    page: "#f4f4f1",
    surface: "#ffffff",
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    border: "rgba(11,11,11,0.08)",
    accent: "#2a78d6",
    accentSoft: "rgba(42,120,214,0.12)",
    good: "#006300",
  },
  dark: {
    page: "#0d0d0d",
    surface: "#1a1a19",
    ink: "#ffffff",
    ink2: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    border: "rgba(255,255,255,0.09)",
    accent: "#3987e5",
    accentSoft: "rgba(57,135,229,0.18)",
    good: "#0ca30c",
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
