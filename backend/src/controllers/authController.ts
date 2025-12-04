import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { enqueueTokenWrite, startSupabaseTokenQueueWorker } from '../services/supabaseTokenService';
import { storeTokensLocally } from '../services/localTokenStore';
import {
  createOAuth2Client,
  generateAuthUrl,
  exchangeCodeForTokens,
  getUserInfo,
  encryptRefreshToken,
} from '../services/googleOAuthService';

/**
 * Detect if request is from mobile app based on User-Agent
 * This is used in the OAuth callback to decide whether to deep-link
 */
const isMobileRequest = (req: Request): boolean => {
  const userAgent = (req.headers['user-agent'] || '') as string;

  // Broad mobile detection: Expo, React Native, Android, iOS, generic Mobile
  const mobileRegex = /Expo|ReactNative|Android|iPhone|iPad|iPod|Mobile/i;

  return (
    mobileRegex.test(userAgent) ||
    req.headers['x-mobile-app'] === 'true'
  );
};

/**
 * GET /api/auth/google/login
 * Initiates Google OAuth flow by redirecting to Google consent page
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    console.log('[OAuth] Login request received');
    console.log('[OAuth] Login User-Agent:', req.headers['user-agent']);
    
    // Validate environment variables exist
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('[OAuth] Missing Google OAuth credentials in .env file');
      return res.status(500).send(`
        <html>
          <head><title>Configuration Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>❌ Configuration Error</h1>
            <p><strong>Missing Google OAuth credentials in .env file</strong></p>
            <p>Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in backend/.env</p>
            <p>See <a href="/api/auth/debug/oauth">debug endpoint</a> for help.</p>
          </body>
        </html>
      `);
    }

    // Check for placeholder values
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (clientId.includes('your-google-client-id') || 
        clientId.includes('placeholder') ||
        redirectUri.includes('your-ngrok-url') ||
        redirectUri.includes('placeholder')) {
      console.error('[OAuth] Placeholder values detected in .env file');
      return res.status(500).send(`
        <html>
          <head><title>Configuration Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <h1>❌ Configuration Error</h1>
            <p><strong>Placeholder values detected in .env file</strong></p>
            <p>Your .env file still contains placeholder values. Please update:</p>
            <ul style="text-align: left; display: inline-block;">
              <li><strong>GOOGLE_CLIENT_ID</strong> - Get from <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
              <li><strong>GOOGLE_CLIENT_SECRET</strong> - Get from Google Cloud Console</li>
              <li><strong>GOOGLE_REDIRECT_URI</strong> - Should be your ngrok URL: <code>https://your-actual-ngrok-url.ngrok-free.dev/api/auth/google/callback</code></li>
            </ul>
            <p><strong>Steps to fix:</strong></p>
            <ol style="text-align: left; display: inline-block;">
              <li>Start ngrok: <code>ngrok http 3000</code></li>
              <li>Copy your ngrok URL (e.g., <code>https://abc123.ngrok-free.dev</code>)</li>
              <li>Update <code>backend/.env</code> with real values</li>
              <li>Add redirect URI to Google Cloud Console</li>
              <li>Restart backend server</li>
            </ol>
            <p><a href="/api/auth/debug/oauth">View debug info</a></p>
          </body>
        </html>
      `);
    }

    const oauth2Client = createOAuth2Client();

    // Detect if this login request is coming from a mobile browser
    const userAgent = (req.headers['user-agent'] || '') as string;
    const mobileLogin = /Android|iPhone|iPad|iPod|Mobile|Expo|ReactNative/i.test(userAgent);

    // Generate auth URL with state indicating the platform
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'openid',
        'email',
        'profile',
      ],
      prompt: 'consent',
      // Use state to remember if this came from mobile or desktop
      state: mobileLogin ? 'mobile' : 'desktop',
    });

    console.log('[OAuth] Generated auth URL, redirecting to Google');
    console.log('[OAuth] Redirect URI configured:', process.env.GOOGLE_REDIRECT_URI);

    res.redirect(authUrl);
  } catch (error: any) {
    console.error('[OAuth] Login error:', error);
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1>❌ OAuth Error</h1>
          <p><strong>Failed to initiate Google login</strong></p>
          <p>Error: ${error.message}</p>
          <p>Check backend logs for details.</p>
        </body>
      </html>
    `);
  }
};

/**
 * GET /api/auth/google/me
 * Validates session JWT and returns user profile.
 * NOTE: This endpoint is intentionally lightweight and does NOT depend on Supabase
 * or Google being reachable. It only validates the JWT and returns its payload,
 * so the app can consider the user authenticated even if Supabase is temporarily down.
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    console.log('[Auth] /me request received');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Auth] /me missing authorization header');
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      console.error('[Auth] /me JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err: any) {
      console.error('[Auth] /me JWT validation failed:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('[Auth] /me JWT validated for user:', decoded.userId);

    // Minimal user profile from JWT
    const userProfile = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.email?.split('@')[0] || 'User',
    };

    return res.json(userProfile);
  } catch (error: any) {
    console.error('[Auth] /me error:', error);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
};

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback, exchanges code for tokens, creates session JWT
 */
export const googleCallback = async (req: Request, res: Response) => {
  try {
    console.log('[OAuth] Callback received');
    console.log('[OAuth] Full URL:', req.url);
    console.log('[OAuth] Query params:', JSON.stringify(req.query));
    console.log('[OAuth] Headers:', JSON.stringify(req.headers));
    
    const { code, error: oauthError, state } = req.query;

    // Handle OAuth errors from Google
    if (oauthError) {
      console.error('[OAuth] OAuth error from Google:', oauthError);
      return res.status(400).send(`
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>Authentication Failed</h1>
            <p>Error: ${oauthError}</p>
            <p>Please try again.</p>
          </body>
        </html>
      `);
    }

    if (!code || typeof code !== 'string') {
      console.error('[OAuth] Missing authorization code');
      console.error('[OAuth] Received query params:', req.query);
      console.error('[OAuth] Expected redirect URI:', process.env.GOOGLE_REDIRECT_URI);
      
      // Provide helpful debugging info
      return res.status(400).send(`
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <h1>❌ Authentication Failed</h1>
            <p><strong>Missing authorization code</strong></p>
            <p>This usually means the callback URL doesn't match exactly.</p>
            <hr style="margin: 20px 0;">
            <h3>Debug Info:</h3>
            <ul style="text-align: left; display: inline-block;">
              <li><strong>Received URL:</strong> ${req.url}</li>
              <li><strong>Expected Redirect URI:</strong> ${process.env.GOOGLE_REDIRECT_URI || 'Not configured'}</li>
              <li><strong>Query Params:</strong> ${JSON.stringify(req.query)}</li>
            </ul>
            <hr style="margin: 20px 0;">
            <h3>Fix Steps:</h3>
            <ol style="text-align: left; display: inline-block;">
              <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
              <li>Check your OAuth client's "Authorized redirect URIs"</li>
              <li>Make sure it matches EXACTLY: <code>${process.env.GOOGLE_REDIRECT_URI || 'Not configured'}</code></li>
              <li>Check that ngrok is running and forwarding to localhost:3000</li>
              <li>Try signing in again</li>
            </ol>
            <p><a href="/api/auth/debug/oauth">View debug info</a></p>
          </body>
        </html>
      `);
    }

    console.log('[OAuth] Exchanging code for tokens...');
    const oauth2Client = createOAuth2Client();
    const tokens = await exchangeCodeForTokens(oauth2Client, code);

    console.log('[OAuth] Tokens received, fetching user info...');
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
    });

    const userInfo = await getUserInfo(oauth2Client);
    console.log('[OAuth] User info retrieved:', { id: userInfo.id, email: userInfo.email });

    // Encrypt refresh token before storing
    let encryptedRefreshToken: string | null = null;
    if (tokens.refresh_token) {
      try {
        encryptedRefreshToken = encryptRefreshToken(tokens.refresh_token);
        console.log('[OAuth] Refresh token encrypted successfully');
      } catch (encryptError) {
        console.error('[OAuth] Failed to encrypt refresh token:', encryptError);
        // Continue without encryption for now, but log the error
        encryptedRefreshToken = tokens.refresh_token;
      }
    }

    // ============================================================
    // CRITICAL: Store tokens LOCALLY FIRST for immediate use
    // This ensures the calendar works even if Supabase is unreachable
    // ============================================================
    try {
      const localStored = storeTokensLocally({
        userId: userInfo.id,
        email: userInfo.email || '',
        accessToken: tokens.access_token,
        refreshToken: encryptedRefreshToken,
      });
      if (localStored) {
        console.log('[OAuth] ✅ Tokens stored LOCALLY - calendar will work immediately');
      } else {
        console.error('[OAuth] ⚠️ Failed to store tokens locally');
      }
    } catch (localError: any) {
      console.error('[OAuth] ⚠️ Local token storage error:', localError?.message);
    }

    // Enqueue tokens for Supabase storage; background worker will handle retries.
    // This ensures OAuth redirect to the app is never blocked by Supabase outages.
    try {
      const queueId = enqueueTokenWrite({
        userId: userInfo.id,
        email: userInfo.email || '',
        accessToken: tokens.access_token,
        encryptedRefreshToken,
      });
      console.log('[OAuth] Queued tokens for Supabase storage (background)', {
        queueId,
        userId: userInfo.id,
      });
      // Ensure worker is running
      startSupabaseTokenQueueWorker();
    } catch (queueError: any) {
      console.error('[OAuth] Failed to enqueue tokens for Supabase storage:', queueError?.message || queueError);
    }

    // Create JWT session token
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const sessionJwt = jwt.sign(
      {
        userId: userInfo.id,
        email: userInfo.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d', // Session expires in 7 days
      }
    );

    console.log('[OAuth] JWT session token created');

    // Detect if request is from mobile app
    // Prefer the OAuth state flag, fall back to User-Agent detection
    const stateValue = typeof state === 'string' ? state : undefined;
    const isMobile =
      stateValue === 'mobile' ||
      (stateValue === undefined && isMobileRequest(req));

    console.log('[OAuth] Request type:', isMobile ? 'mobile' : 'desktop', 'state:', stateValue);

    if (isMobile) {
      // Redirect to mobile app via deep link
      const redirectUrl = `focuswise://auth?token=${encodeURIComponent(sessionJwt)}`;
      console.log('[OAuth] Redirecting to mobile app:', redirectUrl);
      res.redirect(redirectUrl);
    } else {
      // Show success page for desktop
      res.send(`
        <html>
          <head>
            <title>Authentication Complete</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                text-align: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
              }
              .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
              }
              h1 {
                margin-top: 0;
                font-size: 2em;
              }
              p {
                font-size: 1.2em;
                margin: 20px 0;
              }
              .checkmark {
                font-size: 4em;
                margin-bottom: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="checkmark">✓</div>
              <h1>Authentication Complete</h1>
              <p>You have successfully authenticated with Google.</p>
              <p>You can close this tab now.</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (error: any) {
    console.error('[OAuth] Callback error:', error);
    res.status(500).send(`
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1>Authentication Failed</h1>
          <p>Error: ${error.message}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
};

// (previous, more complex getMe implementation removed to avoid duplicate declarations)
