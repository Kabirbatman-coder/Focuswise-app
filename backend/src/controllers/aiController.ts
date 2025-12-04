import { Request, Response } from 'express';
import { processCommand } from '../services/commandProcessor';
import { getTasksByUserId, createTask, updateTask, deleteTask, Task } from '../services/taskService';

// Process AI command
export const handleAICommand = async (req: Request, res: Response) => {
  try {
    const { query, accessToken } = req.body;
    const userId = (req as any).userId || 'default_user';
    
    console.log(`[AIController] Received command: "${query}" from user: ${userId}`);
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string',
      });
    }
    
    // Process the command using the AI processor
    const result = await processCommand(query, userId, accessToken);
    
    console.log(`[AIController] Command result:`, {
      success: result.success,
      intent: result.intent,
      action: result.action,
    });
    
    return res.json(result);
  } catch (error: any) {
    console.error('[AIController] Error processing command:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process command',
      message: error.message,
    });
  }
};

// Get all tasks for user
export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const tasks = await getTasksByUserId(userId);
    
    return res.json({
      success: true,
      tasks,
    });
  } catch (error: any) {
    console.error('[AIController] Error getting tasks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get tasks',
      message: error.message,
    });
  }
};

// Create a task directly
export const createNewTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { title, description, priority, dueDate, estimatedMinutes } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }
    
    const task = await createTask({
      userId,
      title,
      description,
      priority: priority || 'medium',
      dueDate,
      estimatedMinutes,
    });
    
    return res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('[AIController] Error creating task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create task',
      message: error.message,
    });
  }
};

// Update a task
export const updateExistingTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required',
      });
    }
    
    const task = await updateTask(taskId, updates);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    return res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error('[AIController] Error updating task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task',
      message: error.message,
    });
  }
};

// Delete a task
export const deleteExistingTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required',
      });
    }
    
    const deleted = await deleteTask(taskId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    return res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('[AIController] Error deleting task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete task',
      message: error.message,
    });
  }
};

