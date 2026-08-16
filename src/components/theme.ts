"use client";

import { useEffect, useState } from "react";

/**
 * Chart color tokens from the validated palette. Recharts needs concrete hex
 * values (SVG attributes don't resolve CSS variables), so charts pick the
 * light or dark set via useIsDark().
 */
export const CHROME = {
  light: {
    surface: "#fcfcfb",
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    baseline: "#c3c2b7",
    accent: "#2a78d6",
  },
  dark: {
    surface: "#1a1a19",
    ink: "#ffffff",
    ink2: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    baseline: "#383835",
    accent: "#3987e5",
  },
};

/**
 * Category colors stored in the DB are the light-mode steps; this maps each to
 * its dark-surface step (same hue, re-stepped — not an automatic flip).
 */
const DARK_VARIANT: Record<string, string> = {
  "#2a78d6": "#3987e5", // blue
  "#eb6834": "#d95926", // orange
  "#1baf7a": "#199e70", // aqua
  "#eda100": "#c98500", // yellow
  "#e87ba4": "#d55181", // magenta
  "#008300": "#008300", // green
  "#4a3aa7": "#9085e9", // violet
  "#e34948": "#e66767", // red
  "#898781": "#898781", // gray (Uncategorized / Other)
};

export const FALLBACK_COLOR = "#898781";

export function seriesColor(lightHex: string | null, dark: boolean): string {
  const hex = (lightHex ?? FALLBACK_COLOR).toLowerCase();
  return dark ? (DARK_VARIANT[hex] ?? hex) : hex;
}

/** Tracks the OS color-scheme preference so charts restyle live. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return dark;
}

export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
