// AI Service - Frontend API calls to backend
// This service handles all communication with the AI backend

import { getApiUrl } from '@/constants/config';

export interface AICommandResponse {
  success: boolean;
  intent: string;
  response: string;
  action?: string;
  data?: any;
  error?: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  estimatedMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  success: boolean;
  tasks: Task[];
  error?: string;
}

// Send an AI command to the backend
export async function sendAICommand(
  query: string,
  accessToken?: string | null,
  userId?: string
): Promise<AICommandResponse> {
  try {
    const response = await fetch(getApiUrl('/api/ai/command'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        accessToken: accessToken || undefined,
        userId: userId || 'default_user',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AIService] Error sending command:', error);
    return {
      success: false,
      intent: 'error',
      response: `Failed to communicate with the AI: ${error.message}`,
      error: error.message,
    };
  }
}

// Get all tasks for the user
export async function getTasks(userId?: string): Promise<TasksResponse> {
  try {
    const response = await fetch(getApiUrl('/api/ai/tasks'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // In production, you'd add an auth header here
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AIService] Error fetching tasks:', error);
    return {
      success: false,
      tasks: [],
      error: error.message,
    };
  }
}

// Create a new task
export async function createTask(task: {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  estimatedMinutes?: number;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const response = await fetch(getApiUrl('/api/ai/tasks'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AIService] Error creating task:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Update an existing task
export async function updateTask(
  taskId: string,
  updates: Partial<Task>
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const response = await fetch(getApiUrl(`/api/ai/tasks/${taskId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AIService] Error updating task:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete a task
export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(getApiUrl(`/api/ai/tasks/${taskId}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[AIService] Error deleting task:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

