# Supabase Connection Resilience

## Overview

This document explains how FocusWise handles Supabase connection issues, particularly on slow networks (like those common in India on the Supabase free tier).

## The Problem

Supabase free tier projects can experience connection timeouts when:
- Network latency is high (>200ms)
- The Supabase project is cold starting after inactivity
- ISP routing issues cause packet loss
- The client's internet connection is unstable

This manifests as:
```
ConnectTimeoutError: attempted address: sntxzyvagpvbsfpplwyw.supabase.co:443 timeout: 10000ms
```

## The Solution

FocusWise implements a robust queue-and-retry system that guarantees **eventual consistency**:

### 1. Extended Timeouts
- All Supabase requests now have a **60 second timeout** (up from 10s)
- This accommodates slow network conditions

### 2. Automatic Retry with Exponential Backoff
When a write fails, it's retried with increasing delays:
- Attempt 1: Immediate
- Attempt 2: Wait 1 second
- Attempt 3: Wait 3 seconds
- Attempt 4: Wait 5 seconds
- Attempt 5: Wait 10 seconds
- Attempt 6: Wait 20 seconds
- Attempt 7: Wait 30 seconds

### 3. Persistent Queue
If all retry attempts fail:
- The token data is saved to `supabase_token_queue.json`
- A background worker retries **every 5 seconds** (infinite retries)
- The queue persists across server restarts

### 4. OAuth Never Blocked
The OAuth callback **always redirects to the mobile app**, even if Supabase is unreachable:
- Google tokens are received ✓
- JWT session token is created ✓
- Mobile app receives the auth token ✓
- Supabase write is queued for background processing ✓

## Debug Endpoints

### Check Supabase Connection
```
GET /api/auth/debug/supabase
```
Returns connection status, queue size, and troubleshooting tips.

### Force Queue Sync
```
GET /api/auth/debug/supabase-sync
```
Immediately attempts to process all queued token writes.

### Check Queue Status
```
GET /api/auth/debug/queue-status
```
Shows current queue contents without modifying them.

## Logs

The system logs detailed information:

```
[Supabase] Write queued: <userId>     # Token saved to queue
[Supabase] ✅ Write successful: <userId>  # Token saved to Supabase
[Supabase] ❌ Write failed: <userId>      # Write failed, will retry
```

## Architecture

```
┌─────────────────┐
│  Google OAuth   │
│    Callback     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create JWT &   │
│  Redirect App   │──────────────────────────────────┐
└────────┬────────┘                                  │
         │                                           │
         ▼                                           ▼
┌─────────────────┐    Fail    ┌─────────────────┐  │
│  Supabase       │───────────▶│  Token Queue    │  │
│  safeWrite()    │            │  (JSON file)    │  │
└────────┬────────┘            └────────┬────────┘  │
         │                              │           │
         │ Success                      │ Every 5s  │
         ▼                              ▼           │
┌─────────────────┐            ┌─────────────────┐  │
│  Token Stored   │◀───────────│  Queue Worker   │  │
│  in Supabase    │            │  (Infinite      │  │
└─────────────────┘            │   Retry)        │  │
                               └─────────────────┘  │
                                                    │
                               ┌─────────────────┐  │
                               │  Mobile App     │◀─┘
                               │  (Has JWT)      │
                               └─────────────────┘
```

## Configuration

Environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
- `SUPABASE_QUEUE_FILE` - Custom path for queue file (optional)

## Troubleshooting

### "Connecting..." stuck on mobile app
1. Check `/api/auth/debug/supabase` to verify connection
2. Check `/api/auth/debug/queue-status` for pending tokens
3. Use `/api/auth/debug/supabase-sync` to force retry
4. Check server logs for detailed error messages

### Queue keeps growing
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
2. Check if Supabase project is paused (free tier pauses after 7 days inactivity)
3. Test connection from a different network

### Tokens stored but calendar not loading
The calendar API may need a valid access token. Check:
1. Token is in Supabase (`user_tokens` table)
2. `refresh_token` is not null
3. Token hasn't expired

## Files Modified

- `src/services/supabaseService.ts` - Robust Supabase wrapper
- `src/services/supabaseTokenService.ts` - Queue and worker logic
- `src/config/supabase.ts` - Extended timeout configuration
- `src/routes/auth.ts` - Debug endpoints
- `src/index.ts` - Worker startup and logging
- `supabase_token_queue.json` - Persistent queue file

