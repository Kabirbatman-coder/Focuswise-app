/**
 * Calendar Utility Functions
 * Exposed utility functions for calendar operations
 */

import { supabase } from '../config/supabase';
import * as googleService from './googleCalendarService';
import { decryptRefreshToken } from './googleOAuthService';

/**
 * Get user calendar events from local database
 * @param userId - User ID
 * @param startDate - Optional start date (defaults to now)
 * @param endDate - Optional end date (defaults to 7 days from now)
 */
export const getUserCalendarEvents = async (
  userId: string,
  startDate?: Date,
  endDate?: Date
) => {
  try {
    const start = startDate?.toISOString() || new Date().toISOString();
    const end = endDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[CalendarUtils] Error fetching events:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[CalendarUtils] getUserCalendarEvents error:', error);
    throw error;
  }
};

/**
 * Create a new calendar event
 * @param userId - User ID
 * @param taskObject - Event data object
 */
export const createEvent = async (userId: string, taskObject: {
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
}) => {
  try {
    // Get user tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Failed to get user tokens');
    }

    // Create OAuth client
    const auth = googleService.getOAuthClient(
      tokenData.access_token,
      tokenData.refresh_token
    );

    // Create event in Google Calendar
    const newEvent = await googleService.insertEvent(auth, taskObject);

    // Save to local database
    const record = {
      user_id: userId,
      google_event_id: newEvent.id,
      summary: newEvent.summary || 'No title',
      description: newEvent.description || null,
      start_time: newEvent.start?.dateTime || newEvent.start?.date,
      end_time: newEvent.end?.dateTime || newEvent.end?.date,
      location: newEvent.location || null,
      html_link: newEvent.htmlLink || null,
      status: newEvent.status || 'confirmed',
    };

    const { error: dbError } = await supabase
      .from('calendar_events')
      .insert(record);

    if (dbError) {
      console.error('[CalendarUtils] Error saving event to database:', dbError);
      throw dbError;
    }

    return record;
  } catch (error) {
    console.error('[CalendarUtils] createEvent error:', error);
    throw error;
  }
};

/**
 * Update an existing calendar event
 * @param userId - User ID
 * @param eventId - Google Calendar event ID
 * @param newData - Updated event data
 */
export const updateEvent = async (
  userId: string,
  eventId: string,
  newData: {
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
  }
) => {
  try {
    // Get user tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Failed to get user tokens');
    }

    // Create OAuth client
    const auth = googleService.getOAuthClient(
      tokenData.access_token,
      tokenData.refresh_token
    );

    // Update event in Google Calendar
    const updatedEvent = await googleService.updateEvent(auth, eventId, newData);

    // Update in local database
    const record = {
      summary: updatedEvent.summary,
      description: updatedEvent.description,
      start_time: updatedEvent.start?.dateTime || updatedEvent.start?.date,
      end_time: updatedEvent.end?.dateTime || updatedEvent.end?.date,
      location: updatedEvent.location,
      status: updatedEvent.status,
    };

    const { error: dbError } = await supabase
      .from('calendar_events')
      .update(record)
      .eq('google_event_id', eventId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[CalendarUtils] Error updating event in database:', dbError);
      throw dbError;
    }

    return updatedEvent;
  } catch (error) {
    console.error('[CalendarUtils] updateEvent error:', error);
    throw error;
  }
};

/**
 * Delete a calendar event
 * @param userId - User ID
 * @param eventId - Google Calendar event ID
 */
export const deleteEvent = async (userId: string, eventId: string) => {
  try {
    // Get user tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Failed to get user tokens');
    }

    // Create OAuth client
    const auth = googleService.getOAuthClient(
      tokenData.access_token,
      tokenData.refresh_token
    );

    // Delete event from Google Calendar
    await googleService.deleteEvent(auth, eventId);

    // Delete from local database
    const { error: dbError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('google_event_id', eventId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[CalendarUtils] Error deleting event from database:', dbError);
      throw dbError;
    }

    return { success: true };
  } catch (error) {
    console.error('[CalendarUtils] deleteEvent error:', error);
    throw error;
  }
};

