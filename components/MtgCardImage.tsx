import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

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
  title?: string;
  foil?: boolean;
  style: StyleProp<ViewStyle>;
  placeholderColor: string;
  placeholderTextColor?: string;
}

export function MtgCardImage({
  uri,
  title,
  foil = false,
  style,
  placeholderColor,
  placeholderTextColor,
}: MtgCardImageProps) {
  return (
    <View style={[style, styles.frame]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: placeholderColor }]}>
          {title ? (
            <Text style={[styles.placeholderText, { color: placeholderTextColor }]} numberOfLines={3}>
              {title}
            </Text>
          ) : null}
        </View>
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
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  placeholderText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
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
