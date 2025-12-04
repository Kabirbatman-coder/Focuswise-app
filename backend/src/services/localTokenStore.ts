/**
 * Local SQLite Token Store (using sql.js - pure JS, no native deps)
 * 
 * Provides LOCAL storage for tokens when Supabase is unreachable.
 * This enables the app to work completely offline/without Supabase during development.
 * 
 * Usage:
 * - Tokens are stored locally immediately when received from Google OAuth
 * - Calendar operations check local store FIRST, then fall back to Supabase
 * - Background sync pushes local tokens to Supabase when available
 */

import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

// Database file path
const DB_PATH = process.env.LOCAL_DB_PATH || path.resolve(__dirname, '../../local_tokens.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('[LocalTokenStore] Initializing local SQLite database at:', DB_PATH);

// Database instance (initialized asynchronously)
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * Initialize the database (lazy, async)
 */
const initDb = async (): Promise<Database> => {
  if (db) return db;
  
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const SQL = await initSqlJs();
    
    // Try to load existing database from file
    let database: Database;
    if (fs.existsSync(DB_PATH)) {
      try {
        const fileBuffer = fs.readFileSync(DB_PATH);
        database = new SQL.Database(fileBuffer);
        console.log('[LocalTokenStore] ✅ Loaded existing database from file');
      } catch (e) {
        console.log('[LocalTokenStore] Creating new database (could not load existing)');
        database = new SQL.Database();
      }
    } else {
      console.log('[LocalTokenStore] Creating new database');
      database = new SQL.Database();
    }
    
    // Create tables
    database.run(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        user_id TEXT PRIMARY KEY,
        email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        synced_to_supabase INTEGER DEFAULT 0
      )
    `);
    
    database.run(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        google_event_id TEXT UNIQUE,
        summary TEXT,
        description TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        html_link TEXT,
        status TEXT DEFAULT 'confirmed',
        created_at TEXT DEFAULT (datetime('now')),
        synced_to_supabase INTEGER DEFAULT 0
      )
    `);
    
    // Save immediately
    saveDbToFile(database);
    
    db = database;
    console.log('[LocalTokenStore] ✅ Database initialized successfully');
    return database;
  })();
  
  return initPromise;
};

/**
 * Save database to file
 */
const saveDbToFile = (database: Database) => {
  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e: any) {
    console.error('[LocalTokenStore] Failed to save database:', e.message);
  }
};

/**
 * Store tokens locally
 */
export const storeTokensLocally = (params: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
}): boolean => {
  try {
    // Synchronous initialization for simplicity
    if (!db) {
      // Sync initialization - block until ready
      const SQL = require('sql.js');
      
      // Check if we need to await the init
      if (!db) {
        // Use sync loading for immediate storage
        const sqlPromise = initSqlJs();
        
        // We can't await here, so use a simpler approach
        // Write to a JSON file as fallback
        const jsonPath = DB_PATH.replace('.db', '.json');
        let tokens: Record<string, any> = {};
        
        if (fs.existsSync(jsonPath)) {
          try {
            tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          } catch {
            tokens = {};
          }
        }
        
        tokens[params.userId] = {
          userId: params.userId,
          email: params.email,
          accessToken: params.accessToken,
          refreshToken: params.refreshToken,
          updatedAt: new Date().toISOString(),
          syncedToSupabase: false,
        };
        
        fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
        console.log('[LocalTokenStore] ✅ Tokens stored (JSON fallback) for user:', params.userId);
        
        // Also trigger async DB init for future use
        initDb().catch(() => {});
        
        return true;
      }
    }
    
    db.run(
      `INSERT INTO user_tokens (user_id, email, access_token, refresh_token, updated_at, synced_to_supabase)
       VALUES (?, ?, ?, ?, datetime('now'), 0)
       ON CONFLICT(user_id) DO UPDATE SET
         email = excluded.email,
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, user_tokens.refresh_token),
         updated_at = datetime('now'),
         synced_to_supabase = 0`,
      [params.userId, params.email, params.accessToken, params.refreshToken]
    );
    
    saveDbToFile(db);
    console.log('[LocalTokenStore] ✅ Tokens stored locally for user:', params.userId);
    return true;
  } catch (error: any) {
    console.error('[LocalTokenStore] ❌ Failed to store tokens:', error.message);
    
    // Fallback to JSON file
    try {
      const jsonPath = DB_PATH.replace('.db', '.json');
      let tokens: Record<string, any> = {};
      
      if (fs.existsSync(jsonPath)) {
        try {
          tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch {
          tokens = {};
        }
      }
      
      tokens[params.userId] = {
        userId: params.userId,
        email: params.email,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        updatedAt: new Date().toISOString(),
        syncedToSupabase: false,
      };
      
      fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
      console.log('[LocalTokenStore] ✅ Tokens stored (JSON fallback) for user:', params.userId);
      return true;
    } catch (jsonError: any) {
      console.error('[LocalTokenStore] ❌ JSON fallback also failed:', jsonError.message);
      return false;
    }
  }
};

/**
 * Get tokens from local store
 */
export const getTokensFromLocal = (userId: string): {
  success: boolean;
  accessToken?: string;
  refreshToken?: string | null;
  email?: string;
  error?: string;
} => {
  try {
    // Try JSON file first (always available)
    const jsonPath = DB_PATH.replace('.db', '.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (tokens[userId]) {
          console.log('[LocalTokenStore] ✅ Tokens retrieved (JSON) for user:', userId);
          return {
            success: true,
            accessToken: tokens[userId].accessToken,
            refreshToken: tokens[userId].refreshToken,
            email: tokens[userId].email,
          };
        }
      } catch {
        // Continue to try SQLite
      }
    }
    
    // Try SQLite if initialized
    if (db) {
      const stmt = db.prepare(`SELECT access_token, refresh_token, email FROM user_tokens WHERE user_id = ?`);
      stmt.bind([userId]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        
        console.log('[LocalTokenStore] ✅ Tokens retrieved (SQLite) for user:', userId);
        return {
          success: true,
          accessToken: row.access_token as string,
          refreshToken: row.refresh_token as string | null,
          email: row.email as string,
        };
      }
      stmt.free();
    }
    
    return { success: false, error: 'No tokens found locally' };
  } catch (error: any) {
    console.error('[LocalTokenStore] ❌ Failed to get tokens:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user exists in local store
 */
export const hasLocalTokens = (userId: string): boolean => {
  const result = getTokensFromLocal(userId);
  return result.success;
};

/**
 * Get all unsynced tokens for background sync to Supabase
 */
export const getUnsyncedTokens = (): Array<{
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
}> => {
  const results: Array<{
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string | null;
  }> = [];
  
  // Check JSON file
  const jsonPath = DB_PATH.replace('.db', '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      for (const [userId, data] of Object.entries(tokens)) {
        const tokenData = data as any;
        if (!tokenData.syncedToSupabase) {
          results.push({
            userId,
            email: tokenData.email,
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
          });
        }
      }
    } catch {
      // Ignore JSON errors
    }
  }
  
  return results;
};

/**
 * Mark tokens as synced to Supabase
 */
export const markTokensSynced = (userId: string): boolean => {
  try {
    // Update JSON file
    const jsonPath = DB_PATH.replace('.db', '.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (tokens[userId]) {
          tokens[userId].syncedToSupabase = true;
          fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
        }
      } catch {
        // Ignore
      }
    }
    
    // Update SQLite if available
    if (db) {
      db.run(`UPDATE user_tokens SET synced_to_supabase = 1 WHERE user_id = ?`, [userId]);
      saveDbToFile(db);
    }
    
    console.log('[LocalTokenStore] Marked tokens as synced for user:', userId);
    return true;
  } catch (error: any) {
    console.error('[LocalTokenStore] Failed to mark tokens synced:', error.message);
    return false;
  }
};

/**
 * Store calendar event locally
 */
export const storeEventLocally = (params: {
  userId: string;
  googleEventId: string;
  summary: string;
  description?: string | null | undefined;
  startTime?: string | undefined;
  endTime?: string | undefined;
  location?: string | null | undefined;
  htmlLink?: string | null | undefined;
  status?: string | undefined;
}): boolean => {
  try {
    // Store in JSON file (simpler and always works)
    const jsonPath = DB_PATH.replace('.db', '_events.json');
    let events: any[] = [];
    
    if (fs.existsSync(jsonPath)) {
      try {
        events = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (!Array.isArray(events)) events = [];
      } catch {
        events = [];
      }
    }
    
    // Remove existing event with same google_event_id
    events = events.filter(e => e.google_event_id !== params.googleEventId);
    
    // Add new event
    events.push({
      user_id: params.userId,
      google_event_id: params.googleEventId,
      summary: params.summary,
      description: params.description || null,
      start_time: params.startTime || null,
      end_time: params.endTime || null,
      location: params.location || null,
      html_link: params.htmlLink || null,
      status: params.status || 'confirmed',
      created_at: new Date().toISOString(),
    });
    
    fs.writeFileSync(jsonPath, JSON.stringify(events, null, 2));
    return true;
  } catch (error: any) {
    console.error('[LocalTokenStore] Failed to store event:', error.message);
    return false;
  }
};

/**
 * Get events from local store
 */
export const getEventsFromLocal = (userId: string): any[] => {
  try {
    const jsonPath = DB_PATH.replace('.db', '_events.json');
    if (!fs.existsSync(jsonPath)) return [];
    
    const events = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(events)) return [];
    
    return events
      .filter((e: any) => e.user_id === userId)
      .sort((a: any, b: any) => {
        const aTime = new Date(a.start_time || 0).getTime();
        const bTime = new Date(b.start_time || 0).getTime();
        return aTime - bTime;
      });
  } catch (error: any) {
    console.error('[LocalTokenStore] Failed to get events:', error.message);
    return [];
  }
};

/**
 * Get local store status
 */
export const getLocalStoreStatus = (): {
  tokenCount: number;
  unsyncedTokenCount: number;
  eventCount: number;
  dbPath: string;
} => {
  let tokenCount = 0;
  let unsyncedTokenCount = 0;
  let eventCount = 0;
  
  // Check JSON files
  const jsonPath = DB_PATH.replace('.db', '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      tokenCount = Object.keys(tokens).length;
      unsyncedTokenCount = Object.values(tokens).filter((t: any) => !t.syncedToSupabase).length;
    } catch {
      // Ignore
    }
  }
  
  const eventsPath = DB_PATH.replace('.db', '_events.json');
  if (fs.existsSync(eventsPath)) {
    try {
      const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
      if (Array.isArray(events)) {
        eventCount = events.length;
      }
    } catch {
      // Ignore
    }
  }
  
  return {
    tokenCount,
    unsyncedTokenCount,
    eventCount,
    dbPath: DB_PATH,
  };
};

/**
 * Close database connection (for graceful shutdown)
 */
export const closeDatabase = () => {
  if (db) {
    saveDbToFile(db);
    db.close();
    db = null;
    console.log('[LocalTokenStore] Database connection closed');
  }
};

// Initialize database on module load (async, non-blocking)
initDb().catch(err => {
  console.error('[LocalTokenStore] ⚠️ Failed to initialize SQLite, using JSON fallback:', err.message);
});

// Handle process termination
process.on('SIGTERM', closeDatabase);
process.on('SIGINT', closeDatabase);

export default {
  storeTokensLocally,
  getTokensFromLocal,
  hasLocalTokens,
  getUnsyncedTokens,
  markTokensSynced,
  storeEventLocally,
  getEventsFromLocal,
  getLocalStoreStatus,
  closeDatabase,
};
