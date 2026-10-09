import { Redirect, Stack, useSegments } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HeaderBackButton } from '../../components/HeaderBackButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { HouseholdProvider, useHousehold } from '../../lib/householdContext';
import { spacing, typeScale, useTheme } from '../../lib/theme';

function AppNavigator() {
  const { household, loading, error, refresh } = useHousehold();
  const { colors } = useTheme();
  const segments = useSegments();
  const [retrying, setRetrying] = useState(false);
  const leaf = segments[segments.length - 1];
  const openWithoutHousehold =
    leaf === 'gate' || leaf === 'join' || leaf === 'settings' || leaf === 'account' || leaf === 'about';

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error && !household) {
    return (
      <View style={[styles.blocked, { backgroundColor: colors.background }]}>
        <Text style={[typeScale.title, styles.blockedTitle, { color: colors.text }]}>
          Could not load your household
        </Text>
        <Text style={[typeScale.body, styles.blockedBody, { color: colors.textSecondary }]}>{error}</Text>
        <PrimaryButton
          label="Try again"
          loading={retrying}
          onPress={() => {
            setRetrying(true);
            void refresh().finally(() => setRetrying(false));
          }}
        />
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
          headerBackButtonDisplayMode: 'minimal',
          headerLeft: ({ canGoBack, tintColor }) =>
            canGoBack ? <HeaderBackButton color={tintColor ?? colors.text} /> : null,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Alcove' }} />
        <Stack.Screen name="add" options={{ title: 'Add movie', presentation: 'modal' }} />
        <Stack.Screen name="add-book" options={{ title: 'Add book', presentation: 'modal' }} />
        <Stack.Screen name="edit-movie" options={{ title: 'Edit movie' }} />
        <Stack.Screen name="movie/[id]" options={{ title: '' }} />
        <Stack.Screen name="book/[id]" options={{ title: '' }} />
        <Stack.Screen name="household/index" options={{ title: 'Household' }} />
        <Stack.Screen
          name="household/gate"
          options={{ title: 'Your household', headerBackVisible: false, headerLeft: () => null }}
        />
        <Stack.Screen name="household/join" options={{ title: 'Join household' }} />
        <Stack.Screen name="household/confirm-departure" options={{ title: 'Before you leave' }} />
        <Stack.Screen name="contacts/index" options={{ title: 'Contacts' }} />
        <Stack.Screen name="contacts/edit" options={{ title: 'Contact' }} />
        <Stack.Screen name="contacts/from-phone" options={{ title: 'From your phone' }} />
        <Stack.Screen name="loans" options={{ title: 'Loans' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="scan/index" options={{ title: 'Scan', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/confirm-book" options={{ title: 'Add book' }} />
        <Stack.Screen name="scan/confirm-movie" options={{ title: 'Add movie' }} />
        <Stack.Screen name="mtg/add" options={{ title: 'Add MTG card', presentation: 'modal' }} />
        <Stack.Screen name="mtg/import" options={{ title: 'MTG deck' }} />
        <Stack.Screen name="mtg/card/[id]" options={{ title: '' }} />
        <Stack.Screen name="mtg/deck-add" options={{ title: 'Add to deck', presentation: 'modal' }} />
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

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  blockedTitle: {
    textAlign: 'center',
  },
  blockedBody: {
    textAlign: 'center',
  },
});
