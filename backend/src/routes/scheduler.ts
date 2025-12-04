import { Router } from 'express';
import {
  runScheduler,
  getDaySummary,
  reschedule,
  getCurrentSchedule,
} from '../controllers/schedulerController';

const router = Router();

// Run scheduler to generate/regenerate schedule
router.post('/run', runScheduler);

// Reschedule when calendar changes
router.post('/reschedule', reschedule);

// Get optimal day summary
router.get('/summary/:userId', getDaySummary);

// Get current schedule for a user
router.get('/schedule/:userId', getCurrentSchedule);

export default router;

