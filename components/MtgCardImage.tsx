import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

/** Same wash Archidekt paints over foil (and etched) printings. */
const FOIL_COLORS = ['purple', 'blue', 'green', 'yellow', 'red'] as const;

/**
 * CSS `linear-gradient(-60deg, …)`: 0° points up and negative angles run
 * counterclockwise, so the last color sits toward the upper left.
 */
const FOIL_START = { x: 0.93, y: 0.75 };
const FOIL_END = { x: 0.07, y: 0.25 };

interface MtgCardImageProps {
  uri: string | null;
  foil?: boolean;
  style: StyleProp<ViewStyle>;
  placeholderColor: string;
}

export function MtgCardImage({ uri, foil = false, style, placeholderColor }: MtgCardImageProps) {
  return (
    <View style={[style, styles.frame]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: placeholderColor }]} />
      )}
      {foil ? (
        <LinearGradient colors={FOIL_COLORS} start={FOIL_START} end={FOIL_END} style={styles.foil} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  foil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.15,
    pointerEvents: 'none',
  },
});
