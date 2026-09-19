import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../components/EmptyState';
import { MovieGridItem } from '../../components/MovieGridItem';
import { SearchInput } from '../../components/SearchInput';
import { Book, searchBooksInLibrary } from '../../lib/books';
import { searchMoviesInLibrary } from '../../lib/movies';
import { radius, spacing, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';

type LibraryTab = 'movies' | 'books';

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [tab, setTab] = useState<LibraryTab>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (searchQuery: string, activeTab: LibraryTab) => {
      setLoading(true);
      try {
        if (activeTab === 'movies') {
          setMovies(await searchMoviesInLibrary(searchQuery));
        } else {
          setBooks(await searchBooksInLibrary(searchQuery));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load library.';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load(query, tab);
    }, [load, query, tab]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => router.push('/household')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Household</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, colors.accent]);

  const handleSearch = (text: string) => {
    setQuery(text);
    load(text, tab);
  };

  const empty =
    tab === 'movies'
      ? {
          title: query ? 'No matches' : 'No movies yet',
          message: query
            ? 'Try a different search term.'
            : 'Scan a disc barcode or tap + to search TMDb.',
        }
      : {
          title: query ? 'No matches' : 'No books yet',
          message: query
            ? 'Try a different search term.'
            : 'Scan an ISBN barcode to add your first book.',
        };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabs}>
        {(['movies', 'books'] as const).map((value) => {
          const active = tab === value;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.accentMuted : 'transparent',
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                {value === 'movies' ? 'Movies' : 'Books'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <SearchInput
            value={query}
            onChangeText={handleSearch}
            placeholder={tab === 'movies' ? 'Search movies' : 'Search books'}
          />
        </View>
        <Pressable
          onPress={() => router.push('/scan')}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
        >
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Scan</Text>
        </Pressable>
        {tab === 'movies' ? (
          <Pressable
            onPress={() => router.push('/add')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add movie"
          >
            <Text style={[styles.addButtonText, { color: colors.accentText }]}>+</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : tab === 'movies' ? (
        movies.length === 0 ? (
          <EmptyState title={empty.title} message={empty.message} />
        ) : (
          <FlatList
            data={movies}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <MovieGridItem movie={item} onPress={() => router.push(`/movie/${item.id}`)} />
            )}
          />
        )
      ) : books.length === 0 ? (
        <EmptyState title={empty.title} message={empty.message} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/book/${item.id}`)}
              style={({ pressed }) => [styles.bookItem, pressed && { opacity: 0.85 }]}
            >
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} style={styles.bookCover} contentFit="cover" />
              ) : (
                <View style={[styles.bookCover, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', padding: 8 }}>
                    {item.title}
                  </Text>
                </View>
              )}
              <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                {[item.year, item.authors[0]].filter(Boolean).join(' · ')}
              </Text>
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
  },
  iconButton: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    justifyContent: 'space-between',
  },
  bookItem: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '50%',
    gap: 4,
  },
  bookCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});
