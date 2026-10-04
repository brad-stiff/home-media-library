import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthTextField } from '../../components/AuthForm';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/household';
import { useHousehold } from '../../lib/householdContext';
import { useProfile } from '../../lib/profile';
import { spacing, useTheme } from '../../lib/theme';
import { useToast } from '../../lib/toast';

export default function AccountScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { user, updateEmail, updatePassword, deleteAccount } = useAuth();
  const { household } = useHousehold();
  const { profile, saveDisplayName } = useProfile();
  const [name, setName] = useState(profile.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(profile.displayName ?? '');
  }, [profile.displayName]);

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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Delete account</Text>
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
});
