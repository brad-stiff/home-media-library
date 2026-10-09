import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { formatLabel } from '../../lib/deckLegality';
import { MtgDeckListItem } from '../../lib/mtgDecks';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ManaIdentity } from '../MtgCollectionOverview';

const COLUMN_COUNT = 3;
const PIP_BOX = 72;
const PIP_BOX_COMPACT = 60;

type PadTile = { id: string; pad: true };
type GridTile = MtgDeckListItem | PadTile;

type MtgDeckResultsProps = {
  decks: MtgDeckListItem[];
  query: string;
  writer: boolean;
  compact: boolean;
  emptyAction?: { label: string; onPress: () => void };
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

const COLOR_NAMES: Record<string, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
};

function colorPhrase(identity: string | null): string | null {
  if (identity == null) return null;
  if (identity.length === 0) return 'colorless';
  return [...identity].map((letter) => COLOR_NAMES[letter] ?? letter).join(', ');
}

function tileLabel(deck: MtgDeckListItem): string {
  const colors = colorPhrase(deck.colors);
  return [deck.name, formatLabel(deck.format), colors, deck.archidektId ? 'from Archidekt' : null].filter(Boolean).join(', ');
}

function gridTiles(decks: MtgDeckListItem[]): GridTile[] {
  if (decks.length === 0) return [];
  const remainder = decks.length % COLUMN_COUNT;
  if (remainder === 0) return decks;
  return [
    ...decks,
    ...Array.from({ length: COLUMN_COUNT - remainder }, (_, index) => ({ id: `pad-${index}`, pad: true as const })),
  ];
}

function isPad(item: GridTile): item is PadTile {
  return 'pad' in item;
}

export function MtgDeckResults({
  decks,
  query,
  writer,
  compact,
  emptyAction,
  bottomPad,
  refreshing,
  onRefresh,
  footer,
}: MtgDeckResultsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const tiles = gridTiles(decks);

  if (decks.length === 0) {
    return (
      <EmptyState
        title={query ? 'No matches' : 'No decks yet'}
        message={
          writer
            ? 'Create a Commander or Standard deck, or import one from Archidekt.'
            : 'Decks imported by your household will show up here.'
        }
        action={emptyAction}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <FlatList
      data={tiles}
      numColumns={COLUMN_COUNT}
      columnWrapperStyle={styles.row}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) => {
        if (isPad(item)) return <View style={styles.tile} />;
        return (
          <Pressable
            onPress={() => router.push(`/mtg/deck/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={tileLabel(item)}
            style={({ pressed }) => [
              styles.tile,
              styles.tileFace,
              compact && styles.tileCompact,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.tilePressed,
            ]}
          >
            <ManaIdentity identity={item.colors} box={compact ? PIP_BOX_COMPACT : PIP_BOX} />
            <Text style={[typeScale.caption, styles.name, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[typeScale.caption, styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatLabel(item.format)}
            </Text>
            <Text style={[typeScale.caption, styles.mark, { color: colors.textTertiary }]} numberOfLines={1}>
              {item.archidektId ? 'Archidekt' : ''}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  row: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  tileFace: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tileCompact: {
    paddingVertical: spacing.xs,
  },
  tilePressed: {
    opacity: 0.7,
  },
  name: {
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  detail: {
    textAlign: 'center',
    width: '100%',
  },
  mark: {
    textAlign: 'center',
    width: '100%',
    minHeight: 18,
  },
});
