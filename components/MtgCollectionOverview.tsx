import { Image } from 'expo-image';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { SetSummary, TypeBar } from '../lib/mtgOverview';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { ChevronIcon } from './icons';

const COLUMN_COUNT = 3;
const RING_SIZE = 72;
const RING_STROKE = 4;

type MtgCollectionOverviewProps = {
  bars: TypeBar[];
  copies: number;
  sets: SetSummary[];
  onOpenSet: (code: string) => void;
  onOpenAll: () => void;
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
  bars,
  copies,
  sets,
  onOpenSet,
  onOpenAll,
  bottomPad,
  filtering,
  refreshing,
  onRefresh,
  footer,
}: MtgCollectionOverviewProps) {
  const { colors } = useTheme();
  const max = Math.max(...bars.map((bar) => bar.count), 1);
  const tiles = gridTiles(sets);

  return (
    <FlatList
      data={tiles}
      numColumns={COLUMN_COUNT}
      columnWrapperStyle={tiles.length > 0 ? styles.setRow : undefined}
      keyExtractor={(item) => item.code}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[typeScale.label, { color: colors.textTertiary }]}>Card types</Text>
          <View accessibilityRole="summary" accessibilityLabel="Card types in the collection">
            {bars.map((bar) => (
              <View key={bar.type} style={styles.barRow} accessibilityLabel={`${bar.type}, ${bar.count}`}>
                <Text style={[styles.barLabel, typeScale.caption, { color: colors.text }]}>{bar.type}</Text>
                <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${Math.max(4, Math.round((bar.count / max) * 100))}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.barCount, typeScale.caption, { color: colors.textSecondary }]}>{bar.count}</Text>
              </View>
            ))}
          </View>
          <Text style={[typeScale.body, { color: colors.text }]}>
            {copies.toLocaleString()} {copies === 1 ? 'card' : 'cards'} in the collection
          </Text>
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
            Bars count each printing once. A card with more than one type is counted in each bar.
          </Text>
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
        if (isPad(item)) return <View style={styles.tile} />;
        const copy = completionCopy(item);
        return (
          <Pressable
            onPress={() => onOpenSet(item.code)}
            accessibilityRole="button"
            accessibilityLabel={copy.label}
            style={({ pressed }) => [
              styles.tile,
              styles.tileFace,
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 28,
  },
  barLabel: {
    width: 108,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: radius.sm,
  },
  barCount: {
    width: 36,
    textAlign: 'right',
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
