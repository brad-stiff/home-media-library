import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

import { SearchInput } from '../../../components/SearchInput';
import { WriterOnly } from '../../../components/WriterOnly';
import { addMtgCardFromScryfall } from '../../../lib/mtgCards';
import { searchScryfallCards, ScryfallCard, scryfallImageUri } from '../../../lib/scryfall';
import { radius, spacing, useTheme } from '../../../lib/theme';

function AddMtgCardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [foil, setFoil] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
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
  }, [query]);

  const handleAdd = async (card: ScryfallCard) => {
    setSavingId(card.id);
    try {
      await addMtgCardFromScryfall(card, { foil });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add card.';
      Alert.alert('Error', message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Scryfall"
          autoFocus
        />
        <View style={styles.foilRow}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Add as foil</Text>
          <Switch value={foil} onValueChange={setFoil} />
        </View>
      </View>

      {searching ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query.trim() ? 'No cards found.' : 'Search by card name (Scryfall).'}
            </Text>
          }
          renderItem={({ item }) => {
            const image = scryfallImageUri(item, 'small');
            return (
              <Pressable
                onPress={() => void handleAdd(item)}
                disabled={savingId === item.id}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
                )}
                <View style={styles.meta}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
                    {[item.set?.toUpperCase(), item.collector_number, item.type_line]
                      .filter(Boolean)
                      .join(' · ')}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

export default function AddMtgCardRoute() {
  return (
    <WriterOnly>
      <AddMtgCardScreen />
    </WriterOnly>
  );
}
