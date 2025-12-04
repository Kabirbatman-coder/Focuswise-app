# Fix OAuth Callback & Database Errors

## Issues Fixed

### 1. ✅ "Missing authorization code" Error
**Problem:** OAuth callback not receiving the `code` parameter from Google

**Fixes Applied:**
- Added detailed logging to see what's being received in callback
- Enhanced error messages with debugging info
- Better handling of callback URL mismatches

**To Fix:**
1. **Check Google Cloud Console:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click on your OAuth client
   - Under "Authorized redirect URIs", verify it matches EXACTLY:
     ```
     https://distinguishingly-triadic-nancy.ngrok-free.dev/api/auth/google/callback
     ```
   - Must match character-for-character (including https, no trailing slash)

2. **Check ngrok is running:**
   ```bash
   ngrok http 3000
   ```
   - Make sure the URL matches what's in `.env`

3. **Check backend/.env:**
   ```env
   GOOGLE_REDIRECT_URI=https://distinguishingly-triadic-nancy.ngrok-free.dev/api/auth/google/callback
   ```
   - Must match exactly (no trailing slash)

4. **Restart backend after changing .env:**
   ```bash
   cd FocusWise/backend
   npm start
   ```

### 2. ✅ Supabase Connection Timeout
**Problem:** Database connection timing out when storing tokens

**Fixes Applied:**
- Increased timeout to 20 seconds
- Added progressive retry delays (1s, 2s, 3s, 5s, 5s)
- Increased max retries from 3 to 5
- Authentication now proceeds even if database save fails (for connection errors)
- Tokens will be saved on next calendar sync

**To Fix:**
1. **Check internet connection:**
   ```bash
   ping sntxzyvagpvbsfpplwyw.supabase.co
   ```

2. **Check Supabase project status:**
   - Go to: https://supabase.com/dashboard
   - Make sure project is active (not paused)

3. **Verify credentials:**
   - Check `SUPABASE_URL` in `.env`
   - Check `SUPABASE_SERVICE_ROLE_KEY` in `.env`
   - Get from: Supabase Dashboard → Settings → API

4. **Check firewall/antivirus:**
   - Windows Firewall might be blocking outbound HTTPS
   - Temporarily disable to test

5. **Try different network:**
   - Some networks block outbound connections
   - Try mobile hotspot or different WiFi

## What Happens Now

### If Database Connection Fails:
- **Authentication still works** - JWT is created and user can sign in
- **Warning logged** - Backend logs show connection failed
- **Tokens saved later** - Next calendar sync will try to save tokens again
- **User can use app** - Calendar sync will retry database operations

### If Callback Missing Code:
- **Detailed error page** - Shows what was received vs expected
- **Debug info** - Link to debug endpoint for troubleshooting
- **Clear instructions** - Step-by-step fix guide

## Testing

1. **Test OAuth callback:**
   - Sign in from mobile app
   - Check backend logs for: `[OAuth] Callback received`
   - Should see: `[OAuth] Query params: {"code":"..."}`

2. **Test database connection:**
   - Check backend logs on startup: `[Supabase] Connection test successful`
   - Or visit: `http://localhost:3000/api/auth/debug/supabase`

3. **Test full flow:**
   - Sign in → Should redirect to app (even if DB save fails)
   - Go to Calendar tab → Should sync and save tokens
   - Check backend logs for retry attempts

## Debug Endpoints

- **OAuth Debug:** `http://localhost:3000/api/auth/debug/oauth`
- **Supabase Debug:** `http://localhost:3000/api/auth/debug/supabase`

## Common Issues

### "Missing authorization code"
- **Cause:** Callback URL mismatch
- **Fix:** Verify redirect URI in Google Cloud Console matches exactly

### "Connect Timeout Error"
- **Cause:** Can't reach Supabase
- **Fix:** Check internet, firewall, Supabase status

### Authentication works but calendar empty
- **Cause:** Tokens not saved due to DB timeout
- **Fix:** Pull to refresh on Calendar tab - will retry saving tokens

## Next Steps

If errors persist:
1. Check backend logs for detailed error messages
2. Use debug endpoints to verify configuration
3. Test Supabase connection: `curl https://sntxzyvagpvbsfpplwyw.supabase.co`
4. Verify Google OAuth redirect URI matches exactly

