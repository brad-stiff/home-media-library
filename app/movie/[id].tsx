import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { deleteMovie, getMovieById } from '../../lib/db';
import { backdropUrl, formatRuntime, radius, spacing, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        if (!id) return;
        setLoading(true);
        const result = await getMovieById(id);
        if (active) {
          setMovie(result);
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [id]),
  );

  const handleDelete = () => {
    if (!movie) return;

    Alert.alert('Remove movie?', `Remove "${movie.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMovie(movie.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not remove this movie.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Movie not found.</Text>
      </View>
    );
  }

  const backdrop = backdropUrl(movie.backdropPath);

  return (
    <>
      <Stack.Screen options={{ title: movie.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        {backdrop ? (
          <Image source={{ uri: backdrop }} style={styles.backdrop} contentFit="cover" />
        ) : (
          <View style={[styles.backdrop, { backgroundColor: colors.surfaceElevated }]} />
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.metaBlock}>
              <Text style={[styles.title, { color: colors.text }]}>{movie.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {[movie.year, formatRuntime(movie.runtime)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={[styles.formatBadge, { backgroundColor: colors.accentMuted }]}>
              <Text style={[styles.formatText, { color: colors.accent }]}>{movie.format}</Text>
            </View>
          </View>

          {movie.genres.length > 0 ? (
            <View style={styles.genreRow}>
              {movie.genres.map((genre) => (
                <View
                  key={genre}
                  style={[styles.genreChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.genreText, { color: colors.textSecondary }]}>{genre}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {movie.overview ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
              <Text style={[styles.overview, { color: colors.textSecondary }]}>{movie.overview}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>In your library</Text>
            <Text style={[styles.addedText, { color: colors.textSecondary }]}>
              Added {new Date(movie.addedAt).toLocaleDateString()}
            </Text>
          </View>

          <PrimaryButton
            label="Remove from Library"
            onPress={handleDelete}
            loading={deleting}
            variant="danger"
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing.xl,
  },
  backdrop: {
    width: '100%',
    height: 220,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  metaBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  formatBadge: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  formatText: {
    fontSize: 13,
    fontWeight: '700',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  genreText: {
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
  },
  addedText: {
    fontSize: 15,
  },
});
