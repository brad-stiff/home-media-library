import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormatPicker } from '../components/FormatPicker';
import { MoviePoster } from '../components/MoviePoster';
import { PrimaryButton } from '../components/PrimaryButton';
import { SearchInput } from '../components/SearchInput';
import { addMovie } from '../lib/db';
import { spacing, useTheme } from '../lib/theme';
import { getMovieDetails, movieSearchSubtitle, searchMovies } from '../lib/tmdb';
import { MovieFormat, TmdbMovieSearchResult } from '../lib/types';

export default function AddMovieScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbMovieSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TmdbMovieSearchResult | null>(null);
  const [format, setFormat] = useState<MovieFormat>('Blu-ray');
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const movies = await searchMovies(query);
        setResults(movies);
      } catch {
        setSearchError('Could not search TMDb. Check your connection and API key.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSave = async () => {
    if (!selected) return;

    setSaving(true);
    try {
      const details = await getMovieDetails(selected.id);
      await addMovie(details, format);
      router.back();
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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.confirmContent}>
          <View style={styles.confirmHeader}>
            <MoviePoster posterPath={selected.poster_path} title={selected.title} size="lg" />
            <View style={styles.confirmMeta}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>{selected.title}</Text>
              <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                {movieSearchSubtitle(selected)}
              </Text>
              {selected.overview ? (
                <Text style={[styles.overview, { color: colors.textSecondary }]} numberOfLines={4}>
                  {selected.overview}
                </Text>
              ) : null}
            </View>
          </View>

          <FormatPicker value={format} onChange={setFormat} />

          <View style={styles.confirmActions}>
            <PrimaryButton label="Add to Library" onPress={handleSave} loading={saving} />
            <Pressable onPress={() => setSelected(null)} style={styles.secondaryAction}>
              <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>
                Choose a different movie
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search TMDb for a movie"
          autoFocus
        />
      </View>

      {searching ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : searchError ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{searchError}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No movies found for "{query.trim()}".
              </Text>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start typing to search TMDb.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: colors.border },
              ]}
            >
              {item.poster_path ? (
                <Image
                  source={{ uri: `https://image.tmdb.org/t/p/w92${item.poster_path}` }}
                  style={styles.resultPoster}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.resultPoster, styles.resultPosterPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={{ color: colors.textTertiary, fontSize: 10 }}>No art</Text>
                </View>
              )}
              <View style={styles.resultMeta}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                  {movieSearchSubtitle(item)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  resultPoster: {
    width: 46,
    height: 69,
    borderRadius: 8,
  },
  resultPosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMeta: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  resultSubtitle: {
    fontSize: 14,
  },
  confirmContent: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  confirmHeader: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  confirmMeta: {
    flex: 1,
    gap: spacing.sm,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  confirmSubtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    gap: spacing.md,
    marginTop: 'auto',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
