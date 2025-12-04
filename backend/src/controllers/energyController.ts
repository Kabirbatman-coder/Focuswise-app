import { Request, Response } from 'express';
import {
  saveEnergyCheckIn,
  getEnergyProfile,
  getCheckInsByUserId,
  getTodayCheckIns,
  getEnergyTrends,
  getOptimalTimeSlots,
  deleteCheckIn,
  EnergyLevel,
  getEnergyEmoji,
  getEnergyLabel,
  formatTimePeriod,
} from '../services/energyService';

// POST /api/energy/checkin - Save a new energy check-in
export async function createCheckIn(req: Request, res: Response) {
  try {
    const { userId, level, mood, note, timestamp } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    if (!level || level < 1 || level > 5) {
      return res.status(400).json({ success: false, error: 'level must be between 1 and 5' });
    }
    
    const checkIn = await saveEnergyCheckIn(userId, level as EnergyLevel, {
      mood,
      note,
      timestamp,
    });
    
    return res.json({
      success: true,
      checkIn,
      message: `Energy logged: ${getEnergyEmoji(level)} ${getEnergyLabel(level)}`,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error creating check-in:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/energy/profile/:userId - Get user's energy profile
export async function getUserProfile(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const profile = await getEnergyProfile(userId);
    
    // Add formatted peak/low period info
    const formattedProfile = {
      ...profile,
      peakPeriodFormatted: profile.peakPeriod ? formatTimePeriod(profile.peakPeriod) : null,
      lowPeriodFormatted: profile.lowPeriod ? formatTimePeriod(profile.lowPeriod) : null,
    };
    
    return res.json({
      success: true,
      profile: formattedProfile,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error getting profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/energy/checkins/:userId - Get user's check-ins
export async function getCheckIns(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const checkIns = await getCheckInsByUserId(userId, limit);
    
    return res.json({
      success: true,
      checkIns,
      count: checkIns.length,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error getting check-ins:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/energy/today/:userId - Get today's check-ins
export async function getTodaysCheckIns(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const checkIns = await getTodayCheckIns(userId);
    
    // Calculate today's average
    const todayAverage = checkIns.length > 0
      ? Math.round((checkIns.reduce((sum, c) => sum + c.level, 0) / checkIns.length) * 10) / 10
      : null;
    
    return res.json({
      success: true,
      checkIns,
      count: checkIns.length,
      todayAverage,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error getting today check-ins:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/energy/trends/:userId - Get energy trends for visualization
export async function getTrends(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 14;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const trends = await getEnergyTrends(userId, days);
    
    return res.json({
      success: true,
      trends,
      period: `${days} days`,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error getting trends:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/energy/optimal-slots/:userId - Get optimal time slots
export async function getOptimalSlots(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const energyLevel = (req.query.energy as 'high' | 'medium' | 'low') || 'high';
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const slots = await getOptimalTimeSlots(userId, energyLevel);
    
    return res.json({
      success: true,
      slots,
      requestedEnergyLevel: energyLevel,
    });
  } catch (error: any) {
    console.error('[EnergyController] Error getting optimal slots:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /api/energy/checkin/:checkInId - Delete a check-in
export async function removeCheckIn(req: Request, res: Response) {
  try {
    const { checkInId } = req.params;
    
    if (!checkInId) {
      return res.status(400).json({ success: false, error: 'checkInId is required' });
    }
    
    await deleteCheckIn(checkInId);
    
    return res.json({
      success: true,
      message: 'Check-in deleted',
    });
  } catch (error: any) {
    console.error('[EnergyController] Error deleting check-in:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/energy/quick-checkin - Quick check-in with minimal data
export async function quickCheckIn(req: Request, res: Response) {
  try {
    const { userId, level } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    if (!level || level < 1 || level > 5) {
      return res.status(400).json({ success: false, error: 'level must be between 1 and 5' });
    }
    
    const checkIn = await saveEnergyCheckIn(userId, level as EnergyLevel);
    
    // Get updated profile summary
    const profile = await getEnergyProfile(userId);
    
    return res.json({
      success: true,
      checkIn,
      message: `${getEnergyEmoji(level)} Energy logged as "${getEnergyLabel(level)}"`,
      todayCount: (await getTodayCheckIns(userId)).length,
      peakPeriod: profile.peakPeriod ? formatTimePeriod(profile.peakPeriod) : 'Not enough data yet',
    });
  } catch (error: any) {
    console.error('[EnergyController] Error with quick check-in:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

