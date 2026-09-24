import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { AuthTextField } from '../../components/AuthForm';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../lib/auth';
import { API_CREDITS } from '../../lib/credits';
import {
  errorMessage,
  setHouseholdMedia,
} from '../../lib/household';
import { useHousehold } from '../../lib/householdContext';
import {
  householdShows,
  MediaType,
  useProfile,
} from '../../lib/profile';
import { shareLibraryBackup } from '../../lib/shareBackup';
import { AppearancePreference } from '../../lib/appearanceContext';
import { radius, spacing, useTheme } from '../../lib/theme';
import { useToast } from '../../lib/toast';

const APPEARANCE_OPTIONS: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const MEDIA: { id: MediaType; label: string }[] = [
  { id: 'movies', label: 'Movies' },
  { id: 'books', label: 'Books' },
  { id: 'mtg', label: 'MTG' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { user, updateEmail, updatePassword, deleteAccount } = useAuth();
  const { household, refresh: refreshHousehold } = useHousehold();
  const { profile, saveDisplayName, saveAppearance, savePersonalHide } = useProfile();
  const [name, setName] = useState(profile.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(profile.displayName ?? '');
  }, [profile.displayName]);

  const isAdmin = household?.role === 'admin';

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await saveDisplayName(name);
      showToast('Display name saved');
    } catch (error) {
      Alert.alert('Could not save name', errorMessage(error, 'Try again.'));
    } finally {
      setSavingName(false);
    }
  };

  const handleAppearance = async (appearance: AppearancePreference) => {
    if (appearance === profile.appearance) return;
    try {
      await saveAppearance(appearance);
    } catch (error) {
      Alert.alert('Could not save appearance', errorMessage(error, 'Try again.'));
    }
  };

  const personalHide = {
    hideMovies: profile.hideMovies,
    hideBooks: profile.hideBooks,
    hideMtg: profile.hideMtg,
  };

  const handlePersonalToggle = async (type: MediaType, shown: boolean) => {
    const next = { ...personalHide };
    if (type === 'movies') next.hideMovies = !shown;
    if (type === 'books') next.hideBooks = !shown;
    if (type === 'mtg') next.hideMtg = !shown;
    try {
      await savePersonalHide(next);
    } catch (error) {
      Alert.alert('Could not update your tabs', errorMessage(error, 'Try again.'));
    }
  };

  const handleHouseholdToggle = async (type: MediaType, shown: boolean) => {
    if (!household || !isAdmin) return;
    const shows = {
      movies: household.showMovies,
      books: household.showBooks,
      mtg: household.showMtg,
    };
    shows[type] = shown;
    try {
      await setHouseholdMedia(shows);
      await refreshHousehold();
    } catch (error) {
      Alert.alert('Could not update the household', errorMessage(error, 'Try again.'));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const shared = await shareLibraryBackup();
      if (Platform.OS === 'ios') {
        if (shared) showToast('Library backup shared');
      } else {
        showToast('Library backup ready');
      }
    } catch (error) {
      Alert.alert('Could not export', errorMessage(error, 'Try again.'));
    } finally {
      setExporting(false);
    }
  };

  const handleEmail = async () => {
    if (!email.trim()) {
      showToast('Enter a new email.', 'error');
      return;
    }
    setSavingEmail(true);
    try {
      await updateEmail(email);
      setEmail('');
      showToast('Check the new email to confirm the change');
    } catch (error) {
      Alert.alert('Could not change email', errorMessage(error, 'Try again.'));
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePassword = async () => {
    if (password.length < 6) {
      showToast('Use at least 6 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Enter the same password in both fields.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      showToast('Password updated');
    } catch (error) {
      Alert.alert('Could not change password', errorMessage(error, 'Try again.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = () => {
    if (household) {
      Alert.alert(
        'Leave your household first',
        'Account deletion is available after you leave. If you are the only admin, transfer admin before leaving. If you are the last member, leaving asks you to save a backup and then deletes the household.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave household',
            onPress: () => router.push('/household/confirm-departure?intent=leave'),
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Delete account?',
      'This removes your login. Items you added stay in any former household and show Deleted account. You cannot sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void (async () => {
              try {
                await deleteAccount();
              } catch (error) {
                setDeleting(false);
                Alert.alert('Could not delete account', errorMessage(error, 'Try again.'));
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Display name</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Shown on the household member list.
          </Text>
          <AuthTextField
            label="Name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            maxLength={80}
          />
          <PrimaryButton
            label="Save name"
            onPress={handleSaveName}
            loading={savingName}
            disabled={name.trim() === (profile.displayName ?? '').trim() || name.trim().length < 1}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Appearance</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Saved on your account. System follows this phone.
          </Text>
          <View style={styles.choices}>
            {APPEARANCE_OPTIONS.map((option) => {
              const active = profile.appearance === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => void handleAppearance(option.id)}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: active ? colors.accentMuted : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '700' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Your tabs</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Hide a type from your library. Other people still see it, and active loans stay on the
            Loans list.
          </Text>
          {household ? (
            MEDIA.map((type) => {
              const available = householdShows(household, type.id);
              const shown = available && (
                type.id === 'movies'
                  ? !profile.hideMovies
                  : type.id === 'books'
                    ? !profile.hideBooks
                    : !profile.hideMtg
              );
              return (
                <View
                  key={type.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{type.label}</Text>
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                      {available ? 'Shown in your library' : 'Off for the household'}
                    </Text>
                  </View>
                  <Switch
                    value={shown}
                    disabled={!available}
                    onValueChange={(value) => void handlePersonalToggle(type.id, value)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
              );
            })
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Create or join a household to choose which tabs you see.
            </Text>
          )}
        </View>

        {isAdmin && household ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Household library</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Turning a type off hides its tab and add buttons for everyone. The catalog stays.
            </Text>
            {MEDIA.map((type) => {
              const shown = householdShows(household, type.id);
              return (
                <View
                  key={type.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{type.label}</Text>
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                      {shown ? 'Available to the household' : 'Hidden for everyone'}
                    </Text>
                  </View>
                  <Switch
                    value={shown}
                    onValueChange={(value) => void handleHouseholdToggle(type.id, value)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>About</Text>
          {API_CREDITS.map((credit) => (
            <View key={credit.id} style={styles.credit}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{credit.name}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{credit.notice}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Export library</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Share a JSON backup of movies, books, MTG cards, decks, and checkouts. Sharing the file
            leaves the household in place.
          </Text>
          <PrimaryButton
            label="Export library"
            onPress={handleExport}
            loading={exporting}
            disabled={!household}
          />
          {!household ? (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Join a household to export its library.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {user?.email ?? 'Signed in'}
          </Text>
          <AuthTextField
            label="New email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <PrimaryButton
            label="Change email"
            onPress={handleEmail}
            loading={savingEmail}
            disabled={email.trim().length < 3}
          />
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            A confirmation link goes to the new address. The email changes after you open it.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <AuthTextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <AuthTextField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <PrimaryButton
            label="Change password"
            onPress={handlePassword}
            loading={savingPassword}
            disabled={password.length < 6 || confirmPassword.length < 6}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Account</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {household
              ? 'Leave the household before deleting this login. Items you added stay behind and show Deleted account.'
              : 'This login is not in a household. Deleting it is permanent.'}
          </Text>
          <PrimaryButton
            label="Delete account"
            onPress={handleDelete}
            loading={deleting}
            variant="danger"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  credit: {
    gap: 2,
  },
});
