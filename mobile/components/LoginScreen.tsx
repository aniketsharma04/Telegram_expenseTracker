import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "./Text";
import { BOT_URL, emailSignIn } from "../lib/api";
import { usePalette } from "../lib/theme";
import { KeyboardAware } from "./ui";

/**
 * Signing in (v12).
 *
 * Email is the front door — anyone can use it, with nothing installed first.
 * Telegram still works for people who started there, and stays available as
 * a way to log expenses by chat, but it is no longer required to have an
 * account at all.
 */

interface Props {
  onLogin: (token: string) => Promise<string | null>; // returns error or null
}

type Mode = "email" | "telegram";
type Stage = "enter_email" | "enter_code";

export default function LoginScreen({ onLogin }: Props) {
  const { p } = usePalette();
  const [mode, setMode] = useState<Mode>("email");
  const [stage, setStage] = useState<Stage>("enter_email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [telegramCode, setTelegramCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    { borderColor: p.grid, color: p.ink, backgroundColor: p.page },
  ];

  const sendCode = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const result = await emailSignIn(email.trim());
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStage("enter_code");
    setNote(`We sent a 6-digit code to ${email.trim()}.`);
  };

  const verifyCode = async () => {
    if (code.trim().length < 4 || busy) return;
    setBusy(true);
    setError(null);
    const result = await emailSignIn(email.trim(), code.trim());
    if ("error" in result) {
      setBusy(false);
      setError(result.error);
      return;
    }
    if (result.token) {
      const err = await onLogin(result.token);
      if (err) setError(err);
    }
    setBusy(false);
  };

  const signInWithTelegram = async () => {
    if (!telegramCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onLogin(telegramCode.trim());
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <KeyboardAware style={[styles.wrap, { backgroundColor: p.page }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.mark, { backgroundColor: p.accent }]}>
            <Text style={styles.markText}>₹</Text>
          </View>
          <Text style={[styles.title, { color: p.ink }]}>Aaj</Text>
          <Text style={[styles.tagline, { color: p.ink2 }]}>
            Know where your money actually goes.
          </Text>

          <View
            style={[
              styles.seg,
              { backgroundColor: p.page, borderColor: p.border },
            ]}
          >
            {(["email", "telegram"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.segBtn,
                  mode === m && { backgroundColor: p.accent },
                ]}
                onPress={() => {
                  setMode(m);
                  setError(null);
                  setNote(null);
                }}
              >
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: mode === m ? "600" : "400",
                    color: mode === m ? "#fff" : p.ink2,
                  }}
                >
                  {m === "email" ? "Email" : "Telegram"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "email" ? (
            <>
              <TextInput
                style={inputStyle}
                placeholder="you@example.com"
                placeholderTextColor={p.muted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (stage === "enter_code") setStage("enter_email");
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!busy}
              />

              {stage === "enter_code" && (
                <TextInput
                  style={[...inputStyle, styles.codeInput]}
                  placeholder="6-digit code"
                  placeholderTextColor={p.muted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  editable={!busy}
                />
              )}

              {note && (
                <Text style={[styles.note, { color: p.ink2 }]}>{note}</Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: p.accent, opacity: busy ? 0.7 : 1 },
                ]}
                onPress={stage === "enter_email" ? sendCode : verifyCode}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {stage === "enter_email" ? "Email me a code" : "Sign in"}
                  </Text>
                )}
              </Pressable>

              {stage === "enter_code" && !busy && (
                <Pressable onPress={sendCode}>
                  <Text style={[styles.link, { color: p.accent }]}>
                    Send another code
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <View style={styles.steps}>
                <Text style={[styles.step, { color: p.ink2 }]}>
                  1. Open the Telegram bot
                </Text>
                <Text style={[styles.step, { color: p.ink2 }]}>
                  2. Send <Text style={{ fontWeight: "700" }}>/app</Text> and it
                  replies with a login code
                </Text>
                <Text style={[styles.step, { color: p.ink2 }]}>
                  3. Paste the code below
                </Text>
              </View>

              <TextInput
                style={inputStyle}
                placeholder="Paste your login code"
                placeholderTextColor={p.muted}
                value={telegramCode}
                onChangeText={setTelegramCode}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                editable={!busy}
              />
              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: p.accent, opacity: busy ? 0.7 : 1 },
                ]}
                onPress={signInWithTelegram}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Sign in</Text>
                )}
              </Pressable>

              <Pressable onPress={() => Linking.openURL(BOT_URL)}>
                <Text style={[styles.link, { color: p.accent }]}>
                  Open the Telegram bot →
                </Text>
              </Pressable>
            </>
          )}

          <Text style={[styles.legal, { color: p.muted }]}>
            Your data stays in this app. You can export or delete all of it at
            any time from Settings.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  markText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  tagline: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 18,
    textAlign: "center",
  },
  seg: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  steps: { alignSelf: "stretch", gap: 8, marginBottom: 14 },
  step: { fontSize: 14, lineHeight: 20 },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    marginBottom: 10,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
    fontWeight: "700",
  },
  note: {
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 6,
    lineHeight: 18,
  },
  error: {
    color: "#b91c1c",
    fontSize: 13,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  btn: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { fontSize: 13.5, marginTop: 14, fontWeight: "500" },
  legal: { fontSize: 11.5, marginTop: 18, textAlign: "center", lineHeight: 16 },
});
