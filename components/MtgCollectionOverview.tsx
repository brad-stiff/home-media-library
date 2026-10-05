import { Image } from 'expo-image';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { SetSummary, TypeBar } from '../lib/mtgOverview';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { ChevronIcon } from './icons';

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

function completionLabel(set: SetSummary): string {
  if (set.completed != null && set.printedSize != null && set.percent != null) {
    return `${set.completed}/${set.printedSize} · ${set.percent}%`;
  }
  return `${set.owned} owned`;
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

  return (
    <FlatList
      data={sets}
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
        const label = completionLabel(item);
        return (
          <Pressable
            onPress={() => onOpenSet(item.code)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${label}`}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.iconPlate, { backgroundColor: colors.surfaceElevated }]}>
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
            </View>
            <View style={styles.tileMeta}>
              <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
            <ChevronIcon color={colors.textTertiary} />
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
  tile: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconPlate: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  tileMeta: {
    flex: 1,
    gap: 2,
  },
});
