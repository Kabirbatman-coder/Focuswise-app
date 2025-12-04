import { DarkTheme, ThemeProvider, Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { AIOverlayProvider } from '@/context/AIOverlayContext';
import { AuthProvider } from '@/context/AuthContext';
import { AICommandOverlay } from '@/components/AICommandOverlay';

const FocusWiseTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background.primary,
    card: Colors.background.secondary,
    text: Colors.text.primary,
    border: Colors.background.tertiary,
    notification: Colors.status.distraction,
    primary: Colors.ai_chief.active_ring,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={FocusWiseTheme}>
      <AuthProvider>
        <AIOverlayProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <AICommandOverlay />
          <StatusBar style="light" />
        </AIOverlayProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

