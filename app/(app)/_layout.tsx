import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { HouseholdProvider, useHousehold } from '../../lib/householdContext';
import { useTheme } from '../../lib/theme';

function AppNavigator() {
  const { household, loading } = useHousehold();
  const { colors } = useTheme();
  const segments = useSegments();
  const leaf = segments[segments.length - 1];
  const openWithoutHousehold = leaf === 'gate' || leaf === 'join' || leaf === 'settings';

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      {!household && !openWithoutHousehold ? <Redirect href="/household/gate" /> : null}
      {household && leaf === 'gate' ? <Redirect href="/" /> : null}
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
        <Stack.Screen name="edit-movie" options={{ title: 'Edit movie' }} />
        <Stack.Screen name="movie/[id]" options={{ title: '' }} />
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
        <Stack.Screen name="household/index" options={{ title: 'Household' }} />
        <Stack.Screen
          name="household/gate"
          options={{ title: 'Your household', headerBackVisible: false }}
        />
        <Stack.Screen name="household/join" options={{ title: 'Join Household' }} />
        <Stack.Screen name="household/confirm-departure" options={{ title: 'Before you leave' }} />
        <Stack.Screen name="loans" options={{ title: 'Loans' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="scan/index" options={{ title: 'Scan', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/confirm-book" options={{ title: 'Add Book' }} />
        <Stack.Screen name="scan/confirm-movie" options={{ title: 'Add Movie' }} />
        <Stack.Screen name="mtg/add" options={{ title: 'Add MTG Card', presentation: 'modal' }} />
        <Stack.Screen name="mtg/import" options={{ title: 'MTG Deck' }} />
        <Stack.Screen name="mtg/deck/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}

export default function AppLayout() {
  return (
    <HouseholdProvider>
      <AppNavigator />
    </HouseholdProvider>
  );
}
