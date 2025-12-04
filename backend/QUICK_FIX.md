# Quick Fix Guide - OAuth Errors

## Problem 1: "invalid_client" Error (First Screenshot)

**Error:** `Error 401: invalid_client` - "The OAuth client was not found"

**Cause:** Your `.env` file has placeholder values instead of real Google OAuth credentials.

**Fix:**

1. **Get Google OAuth Credentials:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Select your project (or create one)
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "FocusWise Backend"
   - **Authorized redirect URIs:** (leave empty for now, we'll add it after ngrok)
   - Click "Create"
   - **Copy the Client ID and Client Secret**

2. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

3. **Update backend/.env file:**
   ```env
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-actual-client-secret
   GOOGLE_REDIRECT_URI=https://your-actual-ngrok-url.ngrok-free.dev/api/auth/google/callback
   ```
   **Replace with your actual values!**

4. **Add Redirect URI to Google Cloud Console:**
   - Go back to: https://console.cloud.google.com/apis/credentials
   - Click on your OAuth client
   - Under "Authorized redirect URIs", click "ADD URI"
   - Add: `https://your-actual-ngrok-url.ngrok-free.dev/api/auth/google/callback`
   - Click "SAVE"

5. **Restart backend:**
   ```bash
   cd FocusWise/backend
   npm start
   ```

## Problem 2: Blank Page on Mobile (Second Screenshot)

**Error:** Blank white page at `10.0.2.2:3000`

**Possible Causes:**
1. Backend not running
2. Backend not accessible from Android emulator
3. Backend returning an error

**Fix:**

1. **Check if backend is running:**
   ```bash
   cd FocusWise/backend
   npm start
   ```
   You should see: `Server running on port 3000`

2. **Test backend from browser:**
   - Open: `http://localhost:3000`
   - Should see: "FocusWise Backend is running"

3. **Test OAuth endpoint:**
   - Open: `http://localhost:3000/api/auth/google/login`
   - If you see an error page, follow the instructions on that page

4. **For Android Emulator:**
   - `10.0.2.2` is the special IP for localhost on Android emulator
   - Make sure backend is running on `localhost:3000`
   - If still not working, try using ngrok URL in the app

5. **Use ngrok URL in mobile app:**
   - Set environment variable: `EXPO_PUBLIC_BACKEND_URL=https://your-ngrok-url.ngrok-free.dev`
   - Or modify `context/AuthContext.tsx` to use ngrok URL directly

## Verification Steps

1. **Check backend logs:**
   - Should see: `[OAuth] Login request received`
   - Should NOT see placeholder values in logs

2. **Test debug endpoint:**
   - Open: `http://localhost:3000/api/auth/debug/oauth`
   - Should show your actual redirect URI (not placeholder)

3. **Test OAuth flow:**
   - Open: `http://localhost:3000/api/auth/google/login`
   - Should redirect to Google (not show error page)

## Common Issues

### "Placeholder values detected"
- Your `.env` still has `your-google-client-id` or `your-ngrok-url`
- Replace with actual values

### "Missing Google OAuth credentials"
- Check that `.env` file exists in `backend/` directory
- Check that all three variables are set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### "The OAuth client was not found"
- Client ID is wrong or doesn't exist in Google Cloud Console
- Double-check you copied the full Client ID
- Make sure you're using the correct Google Cloud project

### Backend not accessible from mobile
- Use ngrok URL instead of `10.0.2.2:3000`
- Set `EXPO_PUBLIC_BACKEND_URL` environment variable
- Or update `AuthContext.tsx` to use ngrok URL

