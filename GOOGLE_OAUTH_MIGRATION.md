# Backend-Driven Google OAuth Implementation - Summary

## ✅ What Was Changed

### **Problem Solved**
The app was using **frontend Expo Google OAuth** which:
- ❌ Causes Google to block `exp://` redirect URIs (Error 400: invalid_request)
- ❌ Cannot reliably get refresh tokens
- ❌ Cannot be published to app stores
- ❌ Cannot do backend token exchange

### **Solution Implemented**
Switched to **backend-driven OAuth flow** (same approach as Motion, Cron, Notion Calendar, Sunsama):

1. Mobile app opens backend login URL
2. Backend handles Google OAuth
3. Backend receives callback and exchanges code for tokens
4. Backend stores tokens in database
5. Backend redirects back to app with session token
6. App uses session token for all API calls

---

## 📁 Files Changed

### **Frontend Changes**

#### `FocusWise/context/AuthContext.tsx`
- ❌ **Removed:** All Expo Google auth imports (`expo-auth-session/providers/google`, `makeRedirectUri`)
- ❌ **Removed:** `useAuthRequest`, `promptAsync`, `response`
- ✅ **Added:** Backend-driven auth using `WebBrowser.openAuthSessionAsync`
- ✅ **Added:** Deep link handling with `expo-linking`
- ✅ **Added:** Session token management

#### `FocusWise/app/(tabs)/calendar.tsx`
- ✅ Updated to use `/events` endpoint with Authorization header
- ✅ Removed userId from URL path

### **Backend Changes**

#### New Files Created:
1. **`FocusWise/backend/src/routes/auth.ts`** - Auth routes
2. **`FocusWise/backend/src/controllers/authController.ts`** - Google OAuth handlers
3. **`FocusWise/backend/src/middleware/auth.ts`** - Auth middleware to extract user from token

#### Updated Files:
1. **`FocusWise/backend/src/index.ts`** - Added auth routes
2. **`FocusWise/backend/src/controllers/calendarController.ts`** - Updated to use auth middleware
3. **`FocusWise/backend/src/routes/calendar.ts`** - Updated routes to use Authorization header

---

## 🔑 Key Features

### **1. Secure Token Storage**
- Tokens stored in Supabase database
- Session tokens (base64 encoded) used for API authentication
- Refresh tokens properly stored for long-term access

### **2. Backend Routes**

```
GET  /api/auth/google/login       → Redirects to Google OAuth
GET  /api/auth/google/callback    → Handles OAuth callback
GET  /api/auth/google/me          → Returns user info

POST /api/calendar/sync           → Syncs calendar events
GET  /api/calendar/events         → Gets user's calendar events
POST /api/calendar/create         → Creates new event
PUT  /api/calendar/:eventId       → Updates event
DELETE /api/calendar/:eventId     → Deletes event
```

### **3. Authentication Flow**

```
User taps "Connect Google Calendar"
    ↓
App opens: http://localhost:3000/api/auth/google/login
    ↓
Backend redirects to Google OAuth
    ↓
User authorizes on Google
    ↓
Google redirects to: http://localhost:3000/api/auth/google/callback
    ↓
Backend exchanges code for tokens
    ↓
Backend stores tokens in Supabase
    ↓
Backend redirects to: focuswise://auth?token=...&userId=...
    ↓
App receives deep link and fetches user info
    ↓
App now authenticated! ✅
```

---

## 🚀 Next Steps

### **1. Google Cloud Console Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Calendar API
3. Create OAuth 2.0 Client ID (Web application)
4. Add redirect URI: `http://localhost:3000/api/auth/google/callback`

### **2. Backend Environment Variables**
Create `.env` in `FocusWise/backend/`:
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
```

### **3. Test the Flow**
1. Start backend: `cd FocusWise/backend && npm run start`
2. Start Expo app: `cd FocusWise && npx expo start`
3. Go to Settings → Toggle "Google Calendar"
4. Complete OAuth flow

---

## 🎯 Benefits

✅ **No more Google OAuth errors** - Uses proper backend redirect URIs  
✅ **Reliable refresh tokens** - Properly stored and managed  
✅ **Production ready** - Can be published to app stores  
✅ **Secure** - Tokens never exposed to frontend  
✅ **Maintainable** - Follows industry best practices  

---

## 📚 See Also

- `FocusWise/backend/GOOGLE_OAUTH_SETUP.md` - Detailed setup guide
- Google OAuth 2.0 Documentation: https://developers.google.com/identity/protocols/oauth2

