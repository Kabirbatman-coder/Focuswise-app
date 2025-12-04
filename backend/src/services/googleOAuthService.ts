import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

/**
 * Google OAuth Service
 * Handles OAuth client creation, token encryption, and user info retrieval
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Get encryption key from environment or generate a default (for development only)
 */
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)');
    // Default key for development - MUST be changed in production
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt refresh token before storing in database
 */
export const encryptRefreshToken = (refreshToken: string): string => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(refreshToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (IV is needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting refresh token:', error);
    throw new Error('Failed to encrypt refresh token');
  }
};

/**
 * Decrypt refresh token from database
 */
export const decryptRefreshToken = (encryptedToken: string): string => {
  try {
    const key = getEncryptionKey();
    const parts = encryptedToken.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decryptedPart1 = decipher.update(encrypted, 'hex', 'utf8');
    const decryptedPart2 = decipher.final('utf8');
    
    return decryptedPart1 + decryptedPart2;
  } catch (error) {
    console.error('Error decrypting refresh token:', error);
    throw new Error('Failed to decrypt refresh token');
  }
};

/**
 * Create OAuth2 client with environment configuration
 */
export const createOAuth2Client = (): OAuth2Client => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing required Google OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Generate Google OAuth consent URL
 */
export const generateAuthUrl = (oauth2Client: OAuth2Client): string => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'openid',
    'email',
    'profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  });
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (
  oauth2Client: OAuth2Client,
  code: string
): Promise<{ access_token: string; refresh_token: string | null; expiry_date?: number }> => {
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token) {
    throw new Error('Failed to obtain access token from Google');
  }

  const result: { access_token: string; refresh_token: string | null; expiry_date?: number } = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
  };

  if (tokens.expiry_date) {
    result.expiry_date = tokens.expiry_date;
  }

  return result;
};

/**
 * Get user info from Google using OAuth client
 */
export const getUserInfo = async (oauth2Client: OAuth2Client) => {
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  if (!userInfo.id || !userInfo.email) {
    throw new Error('Failed to get user information from Google');
  }

  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name || undefined,
    picture: userInfo.picture || undefined,
  };
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
  oauth2Client: OAuth2Client,
  refreshToken: string
): Promise<string> => {
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  return credentials.access_token;
};

