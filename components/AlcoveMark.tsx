import { ColorValue, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../lib/theme';

type SizeProps = {
  size?: number;
};

type TintedProps = SizeProps & {
  color?: ColorValue;
};

const MARK_PATHS = [
  'M26 66 V98 H102 V42',
  'M26 66 A50 50 0 0 1 102 66',
  'M26 42 A50 50 0 0 1 102 42',
] as const;

/** Geometric double-story a mark for auth and brand surfaces (black tile). */
export function AlcoveMark({ size = 56 }: SizeProps) {
  return (
    <Image
      source={require('../assets/brand/alcove-a.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Alcove"
      accessibilityRole="image"
    />
  );
}

/** Letter-only a for inline wordmarks; inherits tint from the surrounding title. */
export function AlcoveALetter({ color, size = 22 }: TintedProps & { color: ColorValue }) {
  const stroke = typeof color === 'string' ? color : '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityElementsHidden>
      {MARK_PATHS.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={6.5}
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeMiterlimit={4}
        />
      ))}
    </Svg>
  );
}

/** Header wordmark: brand a + “lcove”. */
export function AlcoveWordmark({ color, size = 22 }: TintedProps) {
  const { colors } = useTheme();
  const tint = color ?? colors.text;

  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="Alcove">
      <AlcoveALetter color={tint} size={size} />
      <Text style={[styles.rest, { color: tint, fontSize: size * 0.82, lineHeight: size }]}>lcove</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  rest: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
