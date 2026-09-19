import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthTextField } from '../../../components/AuthForm';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { isJoinNeedsForceError, joinHousehold } from '../../../lib/household';
import { spacing, useTheme } from '../../../lib/theme';

export default function JoinHouseholdScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const attemptJoin = async (force: boolean) => {
    setLoading(true);
    try {
      await joinHousehold(code, force);
      Alert.alert('Joined', 'You are now a member of that household.', [
        { text: 'OK', onPress: () => router.replace('/household') },
      ]);
    } catch (error) {
      if (!force && isJoinNeedsForceError(error)) {
        Alert.alert(
          'Leave your current library?',
          'Your current household has movies. Joining will abandon that library (empty households are deleted).',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Join anyway',
              style: 'destructive',
              onPress: () => {
                void attemptJoin(true);
              },
            },
          ],
        );
      } else {
        const message = error instanceof Error ? error.message : 'Could not join household.';
        Alert.alert('Join failed', message);
      }
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
            Enter the 6-character invite code from your household admin. You can only belong to one
            household.
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
          label="Join"
          onPress={() => attemptJoin(false)}
          loading={loading}
          disabled={code.trim().length < 4}
        />
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
