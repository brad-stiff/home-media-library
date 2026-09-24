import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { WriterOnly } from '../../../components/WriterOnly';
import { addBookFromLookup } from '../../../lib/books';
import { BookLookupResult } from '../../../lib/openLibrary';
import { spacing, useTheme } from '../../../lib/theme';

function ConfirmBookScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { payload } = useLocalSearchParams<{ payload: string }>();
  const [saving, setSaving] = useState(false);

  const book = useMemo(() => {
    try {
      return JSON.parse(payload ?? '') as BookLookupResult;
    } catch {
      return null;
    }
  }, [payload]);

  if (!book) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Missing book data.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await addBookFromLookup(book);
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add book.';
      Alert.alert('Unable to add book', message);
    } finally {
      setSaving(false);
    }
  };

  return (
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
        <Text style={[styles.overview, { color: colors.textSecondary }]} numberOfLines={6}>
          {book.overview}
        </Text>
      ) : null}
      <PrimaryButton label="Add to library" onPress={handleSave} loading={saving} />
      <PrimaryButton label="Scan again" onPress={() => router.replace('/scan')} />
    </ScrollView>
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
    width: 160,
    height: 240,
    borderRadius: 8,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  meta: {
    fontSize: 15,
    textAlign: 'center',
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
});

export default function ConfirmBookRoute() {
  return (
    <WriterOnly>
      <ConfirmBookScreen />
    </WriterOnly>
  );
}
