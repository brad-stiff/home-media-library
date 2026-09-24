import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthTextField } from '../../../components/AuthForm';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useHousehold } from '../../../lib/householdContext';
import { createHousehold, errorMessage, joinHousehold } from '../../../lib/household';
import { spacing, useTheme } from '../../../lib/theme';

export default function HouseholdGateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refresh } = useHousehold();
  const [name, setName] = useState('My Household');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createHousehold(name);
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err, 'Could not create household.'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      await joinHousehold(code, false);
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err, 'Could not join household.'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create or join</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your account is ready. Create a household to become its admin, or join one with an
            invite code as a viewer.
          </Text>
        </View>

        <AuthTextField label="Household name" value={name} onChangeText={setName} />
        <PrimaryButton
          label="Create household"
          onPress={handleCreate}
          loading={creating}
          disabled={joining || name.trim().length < 1}
        />

        <Text style={[styles.or, { color: colors.textTertiary }]}>or</Text>

        <AuthTextField
          label="Invite code"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="ABC123"
        />
        <PrimaryButton
          label="Join with code"
          onPress={handleJoin}
          loading={joining}
          disabled={creating || code.trim().length < 4}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <PrimaryButton label="Settings" onPress={() => router.push('/settings')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  or: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 15,
    lineHeight: 20,
  },
});
