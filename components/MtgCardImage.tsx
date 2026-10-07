import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../lib/theme';

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
  /** Back face of a transform or modal double-faced card. */
  backUri?: string | null;
  title?: string;
  foil?: boolean;
  /** Fades the art for a printed card the collection does not own. */
  muted?: boolean;
  /** Opens or adds the card. Kept off the back control so the two are not nested buttons. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style: StyleProp<ViewStyle>;
  placeholderColor: string;
  placeholderTextColor?: string;
}

export function MtgCardImage({
  uri,
  backUri = null,
  title,
  foil = false,
  muted = false,
  onPress,
  accessibilityLabel,
  style,
  placeholderColor,
  placeholderTextColor,
}: MtgCardImageProps) {
  const { colors } = useTheme();
  const [showingBack, setShowingBack] = useState(false);
  const faceUri = showingBack && backUri ? backUri : uri;

  useEffect(() => {
    setShowingBack(false);
  }, [uri, backUri]);

  const picture = faceUri ? (
    <Image source={{ uri: faceUri }} style={[StyleSheet.absoluteFill, muted && styles.muted]} contentFit="cover" />
  ) : (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.placeholder,
        { backgroundColor: placeholderColor },
        muted && styles.muted,
      ]}
    >
      {title ? (
        <Text style={[styles.placeholderText, { color: placeholderTextColor }]} numberOfLines={3}>
          {title}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[style, styles.frame]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={StyleSheet.absoluteFill}
        >
          {picture}
        </Pressable>
      ) : (
        picture
      )}
      {foil && !muted ? (
        <LinearGradient colors={FOIL_COLORS} start={FOIL_START} end={FOIL_END} style={styles.foil} />
      ) : null}
      {backUri ? (
        <Pressable
          onPress={() => setShowingBack((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={showingBack ? `Show the front of ${title ?? 'this card'}` : `Show the back of ${title ?? 'this card'}`}
          hitSlop={8}
          style={[styles.flip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.flipText, { color: colors.text }]}>{showingBack ? 'Front' : 'Back'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    position: 'relative',
  },
  muted: {
    opacity: 0.4,
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
  flip: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  flipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
