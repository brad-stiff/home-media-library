import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';

import { Checkout } from '../../lib/checkouts';
import { LibraryLayout } from '../../lib/libraryView';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { Movie } from '../../lib/types';
import { CheckoutMark } from '../CheckoutMark';
import { EmptyState } from '../EmptyState';
import { MovieGridItem } from '../MovieGridItem';
import { MoviePoster } from '../MoviePoster';

type MovieResultsProps = {
  movies: Movie[];
  query: string;
  filtering: boolean;
  writer: boolean;
  layout: LibraryLayout;
  compact: boolean;
  lendingOn: boolean;
  checkouts: Map<string, Checkout>;
  emptyAction?: { label: string; onPress: () => void };
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: ReactNode;
};

export function MovieResults({
  movies,
  query,
  filtering,
  writer,
  layout,
  compact,
  lendingOn,
  checkouts,
  emptyAction,
  bottomPad,
  refreshing,
  onRefresh,
  footer,
}: MovieResultsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const listPad = { paddingBottom: bottomPad };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
  );

  if (movies.length === 0) {
    return (
      <EmptyState
        title={query || filtering ? 'No matches' : 'No movies yet'}
        message={
          writer ? 'Scan a disc or add a title from TMDb.' : 'Movies added by your household will show up here.'
        }
        action={emptyAction}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  if (layout === 'grid') {
    return (
      <FlatList
        key="movies-grid"
        data={movies}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
        contentContainerStyle={[styles.grid, listPad]}
        columnWrapperStyle={styles.row}
        ListFooterComponent={footer ? <View>{footer}</View> : null}
        renderItem={({ item }) => (
          <MovieGridItem
            movie={item}
            compact={compact}
            checkedOut={lendingOn && checkouts.has(item.id)}
            borrowerName={lendingOn ? checkouts.get(item.id)?.borrowerName : undefined}
            onPress={() => router.push(`/movie/${item.id}`)}
          />
        )}
      />
    );
  }

  return (
    <FlatList
      key="movies-list"
      data={movies}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      refreshControl={refreshControl}
      contentContainerStyle={[styles.list, listPad]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) => {
        const loan = lendingOn ? checkouts.get(item.id) : undefined;
        return (
          <Pressable
            onPress={() => router.push(`/movie/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={
              loan ? `${item.title}, checked out to ${loan.borrowerName}` : item.title
            }
            style={[
              styles.listRow,
              compact && styles.listRowCompact,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View>
              <MoviePoster
                posterPath={item.posterPath}
                title={item.title}
                size="sm"
                style={compact ? styles.thumbCompact : styles.thumb}
              />
              {loan ? <CheckoutMark /> : null}
            </View>
            <View style={styles.listMeta}>
              <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {[item.year, loan ? 'Out' : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
        );
      }}
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
  thumb: {
    width: 48,
    height: 72,
    borderRadius: radius.sm,
  },
  thumbCompact: {
    width: 36,
    height: 54,
    borderRadius: radius.sm,
  },
});
