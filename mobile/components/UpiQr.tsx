import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import qrcode from "qrcode-generator";

/**
 * A UPI QR code (v25): any UPI app's scanner reads the upi://pay link in it.
 * Drawn as one SVG path, black on white with a quiet zone, whatever the
 * theme — scanners need the contrast.
 */
export default function UpiQr({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++)
        if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, n: count };
  }, [value]);
  const quiet = 4;
  const box = n + quiet * 2;
  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 6,
      }}
      accessibilityLabel="UPI QR code"
    >
      <Svg
        width={size}
        height={size}
        viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      >
        <Rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
        <Path d={d} fill="#000" />
      </Svg>
    </View>
  );
}
