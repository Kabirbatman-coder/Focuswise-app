import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { decryptRefreshToken } from './googleOAuthService';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export const getOAuthClient = (accessToken?: string, refreshToken?: string | null) => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  if (accessToken || refreshToken) {
    const credentials: {
      access_token?: string;
      refresh_token?: string | null;
    } = {};
    
    if (accessToken) {
      credentials.access_token = accessToken;
    }
    
    // Decrypt refresh token if it's encrypted (starts with hex:iv format)
    let decryptedRefreshToken: string | null = null;
    if (refreshToken) {
      try {
        // Check if token is encrypted (contains colon separator)
        if (refreshToken.includes(':') && refreshToken.length > 32) {
          decryptedRefreshToken = decryptRefreshToken(refreshToken);
        } else {
          decryptedRefreshToken = refreshToken;
        }
      } catch (error) {
        console.warn('[Calendar] Failed to decrypt refresh token, using as-is:', error);
        decryptedRefreshToken = refreshToken;
      }
      credentials.refresh_token = decryptedRefreshToken;
    } else if (refreshToken === null) {
      credentials.refresh_token = null;
    }
    
    oAuth2Client.setCredentials(credentials);
  }

  return oAuth2Client;
};

export const listEvents = async (auth: OAuth2Client, timeMin: string, timeMax: string) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items;
};

export const insertEvent = async (auth: OAuth2Client, event: any) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });
  return res.data;
};

export const updateEvent = async (auth: OAuth2Client, eventId: string, event: any) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: event,
  });
  return res.data;
};

export const deleteEvent = async (auth: OAuth2Client, eventId: string) => {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
};

