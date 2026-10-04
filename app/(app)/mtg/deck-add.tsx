import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { ApiCredit } from '../../../components/ApiCredit';
import { MtgCardImage } from '../../../components/MtgCardImage';
import { FilterChoices } from '../../../components/LibraryDock';
import { MediaGate } from '../../../components/MediaGate';
import { SearchInput } from '../../../components/SearchInput';
import { WriterOnly } from '../../../components/WriterOnly';
import { useAuth } from '../../../lib/auth';
import { boardLabel, DeckBoard, DeckFormat } from '../../../lib/deckLegality';
import { getMyHousehold } from '../../../lib/household';
import { MtgCard, searchMtgCollection } from '../../../lib/mtgCards';
import { addCardToDeck, draftFromScryfall, getMtgDeck } from '../../../lib/mtgDecks';
import { canDeleteOwned } from '../../../lib/roles';
import { searchScryfallCards, ScryfallCard, scryfallImageUri } from '../../../lib/scryfall';
import { radius, spacing, useTheme } from '../../../lib/theme';

type Source = 'scryfall' | 'collection';

const SOURCES: { id: Source; label: string }[] = [
  { id: 'scryfall', label: 'Scryfall' },
  { id: 'collection', label: 'Collection' },
];

function boardsFor(format: DeckFormat): { id: DeckBoard; label: string }[] {
  const boards: DeckBoard[] = format === 'commander' ? ['main', 'commander', 'maybeboard'] : ['main', 'sideboard', 'maybeboard'];
  return boards.map((board) => ({ id: board, label: boardLabel(board) }));
}

function AddDeckCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<Source>('scryfall');
  const [board, setBoard] = useState<DeckBoard>('main');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [collection, setCollection] = useState<MtgCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [foil, setFoil] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!deckId) return;
    void (async () => {
      try {
        const [deck, household] = await Promise.all([getMtgDeck(deckId), getMyHousehold()]);
        if (!deck || !canDeleteOwned(household.role, deck.createdBy, user?.id ?? null)) {
          setAllowed(false);
        } else {
          setFormat(deck.format);
          setAllowed(true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not open this deck.';
        Alert.alert('Error', message);
      } finally {
        setReady(true);
      }
    })();
  }, [deckId, user?.id]);

  useEffect(() => {
    if (source !== 'scryfall' || !query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchScryfallCards(query));
      } catch {
        Alert.alert('Search failed', 'Could not reach Scryfall.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, source]);

  useEffect(() => {
    if (source !== 'collection') return;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        setCollection(await searchMtgCollection(query));
      } catch {
        Alert.alert('Search failed', 'Could not load the collection.');
        setCollection([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, source]);

  const addScryfall = async (card: ScryfallCard) => {
    if (!deckId) return;
    setSavingId(card.id);
    try {
      await addCardToDeck(deckId, draftFromScryfall(card, { board, foil }));
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add card.';
      Alert.alert('Error', message);
    } finally {
      setSavingId(null);
    }
  };

  const addCollection = async (card: MtgCard) => {
    if (!deckId) return;
    setSavingId(card.id);
    try {
      await addCardToDeck(deckId, {
        scryfallId: card.scryfallId,
        oracleId: card.oracleId,
        name: card.name,
        imageUri: card.imageUri,
        manaCost: card.manaCost,
        typeLine: card.typeLine,
        qty: 1,
        board,
        foil: card.foil,
        colorIdentity: card.colorIdentity,
        oracleText: null,
        keywords: [],
        standardLegality: null,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add card.';
      Alert.alert('Error', message);
    } finally {
      setSavingId(null);
    }
  };

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Only the person who created this deck, or an admin, can edit it.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FilterChoices label="From" options={SOURCES} value={source} onChange={setSource} />
        <FilterChoices label="Add to" options={boardsFor(format)} value={board} onChange={setBoard} />
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder={source === 'scryfall' ? 'Search Scryfall' : 'Search collection'}
          autoFocus
        />
        {source === 'scryfall' ? (
          <View style={styles.foilRow}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Add as foil</Text>
            <Switch value={foil} onValueChange={setFoil} />
          </View>
        ) : (
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Adding a card here does not change how many you own.
          </Text>
        )}
      </View>

      {searching ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : source === 'scryfall' ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query.trim() ? 'No cards found.' : 'Search by card name (Scryfall).'}
            </Text>
          }
          ListFooterComponent={<ApiCredit providers={['scryfall']} />}
          renderItem={({ item }) => {
            const image = scryfallImageUri(item, 'small');
            return (
              <Pressable
                onPress={() => void addScryfall(item)}
                disabled={savingId === item.id}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MtgCardImage
                  uri={image}
                  foil={foil}
                  style={styles.thumb}
                  placeholderColor={colors.surfaceElevated}
                />
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
                    {[item.set?.toUpperCase(), item.collector_number, item.type_line].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {savingId === item.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>Add</Text>
                )}
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={collection}
          keyExtractor={(item) => item.id}
          contentContainerStyle={collection.length === 0 ? styles.emptyList : styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query.trim() ? 'No cards in the collection match.' : 'Your collection is empty.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void addCollection(item)}
              disabled={savingId === item.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MtgCardImage
                uri={item.imageUri}
                foil={item.foil}
                style={styles.thumb}
                placeholderColor={colors.surfaceElevated}
              />
              <View style={styles.meta}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.name}
                  {item.foil ? ' ★' : ''}
                </Text>
                <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
                  {[item.setCode?.toUpperCase(), item.collectorNumber, `owned ${item.qty}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {savingId === item.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Add</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  foilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  empty: {
    textAlign: 'center',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function AddDeckCardRoute() {
  return (
    <WriterOnly>
      <MediaGate type="mtg">
        <AddDeckCardScreen />
      </MediaGate>
    </WriterOnly>
  );
}
