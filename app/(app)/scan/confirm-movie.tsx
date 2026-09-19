import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MoviePoster } from '../../../components/MoviePoster';
import { OwnershipPicker } from '../../../components/OwnershipPicker';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { addMovie } from '../../../lib/movies';
import { spacing, useTheme } from '../../../lib/theme';
import { getMovieDetails, movieSearchSubtitle } from '../../../lib/tmdb';
import { MovieOwnership, TmdbMovieSearchResult } from '../../../lib/types';

const DEFAULT_OWNERSHIP: MovieOwnership = {
  hasBluray: true,
  has4k: false,
  hasDigital: false,
  platform: null,
};

export default function ConfirmMovieFromScanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    barcode: string;
    productTitle: string;
    ownershipHints: string;
    movies: string;
  }>();

  const movies = useMemo(() => {
    try {
      return JSON.parse(params.movies ?? '[]') as TmdbMovieSearchResult[];
    } catch {
      return [];
    }
  }, [params.movies]);

  const hints = useMemo(() => {
    try {
      return JSON.parse(params.ownershipHints ?? '{}') as Partial<MovieOwnership>;
    } catch {
      return {};
    }
  }, [params.ownershipHints]);

  const [selected, setSelected] = useState<TmdbMovieSearchResult | null>(
    movies.length === 1 ? movies[0] : null,
  );
  const [ownership, setOwnership] = useState<MovieOwnership>(() => {
    const hasAnyHint = Boolean(hints.hasBluray || hints.has4k || hints.hasDigital);
    if (!hasAnyHint) return DEFAULT_OWNERSHIP;
    return {
      hasBluray: !!hints.hasBluray,
      has4k: !!hints.has4k,
      hasDigital: !!hints.hasDigital,
      platform: hints.platform ?? null,
    };
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const details = await getMovieDetails(selected.id);
      await addMovie(details, ownership, { barcode: params.barcode });
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add movie.';
      Alert.alert('Unable to add movie', message);
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.confirm} keyboardShouldPersistTaps="handled">
          <Text style={[styles.product, { color: colors.textSecondary }]}>
            Scanned: {params.productTitle}
          </Text>
          <View style={styles.header}>
            <MoviePoster posterPath={selected.poster_path} title={selected.title} size="lg" />
            <View style={styles.meta}>
              <Text style={[styles.title, { color: colors.text }]}>{selected.title}</Text>
              <Text style={{ color: colors.textSecondary }}>{movieSearchSubtitle(selected)}</Text>
            </View>
          </View>
          <OwnershipPicker value={ownership} onChange={setOwnership} />
          <PrimaryButton label="Add to library" onPress={handleSave} loading={saving} />
          {movies.length > 1 ? (
            <Pressable onPress={() => setSelected(null)} style={styles.link}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                Choose a different match
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.replace('/scan')} style={styles.link}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Scan again</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.listHeader}>
        <Text style={[styles.title, { color: colors.text }]}>Pick the movie</Text>
        <Text style={{ color: colors.textSecondary }}>From barcode: {params.productTitle}</Text>
      </View>
      <FlatList
        data={movies}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {item.poster_path ? (
              <Image
                source={{ uri: `https://image.tmdb.org/t/p/w92${item.poster_path}` }}
                style={styles.poster}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.poster, { backgroundColor: colors.surfaceElevated }]} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: colors.textSecondary }}>{movieSearchSubtitle(item)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  confirm: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  product: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  meta: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  poster: {
    width: 46,
    height: 69,
    borderRadius: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});
