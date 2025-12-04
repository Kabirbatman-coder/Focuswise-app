import { Router, Request, Response } from 'express';
import { googleLogin, googleCallback, getMe } from '../controllers/authController';
import { testConnection } from '../services/supabaseService';
import { forceSyncAll, getQueueStatus } from '../services/supabaseTokenService';
import { getLocalStoreStatus, getTokensFromLocal } from '../services/localTokenStore';

const router = Router();

// Google OAuth routes
router.get('/google/login', googleLogin);
router.get('/google/callback', googleCallback);
router.get('/google/me', getMe);

// Debug route to verify OAuth callback URL configuration
router.get('/debug/oauth', (req: Request, res: Response) => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const ngrokUrl = process.env.NGROK_URL || 'Not configured';
  
  res.json({
    message: 'OAuth Debug Information',
    configuredRedirectUri: redirectUri || 'Not configured',
    ngrokUrl: ngrokUrl,
    expectedCallbackUrl: redirectUri ? `${redirectUri}` : 'Not configured',
    instructions: [
      '1. Make sure GOOGLE_REDIRECT_URI in .env matches your ngrok URL + /api/auth/google/callback',
      '2. Add this exact callback URL to Google Cloud Console OAuth credentials',
      '3. Example: https://your-ngrok-url.ngrok-free.dev/api/auth/google/callback',
      '4. Make sure ngrok is running and forwarding to localhost:3000',
    ],
  });
});

// Debug route to test Supabase connection
router.get('/debug/supabase', async (req: Request, res: Response) => {
  const supabaseUrl = process.env.SUPABASE_URL || 'Not configured';
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;
  
  try {
    console.log('[Debug] Testing Supabase connection...');
    const connected = await testConnection();
    const queueStatus = getQueueStatus();
    
    res.json({
      message: 'Supabase Connection Debug',
      supabaseUrl: supabaseUrl,
      hasServiceKey: hasServiceKey,
      hasAnonKey: hasAnonKey,
      connectionTest: connected ? '✅ Connected' : '❌ Failed',
      queue: {
        size: queueStatus.size,
        items: queueStatus.items,
      },
      troubleshooting: [
        '1. Check SUPABASE_URL matches your project URL (from Supabase Dashboard → Settings → API)',
        '2. Verify SUPABASE_SERVICE_ROLE_KEY is correct (from Supabase Dashboard → Settings → API)',
        '3. Make sure user_tokens table exists (run schema.sql in Supabase SQL Editor)',
        '4. Check your internet connection',
        '5. Verify Supabase project is active and not paused',
        '6. On slow networks, tokens may be queued. Use /api/debug/supabase-sync to force retry.',
      ],
    });
  } catch (error: any) {
    console.error('[Debug] Supabase test error:', error);
    res.status(500).json({
      message: 'Supabase Connection Debug',
      error: error.message,
      supabaseUrl: supabaseUrl,
      hasServiceKey: hasServiceKey,
      hasAnonKey: hasAnonKey,
    });
  }
});

/**
 * GET /api/auth/debug/supabase-sync
 * 
 * Force retry ALL queued Supabase writes.
 * Use this when you know Supabase is reachable and want to flush the queue.
 */
router.get('/debug/supabase-sync', async (req: Request, res: Response) => {
  console.log('[Debug] Manual Supabase sync triggered');
  
  try {
    const queueBefore = getQueueStatus();
    console.log('[Debug] Queue before sync:', queueBefore);
    
    const result = await forceSyncAll();
    
    console.log('[Debug] Sync result:', result);
    
    res.json({
      message: 'Supabase Sync Result',
      timestamp: new Date().toISOString(),
      queueBefore: queueBefore.size,
      queueAfter: result.remaining,
      processed: result.processed,
      failed: result.failed,
      success: result.success,
      items: result.items,
      note: result.remaining > 0 
        ? 'Some items still in queue. They will be retried automatically every 5 seconds.'
        : 'All queued items have been processed successfully.',
    });
  } catch (error: any) {
    console.error('[Debug] Supabase sync error:', error);
    res.status(500).json({
      message: 'Supabase Sync Failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/auth/debug/queue-status
 * 
 * Get current status of the token queue without modifying it.
 */
router.get('/debug/queue-status', (req: Request, res: Response) => {
  const status = getQueueStatus();
  
  res.json({
    message: 'Token Queue Status',
    timestamp: new Date().toISOString(),
    queueSize: status.size,
    items: status.items,
    retryInterval: '5 seconds',
    note: status.size > 0 
      ? 'Items are being retried automatically. Use /api/debug/supabase-sync to force immediate retry.'
      : 'Queue is empty. All tokens have been stored successfully.',
  });
});

/**
 * GET /api/auth/debug/local-store
 * 
 * Get status of the local SQLite token store.
 * This store is used when Supabase is unreachable.
 */
router.get('/debug/local-store', (req: Request, res: Response) => {
  try {
    const status = getLocalStoreStatus();
    
    res.json({
      message: 'Local SQLite Token Store Status',
      timestamp: new Date().toISOString(),
      status: {
        tokenCount: status.tokenCount,
        unsyncedToSupabase: status.unsyncedTokenCount,
        eventCount: status.eventCount,
        databasePath: status.dbPath,
      },
      explanation: {
        purpose: 'Local store enables the app to work even when Supabase is unreachable.',
        howItWorks: [
          '1. When you authenticate with Google, tokens are stored LOCALLY first.',
          '2. Tokens are also queued for Supabase storage (background sync).',
          '3. Calendar operations check LOCAL store first, then Supabase.',
          '4. This means the app works immediately, regardless of Supabase connectivity.',
        ],
        supabaseStatus: status.unsyncedTokenCount > 0 
          ? `⚠️ ${status.unsyncedTokenCount} tokens not yet synced to Supabase (will retry automatically)`
          : '✅ All tokens synced to Supabase',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to get local store status',
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/debug/check-user/:userId
 * 
 * Check if a specific user has tokens stored (both local and queue)
 */
router.get('/debug/check-user/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }
  
  try {
    const localTokens = getTokensFromLocal(userId);
    const queueStatus = getQueueStatus();
    const inQueue = queueStatus.items.some(item => item.userId === userId);
    
    res.json({
      message: `Token status for user: ${userId}`,
      timestamp: new Date().toISOString(),
      localStore: {
        found: localTokens.success,
        hasAccessToken: !!localTokens.accessToken,
        hasRefreshToken: !!localTokens.refreshToken,
        email: localTokens.email || 'N/A',
      },
      supabaseQueue: {
        inQueue: inQueue,
        queueEntry: inQueue ? queueStatus.items.find(item => item.userId === userId) : null,
      },
      summary: localTokens.success
        ? '✅ User can use the calendar (tokens found in local store)'
        : inQueue 
          ? '⏳ Tokens are queued but not yet in local store - please re-authenticate'
          : '❌ No tokens found - user needs to authenticate',
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to check user tokens',
      error: error.message,
    });
  }
});

export default router;
