import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
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
import { Checkout, getActiveCheckoutsByItemIds } from '../../lib/checkouts';
import { useAuth } from '../../lib/auth';
import { useHousehold } from '../../lib/householdContext';
import { searchMoviesInLibrary } from '../../lib/movies';
import { MtgCard, searchMtgCollection, updateMtgCardQty } from '../../lib/mtgCards';
import { listMtgDecks, MtgDeck } from '../../lib/mtgDecks';
import { canDeleteOwned, isWriter } from '../../lib/roles';
import { radius, spacing, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';

type LibraryTab = 'movies' | 'books' | 'mtg';
type AvailabilityFilter = 'all' | 'available' | 'out';
type MtgMode = 'collection' | 'decks';

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const writer = household ? isWriter(household.role) : false;
  const [tab, setTab] = useState<LibraryTab>('movies');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [mtgMode, setMtgMode] = useState<MtgMode>('collection');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [mtgCards, setMtgCards] = useState<MtgCard[]>([]);
  const [mtgDecks, setMtgDecks] = useState<MtgDeck[]>([]);
  const [checkouts, setCheckouts] = useState<Map<string, Checkout>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (searchQuery: string, activeTab: LibraryTab, mode: MtgMode) => {
      setLoading(true);
      try {
        if (activeTab === 'movies') {
          const results = await searchMoviesInLibrary(searchQuery);
          setMovies(results);
          setCheckouts(await getActiveCheckoutsByItemIds('movie', results.map((m) => m.id)));
        } else if (activeTab === 'books') {
          const results = await searchBooksInLibrary(searchQuery);
          setBooks(results);
          setCheckouts(await getActiveCheckoutsByItemIds('book', results.map((b) => b.id)));
        } else if (mode === 'collection') {
          setMtgCards(await searchMtgCollection(searchQuery));
        } else {
          const decks = await listMtgDecks();
          const trimmed = searchQuery.trim().toLowerCase();
          setMtgDecks(
            trimmed
              ? decks.filter((d) => d.name.toLowerCase().includes(trimmed))
              : decks,
          );
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
      load(query, tab, mtgMode);
    }, [load, query, tab, mtgMode]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => router.push('/household')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Household</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => router.push('/loans')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Loans</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, colors.accent]);

  const filteredMovies = useMemo(() => {
    if (availability === 'all') return movies;
    if (availability === 'out') return movies.filter((m) => checkouts.has(m.id));
    return movies.filter((m) => !checkouts.has(m.id));
  }, [movies, checkouts, availability]);

  const filteredBooks = useMemo(() => {
    if (availability === 'all') return books;
    if (availability === 'out') return books.filter((b) => checkouts.has(b.id));
    return books.filter((b) => !checkouts.has(b.id));
  }, [books, checkouts, availability]);

  const handleSearch = (text: string) => {
    setQuery(text);
    load(text, tab, mtgMode);
  };

  const adjustQty = (card: MtgCard, delta: number) => {
    const next = card.qty + delta;
    void (async () => {
      try {
        await updateMtgCardQty(card.id, next);
        await load(query, 'mtg', 'collection');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update quantity.';
        Alert.alert('Error', message);
      }
    })();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabs}>
        {([
          ['movies', 'Movies'],
          ['books', 'Books'],
          ['mtg', 'MTG'],
        ] as const).map(([value, label]) => {
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
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab !== 'mtg' ? (
        <View style={styles.tabs}>
          {(
            [
              ['all', 'All'],
              ['available', 'Available'],
              ['out', 'Checked out'],
            ] as const
          ).map(([value, label]) => {
            const active = availability === value;
            return (
              <Pressable
                key={value}
                onPress={() => setAvailability(value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.surfaceElevated : 'transparent',
                    borderColor: active ? colors.textSecondary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.text : colors.textSecondary,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.tabs}>
          {([
            ['collection', 'Collection'],
            ['decks', 'Decks'],
          ] as const).map(([value, label]) => {
            const active = mtgMode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMtgMode(value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.surfaceElevated : 'transparent',
                    borderColor: active ? colors.textSecondary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.text : colors.textSecondary,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <SearchInput
            value={query}
            onChangeText={handleSearch}
            placeholder={
              tab === 'movies'
                ? 'Search movies'
                : tab === 'books'
                  ? 'Search books'
                  : mtgMode === 'decks'
                    ? 'Search decks'
                    : 'Search collection'
            }
          />
        </View>
        {writer && tab !== 'mtg' ? (
          <Pressable
            onPress={() => router.push('/scan')}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Scan</Text>
          </Pressable>
        ) : null}
        {writer && tab === 'movies' ? (
          <Pressable
            onPress={() => router.push('/add')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.addButtonText, { color: colors.accentText }]}>+</Text>
          </Pressable>
        ) : null}
        {writer && tab === 'books' ? (
          <Pressable
            onPress={() => router.push('/add-book')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.addButtonText, { color: colors.accentText }]}>+</Text>
          </Pressable>
        ) : null}
        {writer && tab === 'mtg' && mtgMode === 'collection' ? (
          <Pressable
            onPress={() => router.push('/mtg/add')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.addButtonText, { color: colors.accentText }]}>+</Text>
          </Pressable>
        ) : null}
        {writer && tab === 'mtg' && mtgMode === 'decks' ? (
          <Pressable
            onPress={() => router.push('/mtg/import')}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.accent,
                borderColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 12 }}>
              Import
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : tab === 'movies' ? (
        filteredMovies.length === 0 ? (
          <EmptyState
            title={query || availability !== 'all' ? 'No matches' : 'No movies yet'}
            message={
              writer
                ? 'Scan a disc or tap + to search TMDb.'
                : 'Movies added by your household will show up here.'
            }
          />
        ) : (
          <FlatList
            data={filteredMovies}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <MovieGridItem
                movie={item}
                checkoutLabel={checkouts.get(item.id)?.borrowerName}
                onPress={() => router.push(`/movie/${item.id}`)}
              />
            )}
          />
        )
      ) : tab === 'books' ? (
        filteredBooks.length === 0 ? (
          <EmptyState
            title={query || availability !== 'all' ? 'No matches' : 'No books yet'}
            message={
              writer
                ? 'Scan an ISBN or tap + to search Open Library.'
                : 'Books added by your household will show up here.'
            }
          />
        ) : (
          <FlatList
            data={filteredBooks}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => {
              const loan = checkouts.get(item.id);
              return (
                <Pressable
                  onPress={() => router.push(`/book/${item.id}`)}
                  style={({ pressed }) => [styles.bookItem, pressed && { opacity: 0.85 }]}
                >
                  <View>
                    {item.coverUrl ? (
                      <Image
                        source={{ uri: item.coverUrl }}
                        style={styles.bookCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.bookCover, { backgroundColor: colors.surfaceElevated }]} />
                    )}
                    {loan ? (
                      <View style={[styles.bookBadge, { backgroundColor: colors.accent }]}>
                        <Text
                          style={[styles.bookBadgeText, { color: colors.accentText }]}
                          numberOfLines={1}
                        >
                          Out · {loan.borrowerName}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            }}
          />
        )
      ) : mtgMode === 'collection' ? (
        mtgCards.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No cards yet'}
            message={
              writer
                ? 'Tap + to search Scryfall and add cards to your collection.'
                : 'Cards added by your household will show up here.'
            }
          />
        ) : (
          <FlatList
            data={mtgCards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View
                style={[styles.mtgRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.mtgThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.mtgThumb, { backgroundColor: colors.surfaceElevated }]} />
                )}
                <View style={styles.mtgMeta}>
                  <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                    {item.foil ? ' ★' : ''}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                    {[item.setCode?.toUpperCase(), item.collectorNumber, item.typeLine]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.qtyCol}>
                  {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                    <Pressable onPress={() => adjustQty(item, 1)} hitSlop={8}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>+</Text>
                    </Pressable>
                  ) : null}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.qty}</Text>
                  {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                    <Pressable onPress={() => adjustQty(item, -1)} hitSlop={8}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>−</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}
          />
        )
      ) : mtgDecks.length === 0 ? (
        <EmptyState
          title={query ? 'No matches' : 'No decks yet'}
            message={
              writer
                ? 'Tap Import to pull a commander deck from Archidekt.'
                : 'Decks imported by your household will show up here.'
            }
        />
      ) : (
        <FlatList
          data={mtgDecks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/mtg/deck/${item.id}`)}
              style={[styles.deckRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.bookTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {item.archidektId
                    ? `Archidekt ${item.archidektId}`
                    : `Updated ${new Date(item.updatedAt).toLocaleDateString()}`}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
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
  searchInput: { flex: 1 },
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
  row: { justifyContent: 'space-between' },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
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
  },
  bookBadge: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  bookBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  mtgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  mtgThumb: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
  mtgMeta: { flex: 1, gap: 4 },
  qtyCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 28,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
});
