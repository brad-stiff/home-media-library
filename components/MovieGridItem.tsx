import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckoutMark } from './CheckoutMark';
import { MoviePoster } from './MoviePoster';
import { spacing, useTheme } from '../lib/theme';
import { formatOwnershipLabel, Movie } from '../lib/types';

interface MovieGridItemProps {
  movie: Movie;
  onPress: () => void;
  checkedOut?: boolean;
  borrowerName?: string | null;
  compact?: boolean;
}

export function MovieGridItem({
  movie,
  onPress,
  checkedOut = false,
  borrowerName,
  compact = false,
}: MovieGridItemProps) {
  const { colors } = useTheme();
  const ownership = formatOwnershipLabel(movie);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, compact && styles.compact, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}, ${movie.year ?? 'unknown year'}, ${ownership}${
        borrowerName ? `, checked out to ${borrowerName}` : ''
      }`}
    >
      <View>
        <MoviePoster posterPath={movie.posterPath} title={movie.title} />
        {checkedOut ? <CheckoutMark /> : null}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.title, compact && styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
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
  compact: {
    margin: spacing.xs,
  },
  compactTitle: {
    fontSize: 13,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.85,
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
