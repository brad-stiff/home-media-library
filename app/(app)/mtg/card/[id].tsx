import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiCredit } from '../../../../components/ApiCredit';
import { DetailHeader, DetailScroll, DetailSection } from '../../../../components/DetailLayout';
import { MtgCardImage } from '../../../../components/MtgCardImage';
import { PrimaryButton } from '../../../../components/PrimaryButton';
import { useAuth } from '../../../../lib/auth';
import { useHousehold } from '../../../../lib/householdContext';
import { deleteMtgCard, getMtgCard, MtgCard, updateMtgCardQty } from '../../../../lib/mtgCards';
import { canDeleteOwned } from '../../../../lib/roles';
import { spacing, useTheme } from '../../../../lib/theme';

export default function MtgCardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const [card, setCard] = useState<MtgCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id || !household) return;
    const result = await getMtgCard(id);
    setCard(result);
    setCanEdit(result != null && canDeleteOwned(household.role, result.addedBy, user?.id ?? null));
  }, [household, id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load()
        .catch((error) => {
          if (!active) return;
          const message = error instanceof Error ? error.message : 'Could not load this card.';
          Alert.alert('Error', message);
          setCard(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const changeQty = (delta: number) => {
    if (!card) return;
    const next = card.qty + delta;
    const apply = async () => {
      setBusy(true);
      try {
        if (next < 1) {
          await deleteMtgCard(card.id);
          router.back();
          return;
        }
        await updateMtgCardQty(card.id, next);
        setCard({ ...card, qty: next });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update quantity.';
        Alert.alert('Error', message);
      } finally {
        setBusy(false);
      }
    };

    if (next < 1) {
      Alert.alert('Remove card?', `Remove "${card.name}" from the collection?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void apply() },
      ]);
      return;
    }
    void apply();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Card not found.</Text>
      </View>
    );
  }

  const subtitle = [card.setName ?? card.setCode?.toUpperCase(), card.collectorNumber].filter(Boolean).join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <DetailScroll>
        <DetailHeader
          art={
            <MtgCardImage
              uri={card.imageUri}
              title={card.name}
              foil={card.foil}
              style={styles.art}
              placeholderColor={colors.surfaceElevated}
              placeholderTextColor={colors.textTertiary}
            />
          }
          title={card.foil ? `${card.name} ★` : card.name}
          subtitle={subtitle || null}
        />

        {card.typeLine || card.manaCost ? (
          <DetailSection title="Card">
            {card.manaCost ? <Text style={[styles.body, { color: colors.textSecondary }]}>{card.manaCost}</Text> : null}
            {card.typeLine ? <Text style={[styles.body, { color: colors.textSecondary }]}>{card.typeLine}</Text> : null}
            {card.rarity ? <Text style={[styles.body, { color: colors.textSecondary }]}>{card.rarity}</Text> : null}
          </DetailSection>
        ) : null}

        <DetailSection title="In your collection">
          <View style={styles.qtyRow}>
            {canEdit ? (
              <Pressable
                onPress={() => changeQty(-1)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${card.name}`}
                style={styles.qtyButton}
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>−</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.qty, { color: colors.text }]}>{card.qty}</Text>
            {canEdit ? (
              <Pressable
                onPress={() => changeQty(1)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${card.name}`}
                style={styles.qtyButton}
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>+</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Added {new Date(card.addedAt).toLocaleDateString()}
            {card.addedByName ? ` · ${card.addedByName}` : ''}
          </Text>
        </DetailSection>

        {canEdit ? (
          <PrimaryButton
            label="Remove from library"
            onPress={() => changeQty(-card.qty)}
            loading={busy}
            variant="danger"
          />
        ) : null}
        <ApiCredit providers={['scryfall']} />
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
  art: {
    width: 120,
    height: 168,
    borderRadius: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qty: {
    fontSize: 22,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  qtyButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
