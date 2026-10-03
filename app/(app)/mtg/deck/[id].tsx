import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiCredit } from '../../../../components/ApiCredit';
import { FilterChoices } from '../../../../components/LibraryDock';
import { PrimaryButton } from '../../../../components/PrimaryButton';
import { fetchArchidektDeck } from '../../../../lib/archidekt';
import { useAuth } from '../../../../lib/auth';
import {
  boardLabel,
  DeckBoard,
  DeckFormat,
  deckWarnings,
  formatLabel,
  type LegalityCard,
} from '../../../../lib/deckLegality';
import { getMyHousehold, listHouseholdMembers } from '../../../../lib/household';
import { isWriter, attributionName, canDeleteOwned } from '../../../../lib/roles';
import { addMtgCardFromScryfall } from '../../../../lib/mtgCards';
import {
  deleteMtgDeck,
  getMtgDeck,
  getMtgDeckCards,
  moveDeckCard,
  MtgDeck,
  MtgDeckCard,
  removeDeckCard,
  resyncArchidektDeck,
  saveDeckCardRules,
  updateDeckCardQty,
  updateMtgDeck,
  withScryfallRules,
} from '../../../../lib/mtgDecks';
import { getScryfallCard, getScryfallCardsByIds } from '../../../../lib/scryfall';
import { radius, spacing, typeScale, useTheme } from '../../../../lib/theme';

const FORMATS: { id: DeckFormat; label: string }[] = [
  { id: 'commander', label: 'Commander' },
  { id: 'standard', label: 'Standard' },
];

function countBoard(cards: MtgDeckCard[], board: DeckBoard): number {
  return cards.filter((card) => card.board === board).reduce((sum, card) => sum + card.qty, 0);
}

function sizeLabel(format: DeckFormat, cards: MtgDeckCard[]): string {
  const maybe = countBoard(cards, 'maybeboard');
  const maybeLabel = maybe > 0 ? ` · ${maybe} maybeboard` : '';
  if (format === 'commander') {
    return `${countBoard(cards, 'commander') + countBoard(cards, 'main')} / 100${maybeLabel}`;
  }
  const side = countBoard(cards, 'sideboard');
  return `${countBoard(cards, 'main')} main${side > 0 ? ` · ${side} sideboard` : ''}${maybeLabel}`;
}

function askDeckFormat(): Promise<DeckFormat | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Choose a format',
      'Archidekt lists this deck outside Commander and Standard. Pick which format to save. The list still imports either way.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Commander', onPress: () => resolve('commander') },
        { text: 'Standard', onPress: () => resolve('standard') },
      ],
    );
  });
}

function sectionsFor(format: DeckFormat, cards: MtgDeckCard[]) {
  const order: DeckBoard[] =
    format === 'commander'
      ? ['commander', 'main', 'sideboard', 'maybeboard']
      : ['main', 'sideboard', 'maybeboard', 'commander'];
  return order
    .map((board) => ({
      board,
      title: boardLabel(board),
      data: cards.filter((card) => card.board === board),
    }))
    .filter((section) => {
      if (section.data.length > 0) return true;
      if (section.board === 'main') return true;
      if (format === 'commander' && section.board === 'commander') return true;
      if (format === 'standard' && section.board === 'sideboard') return true;
      return false;
    });
}

export default function MtgDeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [deck, setDeck] = useState<MtgDeck | null>(null);
  const [cards, setCards] = useState<MtgDeckCard[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [writer, setWriter] = useState(false);
  const [createdByLabel, setCreatedByLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [rulesReady, setRulesReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [nextDeck, nextCards, household, members] = await Promise.all([
        getMtgDeck(id),
        getMtgDeckCards(id),
        getMyHousehold(),
        listHouseholdMembers(),
      ]);
      setDeck(nextDeck);
      setCards(nextCards);
      setName(nextDeck?.name ?? '');
      setWriter(isWriter(household.role));
      setCanEdit(
        nextDeck != null && canDeleteOwned(household.role, nextDeck.createdBy, user?.id ?? null),
      );
      setCreatedByLabel(nextDeck ? attributionName(nextDeck.createdBy, members, nextDeck.createdByName) : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load deck.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const pending = cards.filter((card) => card.oracleText == null);
    if (pending.length === 0) {
      setRulesReady(true);
      return;
    }
    let cancelled = false;
    setRulesReady(false);
    void (async () => {
      try {
        const found = await getScryfallCardsByIds(pending.map((card) => card.scryfallId));
        const byId = new Map(found.map((card) => [card.id, card]));
        const updated = cards.map((card) =>
          card.oracleText == null ? withScryfallRules(card, byId.get(card.scryfallId)) : card,
        );
        if (cancelled) return;
        setCards(updated);
        if (canEdit) {
          await Promise.all(
            updated
              .filter((card, index) => card.oracleText !== cards[index]?.oracleText)
              .map((card) => saveDeckCardRules(card).catch(() => undefined)),
          );
        }
      } catch {
        if (!cancelled) {
          setCards((current) =>
            current.map((card) => (card.oracleText == null ? { ...card, oracleText: '' } : card)),
          );
        }
      } finally {
        if (!cancelled) setRulesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, canEdit]);

  const warnings = useMemo(
    () => (deck && rulesReady ? deckWarnings(deck.format, cards as LegalityCard[]) : []),
    [cards, deck, rulesReady],
  );
  const sections = useMemo(
    () => (deck ? sectionsFor(deck.format, cards) : []),
    [cards, deck],
  );

  const saveName = async () => {
    if (!deck || !canEdit) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === deck.name) {
      setName(deck.name);
      return;
    }
    try {
      await updateMtgDeck(deck.id, { name: trimmed });
      setDeck({ ...deck, name: trimmed });
    } catch (error) {
      setName(deck.name);
      const message = error instanceof Error ? error.message : 'Could not rename deck.';
      Alert.alert('Error', message);
    }
  };

  const changeFormat = async (format: DeckFormat) => {
    if (!deck || format === deck.format) return;
    try {
      await updateMtgDeck(deck.id, { format });
      setDeck({ ...deck, format });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not change format.';
      Alert.alert('Error', message);
    }
  };

  const runCard = async (cardId: string, action: () => Promise<void>) => {
    setBusyCardId(cardId);
    try {
      await action();
      if (id) setCards(await getMtgDeckCards(id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update the deck.';
      Alert.alert('Error', message);
    } finally {
      setBusyCardId(null);
    }
  };

  const pullIntoCollection = (card: MtgDeckCard) => {
    void runCard(card.id, async () => {
      const scry = await getScryfallCard(card.scryfallId);
      await addMtgCardFromScryfall(scry, { qty: card.qty, foil: card.foil });
      Alert.alert(
        'Added to collection',
        `${card.qty}× ${card.name}${card.foil ? ' (foil)' : ''} is in the collection. The deck list is unchanged.`,
      );
    });
  };

  const openCardMenu = (card: MtgDeckCard) => {
    if (!deck) return;
    const destinations = (
      deck.format === 'commander'
        ? (['commander', 'main', 'maybeboard'] as const)
        : (['main', 'sideboard', 'maybeboard'] as const)
    ).filter((board) => board !== card.board);
    const misplaced =
      deck.format === 'commander' && card.board === 'sideboard'
        ? (['main', 'maybeboard', 'commander'] as const)
        : deck.format === 'standard' && card.board === 'commander'
          ? (['main', 'sideboard', 'maybeboard'] as const)
          : destinations;

    Alert.alert(card.name, undefined, [
      ...misplaced.map((board) => ({
        text: board === 'commander' ? 'Set as commander' : `Move to ${boardLabel(board).toLowerCase()}`,
        onPress: () => void runCard(card.id, () => moveDeckCard(card, board)),
      })),
      ...(writer
        ? [
            {
              text: 'Add to collection',
              onPress: () => pullIntoCollection(card),
            },
          ]
        : []),
      {
        text: 'Remove from deck',
        style: 'destructive' as const,
        onPress: () => void runCard(card.id, () => removeDeckCard(card.id)),
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleResync = () => {
    if (!deck?.archidektId) return;
    Alert.alert(
      'Replace the card list?',
      'Re-sync replaces every card in this deck. Local edits to the list will be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => void runResync(deck),
        },
      ],
    );
  };

  const runResync = async (current: MtgDeck) => {
    if (!current.archidektId) return;
    setResyncing(true);
    try {
      const imported = await fetchArchidektDeck(current.archidektId);
      const format = imported.format ?? (await askDeckFormat());
      if (!format) return;
      await resyncArchidektDeck(current.id, imported, format);
      const nextCards = await getMtgDeckCards(current.id);
      setDeck({ ...current, format });
      setCards(nextCards);
      const nextWarnings = deckWarnings(format, nextCards);
      if (nextWarnings.length > 0) {
        Alert.alert(
          'Legality warnings',
          `${nextWarnings.slice(0, 5).join('\n')}${nextWarnings.length > 5 ? '\n…' : ''}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not re-sync this deck.';
      Alert.alert('Archidekt', message);
    } finally {
      setResyncing(false);
    }
  };

  const handleDelete = () => {
    if (!deck) return;
    Alert.alert('Delete deck?', `Remove "${deck.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMtgDeck(deck.id);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not delete deck.';
            Alert.alert('Error', message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Deck not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: deck.name }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {canEdit ? (
              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={() => void saveName()}
                onSubmitEditing={() => void saveName()}
                placeholder="Deck name"
                placeholderTextColor={colors.placeholder}
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                accessibilityLabel="Deck name"
              />
            ) : null}
            {canEdit ? (
              <FilterChoices
                label="Format"
                options={FORMATS}
                value={deck.format}
                onChange={(format) => void changeFormat(format)}
              />
            ) : (
              <Text style={[typeScale.body, { color: colors.text }]}>{formatLabel(deck.format)}</Text>
            )}
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              {sizeLabel(deck.format, cards)}
              {deck.archidektId ? ` · Archidekt ${deck.archidektId}` : ''}
              {createdByLabel ? ` · ${createdByLabel}` : ''}
            </Text>
            <View style={[styles.warnings, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typeScale.label, { color: colors.textSecondary }]}>Legality</Text>
              {!rulesReady ? (
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Checking Scryfall…</Text>
              ) : warnings.length === 0 ? (
                <Text style={[typeScale.body, { color: colors.text }]}>No legality warnings.</Text>
              ) : (
                warnings.map((warning) => (
                  <Text key={warning} style={[typeScale.caption, { color: colors.danger }]}>
                    {warning}
                  </Text>
                ))
              )}
            </View>
            {canEdit ? (
              <PrimaryButton
                label="Add cards"
                onPress={() => router.push({ pathname: '/mtg/deck-add', params: { deckId: deck.id } })}
              />
            ) : null}
            {canEdit && deck.archidektId ? (
              <PrimaryButton label="Re-sync from Archidekt" onPress={handleResync} loading={resyncing} />
            ) : null}
            {canEdit ? (
              <PrimaryButton label="Delete deck" onPress={handleDelete} loading={deleting} variant="danger" />
            ) : null}
            <ApiCredit providers={deck.archidektId ? ['archidekt', 'scryfall'] : ['scryfall']} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {section.title}
            {section.data.length === 0 ? ' · empty' : ` · ${section.data.reduce((sum, card) => sum + card.qty, 0)}`}
          </Text>
        )}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
            )}
            <View style={styles.metaCol}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {item.name}
                {item.foil ? ' ★' : ''}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {[item.manaCost, item.typeLine].filter(Boolean).join(' · ')}
              </Text>
              {canEdit ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void runCard(item.id, () => updateDeckCardQty(item.id, item.qty - 1))}
                    disabled={busyCardId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${item.name}`}
                    style={styles.qtyButton}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>−</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>
                    {item.qty}
                  </Text>
                  <Pressable
                    onPress={() => void runCard(item.id, () => updateDeckCardQty(item.id, item.qty + 1))}
                    disabled={busyCardId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${item.name}`}
                    style={styles.qtyButton}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>+</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openCardMenu(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.name}`}
                    style={styles.qtyButton}
                  >
                    <Text style={[typeScale.label, { color: colors.accent }]}>Edit</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[typeScale.caption, { color: colors.text }]}>{item.qty}×</Text>
              )}
              {!canEdit && writer ? (
                <Pressable
                  onPress={() => pullIntoCollection(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name} to collection`}
                >
                  <Text style={[typeScale.label, { color: colors.accent }]}>Add to collection</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nameInput: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 20,
    fontWeight: '700',
  },
  warnings: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    ...typeScale.label,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
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
  metaCol: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  qtyButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
