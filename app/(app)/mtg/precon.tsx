import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { ApiCredit } from '../../../components/ApiCredit';
import { ChevronIcon } from '../../../components/icons';
import { MediaGate } from '../../../components/MediaGate';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { SearchInput } from '../../../components/SearchInput';
import { WriterOnly } from '../../../components/WriterOnly';
import {
  fetchPreconDeck,
  loadCommanderPrecons,
  ParsedPrecon,
  preconCopyCounts,
  PreconHit,
  PreconPrinting,
  PreconProduct,
  searchPrecons,
} from '../../../lib/precons';
import { importPrecon } from '../../../lib/preconImport';
import { radius, spacing, typeScale, useTheme } from '../../../lib/theme';

function localDateStamp(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function deckCountLabel(count: number): string {
  return count === 1 ? '1 deck' : `${count} decks`;
}

function addLabel(copies: number, foils: number): string {
  const cards = copies === 1 ? '1 card' : `${copies} cards`;
  if (foils <= 0) return `Adds ${cards} to your collection.`;
  if (foils === copies) return `Adds ${cards} to your collection, all foil.`;
  const foil = foils === 1 ? '1 is foil' : `${foils} are foil`;
  return `Adds ${cards} to your collection. ${foil}.`;
}

type BrowseRow =
  | { kind: 'product'; product: PreconProduct }
  | { kind: 'deck'; deck: PreconHit };

type Selection =
  | { status: 'loading'; deck: PreconHit }
  | { status: 'ready'; deck: PreconHit; parsed: ParsedPrecon }
  | { status: 'error'; deck: PreconHit; message: string };

function AddPreconScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [products, setProducts] = useState<PreconProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [productCode, setProductCode] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [alsoDeck, setAlsoDeck] = useState(false);
  const [importing, setImporting] = useState(false);
  const request = useRef(0);

  const load = () => {
    setLoadError(null);
    setProducts(null);
    void loadCommanderPrecons(localDateStamp())
      .then(setProducts)
      .catch(() => {
        setLoadError('Could not load Commander precons.');
        setProducts([]);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const product = products?.find((entry) => entry.setCode === productCode) ?? null;
  const hits = useMemo(() => (products ? searchPrecons(products, query) : []), [products, query]);
  const rows: BrowseRow[] = useMemo(() => {
    if (!products) return [];
    if (query.trim()) return hits.map((deck) => ({ kind: 'deck', deck }));
    if (product) return product.decks.map((deck) => ({ kind: 'deck', deck: { ...deck, setName: product.setName } }));
    return products.map((entry) => ({ kind: 'product', product: entry }));
  }, [products, query, product, hits]);

  const openDeck = (deck: PreconHit) => {
    const id = request.current + 1;
    request.current = id;
    setAlsoDeck(false);
    setSelection({ status: 'loading', deck });
    void fetchPreconDeck(deck.fileName)
      .then((parsed) => {
        if (request.current !== id) return;
        setSelection({ status: 'ready', deck, parsed });
      })
      .catch((error: unknown) => {
        if (request.current !== id) return;
        const message = error instanceof Error ? error.message : 'Could not load this precon.';
        setSelection({ status: 'error', deck, message });
      });
  };

  const handleImport = async (parsed: ParsedPrecon) => {
    setImporting(true);
    try {
      const result = await importPrecon(parsed, alsoDeck);
      if (result.deckId) router.replace(`/mtg/deck/${result.deckId}`);
      else router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add this precon.';
      Alert.alert('Add precon', message);
    } finally {
      setImporting(false);
    }
  };

  if (!products && !loadError) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (loadError && products?.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[typeScale.body, styles.centerText, { color: colors.textSecondary }]}>{loadError}</Text>
        <PrimaryButton label="Try again" onPress={load} />
      </View>
    );
  }

  if (selection) {
    const counts = selection.status === 'ready' ? preconCopyCounts(selection.parsed.cards) : null;
    const blocked = selection.status === 'ready' && selection.parsed.missingNames.length > 0;
    const cards = selection.status === 'ready' ? selection.parsed.cards : [];
    const sections = (['commander', 'main'] as const)
      .map((board) => ({
        title: board === 'commander' ? 'Commander' : 'Main',
        data: cards.filter((card) => card.board === board),
      }))
      .filter((section) => section.data.length > 0);
    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.board}|${item.foil ? 'foil' : 'nonfoil'}|${item.scryfallId}`}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.confirm}
        ListHeaderComponent={
          <View style={styles.confirmHeader}>
            <Pressable
              onPress={() => {
                request.current += 1;
                setSelection(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Choose another deck"
            >
              <Text style={[typeScale.body, { color: colors.accent, fontWeight: '600' }]}>Choose another deck</Text>
            </Pressable>
            <Text style={[typeScale.title, { color: colors.text }]}>{selection.deck.name}</Text>
            <Text style={[typeScale.body, { color: colors.textSecondary }]}>{selection.deck.setName}</Text>
            {selection.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
            {selection.status === 'error' ? (
              <Text style={[typeScale.body, { color: colors.textSecondary }]}>{selection.message}</Text>
            ) : null}
            {selection.status === 'ready' && counts ? (
              <>
                <Text style={[typeScale.body, { color: colors.text }]}>
                  {blocked
                    ? `${selection.parsed.missingNames.length} cards have no Scryfall id, so this precon cannot be added.`
                    : addLabel(counts.copies, counts.foils)}
                </Text>
                {blocked ? (
                  selection.parsed.missingNames.map((name, index) => (
                    <Text key={`${name}-${index}`} style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {name}
                    </Text>
                  ))
                ) : (
                  <>
                    <View style={styles.switchRow}>
                      <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>Also add as a deck</Text>
                      <Switch
                        value={alsoDeck}
                        onValueChange={setAlsoDeck}
                        disabled={importing}
                        accessibilityLabel="Also add as a deck"
                      />
                    </View>
                    <PrimaryButton
                      label="Add to collection"
                      onPress={() => void handleImport(selection.parsed)}
                      loading={importing}
                    />
                  </>
                )}
              </>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {section.title} · {section.data.reduce((sum, card) => sum + card.qty, 0)}
          </Text>
        )}
        renderItem={({ item }) => <PreconCardRow card={item} />}
        ListFooterComponent={<ApiCredit providers={['mtgjson', 'scryfall']} />}
      />
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => (row.kind === 'product' ? row.product.setCode : row.deck.fileName)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search decks or sets"
            accessibilityLabel="Search decks or sets"
          />
          {product && !query.trim() ? (
            <View style={styles.productHeading}>
              <Text style={[typeScale.title, { color: colors.text }]}>{product.setName}</Text>
              <Pressable
                onPress={() => setProductCode(null)}
                accessibilityRole="button"
                accessibilityLabel="All products"
              >
                <Text style={[typeScale.body, { color: colors.accent, fontWeight: '600' }]}>All products</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[typeScale.body, { color: colors.textSecondary }]}>
              Pick a Commander precon to add its cards.
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <Text style={[typeScale.body, styles.centerText, { color: colors.textSecondary }]}>No matching decks</Text>
      }
      ListFooterComponent={<ApiCredit providers={['mtgjson', 'scryfall']} />}
      renderItem={({ item }) => {
        if (item.kind === 'product') {
          return (
            <Pressable
              onPress={() => setProductCode(item.product.setCode)}
              accessibilityRole="button"
              accessibilityLabel={item.product.setName}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={styles.meta}>
                <Text style={[styles.name, { color: colors.text }]}>{item.product.setName}</Text>
                <Text style={{ color: colors.textSecondary }}>{deckCountLabel(item.product.decks.length)}</Text>
              </View>
              <ChevronIcon color={colors.textTertiary} />
            </Pressable>
          );
        }
        return (
          <Pressable
            onPress={() => openDeck(item.deck)}
            accessibilityRole="button"
            accessibilityLabel={item.deck.name}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.meta}>
              <Text style={[styles.name, { color: colors.text }]}>{item.deck.name}</Text>
              {query.trim() ? <Text style={{ color: colors.textSecondary }}>{item.deck.setName}</Text> : null}
            </View>
            <ChevronIcon color={colors.textTertiary} />
          </Pressable>
        );
      }}
    />
  );
}

function PreconCardRow({ card }: { card: PreconPrinting }) {
  const { colors } = useTheme();
  const label = `${card.qty} ${card.name}${card.foil ? ', foil' : ''}`;
  return (
    <View
      accessibilityLabel={label}
      style={[styles.cardRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.qty, { color: colors.text }]}>{card.qty}</Text>
      <Text style={[styles.name, { color: colors.text }]}>
        {card.name}
        {card.foil ? ' ★' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  list: {
    padding: spacing.md,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  productHeading: {
    gap: spacing.sm,
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
  meta: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirm: {
    padding: spacing.lg,
  },
  confirmHeader: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typeScale.label,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  qty: {
    minWidth: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});

export default function AddPreconRoute() {
  return (
    <WriterOnly>
      <MediaGate type="mtg">
        <AddPreconScreen />
      </MediaGate>
    </WriterOnly>
  );
}
