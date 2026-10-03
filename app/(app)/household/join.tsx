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
import { errorMessage, isInviteCodeReady, joinHousehold, normalizeInviteCode } from '../../../lib/household';
import { spacing, useTheme } from '../../../lib/theme';

export default function JoinHouseholdScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { household, refresh } = useHousehold();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const normalized = normalizeInviteCode(code);
    if (household) {
      router.push({
        pathname: '/household/confirm-departure',
        params: { intent: 'join', code: normalized },
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinHousehold(normalized, false);
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err, 'Could not join household.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Join household</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the invite code from a household admin. You join as a viewer, and you can only
            belong to one household.
          </Text>
        </View>

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
          label={household ? 'Continue' : 'Join'}
          onPress={handleJoin}
          loading={loading}
          disabled={!isInviteCodeReady(code)}
        />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
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
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
});
