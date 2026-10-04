import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import { Contact, listContacts } from '../../../lib/contacts';
import {
  clearDeviceContact,
  planDeviceImport,
  prepareDeviceContact,
  stageDeviceContact,
} from '../../../lib/deviceContact';
import { finishDeviceContactImport, openDeviceContactForm } from '../../../lib/deviceContactFlow';
import { pickDeviceContactFields } from '../../../lib/deviceContactPicker';
import { errorMessage } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { isWriter } from '../../../lib/roles';
import { radius, spacing, useTheme } from '../../../lib/theme';
import { useToast } from '../../../lib/toast';

function contactLine(contact: Contact): string {
  const parts = [contact.email ?? 'No email'];
  if (contact.linkedUserId) parts.push('Account linked');
  if (contact.smsReminders) parts.push('SMS reminders on');
  return parts.join(' · ');
}

export default function ContactsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { household } = useHousehold();
  const writer = household ? isWriter(household.role) : false;
  const canImport = writer && Platform.OS !== 'web';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setContacts(await listContacts());
    } catch (error) {
      Alert.alert('Could not load contacts', errorMessage(error, 'Try again.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoaded.current);
      hasLoaded.current = true;
    }, [load]),
  );

  const addFromPhone = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const fields = await pickDeviceContactFields();
      if (!fields) return;
      const prepared = prepareDeviceContact(fields);
      const plan = planDeviceImport(prepared);
      if (plan.kind === 'choose') {
        stageDeviceContact(prepared);
        router.push('/contacts/from-phone');
        return;
      }
      if (plan.kind === 'form') {
        openDeviceContactForm(router, plan.draft, plan.held);
        return;
      }
      const outcome = await finishDeviceContactImport(plan.draft, router, showToast);
      if (outcome === 'saved') await load(true);
    } catch (error) {
      clearDeviceContact();
      Alert.alert('Could not open contacts', errorMessage(error, 'Allow contacts access, then try again.'));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {writer ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/contacts/edit')}
            accessibilityRole="button"
            accessibilityLabel="Add contact"
            style={styles.add}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Add contact</Text>
          </Pressable>
          {canImport ? (
            <Pressable
              onPress={() => void addFromPhone()}
              disabled={importing}
              accessibilityRole="button"
              accessibilityLabel="Add from phone"
              style={styles.add}
            >
              {importing ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Add from phone</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          message="Contacts are people outside this household. Checkout uses this list instead of a typed name."
        />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            writer ? null : (
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
  actions: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
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
