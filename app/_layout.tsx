import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '../lib/auth';
import { ProfileProvider } from '../lib/profile';
import { useTheme } from '../lib/theme';
import { ToastProvider } from '../lib/toast';

function RootNavigator() {
  const { session, isReady } = useAuth();
  const { colors, isDark } = useTheme();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function ThemedApp() {
  const { colors } = useTheme();

  return (
    <ToastProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <RootNavigator />
      </View>
    </ToastProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProfileProvider>
          <ThemedApp />
        </ProfileProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
