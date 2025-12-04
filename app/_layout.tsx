import { useEffect, useState, useCallback } from 'react';
import { DarkTheme, ThemeProvider, Theme } from '@react-navigation/native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { APP_CONFIG } from '@/constants/config';
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
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.ONBOARDING_COMPLETE);
        console.log('[Layout] Onboarding completed:', completed);
        
        if (completed === 'true') {
          setInitialRoute('(tabs)');
        } else {
          setInitialRoute('onboarding');
        }
      } catch (error) {
        console.error('[Layout] Error checking onboarding:', error);
        setInitialRoute('(tabs)'); // Default to main app on error
      } finally {
        setIsReady(true);
      }
    };
    
    checkOnboarding();
  }, []);

  // Navigate after root navigation is ready
  useEffect(() => {
    if (!isReady || !initialRoute || !rootNavigationState?.key) return;
    
    // Only navigate on initial load
    if (initialRoute === 'onboarding') {
      router.replace('/onboarding');
    }
    // If initialRoute is (tabs), expo-router will handle it via initialRouteName
  }, [isReady, initialRoute, rootNavigationState?.key, router]);

  // Show nothing while checking
  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={FocusWiseTheme}>
      <AuthProvider>
        <AIOverlayProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="focus" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <AICommandOverlay />
          <StatusBar style="light" />
        </AIOverlayProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

