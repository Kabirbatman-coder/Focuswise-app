# Fix Database Connection Timeout Error

## Error: "Failed to store tokens in database"

**Error Details:**
- `ConnectTimeoutError: Connect Timeout Error (attempted address: sntxzyvagpvbsfpplwyw.supabase.co:443, timeout: 10000ms)`

## What I Fixed

1. **Added Retry Logic**: Database operations now retry 3 times with 2-second delays
2. **Better Error Messages**: More helpful error messages explaining what went wrong
3. **Connection Test**: Backend tests Supabase connection on startup
4. **Debug Endpoint**: Added `/api/auth/debug/supabase` to test connection

## Solutions to Try

### Solution 1: Check Internet Connection
```bash
# Test if you can reach Supabase
curl https://sntxzyvagpvbsfpplwyw.supabase.co
```

### Solution 2: Verify Supabase Credentials
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Verify:
   - **Project URL** matches `SUPABASE_URL` in `.env`
   - **service_role key** matches `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Solution 3: Check Firewall/Antivirus
- Windows Firewall or antivirus might be blocking outbound HTTPS connections
- Temporarily disable to test
- Add exception for Node.js or your backend process

### Solution 4: Test Supabase Connection
```bash
# Test the debug endpoint
curl http://localhost:3000/api/auth/debug/supabase
```

### Solution 5: Check Supabase Project Status
1. Go to: https://supabase.com/dashboard
2. Check if your project is active (not paused)
3. Free tier projects pause after inactivity

### Solution 6: Verify Tables Exist
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
SELECT * FROM user_tokens LIMIT 1;
```
3. If it errors, the table doesn't exist - run the schema.sql

### Solution 7: Use Different Network
- Try a different network (mobile hotspot, different WiFi)
- Some networks block outbound connections

## Testing After Fix

1. **Restart Backend:**
   ```bash
   cd FocusWise/backend
   npm start
   ```
   - Should see: `[Supabase] Connection test successful` or a warning

2. **Test Debug Endpoint:**
   - Open: `http://localhost:3000/api/auth/debug/supabase`
   - Should show connection status

3. **Try OAuth Again:**
   - The retry logic will automatically retry 3 times
   - Check backend logs for retry attempts

## What the Retry Logic Does

- **Attempts**: 3 retries with 2-second delays
- **Only retries on**: Connection timeouts, network errors
- **Doesn't retry on**: Authentication errors, invalid data

## Still Not Working?

1. **Check Backend Logs:**
   - Look for `[OAuth] Database error` messages
   - Check which attempt failed

2. **Test Direct Connection:**
   ```bash
   # From your computer, test if Supabase is reachable
   ping sntxzyvagpvbsfpplwyw.supabase.co
   ```

3. **Check Supabase Status:**
   - Visit: https://status.supabase.com
   - Check if there are any service issues

4. **Contact Support:**
   - If everything looks correct but still timing out
   - Check Supabase community forums
   - Or contact Supabase support

## Expected Behavior After Fix

- Backend will retry database operations automatically
- Better error messages will guide you to the issue
- Connection test on startup will warn if Supabase is unreachable
- Debug endpoint helps diagnose connection issues

