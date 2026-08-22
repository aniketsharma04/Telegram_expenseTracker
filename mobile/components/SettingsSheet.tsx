import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Palette } from "../lib/theme";
import { Lang, useSettings } from "../lib/i18n";

/** Language + text-size settings — the "parent mode" knobs. */
export default function SettingsSheet({
  visible,
  onClose,
  p,
}: {
  visible: boolean;
  onClose: () => void;
  p: Palette;
}) {
  const { t, fs, lang, scale, setLang, setLarge } = useSettings();

  const seg = (
    options: Array<{ key: string; label: string; active: boolean; onPress: () => void }>,
  ) => (
    <View style={[styles.seg, { backgroundColor: p.page, borderColor: p.border }]}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={[styles.segBtn, o.active && { backgroundColor: p.accent }]}
          onPress={o.onPress}
        >
          <Text
            style={{
              fontSize: fs(13.5),
              fontWeight: o.active ? "600" : "400",
              color: o.active ? "#fff" : p.ink2,
            }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>⚙️ {t("settings")}</Text>

          <View style={styles.row}>
            <Text style={{ fontSize: fs(14), color: p.ink2, flex: 1 }}>{t("language")}</Text>
            {seg(
              (
                [
                  { key: "en", label: "English" },
                  { key: "hi", label: "हिंदी" },
                ] as Array<{ key: Lang; label: string }>
              ).map((o) => ({
                ...o,
                active: lang === o.key,
                onPress: () => setLang(o.key),
              })),
            )}
          </View>

          <View style={styles.row}>
            <Text style={{ fontSize: fs(14), color: p.ink2, flex: 1 }}>{t("textSize")}</Text>
            {seg([
              { key: "normal", label: t("normal"), active: scale === 1, onPress: () => setLarge(false) },
              { key: "large", label: t("large"), active: scale > 1, onPress: () => setLarge(true) },
            ])}
          </View>

          <Pressable style={[styles.btn, { backgroundColor: p.accent }]} onPress={onClose}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(15) }}>{t("done")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  seg: { flexDirection: "row", borderRadius: 999, borderWidth: 1, padding: 3, gap: 3 },
  segBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 4 },
});
