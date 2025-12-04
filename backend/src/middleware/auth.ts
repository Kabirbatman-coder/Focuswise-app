import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

export interface AuthUser {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization token' });
      return;
    }

    const token = authHeader.substring(7);

    // Validate JWT
    if (!process.env.JWT_SECRET) {
      console.error('[Auth] JWT_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError: any) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const userId = decoded.userId;

    // Get tokens from database
    const { data: tokenData, error: dbError } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (dbError || !tokenData) {
      res.status(401).json({ error: 'User session not found' });
      return;
    }

    // Attach user info to request
    (req as any).user = {
      userId,
      email: decoded.email,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    } as AuthUser;

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Get authenticated user from request (for use in routes)
 */
export const getAuthUser = async (req: Request): Promise<AuthUser | null> => {
  return (req as any).user || null;
};
