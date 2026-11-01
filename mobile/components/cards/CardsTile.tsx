import { StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { Icon, PressableScale } from "../ui";
import { elevation, type Palette } from "../../lib/theme";
import { useSettings } from "../../lib/i18n";
import { CardArt, cardsAccent } from "./parts";

/** The way into Aaj Cards from the main app: a card-shaped tile. */
export function CardsTile({
  p,
  dark,
  onOpen,
}: {
  p: Palette;
  dark: boolean;
  onOpen: () => void;
}) {
  const { fs, lang } = useSettings();
  const c = cardsAccent(dark);
  const title = lang === "hi" ? "Aaj कार्ड्स" : "Aaj Cards";
  const body =
    lang === "hi"
      ? "देखें कौन-से रिवॉर्ड छूटे, और आपके खर्च के लिए सबसे अच्छा कार्ड"
      : "See the rewards you missed, and the best card for how you spend";
  return (
    <PressableScale
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.tile, { backgroundColor: p.surface }, elevation(p)]}>
        <View style={{ width: 74, transform: [{ rotate: "-6deg" }] }}>
          <CardArt bank="HDFC" name={null} last4={null} size="sm" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: p.ink, fontWeight: "800", fontSize: fs(16) }}>
            Aaj{" "}
            <Text
              style={{ color: c.accent, fontWeight: "800", fontSize: fs(16) }}
            >
              {title.replace("Aaj ", "")}
            </Text>
          </Text>
          <Text
            style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: fs(19) }}
          >
            {body}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color={p.muted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
  },
});
