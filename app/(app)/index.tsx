import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiCredit } from '../../components/ApiCredit';
import { EmptyState } from '../../components/EmptyState';
import { HeaderMenu, HeaderMenuItem } from '../../components/HeaderMenu';
import { FilterChoices, LibraryDock } from '../../components/LibraryDock';
import { FabAction, LibraryFab } from '../../components/LibraryFab';
import { MovieGridItem } from '../../components/MovieGridItem';
import { MtgCardImage } from '../../components/MtgCardImage';
import { SearchInput } from '../../components/SearchInput';
import { Book, searchBooksInLibrary } from '../../lib/books';
import { Checkout, getActiveCheckoutsByItemIds } from '../../lib/checkouts';
import { useAuth } from '../../lib/auth';
import { useHousehold } from '../../lib/householdContext';
import {
  AVAILABILITY_FILTERS,
  CATALOG_SORTS,
  CatalogSort,
  DECK_SORTS,
  DeckSort,
  DOCK_LABELS,
  DockType,
  MTG_COLLECTION_SORTS,
  MtgCollectionSort,
  resolveOpeningTab,
  sortCatalog,
  sortDecks,
  sortMtgCollection,
  visibleDockTabs,
  withTabPrefs,
} from '../../lib/libraryView';
import { searchMoviesInLibrary } from '../../lib/movies';
import { attachColorIdentities, MtgCard, searchMtgCollection, updateMtgCardQty } from '../../lib/mtgCards';
import { listMtgDecks, MtgDeck } from '../../lib/mtgDecks';
import { isTypeVisible, useProfile } from '../../lib/profile';
import { canDeleteOwned, isWriter } from '../../lib/roles';
import { posterUrl, radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';
import { formatLabel } from '../../lib/deckLegality';

type MtgMode = 'collection' | 'decks';

const MTG_MODES: { id: MtgMode; label: string }[] = [
  { id: 'collection', label: 'Collection' },
  { id: 'decks', label: 'Decks' },
];

function searchPlaceholder(tab: DockType, mode: MtgMode): string {
  if (tab === 'movies') return 'Search movies';
  if (tab === 'books') return 'Search books';
  if (tab === 'mtg' && mode === 'decks') return 'Search decks';
  if (tab === 'mtg') return 'Search collection';
  return `Search ${DOCK_LABELS[tab].toLowerCase()}`;
}

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const lendingOn = household?.lendingEnabled !== false;
  const { profile, loading: profileLoading, saveLibraryView } = useProfile();
  const writer = household ? isWriter(household.role) : false;
  const [tab, setTab] = useState<DockType | null>(null);
  const [mtgMode, setMtgMode] = useState<MtgMode>('collection');
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [mtgCards, setMtgCards] = useState<MtgCard[]>([]);
  const [mtgDecks, setMtgDecks] = useState<MtgDeck[]>([]);
  const [checkouts, setCheckouts] = useState<Map<string, Checkout>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dockHeight, setDockHeight] = useState(160);

  const visible = useMemo(() => {
    return visibleDockTabs(profile.libraryView.dockOrder, (type) => {
      if (type === 'games' || type === 'pokemon') return false;
      if (!household) return true;
      return isTypeVisible(household, profile, type);
    });
  }, [household, profile]);
  const visibleKey = visible.join(',');

  useEffect(() => {
    if (profileLoading) return;
    setTab((current) =>
      current && visible.includes(current) ? current : resolveOpeningTab(profile.libraryView, visible),
    );
    // Re-resolve only when the visible dock changes. Tab taps update lastTab and must not jump back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, visibleKey]);

  useEffect(() => {
    if (profileLoading) return;
    setTab(resolveOpeningTab(profile.libraryView, visible));
    // A chosen opening tab should win over whatever is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile.libraryView.opening]);

  const scope = tab === 'mtg' ? `mtg-${mtgMode}` : (tab ?? 'movies');
  const query = queries[scope] ?? '';
  const compact = profile.libraryView.density === 'compact';
  const tabPrefs = tab ? profile.libraryView[tab] : profile.libraryView.movies;
  const layout = tabPrefs.layout;
  const movieAvailability = lendingOn ? profile.libraryView.movies.availability : 'all';
  const bookAvailability = lendingOn ? profile.libraryView.books.availability : 'all';
  const availability = tab === 'books' ? bookAvailability : movieAvailability;
  const mtgSort = profile.libraryView.mtg.sort;
  const catalogSort: CatalogSort = tab && tab !== 'mtg' ? profile.libraryView[tab].sort : 'title';
  const deckSort = profile.libraryView.decks.sort;

  const persist = useCallback(
    async (next: typeof profile.libraryView) => {
      try {
        await saveLibraryView(next);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Try again.';
        Alert.alert('Could not save view', message);
      }
    },
    [profile.libraryView, saveLibraryView],
  );

  const load = useCallback(async (searchQuery: string, activeTab: DockType, mode: MtgMode) => {
    setLoading(true);
    try {
      if (activeTab === 'movies') {
        const results = await searchMoviesInLibrary(searchQuery);
        setMovies(results);
        setCheckouts(
          household?.lendingEnabled === false
            ? new Map()
            : await getActiveCheckoutsByItemIds('movie', results.map((movie) => movie.id)),
        );
      } else if (activeTab === 'books') {
        const results = await searchBooksInLibrary(searchQuery);
        setBooks(results);
        setCheckouts(
          household?.lendingEnabled === false
            ? new Map()
            : await getActiveCheckoutsByItemIds('book', results.map((book) => book.id)),
        );
      } else if (mode === 'collection') {
        const results = await searchMtgCollection(searchQuery);
        setMtgCards(results);
        try {
          const filled = await attachColorIdentities(results, (card) =>
            household != null && canDeleteOwned(household.role, card.addedBy, user?.id ?? null),
          );
          setMtgCards(filled);
        } catch {
          // Set, title, and quantity sorts still work if Scryfall is unreachable.
        }
      } else {
        const decks = await listMtgDecks();
        const trimmed = searchQuery.trim().toLowerCase();
        setMtgDecks(trimmed ? decks.filter((deck) => deck.name.toLowerCase().includes(trimmed)) : decks);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load library.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [household, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (profileLoading || !household || !tab) return;
      if (!visible.includes(tab)) return;
      load(query, tab, mtgMode);
    }, [load, query, tab, mtgMode, profileLoading, household, visible]),
  );

  const menuItems = useMemo(() => {
    const items: HeaderMenuItem[] = [{ label: 'Household', onPress: () => router.push('/household') }];
    if (lendingOn) items.push({ label: 'Loans', onPress: () => router.push('/loans') });
    items.push(
      { label: 'Contacts', onPress: () => router.push('/contacts') },
      { label: 'Settings', onPress: () => router.push('/settings') },
      { label: 'Account', onPress: () => router.push('/account') },
      { label: 'About', onPress: () => router.push('/about') },
    );
    return items;
  }, [lendingOn, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      headerRight: () => <HeaderMenu items={menuItems} />,
    });
  }, [navigation, menuItems]);

  const selectTab = (next: DockType) => {
    setTab(next);
    setSearchOpen(false);
    setFiltersOpen(false);
    if (profile.libraryView.lastTab !== next) {
      void persist({ ...profile.libraryView, lastTab: next });
    }
  };

  const filteredMovies = useMemo(() => {
    const matched =
      movieAvailability === 'all'
        ? movies
        : movies.filter((movie) =>
            movieAvailability === 'out' ? checkouts.has(movie.id) : !checkouts.has(movie.id),
          );
    return sortCatalog(matched, profile.libraryView.movies.sort, {
      title: (movie) => movie.title,
      year: (movie) => movie.year,
      addedAt: (movie) => movie.addedAt,
    });
  }, [movies, checkouts, movieAvailability, profile.libraryView.movies.sort]);

  const filteredBooks = useMemo(() => {
    const matched =
      bookAvailability === 'all'
        ? books
        : books.filter((book) => (bookAvailability === 'out' ? checkouts.has(book.id) : !checkouts.has(book.id)));
    return sortCatalog(matched, profile.libraryView.books.sort, {
      title: (book) => book.title,
      year: (book) => book.year,
      addedAt: (book) => book.addedAt,
    });
  }, [books, checkouts, bookAvailability, profile.libraryView.books.sort]);

  const sortedCards = useMemo(
    () =>
      sortMtgCollection(mtgCards, profile.libraryView.mtg.sort, {
        title: (card) => card.name,
        year: () => null,
        addedAt: (card) => card.addedAt,
        setName: (card) => card.setName ?? card.setCode,
        collectorNumber: (card) => card.collectorNumber,
        colorIdentity: (card) => card.colorIdentity,
        qty: (card) => card.qty,
      }),
    [mtgCards, profile.libraryView.mtg.sort],
  );

  const sortedDecks = useMemo(
    () =>
      sortDecks(mtgDecks, profile.libraryView.decks.sort, {
        title: (deck) => deck.name,
        addedAt: (deck) => deck.createdAt,
      }),
    [mtgDecks, profile.libraryView.decks.sort],
  );

  const adjustQty = (card: MtgCard, delta: number) => {
    const next = card.qty + delta;
    void (async () => {
      try {
        await updateMtgCardQty(card.id, next);
        if (tab) await load(query, tab, 'collection');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update quantity.';
        Alert.alert('Error', message);
      }
    })();
  };

  const actions: FabAction[] = useMemo(() => {
    if (!writer || !tab) return [];
    if (tab === 'movies') {
      return [
        { id: 'scan', label: 'Scan', accessibilityLabel: 'Scan a movie barcode', onPress: () => router.push('/scan') },
        { id: 'add', label: 'Add', accessibilityLabel: 'Add a movie', onPress: () => router.push('/add') },
      ];
    }
    if (tab === 'books') {
      return [
        { id: 'scan', label: 'Scan', accessibilityLabel: 'Scan a book barcode', onPress: () => router.push('/scan') },
        { id: 'add', label: 'Add', accessibilityLabel: 'Add a book', onPress: () => router.push('/add-book') },
      ];
    }
    if (tab === 'mtg' && mtgMode === 'decks') {
      return [
        {
          id: 'import',
          label: 'Import',
          accessibilityLabel: 'Import a deck from Archidekt',
          onPress: () => router.push('/mtg/import'),
        },
      ];
    }
    if (tab === 'mtg') {
      return [
        { id: 'add', label: 'Add', accessibilityLabel: 'Add a card', onPress: () => router.push('/mtg/add') },
      ];
    }
    return [];
  }, [writer, tab, mtgMode, router]);

  if (profileLoading || !tab) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (household && visible.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Nothing to show"
          message={
            household.role === 'admin'
              ? 'Turn a library type back on in Settings. Hiding a type keeps the catalog.'
              : 'Every library type is hidden. Open Settings to show one again, or ask an admin if the household turned them off.'
          }
        />
      </View>
    );
  }

  const creditProviders =
    tab === 'movies'
      ? (['tmdb'] as const)
      : tab === 'books'
        ? (['openLibrary'] as const)
        : mtgMode === 'decks'
          ? (['scryfall', 'archidekt'] as const)
          : (['scryfall'] as const);

  const placeholder = searchPlaceholder(tab, mtgMode);
  const browsingEmpty = query.trim().length === 0 && (tab === 'mtg' || availability === 'all');
  const emptyAction =
    writer && browsingEmpty && actions[0]
      ? { label: actions[0].label, onPress: actions[0].onPress }
      : undefined;

  const filterBits = ['Filters'];
  if (tab === 'mtg' && mtgMode === 'decks') filterBits.push('Decks');
  if (tab !== 'mtg' && availability !== 'all') {
    filterBits.push(AVAILABILITY_FILTERS.find((option) => option.id === availability)?.label ?? availability);
  }
  const activeSort = tab === 'mtg' && mtgMode === 'decks' ? deckSort : tab === 'mtg' ? mtgSort : catalogSort;
  const sortOptions = tab === 'mtg' && mtgMode === 'decks' ? DECK_SORTS : tab === 'mtg' ? MTG_COLLECTION_SORTS : CATALOG_SORTS;
  if (activeSort !== 'title') {
    filterBits.push(sortOptions.find((option) => option.id === activeSort)?.label ?? activeSort);
  }

  const listPad = { paddingBottom: spacing.xl + 56 };

  return (
    <View style={styles.container}>
      {searchOpen ? (
        <View style={styles.searchTop}>
          <SearchInput
            value={query}
            autoFocus
            accessibilityLabel={placeholder}
            placeholder={placeholder}
            onChangeText={(text) => setQueries((prev) => ({ ...prev, [scope]: text }))}
            onBlur={() => setSearchOpen(false)}
          />
        </View>
      ) : null}

      <ApiCredit providers={[...creditProviders]} />

      <View style={styles.results}>
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
                  ? 'Scan a disc or add a title from TMDb.'
                  : 'Movies added by your household will show up here.'
              }
              action={emptyAction}
            />
          ) : layout === 'grid' ? (
            <FlatList
              key="movies-grid"
              data={filteredMovies}
              keyExtractor={(item) => item.id}
              numColumns={2}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.grid, listPad]}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => (
                <MovieGridItem
                  movie={item}
                  compact={compact}
                  checkoutLabel={lendingOn ? checkouts.get(item.id)?.borrowerName : undefined}
                  onPress={() => router.push(`/movie/${item.id}`)}
                />
              )}
            />
          ) : (
            <FlatList
              key="movies-list"
              data={filteredMovies}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.list, listPad]}
              renderItem={({ item }) => {
                const loan = lendingOn ? checkouts.get(item.id) : undefined;
                return (
                  <Pressable
                    onPress={() => router.push(`/movie/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={[styles.listRow, compact && styles.listRowCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {item.posterPath ? (
                      <Image
                        source={{ uri: posterUrl(item.posterPath, 'w342') ?? undefined }}
                        style={compact ? styles.thumbCompact : styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[compact ? styles.thumbCompact : styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
                    )}
                    <View style={styles.listMeta}>
                      <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[item.year, loan ? `Out · ${loan.borrowerName}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )
        ) : tab === 'books' ? (
          filteredBooks.length === 0 ? (
            <EmptyState
              title={query || availability !== 'all' ? 'No matches' : 'No books yet'}
              message={
                writer
                  ? 'Scan an ISBN or add a title from Open Library.'
                  : 'Books added by your household will show up here.'
              }
              action={emptyAction}
            />
          ) : layout === 'grid' ? (
            <FlatList
              key="books-grid"
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              numColumns={2}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.grid, listPad]}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => {
                const loan = lendingOn ? checkouts.get(item.id) : undefined;
                return (
                  <Pressable
                    onPress={() => router.push(`/book/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={({ pressed }) => [styles.bookItem, compact && styles.bookItemCompact, pressed && { opacity: 0.85 }]}
                  >
                    <View>
                      {item.coverUrl ? (
                        <Image source={{ uri: item.coverUrl }} style={styles.bookCover} contentFit="cover" />
                      ) : (
                        <View style={[styles.bookCover, { backgroundColor: colors.surfaceElevated }]} />
                      )}
                      {loan ? (
                        <View style={[styles.bookBadge, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.bookBadgeText, { color: colors.accentText }]} numberOfLines={1}>
                            Out · {loan.borrowerName}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.bookTitle, compact && styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              }}
            />
          ) : (
            <FlatList
              key="books-list"
              data={filteredBooks}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              contentContainerStyle={[styles.list, listPad]}
              renderItem={({ item }) => {
                const loan = lendingOn ? checkouts.get(item.id) : undefined;
                return (
                  <Pressable
                    onPress={() => router.push(`/book/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={[styles.listRow, compact && styles.listRowCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {item.coverUrl ? (
                      <Image source={{ uri: item.coverUrl }} style={compact ? styles.thumbCompact : styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={[compact ? styles.thumbCompact : styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
                    )}
                    <View style={styles.listMeta}>
                      <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[item.authors[0], item.year, loan ? `Out · ${loan.borrowerName}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )
        ) : mtgMode === 'collection' ? (
          sortedCards.length === 0 ? (
            <EmptyState
              title={query ? 'No matches' : 'No cards yet'}
              message={
                writer
                  ? 'Add a card from Scryfall.'
                  : 'Cards added by your household will show up here.'
              }
              action={emptyAction}
            />
          ) : (
            <FlatList
              key={layout === 'grid' ? 'mtg-grid' : 'mtg-list'}
              data={sortedCards}
              keyExtractor={(item) => item.id}
              numColumns={layout === 'grid' ? 2 : 1}
              keyboardDismissMode="on-drag"
              columnWrapperStyle={layout === 'grid' ? styles.row : undefined}
              contentContainerStyle={layout === 'grid' ? [styles.grid, listPad] : [styles.list, listPad]}
              renderItem={({ item }) =>
                layout === 'grid' ? (
                  <View style={[styles.bookItem, compact && styles.bookItemCompact]}>
                    <MtgCardImage
                      uri={item.imageUri}
                      foil={item.foil}
                      style={styles.bookCover}
                      placeholderColor={colors.surfaceElevated}
                    />
                    <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.name}
                      {item.foil ? ' ★' : ''}
                    </Text>
                    <View style={styles.qtyRow}>
                      {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                        <Pressable onPress={() => adjustQty(item, -1)} accessibilityRole="button" accessibilityLabel={`Decrease ${item.name}`} style={styles.qtyButton}>
                          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>−</Text>
                        </Pressable>
                      ) : null}
                      <Text style={[typeScale.body, { color: colors.text, fontWeight: '700' }]}>{item.qty}</Text>
                      {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                        <Pressable onPress={() => adjustQty(item, 1)} accessibilityRole="button" accessibilityLabel={`Increase ${item.name}`} style={styles.qtyButton}>
                          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>+</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={[styles.mtgRow, compact && styles.listRowCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MtgCardImage
                      uri={item.imageUri}
                      foil={item.foil}
                      style={styles.mtgThumb}
                      placeholderColor={colors.surfaceElevated}
                    />
                    <View style={styles.listMeta}>
                      <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                        {item.name}
                        {item.foil ? ' ★' : ''}
                      </Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[item.setCode?.toUpperCase(), item.collectorNumber, item.typeLine, !item.addedBy && item.addedByName ? 'Deleted account' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.qtyCol}>
                      {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                        <Pressable onPress={() => adjustQty(item, 1)} accessibilityRole="button" accessibilityLabel={`Increase ${item.name}`} style={styles.qtyButton}>
                          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>+</Text>
                        </Pressable>
                      ) : null}
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{item.qty}</Text>
                      {household && canDeleteOwned(household.role, item.addedBy, user?.id ?? null) ? (
                        <Pressable onPress={() => adjustQty(item, -1)} accessibilityRole="button" accessibilityLabel={`Decrease ${item.name}`} style={styles.qtyButton}>
                          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>−</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )
              }
            />
          )
        ) : sortedDecks.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No decks yet'}
            message={
              writer
                ? 'Create a Commander or Standard deck, or import one from Archidekt.'
                : 'Decks imported by your household will show up here.'
            }
            action={emptyAction}
          />
        ) : (
          <FlatList
            data={sortedDecks}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            contentContainerStyle={[styles.list, listPad]}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/mtg/deck/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                style={[styles.listRow, compact && styles.listRowCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.listMeta}>
                  <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>{item.name}</Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {[formatLabel(item.format), item.archidektId ? `Archidekt ${item.archidektId}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={[typeScale.label, { color: colors.accent, fontSize: 14 }]}>Open</Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <LibraryFab actions={actions} bottom={dockHeight + spacing.sm} />

      <View onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
        <LibraryDock
          tabs={visible}
          activeTab={tab}
          onTab={selectTab}
          placeholder={placeholder}
          query={query}
          searchOpen={searchOpen}
          onSearchPress={() => setSearchOpen(true)}
          onClearSearch={() => setQueries((prev) => ({ ...prev, [scope]: '' }))}
          filtersOpen={filtersOpen}
          filtersLabel={filterBits.join(', ')}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
        >
          {tab === 'mtg' ? (
            <FilterChoices
              label="Show"
              options={MTG_MODES}
              value={mtgMode}
              onChange={(mode) => {
                setMtgMode(mode);
                setSearchOpen(false);
              }}
            />
          ) : lendingOn ? (
            <FilterChoices
              label="Availability"
              options={AVAILABILITY_FILTERS}
              value={availability}
              onChange={(next) => {
                if (tab === 'movies' || tab === 'books') {
                  void persist(withTabPrefs(profile.libraryView, tab, { availability: next }));
                }
              }}
            />
          ) : null}
          <FilterChoices
            label="Sort"
            options={sortOptions}
            value={activeSort}
            onChange={(next) => {
              if (tab === 'mtg' && mtgMode === 'decks') {
                void persist({ ...profile.libraryView, decks: { sort: next as DeckSort } });
                return;
              }
              if (tab === 'mtg') {
                void persist(withTabPrefs(profile.libraryView, 'mtg', { sort: next as MtgCollectionSort }));
                return;
              }
              if (tab === 'movies' || tab === 'books') {
                void persist(withTabPrefs(profile.libraryView, tab, { sort: next as CatalogSort }));
              }
            }}
          />
        </LibraryDock>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  results: { flex: 1 },
  searchTop: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: spacing.sm,
  },
  row: { justifyContent: 'space-between' },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  listRowCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listMeta: { flex: 1, gap: 2 },
  thumb: {
    width: 48,
    height: 72,
    borderRadius: radius.sm,
  },
  thumbCompact: {
    width: 36,
    height: 54,
    borderRadius: radius.sm,
  },
  bookItem: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '50%',
    gap: 4,
  },
  bookItemCompact: {
    margin: spacing.xs,
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
  compactTitle: {
    fontSize: 13,
    lineHeight: 16,
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
  qtyCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
