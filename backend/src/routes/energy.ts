import { Router } from 'express';
import {
  createCheckIn,
  getUserProfile,
  getCheckIns,
  getTodaysCheckIns,
  getTrends,
  getOptimalSlots,
  removeCheckIn,
  quickCheckIn,
} from '../controllers/energyController';

const router = Router();

// Energy check-in routes
router.post('/checkin', createCheckIn);
router.post('/quick-checkin', quickCheckIn);
router.delete('/checkin/:checkInId', removeCheckIn);

// Profile and data routes
router.get('/profile/:userId', getUserProfile);
router.get('/checkins/:userId', getCheckIns);
router.get('/today/:userId', getTodaysCheckIns);
router.get('/trends/:userId', getTrends);
router.get('/optimal-slots/:userId', getOptimalSlots);

export default router;

