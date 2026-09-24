import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from './PrimaryButton';
import {
  Checkout,
  CheckoutItemType,
  checkoutItem,
  returnCheckout,
} from '../lib/checkouts';
import { radius, spacing, useTheme } from '../lib/theme';

type CheckoutPanelProps = {
  itemType: CheckoutItemType;
  itemId: string;
  activeCheckout: Checkout | null;
  onChanged: (next: Checkout | null) => void;
  canWrite: boolean;
};

export function CheckoutPanel({
  itemType,
  itemId,
  activeCheckout,
  onChanged,
  canWrite,
}: CheckoutPanelProps) {
  const { colors } = useTheme();
  const [borrower, setBorrower] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCheckout = async () => {
    if (!borrower.trim()) {
      Alert.alert('Borrower required', 'Enter who is borrowing this item.');
      return;
    }

    setBusy(true);
    try {
      const row = await checkoutItem(itemType, itemId, borrower);
      onChanged(row);
      setBorrower('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not check out.';
      Alert.alert('Checkout failed', message);
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = () => {
    if (!activeCheckout) return;
    Alert.alert('Mark as returned?', `Confirm ${activeCheckout.borrowerName} returned this.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Returned',
        onPress: async () => {
          setBusy(true);
          try {
            await returnCheckout(activeCheckout.id);
            onChanged(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not return item.';
            Alert.alert('Return failed', message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (activeCheckout) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Checked out</Text>
        <Text style={[styles.borrower, { color: colors.text }]}>{activeCheckout.borrowerName}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Since {new Date(activeCheckout.checkedOutAt).toLocaleDateString()}
        </Text>
        {canWrite ? <PrimaryButton label="Mark returned" onPress={handleReturn} loading={busy} /> : null}
      </View>
    );
  }

  if (!canWrite) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Lending</Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>Available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Check out</Text>
      <Text style={[styles.meta, { color: colors.textTertiary }]}>
        Available — enter a free-text borrower name (friend, family, etc.)
      </Text>
      <TextInput
        value={borrower}
        onChangeText={setBorrower}
        placeholder="Borrower name"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      />
      <PrimaryButton label="Check out" onPress={handleCheckout} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  borrower: {
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
