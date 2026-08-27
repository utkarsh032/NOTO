import { APP_NAME, typeScale } from '@noto/config';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { NotoStoreProvider } from '../src/hooks/use-noto-store';
import { useThemeColors } from '../src/theme';

export default function RootLayout() {
  const colors = useThemeColors();
  const scheme = useColorScheme();

  return (
    <NotoStoreProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: typeScale.h4.fontWeight },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: APP_NAME }} />
        <Stack.Screen name="document/[id]" options={{ title: 'Document' }} />
      </Stack>
    </NotoStoreProvider>
  );
}
