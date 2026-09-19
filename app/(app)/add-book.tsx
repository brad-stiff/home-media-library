import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { PrimaryButton } from '../../components/PrimaryButton';
import { SearchInput } from '../../components/SearchInput';
import { addBookFromLookup } from '../../lib/books';
import { BookLookupResult, bookSearchSubtitle, searchBooks } from '../../lib/openLibrary';
import { spacing, useTheme } from '../../lib/theme';

export default function AddBookScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [results, setResults] = useState<BookLookupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BookLookupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof q === 'string' && q.trim()) {
      setQuery(q);
    }
  }, [q]);

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
        const books = await searchBooks(query);
        setResults(books);
      } catch {
        setSearchError('Could not search Open Library. Check your connection.');
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
      await addBookFromLookup(selected);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add book.';
      Alert.alert('Unable to add book', message);
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
        <ScrollView contentContainerStyle={styles.confirmContent} keyboardShouldPersistTaps="handled">
          <View style={styles.confirmHeader}>
            {selected.coverUrl ? (
              <Image source={{ uri: selected.coverUrl }} style={styles.cover} contentFit="cover" />
            ) : (
              <View
                style={[
                  styles.cover,
                  styles.coverPlaceholder,
                  { backgroundColor: colors.surfaceElevated },
                ]}
              >
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No cover</Text>
              </View>
            )}
            <View style={styles.confirmMeta}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>{selected.title}</Text>
              <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                {bookSearchSubtitle(selected)}
              </Text>
              {selected.isbn ? (
                <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                  ISBN {selected.isbn}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.confirmActions}>
            <PrimaryButton label="Add to Library" onPress={handleSave} loading={saving} />
            <Pressable onPress={() => setSelected(null)} style={styles.secondaryAction}>
              <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>
                Choose a different book
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Open Library for a book"
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
          keyExtractor={(item, index) => item.openLibraryKey ?? item.isbn ?? `${item.title}-${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No books found for "{query.trim()}".
              </Text>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start typing to search Open Library.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [
                styles.resultRow,
                {
                  backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.resultCover} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.resultCover,
                    styles.coverPlaceholder,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text style={{ color: colors.textTertiary, fontSize: 10 }}>No art</Text>
                </View>
              )}
              <View style={styles.resultMeta}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                  {bookSearchSubtitle(item)}
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
  resultCover: {
    width: 46,
    height: 69,
    borderRadius: 8,
  },
  coverPlaceholder: {
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
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  confirmHeader: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  cover: {
    width: 92,
    height: 138,
    borderRadius: 8,
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
  confirmActions: {
    gap: spacing.md,
    marginTop: spacing.md,
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
