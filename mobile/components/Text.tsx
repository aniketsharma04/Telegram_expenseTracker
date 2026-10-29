import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";

/**
 * The app's typeface (v19, "premium"): Plus Jakarta Sans.
 *
 * Android can't synthesise weights for a custom font — each weight is its own
 * file — so `fontWeight` is turned into the matching family here, once, and
 * every screen just uses this Text/TextInput instead of react-native's.
 */

export const FONT_ASSETS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

let fontsReady = false;
/** App.tsx flips this once the fonts are loaded; until then the system font shows. */
export function setFontsReady(ready: boolean) {
  fontsReady = ready;
}

function familyFor(weight: TextStyle["fontWeight"]): string {
  const w = String(weight ?? "400");
  if (w === "800" || w === "900" || w === "heavy" || w === "black")
    return "PlusJakartaSans_800ExtraBold";
  if (w === "700" || w === "bold") return "PlusJakartaSans_700Bold";
  if (w === "600" || w === "semibold") return "PlusJakartaSans_600SemiBold";
  if (w === "500" || w === "medium") return "PlusJakartaSans_500Medium";
  return "PlusJakartaSans_400Regular";
}

function withFont(style: TextProps["style"]) {
  if (!fontsReady) return style;
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return style;
  const { fontWeight, ...rest } = flat;
  return [rest, { fontFamily: familyFor(fontWeight) }];
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, ...props },
  ref,
) {
  return <RNText ref={ref} {...props} style={withFont(style)} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ style, ...props }, ref) {
    return (
      <RNTextInput
        ref={ref}
        {...props}
        style={withFont(style) as TextInputProps["style"]}
      />
    );
  },
);
