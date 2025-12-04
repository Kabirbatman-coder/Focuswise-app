/**
 * Robust Supabase Service Wrapper
 * 
 * Provides a resilient layer over Supabase operations with:
 * - 60 second timeout
 * - Auto retry with exponential backoff: 1s, 3s, 5s, 10s, 20s, 30s
 * - Clear error logging when Supabase is unreachable
 * - NEVER crashes the OAuth callback
 */

import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Retry delays in milliseconds: 1s, 3s, 5s, 10s, 20s, 30s
const RETRY_DELAYS_MS = [1000, 3000, 5000, 10000, 20000, 30000];
const SUPABASE_TIMEOUT_MS = 60000; // 60 second timeout

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Log resolved configuration on startup
console.log('[SupabaseService] Initializing with config:');
console.log('[SupabaseService] SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('[SupabaseService] SUPABASE_KEY:', supabaseKey ? 'SET (hidden)' : 'NOT SET');

if (!supabaseUrl || !supabaseKey) {
  console.error('[SupabaseService] ❌ CRITICAL: Supabase URL or Key is missing!');
  console.error('[SupabaseService] Database operations will fail.');
}

/**
 * Custom fetch with configurable timeout
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch => {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const timeoutId = setTimeout(() => {
      console.log(`[SupabaseService] Request timeout after ${timeoutMs}ms for: ${urlStr.substring(0, 60)}`);
      controller.abort();
    }, timeoutMs);

    const startTime = Date.now();
    console.log(`[SupabaseService] Starting request to: ${urlStr.substring(0, 60)}...`);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`[SupabaseService] Request completed in ${duration}ms, status: ${response.status}`);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.error(`[SupabaseService] ❌ REQUEST TIMEOUT after ${duration}ms`);
        console.error(`[SupabaseService] URL: ${urlStr}`);
        throw new Error(`Supabase request timeout after ${timeoutMs}ms`);
      }
      
      console.error(`[SupabaseService] ❌ Request failed after ${duration}ms:`, error.message);
      console.error(`[SupabaseService] Full error stack:`, error.stack);
      throw error;
    }
  };
};

// Create Supabase client with robust configuration
const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'focuswise-backend-v2',
    },
    fetch: createTimeoutFetch(SUPABASE_TIMEOUT_MS),
  },
});

/**
 * Delay helper
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if an error is transient (retryable)
 */
const isTransientError = (error: any): boolean => {
  const message = error?.message || String(error);
  const transientPatterns = [
    'timeout',
    'UND_ERR_CONNECT_TIMEOUT',
    'ConnectTimeoutError',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'AbortError',
    'fetch failed',
    'Request timeout',
    'network',
    'socket',
    'EPIPE',
  ];
  
  return transientPatterns.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
};

export type SafeWriteResult = {
  success: boolean;
  error?: string;
  data?: any;
  attempts: number;
  queued?: boolean;
};

/**
 * Safe write operation with retry logic
 * 
 * @param table - The table name to write to
 * @param payload - The data payload to insert/upsert
 * @param options - Options for the write operation
 * @returns SafeWriteResult with success status and any errors
 */
export const safeWrite = async (
  table: string,
  payload: Record<string, any>,
  options: {
    upsert?: boolean;
    onConflict?: string;
    maxRetries?: number;
  } = {}
): Promise<SafeWriteResult> => {
  const { upsert = true, onConflict = 'user_id', maxRetries = RETRY_DELAYS_MS.length } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delayMs: number = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 1000;
    
    console.log(`[SupabaseService] safeWrite attempt ${attempt}/${maxRetries} to table: ${table}`);
    
    try {
      let result;
      
      if (upsert) {
        result = await supabaseClient
          .from(table)
          .upsert(payload, { onConflict });
      } else {
        result = await supabaseClient
          .from(table)
          .insert(payload);
      }
      
      if (result.error) {
        const pgError = result.error as PostgrestError;
        console.error(`[SupabaseService] Write error on attempt ${attempt}:`, {
          message: pgError.message,
          details: pgError.details,
          hint: pgError.hint,
          code: pgError.code,
        });
        
        lastError = new Error(pgError.message);
        
        // Don't retry on non-transient database errors
        if (!isTransientError(pgError)) {
          console.error('[SupabaseService] Non-transient database error, not retrying');
          return {
            success: false,
            error: pgError.message,
            attempts: attempt,
          };
        }
        
        if (attempt < maxRetries) {
          console.log(`[SupabaseService] Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          continue;
        }
      } else {
        console.log(`[SupabaseService] ✅ Write successful to ${table} on attempt ${attempt}`);
        return {
          success: true,
          data: result.data,
          attempts: attempt,
        };
      }
    } catch (error: any) {
      console.error(`[SupabaseService] Exception on attempt ${attempt}:`, error.message);
      console.error(`[SupabaseService] Full stack:`, error.stack);
      
      lastError = error;
      
      if (isTransientError(error) && attempt < maxRetries) {
        console.log(`[SupabaseService] Transient error, retrying in ${delayMs}ms...`);
        await delay(delayMs);
        continue;
      }
      
      if (!isTransientError(error)) {
        console.error('[SupabaseService] Non-transient error, not retrying');
        return {
          success: false,
          error: error.message,
          attempts: attempt,
        };
      }
    }
  }
  
  console.error(`[SupabaseService] ❌ All ${maxRetries} attempts failed for table: ${table}`);
  return {
    success: false,
    error: lastError?.message || 'Unknown error after all retries',
    attempts: maxRetries,
  };
};

/**
 * Safe select operation with retry logic
 */
export const safeSelect = async (
  table: string,
  columns: string = '*',
  filter?: { column: string; value: any },
  options: { maxRetries?: number } = {}
): Promise<SafeWriteResult> => {
  const { maxRetries = RETRY_DELAYS_MS.length } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delayMs: number = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 1000;
    
    console.log(`[SupabaseService] safeSelect attempt ${attempt}/${maxRetries} from table: ${table}`);
    
    try {
      let query = supabaseClient.from(table).select(columns);
      
      if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      
      const result = await query;
      
      if (result.error) {
        const pgError = result.error as PostgrestError;
        console.error(`[SupabaseService] Select error on attempt ${attempt}:`, pgError.message);
        
        lastError = new Error(pgError.message);
        
        if (!isTransientError(pgError)) {
          return {
            success: false,
            error: pgError.message,
            attempts: attempt,
          };
        }
        
        if (attempt < maxRetries) {
          console.log(`[SupabaseService] Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          continue;
        }
      } else {
        console.log(`[SupabaseService] ✅ Select successful from ${table} on attempt ${attempt}`);
        return {
          success: true,
          data: result.data,
          attempts: attempt,
        };
      }
    } catch (error: any) {
      console.error(`[SupabaseService] Exception on attempt ${attempt}:`, error.message);
      
      lastError = error;
      
      if (isTransientError(error) && attempt < maxRetries) {
        console.log(`[SupabaseService] Transient error, retrying in ${delayMs}ms...`);
        await delay(delayMs);
        continue;
      }
      
      if (!isTransientError(error)) {
        return {
          success: false,
          error: error.message,
          attempts: attempt,
        };
      }
    }
  }
  
  return {
    success: false,
    error: lastError?.message || 'Unknown error after all retries',
    attempts: maxRetries,
  };
};

/**
 * Test Supabase connection with retry logic
 */
export const testConnection = async (): Promise<boolean> => {
  console.log('[SupabaseService] Testing connection to Supabase...');
  console.log('[SupabaseService] URL:', supabaseUrl);
  
  try {
    const result = await safeSelect('user_tokens', 'user_id', undefined, { maxRetries: 3 });
    
    if (result.success) {
      console.log('[SupabaseService] ✅ Connection test successful');
      return true;
    }
    
    console.error('[SupabaseService] ❌ Connection test failed:', result.error);
    return false;
  } catch (error: any) {
    console.error('[SupabaseService] ❌ Connection test exception:', error.message);
    console.error('[SupabaseService] Full stack:', error.stack);
    return false;
  }
};

/**
 * Get the raw Supabase client for cases where direct access is needed
 * Use safeWrite/safeSelect when possible instead
 */
export const getRawClient = (): SupabaseClient => supabaseClient;

export default {
  safeWrite,
  safeSelect,
  testConnection,
  getRawClient,
};

