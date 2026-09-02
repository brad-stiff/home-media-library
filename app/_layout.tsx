import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const { colors } = useTheme();
  const scheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
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
      </Stack>
    </GestureHandlerRootView>
  );
}
