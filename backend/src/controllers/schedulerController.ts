import { Request, Response } from 'express';
import {
  generateSchedule,
  getOptimalDaySummary,
  rescheduleOnCalendarChange,
} from '../services/schedulerService';

// POST /api/scheduler/run - Generate or regenerate schedule
export async function runScheduler(req: Request, res: Response) {
  try {
    const { userId, calendarEvents, date } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const targetDate = date ? new Date(date) : undefined;
    const schedule = await generateSchedule(userId, calendarEvents || [], targetDate);
    
    return res.json({
      success: true,
      schedule,
    });
  } catch (error: any) {
    console.error('[SchedulerController] Error running scheduler:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/scheduler/summary/:userId - Get optimal day summary
export async function getDaySummary(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const summary = await getOptimalDaySummary(userId);
    
    return res.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error('[SchedulerController] Error getting summary:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/scheduler/reschedule - Reschedule when calendar changes
export async function reschedule(req: Request, res: Response) {
  try {
    const { userId, calendarEvents } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const schedule = await rescheduleOnCalendarChange(userId, calendarEvents || []);
    
    return res.json({
      success: true,
      schedule,
      message: 'Schedule updated based on calendar changes',
    });
  } catch (error: any) {
    console.error('[SchedulerController] Error rescheduling:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/scheduler/schedule/:userId - Get current schedule
export async function getCurrentSchedule(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const date = req.query.date as string | undefined;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const targetDate = date ? new Date(date) : undefined;
    const schedule = await generateSchedule(userId, [], targetDate);
    
    return res.json({
      success: true,
      schedule,
    });
  } catch (error: any) {
    console.error('[SchedulerController] Error getting schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

