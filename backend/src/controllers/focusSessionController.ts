import { Request, Response } from 'express';
import {
  startFocusSession,
  getActiveSession,
  endActiveSession,
  pauseSession,
  resumeSession,
  logDistraction,
  getSessionHistory,
  getDistractionStats,
  getShieldSettings,
  updateShieldSettings,
  shouldBlockApp,
  getDefaultBlockedApps,
} from '../services/focusSessionService';

// POST /api/focus/session/start - Start a focus session
export async function startSession(req: Request, res: Response) {
  try {
    const { userId, taskId, taskTitle, plannedDuration, blockedApps, allowedApps } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    if (!plannedDuration || plannedDuration < 1) {
      return res.status(400).json({ success: false, error: 'plannedDuration must be at least 1 minute' });
    }
    
    const session = await startFocusSession(userId, {
      taskId,
      taskTitle,
      plannedDuration,
      blockedApps,
      allowedApps,
    });
    
    return res.json({
      success: true,
      session,
      message: `Focus session started for ${plannedDuration} minutes. Stay focused! 🎯`,
    });
  } catch (error: any) {
    console.error('[FocusController] Error starting session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/focus/session/active/:userId - Get active session
export async function getActive(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const session = await getActiveSession(userId);
    
    if (!session) {
      return res.json({
        success: true,
        hasActiveSession: false,
        session: null,
      });
    }
    
    // Calculate remaining time
    const startTime = new Date(session.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);
    const remainingMinutes = Math.max(0, session.plannedDuration - elapsedMinutes);
    
    return res.json({
      success: true,
      hasActiveSession: true,
      session,
      elapsedMinutes,
      remainingMinutes,
      progress: Math.min(100, Math.round((elapsedMinutes / session.plannedDuration) * 100)),
    });
  } catch (error: any) {
    console.error('[FocusController] Error getting active session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/focus/session/end - End focus session
export async function endSession(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const session = await endActiveSession(userId);
    
    if (!session) {
      return res.json({
        success: true,
        message: 'No active session to end',
        session: null,
      });
    }
    
    return res.json({
      success: true,
      session,
      message: `Great job! You focused for ${session.actualDuration || 0} minutes. 🎉`,
    });
  } catch (error: any) {
    console.error('[FocusController] Error ending session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/focus/session/pause - Pause session
export async function pause(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const session = await pauseSession(userId);
    
    return res.json({
      success: true,
      session,
      message: session ? 'Session paused' : 'No active session to pause',
    });
  } catch (error: any) {
    console.error('[FocusController] Error pausing session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/focus/session/resume - Resume session
export async function resume(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const session = await resumeSession(userId);
    
    return res.json({
      success: true,
      session,
      message: session ? 'Session resumed. Let\'s go!' : 'No paused session to resume',
    });
  } catch (error: any) {
    console.error('[FocusController] Error resuming session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/focus/distraction - Log a distraction
export async function logDistractionAttempt(req: Request, res: Response) {
  try {
    const { userId, sessionId, appPackageName, appName, wasBlocked } = req.body;
    
    if (!userId || !sessionId || !appPackageName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const log = await logDistraction(userId, sessionId, appPackageName, appName || appPackageName, wasBlocked);
    
    return res.json({
      success: true,
      log,
    });
  } catch (error: any) {
    console.error('[FocusController] Error logging distraction:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/focus/history/:userId - Get session history
export async function getHistory(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const sessions = await getSessionHistory(userId, limit);
    
    return res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    console.error('[FocusController] Error getting history:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/focus/stats/:userId - Get distraction stats
export async function getStats(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const stats = await getDistractionStats(userId, days);
    
    return res.json({
      success: true,
      stats,
      period: `${days} days`,
    });
  } catch (error: any) {
    console.error('[FocusController] Error getting stats:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/focus/shield/:userId - Get shield settings
export async function getShield(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const settings = await getShieldSettings(userId);
    
    return res.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[FocusController] Error getting shield settings:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// PUT /api/focus/shield/:userId - Update shield settings
export async function updateShield(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const settings = await updateShieldSettings(userId, updates);
    
    return res.json({
      success: true,
      settings,
      message: 'Shield settings updated',
    });
  } catch (error: any) {
    console.error('[FocusController] Error updating shield:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/focus/check-app - Check if app should be blocked
export async function checkApp(req: Request, res: Response) {
  try {
    const { userId, appPackageName } = req.body;
    
    if (!userId || !appPackageName) {
      return res.status(400).json({ success: false, error: 'userId and appPackageName required' });
    }
    
    const result = await shouldBlockApp(userId, appPackageName);
    
    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[FocusController] Error checking app:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/focus/default-apps - Get default blocked apps list
export async function getDefaultApps(req: Request, res: Response) {
  try {
    const apps = getDefaultBlockedApps();
    
    return res.json({
      success: true,
      apps,
    });
  } catch (error: any) {
    console.error('[FocusController] Error getting default apps:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

