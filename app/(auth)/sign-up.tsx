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

import { AuthLink, AuthTextField } from '../../components/AuthForm';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuth } from '../../lib/auth';
import { spacing, useTheme } from '../../lib/theme';
import { useToast } from '../../lib/toast';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      showToast('Enter an email and password.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Use at least 6 characters.', 'error');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, displayName);
      showToast('Account created');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create account.';
      showToast(message, 'error');
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
          <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            After this you will create a household or join one with an invite code.
          </Text>
        </View>

        <AuthTextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          textContentType="name"
        />
        <AuthTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <AuthTextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <PrimaryButton label="Create Account" onPress={handleSignUp} loading={loading} />

        <AuthLink
          label="Already have an account? Sign in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
});
