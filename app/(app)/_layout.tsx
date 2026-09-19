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
      <Stack.Screen name="index" options={{ title: 'My Library' }} />
      <Stack.Screen name="add" options={{ title: 'Add Movie', presentation: 'modal' }} />
      <Stack.Screen name="add-book" options={{ title: 'Add Book', presentation: 'modal' }} />
      <Stack.Screen name="movie/[id]" options={{ title: '' }} />
      <Stack.Screen name="book/[id]" options={{ title: '' }} />
      <Stack.Screen name="household/index" options={{ title: 'Household' }} />
      <Stack.Screen name="household/join" options={{ title: 'Join Household' }} />
      <Stack.Screen name="scan/index" options={{ title: 'Scan', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="scan/confirm-book" options={{ title: 'Add Book' }} />
      <Stack.Screen name="scan/confirm-movie" options={{ title: 'Add Movie' }} />
      <Stack.Screen name="mtg/add" options={{ title: 'Add MTG Card', presentation: 'modal' }} />
      <Stack.Screen name="mtg/import" options={{ title: 'MTG Deck' }} />
      <Stack.Screen name="mtg/deck/[id]" options={{ title: '' }} />
    </Stack>
  );
}
