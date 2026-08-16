import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BOT_URL } from "../lib/api";
import { usePalette } from "../lib/theme";

interface Props {
  onLogin: (token: string) => Promise<string | null>; // returns error message or null
}

export default function LoginScreen({ onLogin }: Props) {
  const { p } = usePalette();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onLogin(code.trim());
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrap, { backgroundColor: p.page }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={[styles.mark, { backgroundColor: p.accent }]}>
          <Text style={styles.markText}>₹</Text>
        </View>
        <Text style={[styles.title, { color: p.ink }]}>Expense Tracker</Text>
        <Text style={[styles.tagline, { color: p.ink2 }]}>Log in Telegram. Analyze here.</Text>

        <View style={styles.steps}>
          <Text style={[styles.step, { color: p.ink2 }]}>1. Open our Telegram bot</Text>
          <Text style={[styles.step, { color: p.ink2 }]}>
            2. Send <Text style={{ fontWeight: "700" }}>/app</Text> — it replies with a login code
          </Text>
          <Text style={[styles.step, { color: p.ink2 }]}>3. Paste the code below</Text>
        </View>

        <TextInput
          style={[styles.input, { borderColor: p.grid, color: p.ink, backgroundColor: p.page }]}
          placeholder="Paste your login code"
          placeholderTextColor={p.muted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.btn, { backgroundColor: p.accent, opacity: busy ? 0.7 : 1 }]}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable onPress={() => Linking.openURL(BOT_URL)}>
          <Text style={[styles.link, { color: p.accent }]}>Open the Telegram bot →</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center" },
  mark: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  markText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  tagline: { fontSize: 14, marginTop: 4, marginBottom: 18 },
  steps: { alignSelf: "stretch", gap: 8, marginBottom: 18 },
  step: { fontSize: 14, lineHeight: 20 },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: "top",
  },
  error: { color: "#d03b3b", fontSize: 13, marginTop: 8, alignSelf: "flex-start" },
  btn: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { fontSize: 13.5, marginTop: 16, fontWeight: "500" },
});
