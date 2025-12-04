/**
 * Supabase Token Queue Service
 * 
 * Handles reliable token storage with:
 * - Automatic retry every 5 seconds (infinite retries until success)
 * - Persistent queue stored in supabase_token_queue.json
 * - Clear success/failure logging
 * - Manual sync endpoint support
 */

import fs from 'fs';
import path from 'path';
import { safeWrite } from './supabaseService';

// Queue item type
type QueuedTokenWrite = {
  id: string;
  userId: string;
  email: string;
  accessToken: string;
  encryptedRefreshToken: string | null;
  createdAt: string;
  lastError?: string;
  attempts: number;
  lastAttempt?: string;
};

// Retry interval: 5 seconds (as specified in requirements)
const RETRY_INTERVAL_MS = 5000;

// Queue file path
const queueFilePath =
  process.env.SUPABASE_QUEUE_FILE ||
  path.resolve(__dirname, '../../supabase_token_queue.json');

/**
 * Logging helper with timestamp
 */
const log = (level: 'info' | 'error' | 'warn' | 'success', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [Supabase]`;
  
  switch (level) {
    case 'error':
      console.error(`${prefix} ❌ ${message}`, data ? data : '');
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`, data ? data : '');
      break;
    case 'success':
      console.log(`${prefix} ✅ ${message}`, data ? data : '');
      break;
    default:
      console.log(`${prefix} ${message}`, data ? data : '');
  }
};

/**
 * Load queue from file
 */
const loadQueue = (): QueuedTokenWrite[] => {
  try {
    if (!fs.existsSync(queueFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(queueFilePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    log('error', 'Failed to load queue file', { error: err, path: queueFilePath });
    return [];
  }
};

/**
 * Save queue to file
 */
const saveQueue = (queue: QueuedTokenWrite[]) => {
  try {
    fs.writeFileSync(queueFilePath, JSON.stringify(queue, null, 2), 'utf8');
    log('info', `Queue saved (${queue.length} items)`, { path: queueFilePath });
  } catch (err) {
    log('error', 'Failed to save queue file', { error: err });
  }
};

/**
 * Enqueue a token write operation
 * Called when Supabase is unreachable during OAuth callback
 */
export const enqueueTokenWrite = (params: {
  userId: string;
  email: string;
  accessToken: string;
  encryptedRefreshToken: string | null;
}): string => {
  const queue = loadQueue();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const item: QueuedTokenWrite = {
    id,
    userId: params.userId,
    email: params.email,
    accessToken: params.accessToken,
    encryptedRefreshToken: params.encryptedRefreshToken,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  // Remove any existing entry for this user (keep only latest)
  const filteredQueue = queue.filter(q => q.userId !== params.userId);
  filteredQueue.push(item);
  saveQueue(filteredQueue);

  log('info', `Write queued: ${params.userId}`, { id, email: params.email });

  return id;
};

/**
 * Attempt to write a single token to Supabase
 * Uses the robust safeWrite from supabaseService
 */
const performTokenWrite = async (item: QueuedTokenWrite): Promise<boolean> => {
  log('info', `Attempting write for user: ${item.userId}`, { 
    attempt: item.attempts + 1,
    queuedAt: item.createdAt 
  });

  try {
    const result = await safeWrite(
      'user_tokens',
      {
        user_id: item.userId,
        access_token: item.accessToken,
        refresh_token: item.encryptedRefreshToken,
        updated_at: new Date().toISOString(),
      },
      { upsert: true, onConflict: 'user_id' }
    );

    if (result.success) {
      log('success', `Write successful: ${item.userId}`, { 
        attempts: item.attempts + 1,
        queuedDuration: Date.now() - new Date(item.createdAt).getTime() + 'ms'
      });
      
      // Try to insert calendar connected marker (non-critical)
      try {
        await safeWrite(
          'calendar_events',
          {
            user_id: item.userId,
            google_event_id: `calendar-connected-${Date.now()}`,
            summary: 'Calendar connected',
            description: 'Tokens stored successfully',
            status: 'connected',
          },
          { upsert: false, maxRetries: 2 }
        );
      } catch {
        // Non-fatal, ignore
      }
      
      return true;
    }

    log('error', `Write failed: ${item.userId}`, { 
      error: result.error,
      attempts: item.attempts + 1 
    });
    return false;
  } catch (error: any) {
    log('error', `Write exception: ${item.userId}`, { 
      error: error.message,
      attempts: item.attempts + 1 
    });
    return false;
  }
};

/**
 * Process all items in the queue
 * Returns stats about processing
 */
export const processQueue = async (): Promise<{ processed: number; failed: number; remaining: number }> => {
  const queue = loadQueue();
  
  if (queue.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  log('info', `Processing queue: ${queue.length} items`);

  const remaining: QueuedTokenWrite[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    const success = await performTokenWrite(item);

    if (success) {
      processed++;
    } else {
      failed++;
      // Keep item in queue with updated attempt count
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: new Date().toISOString(),
        lastError: 'Failed to write to Supabase',
      });
    }
  }

  saveQueue(remaining);

  log('info', `Queue processing complete`, { processed, failed, remaining: remaining.length });

  return { processed, failed, remaining: remaining.length };
};

/**
 * Force sync all queued writes (manual trigger)
 * Used by /api/debug/supabase-sync endpoint
 */
export const forceSyncAll = async (): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  remaining: number;
  items: Array<{ userId: string; status: string; error?: string }>;
}> => {
  const queue = loadQueue();
  
  if (queue.length === 0) {
    return { 
      success: true, 
      processed: 0, 
      failed: 0, 
      remaining: 0,
      items: [] 
    };
  }

  log('info', `Force sync triggered: ${queue.length} items`);

  const remaining: QueuedTokenWrite[] = [];
  const items: Array<{ userId: string; status: string; error?: string }> = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    const success = await performTokenWrite(item);

    if (success) {
      processed++;
      items.push({ userId: item.userId, status: 'success' });
    } else {
      failed++;
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: new Date().toISOString(),
        lastError: 'Failed to write to Supabase',
      });
      items.push({ userId: item.userId, status: 'failed', error: 'Supabase write failed' });
    }
  }

  saveQueue(remaining);

  return { 
    success: failed === 0, 
    processed, 
    failed, 
    remaining: remaining.length,
    items 
  };
};

/**
 * Get current queue status
 */
export const getQueueStatus = (): {
  size: number;
  items: Array<{ userId: string; attempts: number; createdAt: string; lastAttempt: string | undefined }>;
} => {
  const queue = loadQueue();
  return {
    size: queue.length,
    items: queue.map(item => ({
      userId: item.userId,
      attempts: item.attempts,
      createdAt: item.createdAt,
      lastAttempt: item.lastAttempt,
    })),
  };
};

// Worker state
let workerStarted = false;
let workerInterval: NodeJS.Timeout | null = null;

/**
 * Start the background worker that processes the queue
 * Runs every 5 seconds (INFINITE retries until success)
 */
export const startSupabaseTokenQueueWorker = () => {
  if (workerStarted) {
    log('info', 'Worker already running, skipping start');
    return;
  }
  
  workerStarted = true;
  
  log('info', 'Background worker starting', { 
    interval: `${RETRY_INTERVAL_MS}ms`,
    queuePath: queueFilePath 
  });

  // Process immediately on start
  processQueue().catch(err => {
    log('error', 'Initial queue processing failed', { error: err.message });
  });

  // Then process every 5 seconds
  workerInterval = setInterval(async () => {
    try {
      const result = await processQueue();
      
      if (result.processed > 0 || result.failed > 0) {
        log('info', 'Worker cycle complete', result);
      }
    } catch (err: any) {
      log('error', 'Worker cycle failed', { error: err.message });
    }
  }, RETRY_INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    if (workerInterval) {
      clearInterval(workerInterval);
      log('info', 'Worker stopped (SIGTERM)');
    }
  });
};

/**
 * Stop the background worker
 */
export const stopSupabaseTokenQueueWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    workerStarted = false;
    log('info', 'Worker stopped');
  }
};

export default {
  enqueueTokenWrite,
  processQueue,
  forceSyncAll,
  getQueueStatus,
  startSupabaseTokenQueueWorker,
  stopSupabaseTokenQueueWorker,
};
