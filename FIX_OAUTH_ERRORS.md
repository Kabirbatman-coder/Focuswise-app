# Fix OAuth Errors - Step by Step

## 🔴 Error 1: "invalid_client" - OAuth client not found

**What you see:** Google error page saying "The OAuth client was not found"

**Why:** Your `backend/.env` file has placeholder values like `your-google-client-id` instead of real credentials.

### Fix Steps:

1. **Open Google Cloud Console:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Sign in with your Google account
   - Create a new project or select existing one

2. **Create OAuth Credentials:**
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure OAuth consent screen first:
     - User type: External
     - App name: FocusWise
     - Support email: your email
     - Add scopes: `https://www.googleapis.com/auth/calendar`, `openid`, `email`, `profile`
     - Add test users: your email
   - Back to credentials, create OAuth client:
     - Application type: **Web application**
     - Name: FocusWise Backend
     - **Authorized redirect URIs:** (leave empty for now)
     - Click "Create"
   - **IMPORTANT:** Copy the **Client ID** and **Client Secret** immediately (you won't see secret again!)

3. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```
   - Copy the **HTTPS URL** (looks like: `https://abc123.ngrok-free.dev`)
   - Keep ngrok running!

4. **Update backend/.env:**
   ```bash
   cd FocusWise/backend
   # Open .env file in a text editor
   ```
   
   Replace these lines:
   ```env
   GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
   GOOGLE_REDIRECT_URI=https://your-actual-ngrok-url.ngrok-free.dev/api/auth/google/callback
   ```
   
   **Use the actual values you copied!**

5. **Add Redirect URI to Google Cloud:**
   - Go back to: https://console.cloud.google.com/apis/credentials
   - Click on your OAuth client (FocusWise Backend)
   - Under "Authorized redirect URIs", click "ADD URI"
   - Paste: `https://your-actual-ngrok-url.ngrok-free.dev/api/auth/google/callback`
   - Click "SAVE"

6. **Restart Backend:**
   ```bash
   # Stop the current backend (Ctrl+C)
   # Then restart:
   cd FocusWise/backend
   npm start
   ```

7. **Test:**
   - Open: `http://localhost:3000/api/auth/google/login`
   - Should redirect to Google (not show error page)

---

## 🔴 Error 2: Blank page on mobile

**What you see:** White blank page at `10.0.2.2:3000` on mobile

**Why:** Backend might not be running, not accessible, or returning an error.

### Fix Steps:

1. **Make sure backend is running:**
   ```bash
   cd FocusWise/backend
   npm start
   ```
   Should see: `Server running on port 3000`

2. **Test backend in browser:**
   - Open: `http://localhost:3000`
   - Should see: "FocusWise Backend is running"

3. **Use ngrok URL for mobile (Recommended):**
   
   **Option A: Set environment variable**
   - Create `.env` file in `FocusWise/` directory (not backend/)
   - Add: `EXPO_PUBLIC_BACKEND_URL=https://your-ngrok-url.ngrok-free.dev`
   - Restart Expo: `npx expo start`

   **Option B: Update AuthContext directly**
   - Edit `FocusWise/context/AuthContext.tsx`
   - Change line 20 from:
     ```typescript
     return 'http://10.0.2.2:3000';
     ```
   - To:
     ```typescript
     return 'https://your-ngrok-url.ngrok-free.dev';
     ```

4. **Restart Expo app:**
   ```bash
   cd FocusWise
   npx expo start
   ```

---

## ✅ Verification Checklist

- [ ] Backend `.env` has real Google Client ID (not placeholder)
- [ ] Backend `.env` has real Google Client Secret (not placeholder)
- [ ] Backend `.env` has ngrok URL in GOOGLE_REDIRECT_URI (not placeholder)
- [ ] Google Cloud Console has redirect URI added
- [ ] ngrok is running and forwarding to port 3000
- [ ] Backend server is running (`npm start` in backend/)
- [ ] Test `http://localhost:3000/api/auth/google/login` works in browser
- [ ] Mobile app uses ngrok URL (not `10.0.2.2:3000`)

---

## 🧪 Quick Test

1. **Test backend:**
   ```bash
   curl http://localhost:3000
   # Should return: "FocusWise Backend is running"
   ```

2. **Test OAuth endpoint:**
   - Browser: `http://localhost:3000/api/auth/google/login`
   - Should redirect to Google (not show error)

3. **Test debug endpoint:**
   - Browser: `http://localhost:3000/api/auth/debug/oauth`
   - Should show your actual redirect URI (not placeholder)

4. **Test mobile:**
   - Open app, tap "Connect Google"
   - Should open browser with Google login (not error page)

---

## 🆘 Still Not Working?

1. **Check backend logs:**
   - Look for `[OAuth]` messages
   - Check for error messages

2. **Check .env file:**
   ```bash
   cd FocusWise/backend
   cat .env | grep GOOGLE
   ```
   - Should NOT contain "your-google-client-id" or "your-ngrok-url"

3. **Verify ngrok:**
   - Visit: `https://your-ngrok-url.ngrok-free.dev`
   - Should show: "FocusWise Backend is running"

4. **Check Google Cloud Console:**
   - Redirect URI must match exactly (including `/api/auth/google/callback`)
   - Client ID must match what's in `.env`

---

## 📝 Important Notes

- **ngrok URLs change** when you restart ngrok (free tier)
- **Update both** `.env` and Google Cloud Console when ngrok URL changes
- **Keep ngrok running** while testing
- **Backend must be running** before testing OAuth
- **Use HTTPS ngrok URL** (not HTTP) for OAuth

---

## 🚀 For Production

- Use a static domain (not ngrok)
- Set up proper SSL certificate
- Use environment-specific `.env` files
- Rotate secrets regularly
- Monitor OAuth errors in logs

