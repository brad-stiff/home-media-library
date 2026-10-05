import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LibraryLayout } from '../../lib/libraryView';
import { MtgCard } from '../../lib/mtgCards';
import { SetSummary, TypeBar } from '../../lib/mtgOverview';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ChevronIcon } from '../icons';
import { MtgCardImage } from '../MtgCardImage';
import { MtgCollectionOverview } from '../MtgCollectionOverview';

type CollectionScreen = 'overview' | 'set' | 'all';

type MtgCollectionResultsProps = {
  cards: MtgCard[];
  sortedCards: MtgCard[];
  screen: CollectionScreen;
  writer: boolean;
  layout: LibraryLayout;
  compact: boolean;
  typeBars: TypeBar[];
  copies: number;
  sets: SetSummary[];
  filtering: boolean;
  onOpenSet: (code: string) => void;
  onOpenAll: () => void;
  emptyAction?: { label: string; onPress: () => void };
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

export function MtgCollectionResults({
  cards,
  sortedCards,
  screen,
  writer,
  layout,
  compact,
  typeBars,
  copies,
  sets,
  filtering,
  onOpenSet,
  onOpenAll,
  emptyAction,
  bottomPad,
  refreshing,
  onRefresh,
  footer,
}: MtgCollectionResultsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const listPad = { paddingBottom: bottomPad };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
  );

  if (cards.length === 0) {
    return (
      <EmptyState
        title="No cards yet"
        message={writer ? 'Add a card from Scryfall.' : 'Cards added by your household will show up here.'}
        action={emptyAction}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  if (screen === 'overview') {
    return (
      <MtgCollectionOverview
        bars={typeBars}
        copies={copies}
        sets={sets}
        onOpenSet={onOpenSet}
        onOpenAll={onOpenAll}
        bottomPad={bottomPad}
        filtering={filtering}
        refreshing={refreshing}
        onRefresh={onRefresh}
        footer={footer}
      />
    );
  }

  if (sortedCards.length === 0) {
    return (
      <EmptyState
        title="No matches"
        message="Try another name, or go back to the collection overview."
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <FlatList
      key={layout === 'grid' ? 'mtg-grid' : 'mtg-list'}
      data={sortedCards}
      keyExtractor={(item) => item.id}
      numColumns={layout === 'grid' ? 2 : 1}
      keyboardDismissMode="on-drag"
      refreshControl={refreshControl}
      columnWrapperStyle={layout === 'grid' ? styles.row : undefined}
      contentContainerStyle={layout === 'grid' ? [styles.grid, listPad] : [styles.list, listPad]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) =>
        layout === 'grid' ? (
          <Pressable
            onPress={() => router.push(`/mtg/card/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.qty}`}
            style={({ pressed }) => [styles.bookItem, compact && styles.bookItemCompact, pressed && { opacity: 0.85 }]}
          >
            <MtgCardImage
              uri={item.imageUri}
              title={item.name}
              foil={item.foil}
              style={styles.bookCover}
              placeholderColor={colors.surfaceElevated}
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
              {item.name}
              {item.foil ? ' ★' : ''}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Qty {item.qty}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/mtg/card/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.qty}`}
            style={[
              styles.mtgRow,
              compact && styles.listRowCompact,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MtgCardImage
              uri={item.imageUri}
              title={item.name}
              foil={item.foil}
              style={styles.mtgThumb}
              placeholderColor={colors.surfaceElevated}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.listMeta}>
              <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                {item.name}
                {item.foil ? ' ★' : ''}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {[item.setCode?.toUpperCase(), item.collectorNumber, `Qty ${item.qty}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <ChevronIcon color={colors.textTertiary} />
          </Pressable>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.sm,
  },
  row: { justifyContent: 'space-between' },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  listRowCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listMeta: { flex: 1, gap: 2 },
  bookItem: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '50%',
    gap: 4,
  },
  bookItemCompact: {
    margin: spacing.xs,
  },
  bookCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  mtgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  mtgThumb: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
});
