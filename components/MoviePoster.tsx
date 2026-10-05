import { Image } from 'expo-image';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { posterUrl, radius, useTheme } from '../lib/theme';

interface MoviePosterProps {
  posterPath?: string | null;
  uri?: string | null;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

const sizes = {
  sm: { width: 100, height: 150 },
  md: { width: '100%' as const, aspectRatio: 2 / 3 },
  lg: { width: 160, height: 240 },
};

export function MoviePoster({ posterPath, uri, title, size = 'md', style }: MoviePosterProps) {
  const { colors } = useTheme();
  const dimensions = sizes[size];
  const resolved = uri ?? posterUrl(posterPath ?? null, size === 'sm' ? 'w342' : 'w500');

  return (
    <View
      style={[
        styles.container,
        style ?? dimensions,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={styles.image} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.placeholderText, { color: colors.textTertiary }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  placeholderText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
