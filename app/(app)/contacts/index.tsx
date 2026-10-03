import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import { Contact, listContacts } from '../../../lib/contacts';
import { errorMessage } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { isWriter } from '../../../lib/roles';
import { radius, spacing, useTheme } from '../../../lib/theme';

function contactLine(contact: Contact): string {
  const parts = [contact.email ?? 'No email'];
  if (contact.linkedUserId) parts.push('Account linked');
  if (contact.smsReminders) parts.push('SMS reminders on');
  return parts.join(' · ');
}

export default function ContactsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { household } = useHousehold();
  const writer = household ? isWriter(household.role) : false;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await listContacts());
    } catch (error) {
      Alert.alert('Could not load contacts', errorMessage(error, 'Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          message="Contacts are people outside this household. Checkout uses this list instead of a typed name."
          action={writer ? { label: 'Add contact', onPress: () => router.push('/contacts/edit') } : undefined}
        />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            writer ? (
              <Pressable
                onPress={() => router.push('/contacts/edit')}
                accessibilityRole="button"
                accessibilityLabel="Add contact"
                style={styles.add}
              >
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Add contact</Text>
              </Pressable>
            ) : (
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                Viewers can see contacts. Members and admins can change them.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/contacts/edit?id=${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{contactLine(item)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  add: { minHeight: 44, justifyContent: 'center' },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    minHeight: 44,
  },
  name: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 14, lineHeight: 20 },
});
