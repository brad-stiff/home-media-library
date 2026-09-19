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

import { PrimaryButton } from '../../../components/PrimaryButton';
import { CheckoutPanel } from '../../../components/CheckoutPanel';
import { Checkout, getActiveCheckout } from '../../../lib/checkouts';
import { getMyHousehold } from '../../../lib/household';
import { deleteMovie, getMovieById } from '../../../lib/movies';
import { backdropUrl, formatRuntime, radius, spacing, useTheme } from '../../../lib/theme';
import { formatOwnershipLabel, Movie } from '../../../lib/types';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCheckout, setActiveCheckout] = useState<Checkout | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        if (!id) return;
        setLoading(true);
        try {
          const [result, household, checkout] = await Promise.all([
            getMovieById(id),
            getMyHousehold(),
            getActiveCheckout('movie', id),
          ]);
          if (active) {
            setMovie(result);
            setIsAdmin(household.role === 'admin');
            setActiveCheckout(checkout);
          }
        } catch (error) {
          if (active) {
            const message = error instanceof Error ? error.message : 'Could not load movie.';
            Alert.alert('Error', message);
            setMovie(null);
          }
        } finally {
          if (active) setLoading(false);
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
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Could not remove this movie.';
            Alert.alert('Error', message);
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
  const ownershipLabel = formatOwnershipLabel(movie);

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
          </View>

          <View style={styles.ownershipRow}>
            {movie.hasBluray ? (
              <View style={[styles.formatBadge, { backgroundColor: colors.accentMuted }]}>
                <Text style={[styles.formatText, { color: colors.accent }]}>Blu-ray</Text>
              </View>
            ) : null}
            {movie.has4k ? (
              <View style={[styles.formatBadge, { backgroundColor: colors.accentMuted }]}>
                <Text style={[styles.formatText, { color: colors.accent }]}>4K</Text>
              </View>
            ) : null}
            {movie.hasDigital ? (
              <View style={[styles.formatBadge, { backgroundColor: colors.accentMuted }]}>
                <Text style={[styles.formatText, { color: colors.accent }]}>Digital</Text>
              </View>
            ) : null}
            {movie.platform?.trim() ? (
              <View style={[styles.formatBadge, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.formatText, { color: colors.textSecondary }]}>
                  {movie.platform.trim()}
                </Text>
              </View>
            ) : null}
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Lending</Text>
            <CheckoutPanel
              itemType="movie"
              itemId={movie.id}
              activeCheckout={activeCheckout}
              onChanged={setActiveCheckout}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>In your library</Text>
            <Text style={[styles.addedText, { color: colors.textSecondary }]}>
              {ownershipLabel}
            </Text>
            <Text style={[styles.addedText, { color: colors.textSecondary }]}>
              Added {new Date(movie.addedAt).toLocaleDateString()}
            </Text>
          </View>

          {isAdmin ? (
            <PrimaryButton
              label="Remove from Library"
              onPress={handleDelete}
              loading={deleting}
              variant="danger"
            />
          ) : (
            <Text style={[styles.addedText, { color: colors.textTertiary }]}>
              Only household admins can remove movies.
            </Text>
          )}
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
  ownershipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
