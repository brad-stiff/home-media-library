import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionMenu } from './ActionMenu';
import { ChevronIcon } from './icons';
import { Contact, listContacts } from '../lib/contacts';
import {
  Checkout,
  CheckoutItemType,
  cancelCheckout,
  checkoutItem,
  returnCheckout,
  updateCheckoutBorrower,
} from '../lib/checkouts';
import { errorMessage } from '../lib/household';
import { radius, spacing, useTheme } from '../lib/theme';
import { PrimaryButton } from './PrimaryButton';

type CheckoutPanelProps = {
  itemType: CheckoutItemType;
  itemId: string;
  activeCheckout: Checkout | null;
  onChanged: (next: Checkout | null) => void;
  canWrite: boolean;
  /** Movies need Blu-ray or 4K. Books are always lendable. */
  allowCheckout?: boolean;
  /** Household admin can hide checkout. Return and cancel stay available. */
  lendingEnabled?: boolean;
};

export function CheckoutPanel({
  itemType,
  itemId,
  activeCheckout,
  onChanged,
  canWrite,
  allowCheckout = true,
  lendingEnabled = true,
}: CheckoutPanelProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setContactId(activeCheckout?.contactId ?? null);
  }, [activeCheckout?.id, activeCheckout?.contactId]);

  useFocusEffect(
    useCallback(() => {
      if (!lendingEnabled || !canWrite) return undefined;
      let active = true;
      void listContacts()
        .then((rows) => {
          if (active) setContacts(rows);
        })
        .catch(() => {
          if (active) setContacts([]);
        });
      return () => {
        active = false;
      };
    }, [lendingEnabled, canWrite]),
  );

  const handleCheckout = async () => {
    if (!contactId) {
      Alert.alert('Contact required', 'Choose who is borrowing this item.');
      return;
    }

    setBusy(true);
    try {
      const row = await checkoutItem(itemType, itemId, contactId);
      onChanged(row);
      setContactId(null);
    } catch (error) {
      Alert.alert('Checkout failed', errorMessage(error, 'Could not check out.'));
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
            Alert.alert('Return failed', errorMessage(error, 'Could not return item.'));
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
              Alert.alert('Cancel failed', errorMessage(error, 'Could not cancel loan.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveBorrower = async () => {
    if (!activeCheckout || !contactId) return;
    setBusy(true);
    try {
      const row = await updateCheckoutBorrower(activeCheckout.id, contactId);
      onChanged(row);
    } catch (error) {
      Alert.alert('Update failed', errorMessage(error, 'Could not update borrower.'));
    } finally {
      setBusy(false);
    }
  };

  if (!lendingEnabled) {
    if (!activeCheckout) return null;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Checked out</Text>
        <Text style={[styles.borrower, { color: colors.text }]}>{activeCheckout.borrowerName}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Since {new Date(activeCheckout.checkedOutAt).toLocaleDateString()}
        </Text>
        {canWrite ? (
          <>
            <PrimaryButton label="Mark returned" onPress={handleReturn} loading={busy} />
            <PrimaryButton label="Cancel loan" onPress={handleCancelLoan} loading={busy} variant="danger" />
          </>
        ) : null}
      </View>
    );
  }

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
            <ContactChoices
              contacts={contacts}
              selectedId={contactId}
              onSelect={setContactId}
              onAdd={() => router.push('/contacts/edit')}
            />
            <PrimaryButton
              label="Save borrower"
              onPress={handleSaveBorrower}
              loading={busy}
              disabled={!contactId || contactId === activeCheckout.contactId}
            />
            <PrimaryButton label="Mark returned" onPress={handleReturn} loading={busy} />
            <PrimaryButton label="Cancel loan" onPress={handleCancelLoan} loading={busy} variant="danger" />
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
        Choose a contact outside this household. Their name is saved on the loan.
      </Text>
      <ContactChoices
        contacts={contacts}
        selectedId={contactId}
        onSelect={setContactId}
        onAdd={() => router.push('/contacts/edit')}
      />
      <PrimaryButton label="Check out" onPress={handleCheckout} loading={busy} disabled={!contactId} />
    </View>
  );
}

function ContactChoices({
  contacts,
  selectedId,
  onSelect,
  onAdd,
}: {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = contacts.find((contact) => contact.id === selectedId);

  return (
    <View style={styles.choices}>
      {contacts.length === 0 ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Add someone outside the household before lending.
        </Text>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={selected ? `Borrower, ${selected.name}` : 'Choose a borrower'}
          style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Text style={{ color: selected ? colors.text : colors.textSecondary, fontWeight: '600', flex: 1 }}>
            {selected?.name ?? 'Choose a borrower'}
          </Text>
          <ChevronIcon color={colors.textTertiary} />
        </Pressable>
      )}
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add contact" style={styles.add}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Add contact</Text>
      </Pressable>
      <ActionMenu
        title="Borrower"
        actions={
          open
            ? [
                ...contacts.map((contact) => ({
                  label: contact.name,
                  onPress: () => onSelect(contact.id),
                })),
                { label: 'Add contact', onPress: onAdd },
              ]
            : null
        }
        onClose={() => setOpen(false)}
      />
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
  choices: {
    gap: spacing.sm,
  },
  picker: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  add: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
