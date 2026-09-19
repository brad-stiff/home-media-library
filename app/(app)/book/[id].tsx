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
import { Book, deleteBook, getBookById } from '../../../lib/books';
import { getMyHousehold } from '../../../lib/household';
import { spacing, useTheme } from '../../../lib/theme';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!id) return;
        setLoading(true);
        try {
          const [result, household] = await Promise.all([getBookById(id), getMyHousehold()]);
          if (active) {
            setBook(result);
            setIsAdmin(household.role === 'admin');
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
    }, [id]),
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
        </Text>
        {isAdmin ? (
          <PrimaryButton
            label="Remove from Library"
            onPress={handleDelete}
            loading={deleting}
            variant="danger"
          />
        ) : (
          <Text style={{ color: colors.textTertiary }}>Only household admins can remove books.</Text>
        )}
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
