import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = '@focuswise_tokens';
const AUTH_USER_KEY = '@focuswise_user';
const CALENDAR_EVENTS_KEY = '@focuswise_calendar_events';

// Your Google OAuth credentials
const GOOGLE_CLIENT_ID_WEB = '919214418885-pf2ohdk52fburfhd9nt6ih3tvmt2dlfg.apps.googleusercontent.com';

// Google OAuth endpoints
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

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
        
        // Try to refresh/validate by fetching calendar
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

  const handleAuthSuccess = async (token: string) => {
    try {
      setAccessToken(token);
      
      // Fetch user info directly from Google
      console.log('[Auth] Fetching user info from Google...');
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      const userInfo = await userInfoResponse.json();
      console.log('[Auth] ✅ User authenticated:', userInfo.email);
      
      setUser(userInfo);
      
      // Store credentials
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify({ accessToken: token }));
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userInfo));
      
      // Sync calendar immediately
      await syncCalendarWithToken(token);
      
      Alert.alert('Success!', `Signed in as ${userInfo.email}`);
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

  const signIn = async (): Promise<void> => {
    console.log('[Auth] Starting Google sign-in...');
    
    try {
      // For web: use localhost redirect (Google allows this)
      // For mobile: use focuswise:// scheme (requires native build, not Expo Go)
      const redirectUri = Platform.OS === 'web' 
        ? 'http://localhost:8081'
        : AuthSession.makeRedirectUri({ scheme: 'focuswise', path: 'auth' });
      
      console.log('[Auth] Platform:', Platform.OS);
      console.log('[Auth] Redirect URI:', redirectUri);
      
      // Build Google OAuth URL manually
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
      
      console.log('[Auth] Opening browser for authentication...');
      
      // Open browser and wait for redirect back
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      
      console.log('[Auth] Browser result type:', result.type);
      
      if (result.type === 'success' && result.url) {
        console.log('[Auth] Got redirect URL, extracting token...');
        
        // Extract access token from URL fragment
        const url = result.url;
        let accessToken: string | null = null;
        
        // Token is in the URL fragment (after #)
        if (url.includes('#')) {
          const fragment = url.split('#')[1];
          const params = new URLSearchParams(fragment);
          accessToken = params.get('access_token');
        }
        
        if (accessToken) {
          console.log('[Auth] ✅ Got access token!');
          await handleAuthSuccess(accessToken);
        } else {
          console.error('[Auth] No access token in redirect URL');
          Alert.alert('Error', 'Failed to get access token from Google');
        }
      } else if (result.type === 'cancel') {
        console.log('[Auth] User cancelled authentication');
      } else {
        console.log('[Auth] Auth dismissed or failed');
      }
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      Alert.alert('Error', error.message || 'Sign in failed');
    }
  };

  const signOut = async (): Promise<void> => {
    console.log('[Auth] Signing out...');
    
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
