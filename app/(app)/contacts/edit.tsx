import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { AuthTextField } from '../../../components/AuthForm';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { appInviteMessage, normalizeContactDraft } from '../../../lib/contactRules';
import {
  Contact,
  deleteContact,
  getContact,
  markContactAppInvite,
  saveContact,
} from '../../../lib/contacts';
import { errorMessage } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { isWriter } from '../../../lib/roles';
import { radius, spacing, useTheme } from '../../../lib/theme';
import { useToast } from '../../../lib/toast';

export default function ContactEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const contactId = typeof id === 'string' ? id : null;
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { household } = useHousehold();
  const writer = household ? isWriter(household.role) : false;
  const [loading, setLoading] = useState(Boolean(contactId));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState(false);
  const [saved, setSaved] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!contactId) return;
    let active = true;
    void (async () => {
      try {
        const contact = await getContact(contactId);
        if (!active) return;
        if (!contact) {
          Alert.alert('Contact not found', 'It may have been deleted.');
          router.back();
          return;
        }
        setSaved(contact);
        setName(contact.name);
        setEmail(contact.email ?? '');
        setPhone(contact.phone ?? '');
        setSms(contact.smsReminders);
      } catch (error) {
        if (active) Alert.alert('Could not load contact', errorMessage(error, 'Try again.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [contactId, router]);

  const normalized = normalizeContactDraft({ name, email, phone, smsReminders: sms });
  const draftEmail = 'value' in normalized ? normalized.value.email : null;
  const savedEmail = saved?.email ?? null;
  const canInvite = writer && Boolean(saved) && draftEmail != null && draftEmail === savedEmail;

  const handleSave = async () => {
    if (!writer) return;
    if ('error' in normalized) {
      Alert.alert('Check the contact', normalized.error);
      return;
    }
    setSaving(true);
    try {
      const next = await saveContact(saved?.id ?? null, {
        name,
        email,
        phone,
        smsReminders: sms,
      });
      setSaved(next);
      setName(next.name);
      setEmail(next.email ?? '');
      setPhone(next.phone ?? '');
      setSms(next.smsReminders);
      showToast(next.linkedUserId ? 'Contact saved and linked to an account' : 'Contact saved');
    } catch (error) {
      Alert.alert('Could not save contact', errorMessage(error, 'Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!saved) return;
    Alert.alert(
      'Delete contact?',
      `${saved.name} will be removed. Past loans keep the name saved on them. Active loans must be returned or cancelled first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void (async () => {
              try {
                await deleteContact(saved.id);
                router.back();
              } catch (error) {
                setDeleting(false);
                Alert.alert('Could not delete contact', errorMessage(error, 'Try again.'));
              }
            })();
          },
        },
      ],
    );
  };

  const handleInvite = async () => {
    if (!saved || !draftEmail) return;
    setInviting(true);
    try {
      const result = await Share.share({ message: appInviteMessage(draftEmail) });
      const shared = Platform.OS !== 'ios' || result.action === Share.sharedAction;
      if (shared) {
        const next = await markContactAppInvite(saved.id);
        setSaved(next);
        showToast('Account invite shared');
      }
    } catch (error) {
      Alert.alert('Could not share invite', errorMessage(error, 'Try again.'));
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const linkNote = saved?.linkedUserId
    ? 'Linked to an account outside this household. Saving a different email looks up that address again.'
    : saved?.email
      ? 'No account uses this email yet. An invite asks them to create one. It does not add them to this household.'
      : 'Email is optional. When you save one, the app links an existing account only if that exact address matches.';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: saved ? saved.name : 'New contact' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Name is required. Phone and email are optional. SMS reminders stay off until you turn them on.
        </Text>
        <AuthTextField
          label="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          editable={writer}
          maxLength={80}
        />
        <AuthTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={writer}
        />
        <AuthTextField
          label="Phone"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (!value.trim()) setSms(false);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={writer}
        />
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>SMS reminders</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {phone.trim()
                ? 'Off unless you opt this contact in. Due-date texts wait for a later phase.'
                : 'Add a phone number before opting in.'}
            </Text>
          </View>
          <Switch
            value={sms}
            disabled={!writer || !phone.trim()}
            onValueChange={setSms}
            trackColor={{ true: colors.accent, false: colors.border }}
            accessibilityLabel="SMS reminders"
          />
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{linkNote}</Text>
        {saved?.appInvitedAt ? (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Account invite shared {new Date(saved.appInvitedAt).toLocaleDateString()}.
          </Text>
        ) : null}
        {writer ? (
          <>
            <PrimaryButton label="Save contact" onPress={handleSave} loading={saving} />
            <PrimaryButton
              label="Invite to create an account"
              onPress={handleInvite}
              loading={inviting}
              disabled={!canInvite}
            />
            {!canInvite ? (
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                Save an email on this contact before sharing an account invite.
              </Text>
            ) : null}
            {saved ? (
              <PrimaryButton label="Delete contact" onPress={handleDelete} loading={deleting} variant="danger" />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  hint: { fontSize: 14, lineHeight: 20 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
});
