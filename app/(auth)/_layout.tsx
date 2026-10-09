import { Stack } from 'expo-router';

import { HeaderBackButton } from '../../components/HeaderBackButton';
import { useTheme } from '../../lib/theme';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: ({ canGoBack, tintColor }) =>
          canGoBack ? <HeaderBackButton color={tintColor ?? colors.text} /> : null,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
    </Stack>
  );
}
