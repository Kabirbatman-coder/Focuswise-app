import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Detect environment
const isDevelopment = __DEV__;

// Get local network IP - In development, you can override this
// For production, this would be your server URL
const getLocalIP = (): string => {
  // Check for Expo Constants first
  const expoHost = Constants.expoConfig?.hostUri;
  if (expoHost) {
    const ip = expoHost.split(':')[0];
    if (ip) return ip;
  }
  
  // Fallback to localhost for web, common local IP for mobile
  return Platform.OS === 'web' ? 'localhost' : '192.168.1.6';
};

// API Configuration
const LOCAL_IP = getLocalIP();
const DEV_PORT = 3000;
const PROD_API_URL = 'https://api.focuswise.app'; // Replace with actual production URL

export const API_CONFIG = {
  BASE_URL: isDevelopment 
    ? `http://${Platform.OS === 'web' ? 'localhost' : LOCAL_IP}:${DEV_PORT}`
    : PROD_API_URL,
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'FocusWise',
  VERSION: '1.0.0',
  
  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: '@focuswise_tokens',
    AUTH_USER: '@focuswise_user',
    CALENDAR_EVENTS: '@focuswise_calendar_events',
    ONBOARDING_COMPLETE: '@focuswise_onboarding_complete',
    ENERGY_PREFERENCES: '@focuswise_energy_prefs',
  },
  
  // Feature Flags
  FEATURES: {
    VOICE_INPUT: false, // Coming soon
    NATIVE_DISTRACTION_SHIELD: Platform.OS === 'android',
  },
};

// Google OAuth Configuration
export const GOOGLE_CONFIG = {
  CLIENT_ID_WEB: '919214418885-pf2ohdk52fburfhd9nt6ih3tvmt2dlfg.apps.googleusercontent.com',
  CLIENT_ID_ANDROID: '919214418885-r4tmdb0qrf5c6cnrj7hqc787aivjuuaj.apps.googleusercontent.com',
  SCOPES: [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
};

// Animation Durations
export const ANIMATION_CONFIG = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  SPRING: {
    damping: 15,
    stiffness: 150,
  },
};

// Focus Session Defaults
export const FOCUS_CONFIG = {
  DEFAULT_DURATION: 25, // minutes (Pomodoro)
  DURATION_OPTIONS: [15, 25, 45, 60, 90, 120],
  BREAK_DURATION: 5,
  LONG_BREAK_DURATION: 15,
};

// Energy Check-in Config
export const ENERGY_CONFIG = {
  LEVELS: [
    { level: 1, emoji: '😴', label: 'Very Low', color: '#6B7280', description: 'Need rest' },
    { level: 2, emoji: '😔', label: 'Low', color: '#EF4444', description: 'Feeling tired' },
    { level: 3, emoji: '😐', label: 'Moderate', color: '#F59E0B', description: 'Doing okay' },
    { level: 4, emoji: '😊', label: 'Good', color: '#10B981', description: 'Feeling productive' },
    { level: 5, emoji: '⚡', label: 'Peak', color: '#8B5CF6', description: 'Maximum energy!' },
  ],
  CHECK_IN_REMINDER_HOURS: [9, 12, 15, 18], // Remind at these hours
};

// Priority Config
export const PRIORITY_CONFIG = {
  high: {
    colors: ['#FF453A', '#FF6B6B'],
    icon: 'flame',
    label: 'High Priority',
  },
  medium: {
    colors: ['#FFD60A', '#FF9F0A'],
    icon: 'time',
    label: 'Medium Priority',
  },
  low: {
    colors: ['#30D158', '#34C759'],
    icon: 'leaf',
    label: 'Low Priority',
  },
};

// Export a helper function for API calls
export const getApiUrl = (endpoint: string): string => {
  const base = API_CONFIG.BASE_URL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

