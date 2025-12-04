# Distraction Shield - Native Android Module

This module enables app blocking functionality during focus sessions on Android.

## Requirements

1. **Android Development Build** - This feature requires a native build (not Expo Go)
2. **Permissions granted by user:**
   - Usage Stats Access
   - Overlay Permission
   - Accessibility Service

## How It Works

1. **Accessibility Service** - Monitors which app is currently in foreground
2. **Blocking Overlay** - Shows a full-screen overlay when a blocked app is opened
3. **Focus Session Sync** - Integrates with FocusWise backend to track sessions

## Setup

### 1. Add Plugin to app.json

```json
{
  "expo": {
    "plugins": [
      "./plugins/distraction-shield/withDistractionShield"
    ]
  }
}
```

### 2. Build Development Build

```bash
eas build --profile development --platform android
```

### 3. Install and Grant Permissions

After installing the app:

1. **Enable Accessibility Service:**
   - Go to Settings → Accessibility → FocusWise
   - Toggle ON

2. **Grant Usage Stats Permission:**
   - Go to Settings → Apps → Special Access → Usage Access
   - Find FocusWise and toggle ON

3. **Grant Overlay Permission:**
   - Go to Settings → Apps → Special Access → Display over other apps
   - Find FocusWise and toggle ON

## Files Structure

```
plugins/distraction-shield/
├── withDistractionShield.js     # Expo config plugin
├── accessibility_service_config.xml  # Service configuration
├── DistractionShieldService.kt  # Android service (Kotlin)
├── blocking_overlay.xml         # Overlay UI layout
└── README.md                    # This file
```

## Integration with React Native

The native module communicates with React Native through:

1. **Native Module Bridge** (to be implemented)
   - `DistractionShieldModule.startFocusSession(taskTitle, blockedApps)`
   - `DistractionShieldModule.endFocusSession()`
   - `DistractionShieldModule.updateBlockedApps(apps)`

2. **Event Emitter** (for distraction logs)
   - `onDistractionAttempt({ packageName, appName, timestamp })`

## Limitations

- **Android Only** - iOS doesn't allow this level of app monitoring
- **Requires User Setup** - Users must manually grant permissions
- **Battery Impact** - Accessibility services can impact battery life

## Testing

1. Start a focus session from the app
2. Try opening a blocked app (e.g., Instagram)
3. The blocking overlay should appear
4. Press "Go Back to Home" to return (unless Strict Mode is enabled)

## Troubleshooting

**Overlay not showing:**
- Check if Overlay permission is granted
- Check if Accessibility Service is enabled

**Apps not being blocked:**
- Verify the app's package name is in the blocked list
- Check if a focus session is active

**Service crashes:**
- Check logcat for errors
- Ensure all XML resources are properly included

