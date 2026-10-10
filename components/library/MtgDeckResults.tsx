import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { partitionDecks } from '../../lib/deckSleeve';
import { formatLabel } from '../../lib/deckLegality';
import { sleeveById, sleeveLabel } from '../../lib/dragonShield';
import { MtgDeckListItem } from '../../lib/mtgDecks';
import { spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ManaIdentity } from '../MtgCollectionOverview';
import { SleeveFrame } from '../SleeveFrame';

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
  const sleeve = sleeveById(deck.sleeveId);
  return [
    deck.name,
    formatLabel(deck.format),
    colors,
    sleeve ? sleeveLabel(sleeve) : null,
    deck.archivedAt ? 'archived' : null,
    deck.archidektId ? 'from Archidekt' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function tileMark(deck: MtgDeckListItem): string {
  return [deck.archivedAt ? 'Archived' : null, deck.archidektId ? 'Archidekt' : null].filter(Boolean).join(' · ');
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

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function DeckGrid({ decks, compact }: { decks: MtgDeckListItem[]; compact: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const pip = compact ? PIP_BOX_COMPACT : PIP_BOX;

  return (
    <View>
      {chunk(gridTiles(decks), COLUMN_COUNT).map((row) => (
        <View key={row.map((item) => item.id).join(':')} style={styles.row}>
          {row.map((item) => {
            if (isPad(item)) return <View key={item.id} style={styles.tile} />;
            const sleeve = sleeveById(item.sleeveId);
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/mtg/deck/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={tileLabel(item)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <SleeveFrame sleeve={sleeve}>
                  <View style={[styles.tileInner, compact && styles.tileCompact]}>
                    {item.sleeveImageUrl ? (
                      <Image
                        source={{ uri: item.sleeveImageUrl }}
                        style={styles.sleevePhoto}
                        contentFit="cover"
                        accessibilityElementsHidden
                      />
                    ) : null}
                    <ManaIdentity identity={item.colors} box={pip} />
                    <Text style={[typeScale.caption, styles.name, { color: colors.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[typeScale.caption, styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatLabel(item.format)}
                    </Text>
                    <Text style={[typeScale.caption, styles.mark, { color: colors.textTertiary }]} numberOfLines={1}>
                      {tileMark(item)}
                    </Text>
                  </View>
                </SleeveFrame>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
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
  const { colors } = useTheme();
  const { active, archived } = partitionDecks(decks);

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
    <ScrollView
      style={styles.scroll}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
    >
      {active.length > 0 ? (
        <DeckGrid decks={active} compact={compact} />
      ) : (
        <Text style={[typeScale.body, styles.quiet, { color: colors.textSecondary }]}>No active decks</Text>
      )}
      {archived.length > 0 ? (
        <View style={styles.archived}>
          <Text style={[typeScale.label, { color: colors.text }]} accessibilityRole="header">
            Archived
          </Text>
          <DeckGrid decks={archived} compact={compact} />
        </View>
      ) : null}
      {footer ? <View>{footer}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  quiet: {
    paddingVertical: spacing.md,
  },
  archived: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tile: {
    flex: 1,
    minHeight: 44,
  },
  tileInner: {
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tileCompact: {
    paddingVertical: spacing.xs,
  },
  tilePressed: {
    opacity: 0.7,
  },
  sleevePhoto: {
    width: '100%',
    height: 36,
    borderRadius: 6,
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
