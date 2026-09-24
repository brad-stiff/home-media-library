import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { CheckoutPanel } from '../../../components/CheckoutPanel';
import { useAuth } from '../../../lib/auth';
import { Book, deleteBook, getBookById, refreshBookFromOpenLibrary } from '../../../lib/books';
import { LoanHistory } from '../../../components/LoanHistory';
import { Checkout, getActiveCheckout, listItemCheckouts } from '../../../lib/checkouts';
import { listHouseholdMembers } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { ApiCredit } from '../../../components/ApiCredit';
import { attributionName, canDeleteOwned, canEditHouseholdFacts, isWriter } from '../../../lib/roles';
import { spacing, useTheme } from '../../../lib/theme';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canLend, setCanLend] = useState(false);
  const [addedByLabel, setAddedByLabel] = useState<string | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<Checkout | null>(null);
  const [loanHistory, setLoanHistory] = useState<Checkout[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!id || !household) return;
        setLoading(true);
        try {
          const [result, members, checkout, history] = await Promise.all([
            getBookById(id),
            listHouseholdMembers(),
            getActiveCheckout('book', id),
            listItemCheckouts('book', id),
          ]);
          if (active) {
            setBook(result);
            const memberIds = new Set(members.map((member) => member.userId));
            setCanEdit(
              result != null && canEditHouseholdFacts(household.role, result.addedBy, memberIds),
            );
            setCanDelete(
              result != null && canDeleteOwned(household.role, result.addedBy, user?.id ?? null),
            );
            setCanLend(isWriter(household.role));
            setAddedByLabel(
              result ? attributionName(result.addedBy, members, result.addedByName) : null,
            );
            setActiveCheckout(checkout);
            setLoanHistory(history);
          }
        } catch (error) {
          if (active) {
            const message = error instanceof Error ? error.message : 'Could not load book.';
            Alert.alert('Error', message);
            setBook(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [household, id, user?.id]),
  );

  const handleDelete = () => {
    if (!book) return;
    Alert.alert('Remove book?', `Remove "${book.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteBook(book.id);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not remove book.';
            Alert.alert('Error', message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    if (!book) return;
    setRefreshing(true);
    try {
      setBook(await refreshBookFromOpenLibrary(book));
      Alert.alert('Updated', 'Book details were refreshed from Open Library.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not refresh this book.';
      Alert.alert('Error', message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Book not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: book.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        {book.coverUrl ? (
          <Image source={{ uri: book.coverUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, { backgroundColor: colors.surfaceElevated }]} />
        )}
        <Text style={[styles.title, { color: colors.text }]}>{book.title}</Text>
        {book.authors.length > 0 ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {book.authors.join(', ')}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {[book.year, book.isbn ? `ISBN ${book.isbn}` : null].filter(Boolean).join(' · ')}
        </Text>
        {book.overview ? (
          <Text style={[styles.overview, { color: colors.textSecondary }]}>{book.overview}</Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          Added {new Date(book.addedAt).toLocaleDateString()}
          {addedByLabel ? ` · ${addedByLabel}` : ''}
        </Text>
        <CheckoutPanel
          itemType="book"
          itemId={book.id}
          activeCheckout={activeCheckout}
          onChanged={(next) => {
            setActiveCheckout(next);
            void listItemCheckouts('book', book.id).then(setLoanHistory);
          }}
          canWrite={canLend}
        />
        <LoanHistory loans={loanHistory} />
        {canEdit ? (
          <PrimaryButton
            label="Refresh from Open Library"
            onPress={handleRefresh}
            loading={refreshing}
            disabled={!book.isbn && !book.openLibraryKey}
          />
        ) : null}
        {canDelete ? (
          <PrimaryButton
            label="Remove from Library"
            onPress={handleDelete}
            loading={deleting}
            variant="danger"
          />
        ) : (
          <Text style={{ color: colors.textTertiary }}>
            {canLend
              ? 'You can remove books you added. Admins can remove any book.'
              : 'Viewers can browse this book.'}
            </Text>
        )}
        <ApiCredit providers={['openLibrary']} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cover: {
    width: 180,
    height: 270,
    borderRadius: 8,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  meta: {
    fontSize: 15,
    textAlign: 'center',
  },
  overview: {
    fontSize: 16,
    lineHeight: 24,
  },
});
