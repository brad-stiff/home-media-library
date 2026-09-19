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
import { searchMoviesInLibrary } from '../../lib/movies';
import { spacing, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMovies = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const results = await searchMoviesInLibrary(searchQuery);
      setMovies(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load movies.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMovies(query);
    }, [loadMovies, query]),
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
    loadMovies(text);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <SearchInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search your library"
          />
        </View>
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
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : movies.length === 0 ? (
        <EmptyState
          title={query ? 'No matches' : 'No movies yet'}
          message={
            query
              ? 'Try a different search term.'
              : 'Tap + to search TMDb and add the first movie to your library.'
          }
        />
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
