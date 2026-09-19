import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MoviePoster } from './MoviePoster';
import { radius, spacing, useTheme } from '../lib/theme';
import { formatOwnershipLabel, Movie } from '../lib/types';

interface MovieGridItemProps {
  movie: Movie;
  onPress: () => void;
  checkoutLabel?: string | null;
}

export function MovieGridItem({ movie, onPress, checkoutLabel }: MovieGridItemProps) {
  const { colors } = useTheme();
  const ownership = formatOwnershipLabel(movie);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}, ${movie.year ?? 'unknown year'}, ${ownership}${
        checkoutLabel ? `, checked out to ${checkoutLabel}` : ''
      }`}
    >
      <View>
        <MoviePoster posterPath={movie.posterPath} title={movie.title} />
        {checkoutLabel ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accentText }]} numberOfLines={1}>
              Out · {checkoutLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {movie.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {[movie.year, ownership].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '50%',
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  meta: {
    marginTop: spacing.sm,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
