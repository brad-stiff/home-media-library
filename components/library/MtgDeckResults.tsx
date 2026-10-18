import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { partitionDecks } from '../../lib/deckSleeve';
import { formatLabel } from '../../lib/deckLegality';
import { sleeveById, sleeveLabel } from '../../lib/dragonShield';
import { MtgDeckListItem } from '../../lib/mtgDecks';
import { spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ManaIdentity } from '../MtgCollectionOverview';
import { SleeveFrame } from '../SleeveFrame';

const PIP_BOX = 72;
const PIP_BOX_COMPACT = 60;
const MAX_COLUMNS = 3;
/** Room beside the color identity so the deck name is not crushed into the card. */
const MIN_TILE = PIP_BOX + spacing.xs * 2 + spacing.xl * 2;

type PadTile = { id: string; pad: true };
type GridTile = MtgDeckListItem | PadTile;

type MtgDeckResultsProps = {
  decks: MtgDeckListItem[];
  query: string;
  writer: boolean;
  compact: boolean;
  emptyActions?: { label: string; onPress: () => void }[];
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

function gridTiles(decks: MtgDeckListItem[], columns: number): GridTile[] {
  if (decks.length === 0) return [];
  const remainder = decks.length % columns;
  if (remainder === 0) return decks;
  return [
    ...decks,
    ...Array.from({ length: columns - remainder }, (_, index) => ({ id: `pad-${index}`, pad: true as const })),
  ];
}

/** Two columns on a phone; three once each card is wide enough for the identity and the name. */
function columnCount(listWidth: number): number {
  if (listWidth <= 0) return 2;
  const row = listWidth - spacing.md * 2;
  const fitted = Math.floor((row + spacing.sm) / (MIN_TILE + spacing.sm));
  return Math.min(MAX_COLUMNS, Math.max(2, fitted));
}

/** One share of the measured row, so a short last row cannot grow past the other columns. */
function columnWidth(listWidth: number, columns: number): number {
  const row = listWidth - spacing.md * 2;
  const gaps = spacing.sm * Math.max(0, columns - 1);
  return Math.max(0, Math.floor((row - gaps) / columns));
}

function pipSize(tileWidth: number, compact: boolean): number {
  const preferred = compact ? PIP_BOX_COMPACT : PIP_BOX;
  const inner = tileWidth - spacing.xs * 2;
  if (!(inner > 0)) return preferred;
  return Math.min(preferred, inner);
}

function isPad(item: GridTile): item is PadTile {
  return 'pad' in item;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function DeckGrid({
  decks,
  compact,
  columns,
  tileWidth,
}: {
  decks: MtgDeckListItem[];
  compact: boolean;
  columns: number;
  tileWidth: number;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const pip = pipSize(tileWidth, compact);
  const columnStyle =
    tileWidth > 0
      ? { width: tileWidth, maxWidth: tileWidth, flexBasis: tileWidth, flexGrow: 0, flexShrink: 0 }
      : null;

  return (
    <View>
      {chunk(gridTiles(decks, columns), columns).map((row) => (
        <View key={row.map((item) => item.id).join(':')} style={styles.row}>
          {row.map((item) => {
            if (isPad(item)) return <View key={item.id} style={[styles.tile, columnStyle]} />;
            const sleeve = sleeveById(item.sleeveId);
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/mtg/deck/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={tileLabel(item)}
                style={({ pressed }) => [styles.tile, columnStyle, pressed && styles.tilePressed]}
              >
                <SleeveFrame sleeve={sleeve} fill>
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
  emptyActions,
  bottomPad,
  refreshing,
  onRefresh,
  footer,
}: MtgDeckResultsProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [listWidth, setListWidth] = useState(0);
  const width = listWidth || windowWidth;
  const columns = columnCount(width);
  const tileWidth = columnWidth(width, columns);
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
        actions={emptyActions}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      keyboardDismissMode="on-drag"
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setListWidth((current) => (current === next ? current : next));
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
    >
      {active.length > 0 ? (
        <DeckGrid decks={active} compact={compact} columns={columns} tileWidth={tileWidth} />
      ) : (
        <Text style={[typeScale.body, styles.quiet, { color: colors.textSecondary }]}>No active decks</Text>
      )}
      {archived.length > 0 ? (
        <View style={styles.archived}>
          <Text style={[typeScale.label, { color: colors.text }]} accessibilityRole="header">
            Archived
          </Text>
          <DeckGrid decks={archived} compact={compact} columns={columns} tileWidth={tileWidth} />
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
    alignItems: 'stretch',
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
