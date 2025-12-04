import { Router } from 'express';
import {
  handleAICommand,
  getTasks,
  createNewTask,
  updateExistingTask,
  deleteExistingTask,
} from '../controllers/aiController';

const router = Router();

// AI Command endpoint - processes natural language commands
router.post('/command', handleAICommand);

// Task CRUD endpoints
router.get('/tasks', getTasks);
router.post('/tasks', createNewTask);
router.put('/tasks/:taskId', updateExistingTask);
router.delete('/tasks/:taskId', deleteExistingTask);

export default router;

