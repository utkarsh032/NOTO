import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useThemeColors } from '../src/theme';

/**
 * The native shell is one screen deep.
 *
 * Noto's navigation — Home, Documents, Search, Memory, Settings, Account and
 * the workspace editor — belongs to the interface inside the WebView, which
 * routes on the URL hash and draws its own header and navigation. A native
 * stack on top of that would be a second, disagreeing set of chrome.
 */
export default function RootLayout() {
  const colors = useThemeColors();
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      {/* Drawn over the interface, which paints its own background up to the
          status bar; only the icons are ours. The bar is already translucent —
          `edgeToEdgeEnabled` in app.json is what puts the page underneath it. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
