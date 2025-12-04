import { Router } from 'express';
import {
  startSession,
  getActive,
  endSession,
  pause,
  resume,
  logDistractionAttempt,
  getHistory,
  getStats,
  getShield,
  updateShield,
  checkApp,
  getDefaultApps,
} from '../controllers/focusSessionController';

const router = Router();

// Session management
router.post('/session/start', startSession);
router.get('/session/active/:userId', getActive);
router.post('/session/end', endSession);
router.post('/session/pause', pause);
router.post('/session/resume', resume);

// Distraction tracking
router.post('/distraction', logDistractionAttempt);
router.post('/check-app', checkApp);

// History and stats
router.get('/history/:userId', getHistory);
router.get('/stats/:userId', getStats);

// Shield settings
router.get('/shield/:userId', getShield);
router.put('/shield/:userId', updateShield);

// Default apps list
router.get('/default-apps', getDefaultApps);

export default router;

