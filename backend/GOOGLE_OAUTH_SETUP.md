# Google OAuth Setup Guide

## Backend-Driven OAuth Flow

This app uses a **backend-driven OAuth flow** instead of frontend Expo OAuth. This is the correct approach for production calendar apps because:

- ✅ Google allows backend redirect URIs
- ✅ You can get refresh tokens reliably
- ✅ You can maintain sessions properly
- ✅ It's how Motion, Cron, Notion Calendar, and Sunsama do it

## Setup Instructions

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add these **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
   (For production, also add your production callback URL)
7. Save your **Client ID** and **Client Secret**

### 2. Backend Environment Variables

Create a `.env` file in `FocusWise/backend/`:

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
```

### 3. Mobile App Configuration

The app.json already has the correct scheme configured:
```json
"scheme": "focuswise"
```

This allows the backend to redirect back to the app after authentication.

### 4. How It Works

1. **User taps "Connect Google Calendar"** in the app
2. **App opens backend login URL** via WebBrowser
3. **Backend redirects to Google OAuth** 
4. **User authorizes** on Google
5. **Google redirects to backend callback** (`/api/auth/google/callback`)
6. **Backend exchanges code for tokens** and stores them in Supabase
7. **Backend redirects to app** with a session token (`focuswise://auth?token=...`)
8. **App receives deep link** and fetches user info from backend

### 5. Testing

1. Start your backend:
   ```bash
   cd FocusWise/backend
   npm run start
   ```

2. Start your Expo app:
   ```bash
   cd FocusWise
   npx expo start
   ```

3. Try connecting Google Calendar from the Settings screen

## Troubleshooting

- **Error 400: invalid_request** - Check that your redirect URI in Google Console exactly matches your backend callback URL
- **Can't connect** - Make sure backend is running and accessible from your device/emulator
- **No refresh token** - Make sure `prompt: 'consent'` is set in the OAuth request (already configured)

