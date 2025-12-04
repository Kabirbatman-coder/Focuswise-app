import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Define types
export interface PermissionStatus {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  allGranted: boolean;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  icon: string;
}

// Get the native module (Android only)
const DistractionShieldNative = Platform.OS === 'android' 
  ? requireNativeModule('DistractionShield')
  : null;

/**
 * Check all required permissions for distraction shield
 */
export async function checkPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android' || !DistractionShieldNative) {
    return {
      usageStats: false,
      overlay: false,
      accessibility: false,
      allGranted: false,
    };
  }
  return DistractionShieldNative.checkPermissions();
}

/**
 * Open settings to grant Usage Stats permission
 */
export function requestUsageStatsPermission(): void {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    DistractionShieldNative.requestUsageStatsPermission();
  }
}

/**
 * Open settings to grant Overlay permission
 */
export function requestOverlayPermission(): void {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    DistractionShieldNative.requestOverlayPermission();
  }
}

/**
 * Open settings to grant Accessibility Service permission
 */
export function requestAccessibilityPermission(): void {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    DistractionShieldNative.requestAccessibilityPermission();
  }
}

/**
 * Start a focus session with specified blocked apps
 */
export function startFocusSession(blockedApps: string[], taskName: string): boolean {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.startFocusSession(blockedApps, taskName);
  }
  return false;
}

/**
 * End the current focus session
 */
export function endFocusSession(): boolean {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.endFocusSession();
  }
  return false;
}

/**
 * Check if a focus session is currently active
 */
export function isSessionActive(): boolean {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.isSessionActive();
  }
  return false;
}

/**
 * Get list of currently blocked apps
 */
export function getBlockedApps(): string[] {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.getBlockedApps();
  }
  return [];
}

/**
 * Add an app to the blocked list
 */
export function addBlockedApp(packageName: string): boolean {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.addBlockedApp(packageName);
  }
  return false;
}

/**
 * Remove an app from the blocked list
 */
export function removeBlockedApp(packageName: string): boolean {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.removeBlockedApp(packageName);
  }
  return false;
}

/**
 * Get list of installed apps for blocking selection
 */
export function getInstalledApps(): InstalledApp[] {
  if (Platform.OS === 'android' && DistractionShieldNative) {
    return DistractionShieldNative.getInstalledApps();
  }
  return [];
}

/**
 * Check if distraction shield is supported on this device
 */
export function isSupported(): boolean {
  return Platform.OS === 'android';
}

export default {
  checkPermissions,
  requestUsageStatsPermission,
  requestOverlayPermission,
  requestAccessibilityPermission,
  startFocusSession,
  endFocusSession,
  isSessionActive,
  getBlockedApps,
  addBlockedApp,
  removeBlockedApp,
  getInstalledApps,
  isSupported,
};

