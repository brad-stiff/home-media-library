import { Stack } from 'expo-router';

import { useTheme } from '../../lib/theme';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'My Movies' }} />
      <Stack.Screen name="add" options={{ title: 'Add Movie', presentation: 'modal' }} />
      <Stack.Screen name="movie/[id]" options={{ title: '' }} />
      <Stack.Screen name="household/index" options={{ title: 'Household' }} />
      <Stack.Screen name="household/join" options={{ title: 'Join Household' }} />
    </Stack>
  );
}
