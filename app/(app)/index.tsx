import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiCredit } from '../../components/ApiCredit';
import { EmptyState } from '../../components/EmptyState';
import { HeaderMenu, useAppMenu } from '../../components/HeaderMenu';
import { FilterChoices, LibraryDock } from '../../components/LibraryDock';
import { FabAction, LibraryFab } from '../../components/LibraryFab';
import { BookResults } from '../../components/library/BookResults';
import { MovieResults } from '../../components/library/MovieResults';
import { MtgCollectionResults } from '../../components/library/MtgCollectionResults';
import { MtgDeckResults } from '../../components/library/MtgDeckResults';
import { SearchInput } from '../../components/SearchInput';
import { SegmentedControl } from '../../components/SegmentedControl';
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
  LibraryDensity,
  LibraryLayout,
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
import { addMtgCardFromScryfall, attachColorIdentities, MtgCard, searchMtgCollection } from '../../lib/mtgCards';
import { cardInSet, cardMatchesQuery, checklistSize, collectionCopyTotal, collectionTypeBars, filterSetSummaries, groupOwnedPrintings, mergePrintedChecklist, PrintedSlot, SetCatalogEntry, sortByCollectorNumber, summarizeSets } from '../../lib/mtgOverview';
import { loadMtgSetCatalog, loadPrintedChecklist } from '../../lib/mtgSets';
import { getScryfallCard } from '../../lib/scryfall';
import { listMtgDecks, MtgDeck } from '../../lib/mtgDecks';
import { takeLibraryTab } from '../../lib/pendingLibraryTab';
import { isTypeVisible, useProfile } from '../../lib/profile';
import { isWriter } from '../../lib/roles';
import { spacing, typeScale, useTheme } from '../../lib/theme';
import { useToastLift } from '../../lib/toast';
import { Movie } from '../../lib/types';

type MtgMode = 'collection' | 'decks';
type CollectionScreen = 'overview' | 'set' | 'all';

const MTG_MODES: { id: MtgMode; label: string }[] = [
  { id: 'collection', label: 'Collection' },
  { id: 'decks', label: 'Decks' },
];

const LAYOUTS: { id: LibraryLayout; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'list', label: 'List' },
];

const DENSITIES: { id: LibraryDensity; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
];

function searchPlaceholder(tab: DockType, mode: MtgMode, collectionScreen: CollectionScreen): string {
  if (tab === 'movies') return 'Search movies';
  if (tab === 'books') return 'Search books';
  if (tab === 'mtg' && mode === 'decks') return 'Search decks';
  if (tab === 'mtg' && collectionScreen === 'overview') return 'Search sets or cards';
  if (tab === 'mtg' && collectionScreen === 'set') return 'Search this set';
  if (tab === 'mtg') return 'Search collection';
  return `Search ${DOCK_LABELS[tab].toLowerCase()}`;
}

function scopeKey(tab: DockType, mode: MtgMode): string {
  return tab === 'mtg' ? `mtg-${mode}` : tab;
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
  const menu = useAppMenu();
  const [tab, setTab] = useState<DockType | null>(null);
  const [mtgMode, setMtgMode] = useState<MtgMode>('collection');
  const [collectionScreen, setCollectionScreen] = useState<CollectionScreen>('overview');
  const [activeSetCode, setActiveSetCode] = useState<string | null>(null);
  const [setCatalog, setSetCatalog] = useState<Map<string, SetCatalogEntry>>(new Map());
  const [printedSlots, setPrintedSlots] = useState<PrintedSlot[] | null>(null);
  const [addingFinish, setAddingFinish] = useState<{ scryfallId: string; foil: boolean } | null>(null);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [mtgCards, setMtgCards] = useState<MtgCard[]>([]);
  const [mtgDecks, setMtgDecks] = useState<MtgDeck[]>([]);
  const [checkouts, setCheckouts] = useState<Map<string, Checkout>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dockHeight, setDockHeight] = useState(64);
  const loadedScopes = useRef(new Set<string>());
  const loadRequest = useRef(0);
  const addingFinishRef = useRef<string | null>(null);
  useToastLift('library', dockHeight + 72);

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

  const load = useCallback(async (
    searchQuery: string,
    activeTab: DockType,
    mode: MtgMode,
    reason: 'focus' | 'pull',
  ) => {
    const request = ++loadRequest.current;
    const key = scopeKey(activeTab, mode);
    const known = loadedScopes.current.has(key);
    if (!known) setLoading(true);
    if (reason === 'pull') setRefreshing(true);
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
          const filled = await attachColorIdentities(results);
          setMtgCards(filled);
        } catch {
          // Set, title, and quantity sorts still work if Scryfall is unreachable.
        }
      } else {
        const decks = await listMtgDecks();
        const trimmed = searchQuery.trim().toLowerCase();
        setMtgDecks(trimmed ? decks.filter((deck) => deck.name.toLowerCase().includes(trimmed)) : decks);
      }
      if (request !== loadRequest.current) return;
      loadedScopes.current.add(key);
    } catch (error) {
      if (request !== loadRequest.current) return;
      const message = error instanceof Error ? error.message : 'Could not load library.';
      Alert.alert('Error', message);
    } finally {
      if (request !== loadRequest.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [household, user?.id]);

  const serverQuery = tab === 'mtg' && mtgMode === 'collection' ? '' : query;

  useFocusEffect(
    useCallback(() => {
      if (profileLoading || !household) return;
      const queued = takeLibraryTab();
      if (queued && visible.includes(queued)) {
        if (!loadedScopes.current.has(scopeKey(queued, mtgMode))) setLoading(true);
        setTab(queued);
        if (profile.libraryView.lastTab !== queued) {
          void persist({ ...profile.libraryView, lastTab: queued });
        }
        if (queued !== tab) return;
      }
      if (!tab || !visible.includes(tab)) return;
      void load(serverQuery, tab, mtgMode, 'focus');
    }, [load, serverQuery, tab, mtgMode, profileLoading, household, visible, persist, profile.libraryView]),
  );

  useEffect(() => {
    if (tab !== 'mtg' || mtgMode !== 'collection' || mtgCards.length === 0) return;
    let cancelled = false;
    const codes = mtgCards.map((card) => card.setCode ?? '');
    void loadMtgSetCatalog(codes)
      .then((catalog) => {
        if (!cancelled) setSetCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setSetCatalog(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [tab, mtgMode, mtgCards]);

  const activePrintedSize =
    collectionScreen === 'set' && activeSetCode ? checklistSize(setCatalog.get(activeSetCode)) : null;

  useEffect(() => {
    if (collectionScreen !== 'set' || !activeSetCode || activePrintedSize == null) {
      setPrintedSlots(null);
      return;
    }
    let cancelled = false;
    const code = activeSetCode;
    const size = activePrintedSize;
    setPrintedSlots(null);
    void loadPrintedChecklist(code, size)
      .then((slots) => {
        if (!cancelled) setPrintedSlots(slots);
      })
      .catch(() => {
        if (!cancelled) setPrintedSlots(null);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionScreen, activeSetCode, activePrintedSize]);

  const addFinish = useCallback(async (scryfallId: string, foil: boolean) => {
    const key = `${scryfallId}:${foil ? 'foil' : 'nonfoil'}`;
    if (addingFinishRef.current) return;
    addingFinishRef.current = key;
    setAddingFinish({ scryfallId, foil });
    try {
      const scry = await getScryfallCard(scryfallId);
      const saved = await addMtgCardFromScryfall(scry, { foil });
      setMtgCards((prev) => [...prev.filter((card) => card.id !== saved.id), saved]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add this card.';
      Alert.alert('Could not add card', message);
    } finally {
      addingFinishRef.current = null;
      setAddingFinish(null);
    }
  }, []);

  const typeBars = useMemo(() => collectionTypeBars(mtgCards), [mtgCards]);
  const copyTotal = useMemo(() => collectionCopyTotal(mtgCards), [mtgCards]);
  const setSummaries = useMemo(() => summarizeSets(mtgCards, setCatalog), [mtgCards, setCatalog]);
  const visibleSets = useMemo(
    () => (collectionScreen === 'overview' ? filterSetSummaries(setSummaries, query) : setSummaries),
    [collectionScreen, setSummaries, query],
  );
  const activeSetName = setSummaries.find((set) => set.code === activeSetCode)?.name ?? 'Set';
  const showCollectionBack = tab === 'mtg' && mtgMode === 'collection' && collectionScreen !== 'overview';
  const collectionTitle =
    tab === 'mtg' && mtgMode === 'collection' && collectionScreen === 'set'
      ? activeSetName
      : tab === 'mtg' && mtgMode === 'collection' && collectionScreen === 'all'
        ? 'All cards'
        : 'My library';

  const leaveCollectionDrill = useCallback(() => {
    setCollectionScreen('overview');
    setActiveSetCode(null);
    setQueries((prev) => ({ ...prev, 'mtg-collection': '' }));
  }, []);

  const openSet = useCallback((code: string) => {
    setActiveSetCode(code);
    setCollectionScreen('set');
    setQueries((prev) => ({ ...prev, 'mtg-collection': '' }));
  }, []);

  const openAllCards = useCallback(() => {
    setActiveSetCode(null);
    setCollectionScreen('all');
    setQueries((prev) => ({ ...prev, 'mtg-collection': '' }));
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: collectionTitle,
      headerLeft: showCollectionBack
        ? () => (
            <Pressable
              onPress={leaveCollectionDrill}
              accessibilityRole="button"
              accessibilityLabel="Back to collection overview"
              style={styles.backButton}
            >
              <Text style={[typeScale.body, { color: colors.accent }]}>Back</Text>
            </Pressable>
          )
        : () => null,
      headerRight: () => <HeaderMenu groups={menu} />,
    });
  }, [navigation, menu, collectionTitle, showCollectionBack, leaveCollectionDrill, colors.accent]);

  const selectTab = (next: DockType) => {
    if (!loadedScopes.current.has(scopeKey(next, mtgMode))) setLoading(true);
    setTab(next);
    setFiltersOpen(false);
    if (next !== 'mtg') {
      setCollectionScreen('overview');
      setActiveSetCode(null);
    }
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

  const checklistEntries = useMemo(() => {
    const matched = mtgCards.filter((card) => {
      if (collectionScreen === 'set' && activeSetCode && !cardInSet(card, activeSetCode)) return false;
      if (collectionScreen === 'overview') return false;
      return cardMatchesQuery(card, query);
    });
    if (collectionScreen === 'set') {
      const owned = sortByCollectorNumber(matched);
      const slots = query.trim() ? null : printedSlots;
      return mergePrintedChecklist(owned, slots, activePrintedSize);
    }
    return sortMtgCollection(groupOwnedPrintings(matched), profile.libraryView.mtg.sort, {
      title: (entry) => entry.nonfoil?.name ?? entry.foil?.name ?? '',
      year: () => null,
      addedAt: (entry) => {
        const nonfoil = entry.nonfoil?.addedAt ?? '';
        const foil = entry.foil?.addedAt ?? '';
        return nonfoil > foil ? nonfoil : foil;
      },
      setName: (entry) => entry.nonfoil?.setName ?? entry.foil?.setName ?? entry.nonfoil?.setCode ?? entry.foil?.setCode ?? null,
      collectorNumber: (entry) => entry.nonfoil?.collectorNumber ?? entry.foil?.collectorNumber ?? null,
      colorIdentity: (entry) => entry.nonfoil?.colorIdentity ?? entry.foil?.colorIdentity ?? null,
      qty: (entry) => (entry.nonfoil?.qty ?? 0) + (entry.foil?.qty ?? 0),
    });
  }, [mtgCards, profile.libraryView.mtg.sort, collectionScreen, activeSetCode, query, printedSlots, activePrintedSize]);

  const sortedDecks = useMemo(
    () =>
      sortDecks(mtgDecks, profile.libraryView.decks.sort, {
        title: (deck) => deck.name,
        addedAt: (deck) => deck.createdAt,
      }),
    [mtgDecks, profile.libraryView.decks.sort],
  );

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

  const placeholder = searchPlaceholder(tab, mtgMode, collectionScreen);
  const onCollectionOverview = tab === 'mtg' && mtgMode === 'collection' && collectionScreen === 'overview';
  const onSetScreen = tab === 'mtg' && mtgMode === 'collection' && collectionScreen === 'set';
  const showLayout = tab !== 'mtg' || (mtgMode === 'collection' && !onCollectionOverview);
  const browsingEmpty = query.trim().length === 0 && (tab === 'mtg' || availability === 'all');
  const emptyAction =
    writer && browsingEmpty && actions[0]
      ? { label: actions[0].label, onPress: actions[0].onPress }
      : undefined;

  const filterParts: string[] = [];
  if (tab !== 'mtg' && availability !== 'all') {
    filterParts.push(AVAILABILITY_FILTERS.find((option) => option.id === availability)?.label ?? availability);
  }
  const activeSort = tab === 'mtg' && mtgMode === 'decks' ? deckSort : tab === 'mtg' ? mtgSort : catalogSort;
  const sortOptions = tab === 'mtg' && mtgMode === 'decks' ? DECK_SORTS : tab === 'mtg' ? MTG_COLLECTION_SORTS : CATALOG_SORTS;
  if (!onCollectionOverview && !onSetScreen && activeSort !== 'title') {
    filterParts.push(sortOptions.find((option) => option.id === activeSort)?.label ?? activeSort);
  }
  const filtersNarrowing = filterParts.length > 0;
  const filtersVisible = filtersNarrowing ? `Filters · ${filterParts.join(' · ')}` : 'Filters';
  const filtersLabel = filtersNarrowing ? `Filters, ${filterParts.join(', ')}` : 'Filters';

  const listPad = spacing.xl + 56;
  const credit = <ApiCredit providers={[...creditProviders]} />;
  const onRefresh = () => {
    void load(serverQuery, tab, mtgMode, 'pull');
  };
  const known = loadedScopes.current.has(scopeKey(tab, mtgMode));
  const showSpinner = loading && !known;

  return (
    <View style={styles.container}>
      <View style={styles.searchTop}>
        <SearchInput
          value={query}
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          onChangeText={(text) => setQueries((prev) => ({ ...prev, [scope]: text }))}
          onSubmitEditing={() => {
            if (onCollectionOverview && query.trim()) {
              setActiveSetCode(null);
              setCollectionScreen('all');
            }
          }}
        />
      </View>

      {tab === 'mtg' ? (
        <View style={styles.segment}>
          <SegmentedControl
            label="MTG"
            options={MTG_MODES}
            value={mtgMode}
            onChange={(mode) => {
              if (tab && !loadedScopes.current.has(scopeKey(tab, mode))) setLoading(true);
              setMtgMode(mode);
              setCollectionScreen('overview');
              setActiveSetCode(null);
            }}
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => setFiltersOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={filtersLabel}
        accessibilityState={{ expanded: filtersOpen }}
        style={styles.filtersButton}
      >
        <Text style={[typeScale.label, { color: filtersOpen || filtersNarrowing ? colors.accent : colors.textSecondary, fontSize: 14 }]}>
          {filtersOpen ? 'Hide filters' : filtersVisible}
        </Text>
      </Pressable>

      {filtersOpen ? (
        <View style={styles.filters}>
          {tab !== 'mtg' && lendingOn ? (
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
          {onCollectionOverview || onSetScreen ? null : (
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
          )}
          {showLayout ? (
            <FilterChoices
              label="Layout"
              options={LAYOUTS}
              value={layout}
              onChange={(next) => {
                if (tab === 'movies' || tab === 'books' || tab === 'mtg') {
                  void persist(withTabPrefs(profile.libraryView, tab, { layout: next }));
                }
              }}
            />
          ) : null}
          <FilterChoices
            label="Density"
            options={DENSITIES}
            value={profile.libraryView.density}
            onChange={(next) => {
              void persist({ ...profile.libraryView, density: next });
            }}
          />
        </View>
      ) : null}

      <View style={styles.results}>
        {showSpinner ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : tab === 'movies' ? (
          <MovieResults
            movies={filteredMovies}
            query={query}
            filtering={availability !== 'all'}
            writer={writer}
            layout={layout}
            compact={compact}
            lendingOn={lendingOn}
            checkouts={checkouts}
            emptyAction={emptyAction}
            bottomPad={listPad}
            refreshing={refreshing}
            onRefresh={onRefresh}
            footer={credit}
          />
        ) : tab === 'books' ? (
          <BookResults
            books={filteredBooks}
            query={query}
            filtering={availability !== 'all'}
            writer={writer}
            layout={layout}
            compact={compact}
            lendingOn={lendingOn}
            checkouts={checkouts}
            emptyAction={emptyAction}
            bottomPad={listPad}
            refreshing={refreshing}
            onRefresh={onRefresh}
            footer={credit}
          />
        ) : mtgMode === 'collection' ? (
          <MtgCollectionResults
            cards={mtgCards}
            entries={checklistEntries}
            onAddFinish={writer ? (scryfallId, foil) => void addFinish(scryfallId, foil) : undefined}
            addingFinish={addingFinish}
            screen={collectionScreen}
            writer={writer}
            layout={layout}
            compact={compact}
            typeBars={typeBars}
            copies={copyTotal}
            sets={visibleSets}
            filtering={query.trim().length > 0}
            onOpenSet={openSet}
            onOpenAll={openAllCards}
            emptyAction={emptyAction}
            bottomPad={listPad}
            refreshing={refreshing}
            onRefresh={onRefresh}
            footer={credit}
          />
        ) : (
          <MtgDeckResults
            decks={sortedDecks}
            query={query}
            writer={writer}
            compact={compact}
            emptyAction={emptyAction}
            bottomPad={listPad}
            refreshing={refreshing}
            onRefresh={onRefresh}
            footer={credit}
          />
        )}
      </View>

      <LibraryFab actions={actions} bottom={dockHeight + spacing.sm} />

      <View onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
        <LibraryDock
          tabs={visible}
          activeTab={tab}
          onTab={selectTab}
          showLoans={lendingOn}
          onLoans={() => router.push('/loans')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  results: { flex: 1 },
  searchTop: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filtersButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filters: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
