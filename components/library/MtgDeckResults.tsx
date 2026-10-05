import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { formatLabel } from '../../lib/deckLegality';
import { MtgDeck } from '../../lib/mtgDecks';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { EmptyState } from '../EmptyState';
import { ChevronIcon } from '../icons';

type MtgDeckResultsProps = {
  decks: MtgDeck[];
  query: string;
  writer: boolean;
  compact: boolean;
  emptyAction?: { label: string; onPress: () => void };
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

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
      data={decks}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/mtg/deck/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={[
            styles.listRow,
            compact && styles.listRowCompact,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.listMeta}>
            <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>{item.name}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              {[formatLabel(item.format), item.archidektId ? `Archidekt ${item.archidektId}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <ChevronIcon color={colors.textTertiary} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  listRowCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listMeta: { flex: 1, gap: 2 },
});
