import { Router } from 'express';
import { syncCalendar, getEvents, createEvent, updateEvent, deleteEvent } from '../controllers/calendarController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All calendar routes require authentication
router.use(authenticate);

router.post('/sync', syncCalendar);
router.get('/events', getEvents);
router.post('/create', createEvent);
router.put('/:eventId', updateEvent);
router.delete('/:eventId', deleteEvent); 

export default router;

