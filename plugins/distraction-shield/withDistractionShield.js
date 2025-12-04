/**
 * Expo Config Plugin for Distraction Shield (Auto-Blocking)
 * 
 * This plugin configures the Android app with necessary permissions for:
 * 1. UsageStatsManager API - to track which apps are being used
 * 2. Accessibility Service - to detect app launches
 * 3. System Alert Window - to show blocking overlay
 */

const { withAndroidManifest, withStringsXml, AndroidConfig } = require('@expo/config-plugins');

// Add required permissions to AndroidManifest.xml
function addPermissions(androidManifest) {
  const { manifest } = androidManifest;
  
  // Ensure uses-permission array exists
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }
  
  const permissions = manifest['uses-permission'];
  
  // Required permissions for app usage tracking and blocking
  const requiredPermissions = [
    'android.permission.PACKAGE_USAGE_STATS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.QUERY_ALL_PACKAGES',
  ];
  
  requiredPermissions.forEach((permission) => {
    const exists = permissions.some((p) => {
      if (p && p.$ && p.$['android:name']) {
        return p.$['android:name'] === permission;
      }
      return false;
    });
    
    if (!exists) {
      permissions.push({
        $: { 'android:name': permission },
      });
    }
  });
  
  return androidManifest;
}

// Main config plugin
const withDistractionShield = (config) => {
  // Modify Android Manifest to add permissions
  config = withAndroidManifest(config, (config) => {
    config.modResults = addPermissions(config.modResults);
    return config;
  });
  
  return config;
};

module.exports = withDistractionShield;
