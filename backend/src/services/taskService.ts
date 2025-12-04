import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'tasks.db');

let db: Database | null = null;

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | undefined;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string | undefined;
  estimatedMinutes?: number | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  userId: string;
  title: string;
  description?: string | undefined;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string | undefined;
  estimatedMinutes?: number | undefined;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  description?: string | undefined;
  priority?: 'high' | 'medium' | 'low' | undefined;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined;
  dueDate?: string | undefined;
  estimatedMinutes?: number | undefined;
}

// Initialize the database
async function initDB(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[TaskService] Loaded existing tasks database');
  } else {
    db = new SQL.Database();
    console.log('[TaskService] Created new tasks database');
  }
  
  // Create tasks table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      dueDate TEXT,
      estimatedMinutes INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  
  // Create index for faster user lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId)`);
  
  saveDB();
  return db;
}

// Save database to file
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Generate unique ID
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get all tasks for a user
export async function getTasksByUserId(userId: string): Promise<Task[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM tasks WHERE userId = ? ORDER BY 
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      dueDate ASC`,
    [userId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const task: any = {};
    columns.forEach((col: string, idx: number) => {
      task[col] = row[idx];
    });
    return task as Task;
  });
}

// Get a single task by ID
export async function getTaskById(taskId: string): Promise<Task | null> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM tasks WHERE id = ?`,
    [taskId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return null;
  }
  
  const columns = firstResult.columns;
  const row = firstResult.values[0];
  if (!row) return null;
  
  const task: any = {};
  columns.forEach((col: string, idx: number) => {
    task[col] = row[idx];
  });
  
  return task as Task;
}

// Create a new task
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const database = await initDB();
  
  const id = generateId();
  const now = new Date().toISOString();
  
  const task: Task = {
    id,
    userId: input.userId,
    title: input.title,
    description: input.description,
    priority: input.priority || 'medium',
    status: input.status || 'pending',
    dueDate: input.dueDate,
    estimatedMinutes: input.estimatedMinutes,
    createdAt: now,
    updatedAt: now,
  };
  
  database.run(
    `INSERT INTO tasks (id, userId, title, description, priority, status, dueDate, estimatedMinutes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.userId,
      task.title,
      task.description || null,
      task.priority,
      task.status,
      task.dueDate || null,
      task.estimatedMinutes || null,
      task.createdAt,
      task.updatedAt,
    ]
  );
  
  saveDB();
  console.log(`[TaskService] Created task: ${task.id} - "${task.title}"`);
  
  return task;
}

// Update an existing task
export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task | null> {
  const database = await initDB();
  
  const existing = await getTaskById(taskId);
  if (!existing) {
    console.warn(`[TaskService] Task not found: ${taskId}`);
    return null;
  }
  
  const updatedAt = new Date().toISOString();
  
  const updatedTask: Task = {
    ...existing,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    priority: updates.priority ?? existing.priority,
    status: updates.status ?? existing.status,
    dueDate: updates.dueDate ?? existing.dueDate,
    estimatedMinutes: updates.estimatedMinutes ?? existing.estimatedMinutes,
    updatedAt,
  };
  
  database.run(
    `UPDATE tasks SET 
      title = ?, 
      description = ?, 
      priority = ?, 
      status = ?, 
      dueDate = ?, 
      estimatedMinutes = ?, 
      updatedAt = ?
     WHERE id = ?`,
    [
      updatedTask.title,
      updatedTask.description || null,
      updatedTask.priority,
      updatedTask.status,
      updatedTask.dueDate || null,
      updatedTask.estimatedMinutes || null,
      updatedTask.updatedAt,
      taskId,
    ]
  );
  
  saveDB();
  console.log(`[TaskService] Updated task: ${taskId}`);
  
  return updatedTask;
}

// Delete a task
export async function deleteTask(taskId: string): Promise<boolean> {
  const database = await initDB();
  
  const existing = await getTaskById(taskId);
  if (!existing) {
    console.warn(`[TaskService] Task not found for deletion: ${taskId}`);
    return false;
  }
  
  database.run(`DELETE FROM tasks WHERE id = ?`, [taskId]);
  saveDB();
  
  console.log(`[TaskService] Deleted task: ${taskId}`);
  return true;
}

// Get tasks by status
export async function getTasksByStatus(
  userId: string,
  status: Task['status']
): Promise<Task[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM tasks WHERE userId = ? AND status = ? ORDER BY 
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      dueDate ASC`,
    [userId, status]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const task: any = {};
    columns.forEach((col: string, idx: number) => {
      task[col] = row[idx];
    });
    return task as Task;
  });
}

// Get high priority tasks
export async function getHighPriorityTasks(userId: string): Promise<Task[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM tasks WHERE userId = ? AND priority = 'high' AND status != 'completed' ORDER BY dueDate ASC`,
    [userId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const task: any = {};
    columns.forEach((col: string, idx: number) => {
      task[col] = row[idx];
    });
    return task as Task;
  });
}

// Search tasks by title/description
export async function searchTasks(userId: string, query: string): Promise<Task[]> {
  const database = await initDB();
  
  const searchPattern = `%${query}%`;
  const result = database.exec(
    `SELECT * FROM tasks WHERE userId = ? AND (title LIKE ? OR description LIKE ?) ORDER BY updatedAt DESC`,
    [userId, searchPattern, searchPattern]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const task: any = {};
    columns.forEach((col: string, idx: number) => {
      task[col] = row[idx];
    });
    return task as Task;
  });
}

