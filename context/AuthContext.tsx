import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = '@focuswise_tokens';
const AUTH_USER_KEY = '@focuswise_user';
const CALENDAR_EVENTS_KEY = '@focuswise_calendar_events';

// Your Google OAuth credentials
const GOOGLE_CLIENT_ID_WEB = '919214418885-pf2ohdk52fburfhd9nt6ih3tvmt2dlfg.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_ANDROID = '919214418885-r4tmdb0qrf5c6cnrj7hqc787aivjuuaj.apps.googleusercontent.com';

// Google OAuth endpoints (for web fallback)
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Configure Google Sign-In for native platforms
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID_WEB, // Required for getting access token
    offlineAccess: true,
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

interface AuthContextType {
  user: any;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncCalendar: () => Promise<CalendarEvent[]>;
  calendarEvents: CalendarEvent[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Auto sync calendar every 30 minutes
  useEffect(() => {
    if (accessToken && user) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      
      syncIntervalRef.current = setInterval(() => {
        console.log('[Auth] Auto-syncing calendar...');
        syncCalendar();
      }, 30 * 60 * 1000);
    }
    
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [accessToken, user]);

  const loadStoredAuth = async () => {
    try {
      console.log('[Auth] Loading stored credentials...');
      const storedTokens = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
      const storedEvents = await AsyncStorage.getItem(CALENDAR_EVENTS_KEY);
      
      if (storedTokens && storedUser) {
        const tokens = JSON.parse(storedTokens);
        const userData = JSON.parse(storedUser);
        
        console.log('[Auth] Found stored credentials for:', userData.email);
        setAccessToken(tokens.accessToken);
        setUser(userData);
        
        if (storedEvents) {
          setCalendarEvents(JSON.parse(storedEvents));
        }
        
        // Try to refresh token for native platforms
        if (Platform.OS !== 'web') {
          try {
            const currentUser = await GoogleSignin.getCurrentUser();
            if (currentUser) {
              const tokens = await GoogleSignin.getTokens();
              if (tokens.accessToken) {
                setAccessToken(tokens.accessToken);
                await AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({ accessToken: tokens.accessToken }));
              }
            }
          } catch (e) {
            console.log('[Auth] Could not refresh native token');
          }
        }
        
        // Try to sync calendar
        try {
          await syncCalendarWithToken(tokens.accessToken);
        } catch (e) {
          console.log('[Auth] Token may be expired, user should re-authenticate');
        }
      }
    } catch (error) {
      console.error('[Auth] Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async (token: string, userInfo?: any) => {
    try {
      setAccessToken(token);
      
      let finalUserInfo = userInfo;
      
      // Fetch user info if not provided
      if (!finalUserInfo) {
        console.log('[Auth] Fetching user info from Google...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }
        
        finalUserInfo = await userInfoResponse.json();
      }
      
      console.log('[Auth] ✅ User authenticated:', finalUserInfo.email);
      
      setUser(finalUserInfo);
      
      // Store credentials
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({ accessToken: token }));
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(finalUserInfo));
      
      // Sync calendar immediately
      await syncCalendarWithToken(token);
      
      Alert.alert('Success!', `Signed in as ${finalUserInfo.email}`);
    } catch (error: any) {
      console.error('[Auth] Error handling auth success:', error);
      Alert.alert('Error', 'Failed to complete authentication');
    }
  };

  const syncCalendarWithToken = async (token: string): Promise<CalendarEvent[]> => {
    try {
      console.log('[Auth] Fetching calendar events from Google...');
      
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);
      
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&` +
        `timeMax=${nextMonth.toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime&` +
        `maxResults=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Calendar API error:', response.status, errorText);
        
        if (response.status === 401) {
          console.log('[Auth] Token expired, need to re-authenticate');
          throw new Error('Token expired');
        }
        throw new Error('Failed to fetch calendar');
      }
      
      const data = await response.json();
      const events: CalendarEvent[] = data.items || [];
      
      console.log('[Auth] ✅ Fetched', events.length, 'calendar events');
      
      setCalendarEvents(events);
      await AsyncStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(events));
      
      return events;
    } catch (error) {
      console.error('[Auth] Calendar sync error:', error);
      throw error;
    }
  };

  // Native sign-in using Google Sign-In SDK
  const signInNative = async (): Promise<void> => {
    try {
      console.log('[Auth] Starting native Google sign-in...');
      
      // Check if already signed in
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        await GoogleSignin.signOut();
      }
      
      // Check for Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign in
      const signInResult = await GoogleSignin.signIn();
      console.log('[Auth] Sign in result:', signInResult.type);
      
      if (signInResult.type === 'success' && signInResult.data) {
        // Get access token
        const tokens = await GoogleSignin.getTokens();
        
        if (tokens.accessToken) {
          console.log('[Auth] ✅ Got native access token!');
          
          const userInfo = {
            id: signInResult.data.user.id,
            email: signInResult.data.user.email,
            name: signInResult.data.user.name,
            given_name: signInResult.data.user.givenName,
            family_name: signInResult.data.user.familyName,
            picture: signInResult.data.user.photo,
          };
          
          await handleAuthSuccess(tokens.accessToken, userInfo);
        } else {
          throw new Error('No access token received');
        }
      } else {
        console.log('[Auth] Sign in cancelled or failed');
      }
    } catch (error: any) {
      console.error('[Auth] Native sign in error:', error);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[Auth] User cancelled sign in');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services is not available');
      } else {
        Alert.alert('Error', error.message || 'Sign in failed');
      }
    }
  };

  // Web sign-in using WebBrowser
  const signInWeb = async (): Promise<void> => {
    try {
      console.log('[Auth] Starting web Google sign-in...');
      
      const redirectUri = 'http://localhost:8081';
      
      const scopes = [
        'openid',
        'profile', 
        'email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ];
      
      const authUrl = 
        `${discovery.authorizationEndpoint}?` +
        `client_id=${GOOGLE_CLIENT_ID_WEB}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scopes.join(' '))}&` +
        `include_granted_scopes=true&` +
        `prompt=consent`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      
      if (result.type === 'success' && result.url) {
        const url = result.url;
        let extractedToken: string | null = null;
        
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          const params = new URLSearchParams(fragment);
          extractedToken = params.get('access_token');
        }
        
        if (extractedToken) {
          console.log('[Auth] ✅ Got web access token!');
          await handleAuthSuccess(extractedToken);
        } else {
          Alert.alert('Error', 'Failed to get access token');
        }
      }
    } catch (error: any) {
      console.error('[Auth] Web sign in error:', error);
      Alert.alert('Error', error.message || 'Sign in failed');
    }
  };

  const signIn = async (): Promise<void> => {
    console.log('[Auth] Starting sign-in for platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      await signInWeb();
    } else {
      await signInNative();
    }
  };

  const signOut = async (): Promise<void> => {
    console.log('[Auth] Signing out...');
    
    // Sign out from Google on native
    if (Platform.OS !== 'web') {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        console.log('[Auth] Error signing out from Google:', e);
      }
    }
    
    setUser(null);
    setAccessToken(null);
    setCalendarEvents([]);
    
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    await AsyncStorage.removeItem(CALENDAR_EVENTS_KEY);
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  };

  const syncCalendar = async (): Promise<CalendarEvent[]> => {
    if (!accessToken) {
      console.warn('[Auth] Cannot sync: no access token');
      return [];
    }
    
    // Try to get fresh token on native
    if (Platform.OS !== 'web') {
      try {
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          const tokens = await GoogleSignin.getTokens();
          if (tokens.accessToken && tokens.accessToken !== accessToken) {
            setAccessToken(tokens.accessToken);
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({ accessToken: tokens.accessToken }));
            return await syncCalendarWithToken(tokens.accessToken);
          }
        }
      } catch (e) {
        console.log('[Auth] Could not refresh token');
      }
    }
    
    try {
      return await syncCalendarWithToken(accessToken);
    } catch (error: any) {
      if (error.message === 'Token expired') {
        Alert.alert(
          'Session Expired',
          'Please sign in again to refresh your calendar.',
          [{ text: 'Sign In', onPress: signIn }]
        );
      }
      return calendarEvents;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        signIn,
        signOut,
        syncCalendar,
        calendarEvents,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
