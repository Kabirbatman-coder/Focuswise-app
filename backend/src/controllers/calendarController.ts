import { Request, Response } from 'express';
import { safeWrite, safeSelect, getRawClient } from '../services/supabaseService';
import { getTokensFromLocal, storeEventLocally, getEventsFromLocal } from '../services/localTokenStore';
import * as googleService from '../services/googleCalendarService';
import { getAuthUser, AuthUser } from '../middleware/auth';
import { decryptRefreshToken } from '../services/googleOAuthService';

/**
 * Helper to get tokens - checks LOCAL store FIRST, then Supabase
 * This ensures the calendar works even when Supabase is unreachable
 */
const getTokensForUser = async (userId: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string | null;
  error: string | undefined;
  source?: 'local' | 'supabase';
}> => {
  // ============================================================
  // STEP 1: Try LOCAL store first (instant, always available)
  // ============================================================
  console.log('[Calendar] Checking LOCAL token store for user:', userId);
  const localResult = getTokensFromLocal(userId);
  
  if (localResult.success && localResult.accessToken) {
    console.log('[Calendar] ✅ Found tokens in LOCAL store');
    return {
      success: true,
      accessToken: localResult.accessToken,
      refreshToken: localResult.refreshToken || null,
      error: undefined,
      source: 'local',
    };
  }
  
  console.log('[Calendar] Tokens not in local store, trying Supabase...');
  
  // ============================================================
  // STEP 2: Fall back to Supabase (may timeout)
  // ============================================================
  try {
    const result = await safeSelect(
      'user_tokens',
      'access_token, refresh_token',
      { column: 'user_id', value: userId },
      { maxRetries: 2 } // Reduce retries since we have local fallback
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Supabase query failed' };
    }

    const data = result.data as any[];
    if (!data || data.length === 0) {
      return { success: false, error: 'No tokens found for user in any store' };
    }

    console.log('[Calendar] ✅ Found tokens in Supabase');
    return {
      success: true,
      accessToken: data[0].access_token,
      refreshToken: data[0].refresh_token,
      error: undefined,
      source: 'supabase',
    };
  } catch (supabaseError: any) {
    console.error('[Calendar] ❌ Supabase fetch failed:', supabaseError.message);
    return { 
      success: false, 
      error: `Both local and Supabase token lookup failed. Local: ${localResult.error || 'not found'}. Supabase: ${supabaseError.message}` 
    };
  }
};

export const syncCalendar = async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);

  if (!authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('[Calendar] Sync request from user:', authUser.userId);

  try {
    // Get tokens from database using robust safeSelect
    const tokenResult = await getTokensForUser(authUser.userId);

    if (!tokenResult.success) {
      console.error('[Calendar] Failed to get tokens:', tokenResult.error);
      return res.status(401).json({ 
        error: 'Failed to get user tokens. Please sign in again.',
        details: tokenResult.error
      });
    }

    const auth = googleService.getOAuthClient(tokenResult.accessToken, tokenResult.refreshToken);
    
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    console.log('[Calendar] Fetching events from', now.toISOString(), 'to', nextWeek.toISOString());
    const events = await googleService.listEvents(auth, now.toISOString(), nextWeek.toISOString());
    console.log('[Calendar] Fetched', events?.length || 0, 'events from Google');

    if (events && events.length > 0) {
      // Process events - store LOCALLY first, then try Supabase in background
      for (const event of events) {
        // Store locally first (instant, always works)
        storeEventLocally({
          userId: authUser.userId,
          googleEventId: event.id || `event-${Date.now()}`,
          summary: event.summary || 'No title',
          description: event.description || null,
          startTime: event.start?.dateTime || event.start?.date || undefined,
          endTime: event.end?.dateTime || event.end?.date || undefined,
          location: event.location || null,
          htmlLink: event.htmlLink || null,
          status: event.status || 'confirmed'
        });

        // Try Supabase in background (may fail, but that's OK)
        const record = {
          user_id: authUser.userId,
          google_event_id: event.id,
          summary: event.summary || 'No title',
          description: event.description || null,
          start_time: event.start?.dateTime || event.start?.date,
          end_time: event.end?.dateTime || event.end?.date,
          location: event.location || null,
          html_link: event.htmlLink || null,
          status: event.status || 'confirmed'
        };

        // Non-blocking Supabase write (don't await, just fire-and-forget)
        safeWrite(
          'calendar_events',
          record,
          { upsert: true, onConflict: 'google_event_id', maxRetries: 2 }
        ).then(writeResult => {
          if (!writeResult.success) {
            console.log('[Calendar] Supabase write failed for event (local copy exists):', event.id);
          }
        }).catch(() => {
          // Ignore - local copy exists
        });
      }

      console.log('[Calendar] ✅ Successfully processed', events.length, 'events (stored locally)');
    }

    res.json({ success: true, count: events?.length || 0, message: `Synced ${events?.length || 0} events` });
  } catch (error: any) {
    console.error('[Calendar] Sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync calendar' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);

    if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    
    try {
        // ============================================================
        // STEP 1: Try to get events from LOCAL store first
        // ============================================================
        console.log('[Calendar] Fetching events for user:', authUser.userId);
        const localEvents = getEventsFromLocal(authUser.userId);
        
        if (localEvents.length > 0) {
          console.log('[Calendar] ✅ Returning', localEvents.length, 'events from LOCAL store');
          // Transform to match expected format
          const formattedEvents = localEvents.map((e: any) => ({
            user_id: e.user_id,
            google_event_id: e.google_event_id,
            summary: e.summary,
            description: e.description,
            start_time: e.start_time,
            end_time: e.end_time,
            location: e.location,
            html_link: e.html_link,
            status: e.status,
          }));
          res.json(formattedEvents);
          return;
        }
        
        // ============================================================
        // STEP 2: Fall back to Supabase
        // ============================================================
        console.log('[Calendar] No local events, trying Supabase...');
        const now = new Date().toISOString();
        
        // Use raw client for complex queries, but wrapped with timeout
        const client = getRawClient();
        const { data, error } = await client
            .from('calendar_events')
            .select('*')
            .eq('user_id', authUser.userId)
            .gte('start_time', now)
            .order('start_time', { ascending: true })
            .limit(50);
            
        if (error) {
            console.error('[Calendar] Supabase fetch failed:', error);
            // Return empty array instead of error (user might be new)
            res.json([]);
            return;
        }
        
        console.log('[Calendar] Returning', data?.length || 0, 'events from Supabase');
        res.json(data || []);
    } catch (error: any) {
        console.error('[Calendar] Get events error:', error);
        // Return empty array instead of 500 error for better UX
        res.json([]);
    }
};

export const createEvent = async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const { event } = req.body;
    if (!event) {
        res.status(400).json({ error: 'Missing event data' });
        return;
    }
    
    try {
        // Get tokens from database
        const tokenResult = await getTokensForUser(authUser.userId);

        if (!tokenResult.success) {
            return res.status(401).json({ error: 'Failed to get user tokens' });
        }

        const auth = googleService.getOAuthClient(tokenResult.accessToken, tokenResult.refreshToken);
        const newEvent = await googleService.insertEvent(auth, event);
        
        // Sync back to local DB using safeWrite
        const record = {
            user_id: authUser.userId,
            google_event_id: newEvent.id,
            summary: newEvent.summary || 'No title',
            description: newEvent.description || null,
            start_time: newEvent.start?.dateTime || newEvent.start?.date,
            end_time: newEvent.end?.dateTime || newEvent.end?.date,
            location: newEvent.location || null,
            html_link: newEvent.htmlLink || null,
            status: newEvent.status || 'confirmed'
        };
        
        const writeResult = await safeWrite('calendar_events', record, { upsert: false });
        if (!writeResult.success) {
            console.error('[Calendar] Failed to save new event to DB:', writeResult.error);
            // Still return success since Google Calendar was updated
        }
        
        console.log('[Calendar] Created event:', newEvent.id);
        res.json(record);
    } catch (error: any) {
        console.error('[Calendar] Create event error:', error);
        res.status(500).json({ error: error.message || 'Failed to create event' });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const { eventId } = req.params;
    const { event } = req.body;
    
    if (!eventId) {
        res.status(400).json({ error: 'Missing eventId' });
        return;
    }
    
    if (!event) {
        res.status(400).json({ error: 'Missing event data' });
        return;
    }
    
    try {
        // Get tokens from database
        const tokenResult = await getTokensForUser(authUser.userId);

        if (!tokenResult.success) {
            return res.status(401).json({ error: 'Failed to get user tokens' });
        }

        const auth = googleService.getOAuthClient(tokenResult.accessToken, tokenResult.refreshToken);
        const updatedEvent = await googleService.updateEvent(auth, eventId, event);
        
        // Update in local DB using raw client (update operation)
        const client = getRawClient();
        const record = {
            summary: updatedEvent.summary,
            description: updatedEvent.description,
            start_time: updatedEvent.start?.dateTime || updatedEvent.start?.date,
            end_time: updatedEvent.end?.dateTime || updatedEvent.end?.date,
            location: updatedEvent.location,
            status: updatedEvent.status
        };
        
        const { error } = await client
            .from('calendar_events')
            .update(record)
            .eq('google_event_id', eventId)
            .eq('user_id', authUser.userId);
            
        if (error) {
            console.error('[Calendar] Failed to update event in DB:', error);
            // Still return success since Google Calendar was updated
        }
        
        console.log('[Calendar] Updated event:', eventId);
        res.json(updatedEvent);
    } catch (error: any) {
        console.error('[Calendar] Update event error:', error);
        res.status(500).json({ error: error.message || 'Failed to update event' });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const { eventId } = req.params;
    
    if (!eventId) {
        res.status(400).json({ error: 'Missing eventId' });
        return;
    }
    
    try {
        // Get tokens from database
        const tokenResult = await getTokensForUser(authUser.userId);

        if (!tokenResult.success) {
            return res.status(401).json({ error: 'Failed to get user tokens' });
        }

        const auth = googleService.getOAuthClient(tokenResult.accessToken, tokenResult.refreshToken);
        await googleService.deleteEvent(auth, eventId);
        
        // Delete from local DB
        const client = getRawClient();
        const { error } = await client
            .from('calendar_events')
            .delete()
            .eq('google_event_id', eventId)
            .eq('user_id', authUser.userId);
            
        if (error) {
            console.error('[Calendar] Failed to delete event from DB:', error);
            // Still return success since Google Calendar was updated
        }
        
        console.log('[Calendar] Deleted event:', eventId);
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error: any) {
        console.error('[Calendar] Delete event error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete event' });
    }
};
