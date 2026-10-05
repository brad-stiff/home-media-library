import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ApiCredit } from '../../../components/ApiCredit';
import { CheckoutPanel } from '../../../components/CheckoutPanel';
import { DetailHeader, DetailScroll, DetailSection } from '../../../components/DetailLayout';
import { LoanHistory } from '../../../components/LoanHistory';
import { MoviePoster } from '../../../components/MoviePoster';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useAuth } from '../../../lib/auth';
import { Book, deleteBook, getBookById, refreshBookFromOpenLibrary } from '../../../lib/books';
import { Checkout, getActiveCheckout, listItemCheckouts } from '../../../lib/checkouts';
import { listHouseholdMembers } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { attributionName, canDeleteOwned, canEditHouseholdFacts, isWriter } from '../../../lib/roles';
import { useTheme } from '../../../lib/theme';
import { useToast } from '../../../lib/toast';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
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
            setCanEdit(result != null && canEditHouseholdFacts(household.role, result.addedBy, memberIds));
            setCanDelete(result != null && canDeleteOwned(household.role, result.addedBy, user?.id ?? null));
            setCanLend(isWriter(household.role));
            setAddedByLabel(result ? attributionName(result.addedBy, members, result.addedByName) : null);
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
      showToast('Book details updated');
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

  const lendingOn = household?.lendingEnabled !== false;
  const subtitle = [book.authors.join(', '), book.year].filter(Boolean).join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <DetailScroll>
        <DetailHeader
          art={<MoviePoster uri={book.coverUrl} title={book.title} size="sm" />}
          title={book.title}
          subtitle={subtitle || null}
        />

        {book.overview ? (
          <DetailSection title="Overview">
            <Text style={[styles.body, { color: colors.textSecondary }]}>{book.overview}</Text>
          </DetailSection>
        ) : null}

        {lendingOn || activeCheckout ? (
          <DetailSection title="Lending">
            <CheckoutPanel
              itemType="book"
              itemId={book.id}
              activeCheckout={activeCheckout}
              onChanged={(next) => {
                setActiveCheckout(next);
                void listItemCheckouts('book', book.id).then(setLoanHistory);
              }}
              canWrite={canLend}
              lendingEnabled={lendingOn}
            />
            {lendingOn ? <LoanHistory loans={loanHistory} /> : null}
          </DetailSection>
        ) : null}

        <DetailSection title="In your library">
          {book.isbn ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>ISBN {book.isbn}</Text>
          ) : null}
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Added {new Date(book.addedAt).toLocaleDateString()}
            {addedByLabel ? ` · ${addedByLabel}` : ''}
          </Text>
        </DetailSection>

        {canEdit ? (
          <PrimaryButton
            label="Refresh from Open Library"
            onPress={handleRefresh}
            loading={refreshing}
            disabled={!book.isbn && !book.openLibraryKey}
          />
        ) : null}
        {canDelete ? (
          <PrimaryButton label="Remove from library" onPress={handleDelete} loading={deleting} variant="danger" />
        ) : null}
        <ApiCredit providers={['openLibrary']} />
      </DetailScroll>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
