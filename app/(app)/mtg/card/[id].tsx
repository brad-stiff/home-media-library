import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiCredit } from '../../../../components/ApiCredit';
import { DetailHeader, DetailScroll, DetailSection } from '../../../../components/DetailLayout';
import { MtgCardImage } from '../../../../components/MtgCardImage';
import { PrimaryButton } from '../../../../components/PrimaryButton';
import { useAuth } from '../../../../lib/auth';
import { useHousehold } from '../../../../lib/householdContext';
import { addMtgCardFromScryfall, attachCardBacks, deleteMtgCard, getMtgPrinting, MtgCard, updateMtgCardQty } from '../../../../lib/mtgCards';
import { canDeleteOwned, isWriter } from '../../../../lib/roles';
import { getScryfallCard } from '../../../../lib/scryfall';
import { spacing, useTheme } from '../../../../lib/theme';

export default function MtgCardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const [printing, setPrinting] = useState<{ nonfoil: MtgCard | null; foil: MtgCard | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const writer = household ? isWriter(household.role) : false;

  const load = useCallback(async () => {
    if (!id || !household) return;
    const loaded = await getMtgPrinting(id);
    if (!loaded) {
      setPrinting(null);
      return;
    }
    const rows = [loaded.nonfoil, loaded.foil].filter((row): row is MtgCard => row != null);
    const filled = await attachCardBacks(rows);
    const byId = new Map(filled.map((row) => [row.id, row]));
    setPrinting({
      nonfoil: loaded.nonfoil ? byId.get(loaded.nonfoil.id) ?? loaded.nonfoil : null,
      foil: loaded.foil ? byId.get(loaded.foil.id) ?? loaded.foil : null,
    });
  }, [household, id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void load()
        .catch((error) => {
          if (!active) return;
          const message = error instanceof Error ? error.message : 'Could not load this card.';
          Alert.alert('Error', message);
          setPrinting(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const canEditRow = (card: MtgCard) =>
    household != null && canDeleteOwned(household.role, card.addedBy, user?.id ?? null);

  const changeQty = (card: MtgCard, delta: number) => {
    if (!printing) return;
    const next = card.qty + delta;
    const other = card.foil ? printing.nonfoil : printing.foil;
    const apply = async () => {
      setBusy(true);
      try {
        if (next < 1) {
          await deleteMtgCard(card.id);
          if (!other) {
            router.back();
            return;
          }
          setPrinting((current) => (current ? { ...current, [card.foil ? 'foil' : 'nonfoil']: null } : current));
          return;
        }
        await updateMtgCardQty(card.id, next);
        setPrinting((current) =>
          current ? { ...current, [card.foil ? 'foil' : 'nonfoil']: { ...card, qty: next } } : current,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update quantity.';
        Alert.alert('Error', message);
      } finally {
        setBusy(false);
      }
    };

    if (next < 1) {
      const which = card.foil ? 'foil' : 'non-foil';
      const message = other
        ? `Remove the ${which} copies of "${card.name}"?`
        : `Remove "${card.name}" from the collection?`;
      Alert.alert('Remove card?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void apply() },
      ]);
      return;
    }
    void apply();
  };

  const addFinish = async (foil: boolean) => {
    const scryfallId = printing?.nonfoil?.scryfallId ?? printing?.foil?.scryfallId;
    if (!scryfallId || busy) return;
    setBusy(true);
    try {
      const scry = await getScryfallCard(scryfallId);
      const saved = await addMtgCardFromScryfall(scry, { foil });
      setPrinting((current) => (current ? { ...current, [foil ? 'foil' : 'nonfoil']: saved } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add this card.';
      Alert.alert('Could not add card', message);
    } finally {
      setBusy(false);
    }
  };

  const removePrinting = async () => {
    if (!printing) return;
    const rows = [printing.nonfoil, printing.foil].filter((row): row is MtgCard => row != null);
    setBusy(true);
    try {
      for (const row of rows) await deleteMtgCard(row.id);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove this card.';
      Alert.alert('Error', message);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const card = printing?.nonfoil ?? printing?.foil ?? null;
  if (!printing || !card) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Card not found.</Text>
      </View>
    );
  }

  const subtitle = [card.setName ?? card.setCode?.toUpperCase(), card.collectorNumber].filter(Boolean).join(' · ');
  const rows = [printing.nonfoil, printing.foil].filter((row): row is MtgCard => row != null);
  const canRemove = rows.length > 0 && rows.every((row) => canEditRow(row));
  const foilOnly = printing.nonfoil == null && printing.foil != null;

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <DetailScroll>
        <DetailHeader
          art={
            <MtgCardImage
              uri={card.imageUri}
              backUri={card.backImageUri}
              title={card.name}
              foil={foilOnly}
              style={styles.art}
              placeholderColor={colors.surfaceElevated}
              placeholderTextColor={colors.textTertiary}
            />
          }
          title={card.name}
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
          <FinishQty
            label="Non-foil"
            card={printing.nonfoil}
            name={card.name}
            canEdit={printing.nonfoil != null && canEditRow(printing.nonfoil)}
            canAdd={writer && printing.nonfoil == null}
            busy={busy}
            onDelta={(delta) => printing.nonfoil && changeQty(printing.nonfoil, delta)}
            onAdd={() => void addFinish(false)}
          />
          <FinishQty
            label="Foil"
            card={printing.foil}
            name={card.name}
            canEdit={printing.foil != null && canEditRow(printing.foil)}
            canAdd={writer && printing.foil == null}
            busy={busy}
            onDelta={(delta) => printing.foil && changeQty(printing.foil, delta)}
            onAdd={() => void addFinish(true)}
          />
        </DetailSection>

        {canRemove ? (
          <PrimaryButton
            label="Remove from library"
            onPress={() => {
              const both = printing.nonfoil != null && printing.foil != null;
              Alert.alert(
                'Remove card?',
                both
                  ? `Remove "${card.name}" from the collection? This removes the non-foil and foil copies.`
                  : `Remove "${card.name}" from the collection?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => void removePrinting() },
                ],
              );
            }}
            loading={busy}
            variant="danger"
          />
        ) : null}
        <ApiCredit providers={['scryfall']} />
      </DetailScroll>
    </>
  );
}

function FinishQty({
  label,
  card,
  name,
  canEdit,
  canAdd,
  busy,
  onDelta,
  onAdd,
}: {
  label: string;
  card: MtgCard | null;
  name: string;
  canEdit: boolean;
  canAdd: boolean;
  busy: boolean;
  onDelta: (delta: number) => void;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const qty = card?.qty ?? 0;
  const finish = label.toLowerCase();

  return (
    <View style={styles.finish}>
      <Text style={[styles.finishLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.qtyRow}>
        {canEdit ? (
          <Pressable
            onPress={() => onDelta(-1)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${finish} ${name}`}
            style={styles.qtyButton}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>−</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.qty, { color: qty > 0 ? colors.text : colors.textTertiary }]}>{qty}</Text>
        {canEdit ? (
          <Pressable
            onPress={() => onDelta(1)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${finish} ${name}`}
            style={styles.qtyButton}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>+</Text>
          </Pressable>
        ) : canAdd ? (
          <Pressable
            onPress={onAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add ${finish} ${name}`}
            style={styles.qtyButton}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>+</Text>
          </Pressable>
        ) : null}
      </View>
      {card ? (
        <Text style={[styles.added, { color: colors.textSecondary }]}>
          Added {new Date(card.addedAt).toLocaleDateString()}
          {card.addedByName ? ` · ${card.addedByName}` : ''}
        </Text>
      ) : null}
    </View>
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
  finish: {
    gap: 2,
  },
  finishLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  added: {
    fontSize: 14,
    lineHeight: 20,
  },
});
