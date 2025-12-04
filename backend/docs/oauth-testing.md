# Google OAuth Testing Guide

## Quick Start

### 1. Start ngrok

```powershell
# First time only - add auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start ngrok tunnel to backend
cd C:\Users\kabir\Music\FocusWise\FocusWise\backend
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok-free.dev`)

### 2. Update .env

```env
GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.dev/api/auth/google/callback
NGROK_URL=https://abc123.ngrok-free.dev
```

### 3. Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://abc123.ngrok-free.dev/api/auth/google/callback
   ```
4. Click Save

### 4. Start Backend

```powershell
cd C:\Users\kabir\Music\FocusWise\FocusWise\backend
npm start
```

### 5. Test OAuth Flow

**Mobile Flow:**
1. Open app on phone
2. Tap "Connect Calendar"
3. Browser opens → Google consent → Allow
4. App receives `focuswise://auth?token=...`
5. App calls `/api/auth/google/me` → User logged in ✅

**Desktop Flow:**
1. Open `https://your-ngrok-url/api/auth/google/login` in browser
2. Google consent → Allow
3. See "Authentication Complete" page ✅

---

## Troubleshooting

### "No API key found in request"

**This is NOT an error!** This happens when you browse directly to:
- `https://xxx.supabase.co/rest/v1/...`

The Supabase REST API requires an `apikey` header. The backend sets this automatically. You cannot access Supabase directly from a browser.

**Solution:** Don't browse to Supabase URLs directly. Use the backend API endpoints instead.

### "redirect_uri_mismatch"

The redirect URI in your request doesn't match Google Cloud Console.

**Fix:**
1. Check your `.env` file: `GOOGLE_REDIRECT_URI`
2. Check Google Cloud Console → OAuth Client → Authorized redirect URIs
3. They must match EXACTLY (including https, trailing slashes, etc.)

### "Connecting..." stuck on mobile app

1. Check `/api/auth/debug/supabase` for connection status
2. Check `/api/auth/debug/queue-status` for pending tokens
3. Force retry with `/api/auth/debug/supabase-sync`

The queue system will keep retrying until Supabase is reachable.

### Token not saved after OAuth

Tokens are queued for background save. Check:
1. Terminal logs for `[Supabase] ✅ Write successful`
2. `/api/auth/debug/queue-status` should show `size: 0`

---

## Debug Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/auth/debug/oauth` | OAuth configuration info |
| `GET /api/auth/debug/supabase` | Supabase connection test |
| `GET /api/auth/debug/supabase-sync` | Force retry all queued writes |
| `GET /api/auth/debug/queue-status` | View pending token queue |
| `GET /health` | Server health + queue status |

---

## Flow Diagrams

### Mobile OAuth Flow

```
┌─────────────┐
│  Mobile App │
└──────┬──────┘
       │ 1. Tap "Connect"
       ▼
┌─────────────┐
│  Browser    │ Opens: /api/auth/google/login
└──────┬──────┘
       │ 2. Redirect to Google
       ▼
┌─────────────┐
│  Google     │ User consents
└──────┬──────┘
       │ 3. Redirect with code
       ▼
┌─────────────┐
│  Backend    │ /api/auth/google/callback
│             │ - Exchange code for tokens
│             │ - Queue DB write (async)
│             │ - Create JWT session
└──────┬──────┘
       │ 4. Redirect: focuswise://auth?token=JWT
       ▼
┌─────────────┐
│  Mobile App │ Deep link received
│             │ - Call /api/auth/google/me
│             │ - User logged in ✅
└─────────────┘
```

### Desktop OAuth Flow

```
┌─────────────┐
│  Browser    │ Opens: /api/auth/google/login
└──────┬──────┘
       │ Redirect to Google
       ▼
┌─────────────┐
│  Google     │ User consents
└──────┬──────┘
       │ Redirect with code
       ▼
┌─────────────┐
│  Backend    │ /api/auth/google/callback
│             │ - Exchange code for tokens
│             │ - Queue DB write (async)
│             │ - Create JWT session
└──────┬──────┘
       │ Return HTML page
       ▼
┌─────────────┐
│  Browser    │ "Authentication Complete"
│             │ "You can close this tab"
└─────────────┘
```

---

## Common Windows PowerShell Commands

```powershell
# Navigate to backend
cd C:\Users\kabir\Music\FocusWise\FocusWise\backend

# Start backend
npm start

# In another terminal, start ngrok
ngrok http 3000

# Check if backend is running
curl http://localhost:3000/health
```

---

## Notes for Expo/React Native

### Deep Links Only Work in Development Client

Custom scheme deep links (`focuswise://...`) do NOT work in Expo Go.

**Options:**
1. Use Expo Development Client: `eas build --profile development`
2. Use `expo run:android` for local dev build
3. Build standalone app

### app.json Configuration

```json
{
  "expo": {
    "scheme": "focuswise",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "focuswise" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

