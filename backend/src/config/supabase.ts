/**
 * Supabase Configuration
 * 
 * This file provides backward compatibility for existing imports.
 * The new robust SupabaseService should be preferred for all new code.
 * 
 * @deprecated Use supabaseService.ts for new code
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Log configuration on load
console.log('[Supabase Config] Loading configuration...');
console.log('[Supabase Config] URL:', supabaseUrl ? supabaseUrl.substring(0, 40) + '...' : 'NOT SET ⚠️');
console.log('[Supabase Config] Key:', supabaseKey ? 'SET ✓' : 'NOT SET ⚠️');

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase Config] ⚠️  Supabase URL or Key is missing. Database operations will fail.');
  console.warn('[Supabase Config] Please check your .env file.');
}

/**
 * Custom fetch with 60 second timeout
 * Longer timeout for slow Indian networks (as noted in requirements)
 */
const createTimeoutFetch = (timeoutMs: number): typeof fetch => {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const timeoutId = setTimeout(() => {
      console.error(`[Supabase] Request timeout after ${timeoutMs}ms`);
      console.error(`[Supabase] URL: ${urlStr.substring(0, 80)}`);
      controller.abort();
    }, timeoutMs);

    const startTime = Date.now();

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      if (duration > 5000) {
        console.warn(`[Supabase] Slow request: ${duration}ms`);
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.error('[Supabase] ❌ REQUEST TIMEOUT');
        console.error(`[Supabase] Duration: ${duration}ms`);
        console.error(`[Supabase] Timeout was: ${timeoutMs}ms`);
        throw new Error(`Supabase request timeout after ${timeoutMs}ms - this may be due to slow network connection`);
      }
      
      console.error('[Supabase] ❌ Request failed:', error.message);
      console.error('[Supabase] Full error:', error.stack);
      throw error;
    }
  };
};

// Create Supabase client with extended timeout (60 seconds)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'focuswise-backend',
    },
    fetch: createTimeoutFetch(60000), // 60 second timeout
  },
});

/**
 * Test Supabase connection
 * Returns true if connection is successful, false otherwise
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
  console.log('[Supabase] Testing connection...');
  console.log('[Supabase] URL:', supabaseUrl);
  
  try {
    const startTime = Date.now();
    const { error } = await supabase.from('user_tokens').select('user_id').limit(1);
    const duration = Date.now() - startTime;
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('[Supabase] Connection test failed:', error.message);
      console.error('[Supabase] Error details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return false;
    }
    
    console.log(`[Supabase] ✅ Connection test successful (${duration}ms)`);
    return true;
  } catch (error: any) {
    console.error('[Supabase] ❌ Connection test error:', error.message);
    console.error('[Supabase] Full stack:', error.stack);
    return false;
  }
};
