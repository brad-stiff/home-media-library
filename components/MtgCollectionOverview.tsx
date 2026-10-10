import { Image } from 'expo-image';
import { ReactNode, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ColorCount, MANA_COLORS, ManaColor, SetSummary } from '../lib/mtgOverview';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { ChevronIcon } from './icons';

const COLUMN_COUNT = 3;
const RING_SIZE = 72;
const RING_STROKE = 4;

const MANA_SYMBOLS: Record<ManaColor, { label: string; uri: string }> = {
  W: { label: 'White', uri: 'https://svgs.scryfall.io/card-symbols/W.svg' },
  U: { label: 'Blue', uri: 'https://svgs.scryfall.io/card-symbols/U.svg' },
  B: { label: 'Black', uri: 'https://svgs.scryfall.io/card-symbols/B.svg' },
  R: { label: 'Red', uri: 'https://svgs.scryfall.io/card-symbols/R.svg' },
  G: { label: 'Green', uri: 'https://svgs.scryfall.io/card-symbols/G.svg' },
  C: { label: 'Colorless', uri: 'https://svgs.scryfall.io/card-symbols/C.svg' },
};

function tally(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function ManaCount({
  color,
  count,
  selected,
  onSelect,
}: {
  color: ManaColor;
  count: number;
  selected: boolean;
  onSelect?: (color: ManaColor) => void;
}) {
  const { colors } = useTheme();
  const symbol = MANA_SYMBOLS[color];
  const countLabel = count.toLocaleString();
  const body = (
    <>
      <View style={[styles.manaMark, selected && { borderColor: colors.accent }]}>
        <Image source={{ uri: symbol.uri }} style={styles.manaIcon} contentFit="contain" accessibilityLabel="" />
      </View>
      <Text style={[typeScale.caption, { color: colors.text }]}>{countLabel}</Text>
    </>
  );
  if (count === 0 || !onSelect) {
    return (
      <View style={styles.mana} accessibilityLabel={`${symbol.label}, ${countLabel}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onSelect(color)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        selected ? `${symbol.label}, ${countLabel}, selected. Show every color` : `${symbol.label}, ${countLabel}. Show these cards`
      }
      style={styles.mana}
    >
      {body}
    </Pressable>
  );
}

/** WUBRG letters, '' for colorless, or null when the colors are not known yet. */
export function ManaIdentity({ identity, box }: { identity: string | null; box: number }) {
  if (identity == null) return <View style={{ width: box, height: box }} />;
  const letters: ManaColor[] = identity.length === 0 ? ['C'] : MANA_COLORS.filter((color): color is ManaColor => color !== 'C' && identity.includes(color));
  const icon = letters.length >= 5 ? 16 : letters.length >= 3 ? 20 : letters.length === 2 ? 26 : 32;
  return (
    <View
      style={[styles.identity, { width: box, height: box }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {letters.map((letter) => (
        <Image
          key={letter}
          source={{ uri: MANA_SYMBOLS[letter].uri }}
          style={{ width: icon, height: icon }}
          contentFit="contain"
          accessibilityLabel=""
        />
      ))}
    </View>
  );
}

export function ManaSymbolRow({
  counts,
  selected,
  onSelect,
}: {
  counts: ColorCount[];
  selected: ManaColor | null;
  onSelect: (color: ManaColor) => void;
}) {
  return (
    <View accessibilityRole="summary" accessibilityLabel="Colors in the collection" style={styles.manaRow}>
      {counts.map((entry) => (
        <ManaCount
          key={entry.color}
          color={entry.color}
          count={entry.count}
          selected={selected === entry.color}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

type MtgCollectionOverviewProps = {
  colorCounts: ColorCount[] | null;
  copies: number;
  printings: number;
  setCount: number;
  sets: SetSummary[];
  onOpenSet: (code: string) => void;
  onOpenAll: () => void;
  onSelectColor: (color: ManaColor) => void;
  bottomPad: number;
  filtering: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

type PadTile = { code: string; pad: true };
type GridTile = SetSummary | PadTile;

function completionCopy(set: SetSummary): { detail: string; percent: string | null; label: string } {
  if (set.completed != null && set.printedSize != null && set.percent != null) {
    const detail = `${set.completed}/${set.printedSize}`;
    const percent = `${set.percent}%`;
    return { detail, percent, label: `${set.name}, ${detail}, ${percent}` };
  }
  const detail = `${set.owned} owned`;
  return { detail, percent: null, label: `${set.name}, ${detail}` };
}

/** Arc length for the ring. A started set keeps a sliver when rounding would draw nothing. */
function completionRingPercent(set: SetSummary): number | null {
  if (set.completed == null || set.printedSize == null || set.printedSize <= 0 || set.percent == null) {
    return null;
  }
  const ratio = Math.min(100, (set.completed / set.printedSize) * 100);
  if (set.completed > 0 && ratio < 2) return 2;
  return ratio;
}

function gridTiles(sets: SetSummary[]): GridTile[] {
  if (sets.length === 0) return [];
  const remainder = sets.length % COLUMN_COUNT;
  if (remainder === 0) return sets;
  return [
    ...sets,
    ...Array.from({ length: COLUMN_COUNT - remainder }, (_, index) => ({ code: `pad-${index}`, pad: true as const })),
  ];
}

function isPad(item: GridTile): item is PadTile {
  return 'pad' in item;
}

/** One share of the measured row, so a short last row cannot grow past the other columns. */
function columnWidth(listWidth: number): number {
  const row = listWidth - spacing.md * 2;
  const gaps = spacing.sm * (COLUMN_COUNT - 1);
  return Math.max(0, (row - gaps) / COLUMN_COUNT);
}

function CompletionRing({
  percent,
  trackColor,
  progressColor,
  children,
}: {
  percent: number | null;
  trackColor: string;
  progressColor: string;
  children: ReactNode;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const dash = (shown / 100) * circumference;
  const center = RING_SIZE / 2;

  return (
    <View style={styles.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={RING_STROKE} fill="none" />
        {shown > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={circumference / 4}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

export function MtgCollectionOverview({
  colorCounts,
  copies,
  printings,
  setCount,
  sets,
  onOpenSet,
  onOpenAll,
  onSelectColor,
  bottomPad,
  filtering,
  refreshing,
  onRefresh,
  footer,
}: MtgCollectionOverviewProps) {
  const { colors } = useTheme();
  const [listWidth, setListWidth] = useState(0);
  const tileWidth = columnWidth(listWidth);
  const columnStyle =
    tileWidth > 0 ? { width: tileWidth, maxWidth: tileWidth, flexBasis: tileWidth, flexGrow: 0 } : null;
  const tiles = gridTiles(sets);
  const totals = [
    tally(copies, 'card', 'cards'),
    tally(printings, 'printing', 'printings'),
    tally(setCount, 'set', 'sets'),
  ].join(' · ');

  return (
    <FlatList
      data={tiles}
      numColumns={COLUMN_COUNT}
      columnWrapperStyle={tiles.length > 0 ? styles.setRow : undefined}
      keyExtractor={(item) => item.code}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setListWidth((current) => (current === next ? current : next));
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text accessibilityRole="summary" style={[typeScale.body, { color: colors.text }]}>
            {totals}
          </Text>
          {colorCounts ? (
            <>
              <ManaSymbolRow counts={colorCounts} selected={null} onSelect={onSelectColor} />
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                A multicolor card counts in each of its colors.
              </Text>
            </>
          ) : null}
          <Pressable
            onPress={onOpenAll}
            accessibilityRole="button"
            accessibilityLabel="All cards"
            style={[styles.allCards, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>All cards</Text>
            <ChevronIcon color={colors.textTertiary} />
          </Pressable>
          <Text style={[typeScale.label, { color: colors.textTertiary }]}>Sets</Text>
        </View>
      }
      ListEmptyComponent={
        filtering ? (
          <Text style={[typeScale.body, { color: colors.textSecondary, paddingVertical: spacing.md }]}>
            No matching sets
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        if (isPad(item)) return <View style={[styles.tile, columnStyle]} />;
        const copy = completionCopy(item);
        return (
          <Pressable
            onPress={() => onOpenSet(item.code)}
            accessibilityRole="button"
            accessibilityLabel={copy.label}
            style={({ pressed }) => [
              styles.tile,
              styles.tileFace,
              columnStyle,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.tilePressed,
            ]}
          >
            <CompletionRing percent={completionRingPercent(item)} trackColor={colors.border} progressColor={colors.accent}>
              {item.iconSvgUri ? (
                <Image
                  source={{ uri: item.iconSvgUri }}
                  style={styles.icon}
                  contentFit="contain"
                  tintColor={colors.text}
                  accessibilityLabel=""
                />
              ) : (
                <Text style={[typeScale.label, { color: colors.text }]}>{(item.code || '?').slice(0, 3).toUpperCase()}</Text>
              )}
            </CompletionRing>
            <Text style={[typeScale.caption, styles.name, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[typeScale.caption, styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
              {copy.detail}
            </Text>
            <Text style={[typeScale.caption, styles.percent, { color: colors.text }]} numberOfLines={1}>
              {copy.percent ?? ''}
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
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  manaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mana: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
    minHeight: 44,
  },
  manaMark: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 22,
    padding: 2,
  },
  manaIcon: {
    width: 36,
    height: 36,
  },
  identity: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  allCards: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    overflow: 'hidden',
  },
  tileFace: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tilePressed: {
    opacity: 0.7,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  icon: {
    width: 32,
    height: 32,
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
  percent: {
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    minHeight: 18,
  },
});
