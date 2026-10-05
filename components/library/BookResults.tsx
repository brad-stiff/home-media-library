import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Book } from '../../lib/books';
import { Checkout } from '../../lib/checkouts';
import { LibraryLayout } from '../../lib/libraryView';
import { radius, spacing, typeScale, useTheme } from '../../lib/theme';
import { CheckoutMark } from '../CheckoutMark';
import { EmptyState } from '../EmptyState';
import { MoviePoster } from '../MoviePoster';

type BookResultsProps = {
  books: Book[];
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

export function BookResults({
  books,
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
}: BookResultsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const listPad = { paddingBottom: bottomPad };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
  );

  if (books.length === 0) {
    return (
      <EmptyState
        title={query || filtering ? 'No matches' : 'No books yet'}
        message={
          writer
            ? 'Scan an ISBN or add a title from Open Library.'
            : 'Books added by your household will show up here.'
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
        key="books-grid"
        data={books}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
        contentContainerStyle={[styles.grid, listPad]}
        columnWrapperStyle={styles.row}
        ListFooterComponent={footer ? <View>{footer}</View> : null}
        renderItem={({ item }) => {
          const loan = lendingOn ? checkouts.get(item.id) : undefined;
          const byline = [item.authors[0], item.year].filter(Boolean).join(' · ');
          return (
            <Pressable
              onPress={() => router.push(`/book/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={
                loan ? `${item.title}, checked out to ${loan.borrowerName}` : `${item.title}, ${byline}`
              }
              style={({ pressed }) => [styles.bookItem, compact && styles.bookItemCompact, pressed && { opacity: 0.85 }]}
            >
              <View>
                <MoviePoster uri={item.coverUrl} title={item.title} style={styles.bookCover} />
                {loan ? <CheckoutMark /> : null}
              </View>
              <Text style={[styles.bookTitle, compact && styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {byline ? (
                <Text style={[styles.bookMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {byline}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <FlatList
      key="books-list"
      data={books}
      keyExtractor={(item) => item.id}
      keyboardDismissMode="on-drag"
      refreshControl={refreshControl}
      contentContainerStyle={[styles.list, listPad]}
      ListFooterComponent={footer ? <View>{footer}</View> : null}
      renderItem={({ item }) => {
        const loan = lendingOn ? checkouts.get(item.id) : undefined;
        return (
          <Pressable
            onPress={() => router.push(`/book/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={loan ? `${item.title}, checked out to ${loan.borrowerName}` : item.title}
            style={[
              styles.listRow,
              compact && styles.listRowCompact,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View>
              <MoviePoster
                uri={item.coverUrl}
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
                {[item.authors[0], item.year, loan ? 'Out' : null].filter(Boolean).join(' · ')}
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
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  compactTitle: {
    fontSize: 13,
    lineHeight: 16,
  },
  bookMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
});
