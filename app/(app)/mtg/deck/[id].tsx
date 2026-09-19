import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../../../components/PrimaryButton';
import { getMyHousehold } from '../../../../lib/household';
import {
  deleteMtgDeck,
  getMtgDeck,
  getMtgDeckCards,
  MtgDeck,
  MtgDeckCard,
} from '../../../../lib/mtgDecks';
import { radius, spacing, useTheme } from '../../../../lib/theme';

export default function MtgDeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [deck, setDeck] = useState<MtgDeck | null>(null);
  const [cards, setCards] = useState<MtgDeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, c, household] = await Promise.all([
        getMtgDeck(id),
        getMtgDeckCards(id),
        getMyHousehold(),
      ]);
      setDeck(d);
      setCards(c);
      setIsAdmin(household.role === 'admin');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load deck.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const totalCards = useMemo(
    () => cards.reduce((sum, card) => sum + card.qty, 0),
    [cards],
  );

  const commanders = useMemo(() => cards.filter((c) => c.isCommander), [cards]);

  const handleDelete = () => {
    if (!deck) return;
    Alert.alert('Delete deck?', `Remove "${deck.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMtgDeck(deck.id);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not delete deck.';
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

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Deck not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: deck.name }} />
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {totalCards} cards
              {deck.archidektId ? ` · Archidekt ${deck.archidektId}` : ''}
            </Text>
            {commanders.length > 0 ? (
              <Text style={[styles.meta, { color: colors.text }]}>
                Commander: {commanders.map((c) => c.name).join(', ')}
              </Text>
            ) : null}
            {isAdmin ? (
              <PrimaryButton
                label="Delete deck"
                onPress={handleDelete}
                loading={deleting}
                variant="danger"
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
            )}
            <View style={styles.metaCol}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {item.qty > 1 ? `${item.qty}× ` : ''}
                {item.name}
              </Text>
              <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
                {[item.isCommander ? 'Commander' : item.category, item.manaCost]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  meta: {
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 44,
    height: 62,
    borderRadius: 6,
  },
  metaCol: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
});
