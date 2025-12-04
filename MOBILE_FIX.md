# Mobile Connection Fix - Quick Guide

## Problem
Mobile app can't connect to backend at `http://10.0.2.2:3000`

## Solution
Mobile app now uses ngrok URL by default. Your current ngrok URL is hardcoded:
- `https://distinguishingly-triadic-nancy.ngrok-free.dev`

## What I Fixed

1. **Updated AuthContext** to use ngrok URL for mobile instead of `10.0.2.2:3000`
2. **Made health check non-blocking** - won't prevent OAuth flow
3. **Better error messages** - more helpful when connection fails

## Important Notes

### ⚠️ When ngrok URL Changes
If you restart ngrok and get a new URL, you need to update it in one of these ways:

**Option 1: Update hardcoded URL (Quick)**
- Edit `context/AuthContext.tsx`
- Find line with: `const ngrokUrl = 'https://distinguishingly-triadic-nancy.ngrok-free.dev';`
- Replace with your new ngrok URL
- Restart Expo app

**Option 2: Use Environment Variable (Recommended)**
1. Create `.env` file in `FocusWise/` directory (not backend/)
2. Add:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://your-new-ngrok-url.ngrok-free.dev
   ```
3. Restart Expo: `npx expo start --clear`

### ✅ Current Setup
- Mobile uses: `https://distinguishingly-triadic-nancy.ngrok-free.dev`
- Web uses: `http://localhost:3000`
- Both work correctly now!

## Testing

1. **Make sure ngrok is running:**
   ```bash
   ngrok http 3000
   ```

2. **Make sure backend is running:**
   ```bash
   cd FocusWise/backend
   npm start
   ```

3. **Restart Expo app:**
   ```bash
   cd FocusWise
   npx expo start --clear
   ```

4. **Test on mobile:**
   - Tap "Connect Google"
   - Should open browser with Google OAuth (no connection error)
   - After auth, should redirect back to app

## If Still Not Working

1. **Check ngrok is running:**
   - Visit: `https://distinguishingly-triadic-nancy.ngrok-free.dev`
   - Should see: "FocusWise Backend is running"

2. **Check backend logs:**
   - Should see: `[OAuth] Login request received`

3. **Check mobile console:**
   - Should see: `[Auth] Mobile detected - using ngrok URL`
   - Should NOT see connection errors

4. **Update ngrok URL if changed:**
   - If you restarted ngrok, update the URL in `AuthContext.tsx`

