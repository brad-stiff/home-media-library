import { useEffect, useState } from 'react';
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
  cancelCheckout,
  checkoutItem,
  returnCheckout,
  updateCheckoutBorrower,
} from '../lib/checkouts';
import { radius, spacing, useTheme } from '../lib/theme';

type CheckoutPanelProps = {
  itemType: CheckoutItemType;
  itemId: string;
  activeCheckout: Checkout | null;
  onChanged: (next: Checkout | null) => void;
  canWrite: boolean;
  /** Movies need Blu-ray or 4K. Books are always lendable. */
  allowCheckout?: boolean;
};

export function CheckoutPanel({
  itemType,
  itemId,
  activeCheckout,
  onChanged,
  canWrite,
  allowCheckout = true,
}: CheckoutPanelProps) {
  const { colors } = useTheme();
  const [borrower, setBorrower] = useState('');
  const [borrowerDraft, setBorrowerDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBorrowerDraft(activeCheckout?.borrowerName ?? '');
  }, [activeCheckout?.id, activeCheckout?.borrowerName]);

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

  const handleCancelLoan = () => {
    if (!activeCheckout) return;
    Alert.alert(
      'Cancel this loan?',
      'The item becomes available. The loan stays in history as cancelled.',
      [
        { text: 'Keep loan', style: 'cancel' },
        {
          text: 'Cancel loan',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await cancelCheckout(activeCheckout.id);
              onChanged(null);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Could not cancel loan.';
              Alert.alert('Cancel failed', message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveBorrower = async () => {
    if (!activeCheckout) return;
    if (!borrowerDraft.trim()) {
      Alert.alert('Borrower required', 'Enter who is borrowing this item.');
      return;
    }
    setBusy(true);
    try {
      const row = await updateCheckoutBorrower(activeCheckout.id, borrowerDraft);
      onChanged(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update borrower.';
      Alert.alert('Update failed', message);
    } finally {
      setBusy(false);
    }
  };

  if (activeCheckout) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Checked out</Text>
        <Text style={[styles.borrower, { color: colors.text }]}>{activeCheckout.borrowerName}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Since {new Date(activeCheckout.checkedOutAt).toLocaleDateString()}
        </Text>
        {canWrite ? (
          <>
            <TextInput
              value={borrowerDraft}
              onChangeText={setBorrowerDraft}
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
            <PrimaryButton
              label="Save borrower"
              onPress={handleSaveBorrower}
              loading={busy}
              disabled={borrowerDraft.trim() === activeCheckout.borrowerName}
            />
            <PrimaryButton label="Mark returned" onPress={handleReturn} loading={busy} />
            <PrimaryButton
              label="Cancel loan"
              onPress={handleCancelLoan}
              loading={busy}
              variant="danger"
            />
          </>
        ) : null}
      </View>
    );
  }

  if (!allowCheckout) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Lending</Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          Digital-only movies cannot be checked out. A Blu-ray or 4K copy can be lent.
        </Text>
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
