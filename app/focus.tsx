import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useAuth } from '@/context/AuthContext';

// Import native module if available
let DistractionShield: any = null;
try {
  DistractionShield = require('../modules/distraction-shield-native').default;
} catch (e) {
  console.log('[Focus] Native distraction shield not available');
}

import { getApiUrl, FOCUS_CONFIG } from '@/constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Focus session type
interface FocusSession {
  id: string;
  taskTitle?: string;
  plannedDuration: number;
  status: string;
  distractionCount: number;
  startTime: string;
}

// Shield settings type
interface ShieldSettings {
  isEnabled: boolean;
  blockedApps: string[];
  allowedApps: string[];
  showOverlay: boolean;
  vibrate: boolean;
  strictMode: boolean;
}

// Default app type
interface BlockedApp {
  packageName: string;
  name: string;
}

// Permission status type
interface PermissionStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  allGranted: boolean;
}

// Duration options (minutes)
const DURATION_OPTIONS = FOCUS_CONFIG.DURATION_OPTIONS;

export default function FocusScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || 'default_user';
  
  // State
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [shieldSettings, setShieldSettings] = useState<ShieldSettings | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [defaultApps, setDefaultApps] = useState<BlockedApp[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [nativeModuleAvailable, setNativeModuleAvailable] = useState(false);
  
  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Check native module availability and permissions
  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android' && DistractionShield) {
      setNativeModuleAvailable(true);
      try {
        const status = await DistractionShield.checkPermissions();
        setPermissions(status);
      } catch (e) {
        console.log('[Focus] Error checking permissions:', e);
        setNativeModuleAvailable(false);
      }
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveSession();
      fetchShieldSettings();
      fetchDefaultApps();
      checkPermissions();
    }
  }, [isAuthenticated, checkPermissions]);
  
  // Timer update
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeSession && activeSession.status === 'active') {
      interval = setInterval(() => {
        const startTime = new Date(activeSession.startTime);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 60000);
        const remaining = Math.max(0, activeSession.plannedDuration - elapsed);
        
        setElapsedMinutes(elapsed);
        setRemainingMinutes(remaining);
        
        // Update progress animation
        const progress = Math.min(1, elapsed / activeSession.plannedDuration);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 500,
          useNativeDriver: false,
        }).start();
        
        // Auto-end session when time is up
        if (remaining <= 0) {
          handleEndSession();
        }
      }, 1000);
      
      // Pulse animation for active session
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
    
    return () => {
      if (interval) clearInterval(interval);
      pulseAnim.stopAnimation();
    };
  }, [activeSession]);
  
  // Fetch active session
  const fetchActiveSession = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/focus/session/active/${userId}`));
      const data = await response.json();
      if (data.success && data.hasActiveSession) {
        setActiveSession(data.session);
        setElapsedMinutes(data.elapsedMinutes);
        setRemainingMinutes(data.remainingMinutes);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error('[Focus] Error fetching session:', error);
    }
  };
  
  // Fetch shield settings
  const fetchShieldSettings = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/focus/shield/${userId}`));
      const data = await response.json();
      if (data.success) {
        setShieldSettings(data.settings);
      }
    } catch (error) {
      console.error('[Focus] Error fetching shield settings:', error);
    }
  };
  
  // Fetch default apps
  const fetchDefaultApps = async () => {
    try {
      const response = await fetch(getApiUrl('/api/focus/default-apps'));
      const data = await response.json();
      if (data.success) {
        setDefaultApps(data.apps);
      }
    } catch (error) {
      console.error('[Focus] Error fetching default apps:', error);
    }
  };
  
  // Request permission functions
  const requestUsageStats = () => {
    if (DistractionShield) {
      DistractionShield.requestUsageStatsPermission();
      // Re-check after a delay
      setTimeout(checkPermissions, 1000);
    }
  };

  const requestOverlay = () => {
    if (DistractionShield) {
      DistractionShield.requestOverlayPermission();
      setTimeout(checkPermissions, 1000);
    }
  };

  const requestAccessibility = () => {
    if (DistractionShield) {
      DistractionShield.requestAccessibilityPermission();
      setTimeout(checkPermissions, 1000);
    }
  };

  // Start focus session
  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      // Start native blocking if available and permissions granted
      if (nativeModuleAvailable && DistractionShield && permissions?.allGranted) {
        const blockedApps = shieldSettings?.blockedApps || [];
        DistractionShield.startFocusSession(blockedApps, 'Focus Task');
      }

      const response = await fetch(getApiUrl('/api/focus/session/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          plannedDuration: selectedDuration,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setActiveSession(data.session);
        setRemainingMinutes(selectedDuration);
        setElapsedMinutes(0);
        Alert.alert('Focus Mode Started! 🎯', `Stay focused for ${selectedDuration} minutes. Distracting apps will be blocked.`);
      }
    } catch (error) {
      console.error('[Focus] Error starting session:', error);
      Alert.alert('Error', 'Failed to start focus session');
    } finally {
      setIsLoading(false);
    }
  };
  
  // End focus session
  const handleEndSession = async () => {
    try {
      // End native blocking
      if (nativeModuleAvailable && DistractionShield) {
        DistractionShield.endFocusSession();
      }

      const response = await fetch(getApiUrl('/api/focus/session/end'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (data.success) {
        setActiveSession(null);
        if (data.session) {
          Alert.alert('Great Job! 🎉', `You focused for ${data.session.actualDuration} minutes with ${data.session.distractionCount} distraction attempts.`);
        }
      }
    } catch (error) {
      console.error('[Focus] Error ending session:', error);
    }
  };
  
  // Update shield setting
  const updateShieldSetting = async (key: keyof ShieldSettings, value: any) => {
    if (!shieldSettings) return;
    
    const updatedSettings = { ...shieldSettings, [key]: value };
    setShieldSettings(updatedSettings);
    
    try {
      await fetch(getApiUrl(`/api/focus/shield/${userId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      console.error('[Focus] Error updating shield:', error);
    }
  };
  
  // Format time display
  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
  // Check if app is blocked
  const isAppBlocked = (packageName: string) => {
    return shieldSettings?.blockedApps.includes(packageName) ?? false;
  };
  
  // Toggle app blocking
  const toggleAppBlock = async (packageName: string) => {
    if (!shieldSettings) return;
    
    let newBlockedApps: string[];
    if (isAppBlocked(packageName)) {
      newBlockedApps = shieldSettings.blockedApps.filter((p) => p !== packageName);
    } else {
      newBlockedApps = [...shieldSettings.blockedApps, packageName];
    }
    
    await updateShieldSetting('blockedApps', newBlockedApps);
  };
  
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="shield-outline" size={64} color={Colors.text.tertiary} />
          <Text style={styles.signInText}>Sign in to use Focus Mode</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Focus Mode</Text>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
            <Ionicons name="settings-outline" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Active Session View */}
        {activeSession ? (
          <View style={styles.activeSessionContainer}>
            <Animated.View style={[styles.timerCircle, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.timerGradient}
              >
                <Text style={styles.timerText}>{formatTime(remainingMinutes)}</Text>
                <Text style={styles.timerLabel}>remaining</Text>
              </LinearGradient>
            </Animated.View>
            
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {elapsedMinutes} / {activeSession.plannedDuration} min
              </Text>
            </View>
            
            {/* Shield Status */}
            <View style={styles.shieldStatus}>
              <Ionicons name="shield-checkmark" size={24} color="#10B981" />
              <Text style={styles.shieldStatusText}>Distraction Shield Active</Text>
            </View>
            
            {/* Distraction count */}
            <View style={styles.distractionCounter}>
              <Text style={styles.distractionLabel}>Distraction Attempts</Text>
              <Text style={styles.distractionCount}>{activeSession.distractionCount}</Text>
            </View>
            
            {/* End session button */}
            <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Start Session View */}
            <View style={styles.startContainer}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="shield" size={48} color="#FFF" />
                </LinearGradient>
              </View>
              
              <Text style={styles.subtitle}>
                Block distracting apps and focus on what matters
              </Text>
              
              {/* Duration selector */}
              <Text style={styles.sectionLabel}>Session Duration</Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationChip,
                      selectedDuration === duration && styles.durationChipSelected,
                    ]}
                    onPress={() => setSelectedDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        selectedDuration === duration && styles.durationTextSelected,
                      ]}
                    >
                      {formatTime(duration)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Start button */}
              <TouchableOpacity
                style={[styles.startButton, isLoading && styles.startButtonDisabled]}
                onPress={handleStartSession}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.startButtonGradient}
                >
                  <Ionicons name="play" size={24} color="#FFF" />
                  <Text style={styles.startButtonText}>
                    {isLoading ? 'Starting...' : 'Start Focus Session'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Shield Settings */}
            {showSettings && shieldSettings && (
              <View style={styles.settingsContainer}>
                <Text style={styles.settingsTitle}>Distraction Shield Settings</Text>
                
                {/* Toggle switches */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="shield" size={20} color={Colors.ai_chief.active_ring} />
                    <Text style={styles.settingLabel}>Shield Enabled</Text>
                  </View>
                  <Switch
                    value={shieldSettings.isEnabled}
                    onValueChange={(v) => updateShieldSetting('isEnabled', v)}
                    trackColor={{ false: '#374151', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="layers" size={20} color={Colors.ai_chief.active_ring} />
                    <Text style={styles.settingLabel}>Show Blocking Overlay</Text>
                  </View>
                  <Switch
                    value={shieldSettings.showOverlay}
                    onValueChange={(v) => updateShieldSetting('showOverlay', v)}
                    trackColor={{ false: '#374151', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="phone-portrait-outline" size={20} color={Colors.ai_chief.active_ring} />
                    <Text style={styles.settingLabel}>Vibrate on Block</Text>
                  </View>
                  <Switch
                    value={shieldSettings.vibrate}
                    onValueChange={(v) => updateShieldSetting('vibrate', v)}
                    trackColor={{ false: '#374151', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="lock-closed" size={20} color="#EF4444" />
                    <Text style={styles.settingLabel}>Strict Mode (Can't Dismiss)</Text>
                  </View>
                  <Switch
                    value={shieldSettings.strictMode}
                    onValueChange={(v) => updateShieldSetting('strictMode', v)}
                    trackColor={{ false: '#374151', true: '#EF4444' }}
                    thumbColor="#FFF"
                  />
                </View>
                
                {/* Blocked Apps */}
                <Text style={styles.appsTitle}>Blocked Apps</Text>
                <Text style={styles.appsSubtitle}>
                  These apps will be blocked during focus sessions
                </Text>
                
                <View style={styles.appsGrid}>
                  {defaultApps.map((app) => (
                    <TouchableOpacity
                      key={app.packageName}
                      style={[
                        styles.appChip,
                        isAppBlocked(app.packageName) && styles.appChipBlocked,
                      ]}
                      onPress={() => toggleAppBlock(app.packageName)}
                    >
                      <Text
                        style={[
                          styles.appChipText,
                          isAppBlocked(app.packageName) && styles.appChipTextBlocked,
                        ]}
                      >
                        {app.name}
                      </Text>
                      {isAppBlocked(app.packageName) && (
                        <Ionicons name="close-circle" size={14} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        
        {/* Permissions Setup (Android only) */}
        {Platform.OS === 'android' && nativeModuleAvailable && permissions && !permissions.allGranted && (
          <View style={styles.permissionsCard}>
            <Text style={styles.permissionsTitle}>🔐 Setup Required</Text>
            <Text style={styles.permissionsSubtitle}>
              Grant these permissions to enable full app blocking:
            </Text>
            
            <TouchableOpacity 
              style={[styles.permissionRow, permissions.usageStats && styles.permissionGranted]}
              onPress={requestUsageStats}
              disabled={permissions.usageStats}
            >
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.usageStats ? "checkmark-circle" : "analytics-outline"} 
                  size={24} 
                  color={permissions.usageStats ? "#10B981" : Colors.ai_chief.active_ring} 
                />
                <View>
                  <Text style={styles.permissionName}>Usage Stats Access</Text>
                  <Text style={styles.permissionDesc}>Track which apps are opened</Text>
                </View>
              </View>
              {!permissions.usageStats && (
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.permissionRow, permissions.overlay && styles.permissionGranted]}
              onPress={requestOverlay}
              disabled={permissions.overlay}
            >
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.overlay ? "checkmark-circle" : "layers-outline"} 
                  size={24} 
                  color={permissions.overlay ? "#10B981" : Colors.ai_chief.active_ring} 
                />
                <View>
                  <Text style={styles.permissionName}>Display Over Apps</Text>
                  <Text style={styles.permissionDesc}>Show blocking overlay</Text>
                </View>
              </View>
              {!permissions.overlay && (
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.permissionRow, permissions.accessibility && styles.permissionGranted]}
              onPress={requestAccessibility}
              disabled={permissions.accessibility}
            >
              <View style={styles.permissionInfo}>
                <Ionicons 
                  name={permissions.accessibility ? "checkmark-circle" : "accessibility-outline"} 
                  size={24} 
                  color={permissions.accessibility ? "#10B981" : Colors.ai_chief.active_ring} 
                />
                <View>
                  <Text style={styles.permissionName}>Accessibility Service</Text>
                  <Text style={styles.permissionDesc}>Detect app launches</Text>
                </View>
              </View>
              {!permissions.accessibility && (
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshPermissionsBtn} onPress={checkPermissions}>
              <Ionicons name="refresh" size={16} color={Colors.ai_chief.active_ring} />
              <Text style={styles.refreshPermissionsText}>Refresh Status</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* All Permissions Granted Badge */}
        {Platform.OS === 'android' && nativeModuleAvailable && permissions?.allGranted && (
          <View style={styles.allGrantedBadge}>
            <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            <Text style={styles.allGrantedText}>All permissions granted - Full blocking enabled!</Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.ai_chief.active_ring} />
          <Text style={styles.infoText}>
            {Platform.OS === 'android' 
              ? nativeModuleAvailable 
                ? 'Tap each permission above to enable it. After granting, tap "Refresh Status" to update.'
                : 'Native module not available. Build a new APK to enable full app blocking.'
              : 'Full app blocking requires native integration. Currently tracking focus sessions.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.bold,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginTop: Spacing.md,
  },
  
  // Start session view
  startContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  sectionLabel: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  durationChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  durationChipSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  durationText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body - 1,
  },
  durationTextSelected: {
    color: '#10B981',
    fontWeight: '600',
  },
  startButton: {
    width: '100%',
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  
  // Active session view
  activeSessionContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  timerCircle: {
    marginBottom: Spacing.lg,
  },
  timerGradient: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    color: '#FFF',
    fontSize: 42,
    fontWeight: '300',
  },
  timerLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: Typography.sizes.caption,
    marginTop: 4,
  },
  progressContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  shieldStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  shieldStatusText: {
    color: '#10B981',
    fontSize: Typography.sizes.body - 1,
    fontWeight: '600',
  },
  distractionCounter: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  distractionLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
  },
  distractionCount: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
  },
  endButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  endButtonText: {
    color: '#EF4444',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  
  // Settings
  settingsContainer: {
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  settingsTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingLabel: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
  },
  appsTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  appsSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginBottom: Spacing.md,
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  appChipBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  appChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  appChipTextBlocked: {
    color: '#EF4444',
  },
  
  // Permissions card
  permissionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  permissionsTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.xs,
  },
  permissionsSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginBottom: Spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  permissionGranted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  permissionName: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
    fontWeight: '500',
  },
  permissionDesc: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption - 1,
  },
  refreshPermissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  refreshPermissionsText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.caption,
  },
  allGrantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    gap: Spacing.xs,
  },
  allGrantedText: {
    color: '#10B981',
    fontSize: Typography.sizes.caption,
    fontWeight: '500',
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 199, 252, 0.1)',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
  },
});

