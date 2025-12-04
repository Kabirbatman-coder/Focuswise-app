import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'tasks.db');

let db: Database | null = null;

// ==================== TYPES ====================

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | undefined;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string | undefined;
  estimatedMinutes?: number | undefined;
  actualMinutes?: number | undefined;       // NEW: Track actual time
  tags?: string[] | undefined;              // NEW: For categorization
  energyRequired?: 'high' | 'medium' | 'low' | undefined; // NEW: Energy tagging
  completedAt?: string | undefined;         // NEW: When completed
  postponedCount?: number | undefined;      // NEW: How many times rescheduled
  sourceIntent?: string | undefined;        // NEW: AI intent that created it
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
  tags?: string[];
  energyRequired?: 'high' | 'medium' | 'low';
  sourceIntent?: string;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  description?: string | undefined;
  priority?: 'high' | 'medium' | 'low' | undefined;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined;
  dueDate?: string | undefined;
  estimatedMinutes?: number | undefined;
  actualMinutes?: number | undefined;
  tags?: string[];
  energyRequired?: 'high' | 'medium' | 'low';
}

// NEW: User interaction for learning
export interface TaskInteraction {
  id: string;
  userId: string;
  taskId: string;
  interactionType: 'completed' | 'postponed' | 'deleted' | 'priority_changed' | 'accepted_suggestion' | 'rejected_suggestion';
  originalPriority?: string;
  newPriority?: string;
  scheduledTime?: string;   // When it was scheduled for
  interactionTime: string;  // When the interaction happened
  context?: string;         // Additional context (e.g., energy level at time)
}

// NEW: Priority learning weights
export interface PriorityWeights {
  userId: string;
  urgencyWeight: number;      // Default: 0.35
  importanceWeight: number;   // Default: 0.30
  effortWeight: number;       // Default: 0.15
  deadlineWeight: number;     // Default: 0.20
  lastUpdated: string;
}

// Default weights
const DEFAULT_WEIGHTS: Omit<PriorityWeights, 'userId' | 'lastUpdated'> = {
  urgencyWeight: 0.35,
  importanceWeight: 0.30,
  effortWeight: 0.15,
  deadlineWeight: 0.20,
};

// ==================== DATABASE ====================

async function initDB(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[TaskService] Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('[TaskService] Created new database');
  }
  
  // Enhanced tasks table
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
      actualMinutes INTEGER,
      tags TEXT DEFAULT '[]',
      energyRequired TEXT DEFAULT 'medium',
      completedAt TEXT,
      postponedCount INTEGER DEFAULT 0,
      sourceIntent TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  
  // NEW: Interaction tracking for learning
  db.run(`
    CREATE TABLE IF NOT EXISTS task_interactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      taskId TEXT NOT NULL,
      interactionType TEXT NOT NULL,
      originalPriority TEXT,
      newPriority TEXT,
      scheduledTime TEXT,
      interactionTime TEXT NOT NULL,
      context TEXT
    )
  `);
  
  // NEW: User priority weights
  db.run(`
    CREATE TABLE IF NOT EXISTS priority_weights (
      userId TEXT PRIMARY KEY,
      urgencyWeight REAL DEFAULT 0.35,
      importanceWeight REAL DEFAULT 0.30,
      effortWeight REAL DEFAULT 0.15,
      deadlineWeight REAL DEFAULT 0.20,
      lastUpdated TEXT NOT NULL
    )
  `);
  
  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_userId ON tasks(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_interactions_userId ON task_interactions(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_interactions_taskId ON task_interactions(taskId)`);
  
  saveDB();
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== CORE CRUD ====================

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
    task.tags = JSON.parse(task.tags || '[]');
    return task as Task;
  });
}

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
  task.tags = JSON.parse(task.tags || '[]');
  
  return task as Task;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const database = await initDB();
  
  const id = generateId();
  const now = new Date().toISOString();
  
  // Infer energy requirement from task properties
  const energyRequired = input.energyRequired || inferEnergyRequirement(input);
  
  const task: Task = {
    id,
    userId: input.userId,
    title: input.title,
    description: input.description,
    priority: input.priority || 'medium',
    status: input.status || 'pending',
    dueDate: input.dueDate,
    estimatedMinutes: input.estimatedMinutes || estimateMinutes(input.title),
    tags: input.tags || inferTags(input.title),
    energyRequired,
    postponedCount: 0,
    sourceIntent: input.sourceIntent,
    createdAt: now,
    updatedAt: now,
  };
  
  database.run(
    `INSERT INTO tasks (id, userId, title, description, priority, status, dueDate, estimatedMinutes, tags, energyRequired, postponedCount, sourceIntent, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.userId,
      task.title,
      task.description || null,
      task.priority,
      task.status,
      task.dueDate || null,
      task.estimatedMinutes ?? null,
      JSON.stringify(task.tags || []),
      task.energyRequired || null,
      task.postponedCount ?? 0,
      task.sourceIntent || null,
      task.createdAt,
      task.updatedAt,
    ]
  );
  
  saveDB();
  console.log(`[TaskService] Created: ${task.id} - "${task.title}" [${task.priority}] ~${task.estimatedMinutes}min`);
  
  return task;
}

export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task | null> {
  const database = await initDB();
  
  const existing = await getTaskById(taskId);
  if (!existing) {
    console.warn(`[TaskService] Task not found: ${taskId}`);
    return null;
  }
  
  const now = new Date().toISOString();
  
  // Track priority changes for learning
  if (updates.priority && updates.priority !== existing.priority) {
    await logInteraction(existing.userId, taskId, 'priority_changed', {
      originalPriority: existing.priority,
      newPriority: updates.priority,
    });
  }
  
  // Track completion
  let completedAt = existing.completedAt;
  if (updates.status === 'completed' && existing.status !== 'completed') {
    completedAt = now;
    await logInteraction(existing.userId, taskId, 'completed', {
      scheduledTime: existing.dueDate ?? undefined,
    });
  }
  
  const updatedTask: Task = {
    ...existing,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    priority: updates.priority ?? existing.priority,
    status: updates.status ?? existing.status,
    dueDate: updates.dueDate ?? existing.dueDate,
    estimatedMinutes: updates.estimatedMinutes ?? existing.estimatedMinutes,
    actualMinutes: updates.actualMinutes ?? existing.actualMinutes,
    tags: updates.tags ?? existing.tags ?? [],
    energyRequired: updates.energyRequired ?? existing.energyRequired,
    completedAt,
    updatedAt: now,
  };
  
  database.run(
    `UPDATE tasks SET 
      title = ?, description = ?, priority = ?, status = ?, 
      dueDate = ?, estimatedMinutes = ?, actualMinutes = ?,
      tags = ?, energyRequired = ?, completedAt = ?, updatedAt = ?
     WHERE id = ?`,
    [
      updatedTask.title,
      updatedTask.description || null,
      updatedTask.priority,
      updatedTask.status,
      updatedTask.dueDate || null,
      updatedTask.estimatedMinutes ?? null,
      updatedTask.actualMinutes ?? null,
      JSON.stringify(updatedTask.tags || []),
      updatedTask.energyRequired || null,
      updatedTask.completedAt || null,
      updatedTask.updatedAt,
      taskId,
    ]
  );
  
  saveDB();
  console.log(`[TaskService] Updated: ${taskId}`);
  
  return updatedTask;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const database = await initDB();
  
  const existing = await getTaskById(taskId);
  if (!existing) {
    console.warn(`[TaskService] Task not found for deletion: ${taskId}`);
    return false;
  }
  
  // Log deletion for learning
  await logInteraction(existing.userId, taskId, 'deleted');
  
  database.run(`DELETE FROM tasks WHERE id = ?`, [taskId]);
  saveDB();
  
  console.log(`[TaskService] Deleted: ${taskId}`);
  return true;
}

export async function postponeTask(taskId: string, newDueDate?: string): Promise<Task | null> {
  const database = await initDB();
  
  const existing = await getTaskById(taskId);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  const postponedCount = (existing.postponedCount ?? 0) + 1;
  
  // Log postponement for learning
  await logInteraction(existing.userId, taskId, 'postponed', {
    originalDueDate: existing.dueDate ?? undefined,
    newDueDate: newDueDate ?? undefined,
    postponeCount: postponedCount,
  });
  
  database.run(
    `UPDATE tasks SET dueDate = ?, postponedCount = ?, updatedAt = ? WHERE id = ?`,
    [newDueDate || null, postponedCount, now, taskId]
  );
  
  saveDB();
  
  return getTaskById(taskId);
}

// ==================== QUERY FUNCTIONS ====================

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
    task.tags = JSON.parse(task.tags || '[]');
    return task as Task;
  });
}

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
    task.tags = JSON.parse(task.tags || '[]');
    return task as Task;
  });
}

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
    task.tags = JSON.parse(task.tags || '[]');
    return task as Task;
  });
}

export async function getTasksByTag(userId: string, tag: string): Promise<Task[]> {
  const tasks = await getTasksByUserId(userId);
  return tasks.filter(t => t.tags?.includes(tag));
}

export async function getOverdueTasks(userId: string): Promise<Task[]> {
  const database = await initDB();
  const now = new Date().toISOString();
  
  const result = database.exec(
    `SELECT * FROM tasks WHERE userId = ? AND status != 'completed' AND dueDate < ? ORDER BY dueDate ASC`,
    [userId, now]
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
    task.tags = JSON.parse(task.tags || '[]');
    return task as Task;
  });
}

// ==================== SMART INFERENCE ====================

function estimateMinutes(title: string): number {
  const titleLower = title.toLowerCase();
  
  // Quick tasks
  if (['email', 'reply', 'respond', 'check', 'review quick', 'approve'].some(kw => titleLower.includes(kw))) {
    return 15;
  }
  
  // Short tasks
  if (['update', 'fix', 'edit', 'call', 'meeting'].some(kw => titleLower.includes(kw))) {
    return 30;
  }
  
  // Medium tasks
  if (['write', 'create', 'build', 'prepare'].some(kw => titleLower.includes(kw))) {
    return 60;
  }
  
  // Long tasks
  if (['plan', 'design', 'strategy', 'research', 'analyze'].some(kw => titleLower.includes(kw))) {
    return 90;
  }
  
  // Complex tasks
  if (['launch', 'implement', 'develop', 'migrate'].some(kw => titleLower.includes(kw))) {
    return 120;
  }
  
  return 30; // Default
}

function inferEnergyRequirement(input: CreateTaskInput): 'high' | 'medium' | 'low' {
  const titleLower = input.title.toLowerCase();
  
  // High energy tasks
  if (input.priority === 'high') return 'high';
  if ((input.estimatedMinutes || 0) > 60) return 'high';
  if (['strategy', 'design', 'create', 'analyze', 'write', 'plan', 'pitch', 'present'].some(kw => titleLower.includes(kw))) {
    return 'high';
  }
  
  // Low energy tasks
  if (input.priority === 'low') return 'low';
  if (['email', 'respond', 'update', 'file', 'organize', 'schedule'].some(kw => titleLower.includes(kw))) {
    return 'low';
  }
  
  return 'medium';
}

function inferTags(title: string): string[] {
  const titleLower = title.toLowerCase();
  const tags: string[] = [];
  
  // Category inference
  if (['meeting', 'call', 'sync', 'discuss'].some(kw => titleLower.includes(kw))) {
    tags.push('meeting');
  }
  if (['email', 'reply', 'respond', 'message'].some(kw => titleLower.includes(kw))) {
    tags.push('communication');
  }
  if (['write', 'create', 'design', 'build'].some(kw => titleLower.includes(kw))) {
    tags.push('creative');
  }
  if (['review', 'approve', 'check', 'verify'].some(kw => titleLower.includes(kw))) {
    tags.push('review');
  }
  if (['plan', 'strategy', 'roadmap', 'goals'].some(kw => titleLower.includes(kw))) {
    tags.push('planning');
  }
  if (['customer', 'client', 'user'].some(kw => titleLower.includes(kw))) {
    tags.push('customer');
  }
  if (['investor', 'funding', 'pitch', 'raise'].some(kw => titleLower.includes(kw))) {
    tags.push('investor');
  }
  if (['hire', 'interview', 'team', 'onboard'].some(kw => titleLower.includes(kw))) {
    tags.push('hiring');
  }
  if (['fix', 'bug', 'issue', 'error'].some(kw => titleLower.includes(kw))) {
    tags.push('bugfix');
  }
  
  return tags;
}

// ==================== INTERACTION LOGGING ====================

async function logInteraction(
  userId: string,
  taskId: string,
  interactionType: TaskInteraction['interactionType'],
  extra?: {
    originalPriority?: string | undefined;
    newPriority?: string | undefined;
    scheduledTime?: string | undefined;
    originalDueDate?: string | undefined;
    newDueDate?: string | undefined;
    postponeCount?: number | undefined;
  }
): Promise<void> {
  const database = await initDB();
  
  const id = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  database.run(
    `INSERT INTO task_interactions (id, userId, taskId, interactionType, originalPriority, newPriority, scheduledTime, interactionTime, context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      taskId,
      interactionType,
      extra?.originalPriority || null,
      extra?.newPriority || null,
      extra?.scheduledTime || null,
      new Date().toISOString(),
      extra ? JSON.stringify(extra) : null,
    ]
  );
  
  saveDB();
  
  // Trigger weight adjustment if enough interactions
  const interactionCount = await getInteractionCount(userId);
  if (interactionCount > 0 && interactionCount % 20 === 0) {
    console.log(`[TaskService] Triggering weight adjustment (${interactionCount} interactions)`);
    adjustWeights(userId).catch(console.error);
  }
}

async function getInteractionCount(userId: string): Promise<number> {
  const database = await initDB();
  const result = database.exec(
    `SELECT COUNT(*) FROM task_interactions WHERE userId = ?`,
    [userId]
  );
  return result[0]?.values[0]?.[0] as number || 0;
}

// ==================== ADAPTIVE WEIGHTS ====================

export async function getWeights(userId: string): Promise<PriorityWeights> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM priority_weights WHERE userId = ?`,
    [userId]
  );
  
  if (!result[0] || !result[0].values.length) {
    // Return defaults
    return {
      userId,
      ...DEFAULT_WEIGHTS,
      lastUpdated: new Date().toISOString(),
    };
  }
  
  const row = result[0].values[0];
  const columns = result[0].columns;
  const weights: any = {};
  columns.forEach((col, idx) => {
    weights[col] = row?.[idx];
  });
  
  return weights as PriorityWeights;
}

async function adjustWeights(userId: string): Promise<void> {
  const database = await initDB();
  
  // Get recent interactions
  const result = database.exec(
    `SELECT interactionType, originalPriority, newPriority, context 
     FROM task_interactions 
     WHERE userId = ? 
     ORDER BY interactionTime DESC 
     LIMIT 50`,
    [userId]
  );
  
  if (!result[0] || result[0].values.length < 10) return;
  
  const currentWeights = await getWeights(userId);
  let { urgencyWeight, importanceWeight, effortWeight, deadlineWeight } = currentWeights;
  
  // Analyze patterns
  const interactions = result[0].values;
  
  // If user frequently completes high-priority tasks → importance matters more
  const completedHigh = interactions.filter(i => 
    i[0] === 'completed' && i[1] === 'high'
  ).length;
  
  // If user frequently postpones → deadline weight needs adjustment
  const postponed = interactions.filter(i => i[0] === 'postponed').length;
  
  // If user frequently changes priority → importance weight needs refinement
  const priorityChanges = interactions.filter(i => i[0] === 'priority_changed').length;
  
  const total = interactions.length;
  
  // Adjust weights based on behavior (small increments)
  if (completedHigh / total > 0.3) {
    importanceWeight = Math.min(0.45, importanceWeight + 0.02);
  }
  
  if (postponed / total > 0.3) {
    deadlineWeight = Math.max(0.10, deadlineWeight - 0.02);
    urgencyWeight = Math.min(0.45, urgencyWeight + 0.02);
  }
  
  if (priorityChanges / total > 0.2) {
    importanceWeight = Math.max(0.15, importanceWeight - 0.01);
    effortWeight = Math.min(0.25, effortWeight + 0.01);
  }
  
  // Normalize weights to sum to 1
  const total_weight = urgencyWeight + importanceWeight + effortWeight + deadlineWeight;
  urgencyWeight /= total_weight;
  importanceWeight /= total_weight;
  effortWeight /= total_weight;
  deadlineWeight /= total_weight;
  
  // Save updated weights
  database.run(
    `INSERT OR REPLACE INTO priority_weights (userId, urgencyWeight, importanceWeight, effortWeight, deadlineWeight, lastUpdated)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, urgencyWeight, importanceWeight, effortWeight, deadlineWeight, new Date().toISOString()]
  );
  
  saveDB();
  console.log(`[TaskService] Adjusted weights for ${userId}:`, { urgencyWeight, importanceWeight, effortWeight, deadlineWeight });
}

// ==================== SMART PRIORITIZATION ====================

export interface PrioritizedTask {
  task: Task;
  score: number;
  breakdown: {
    urgency: number;
    importance: number;
    effort: number;
    deadline: number;
  };
  recommendation: string;
}

export async function getPrioritizedTasks(userId: string): Promise<PrioritizedTask[]> {
  const tasks = await getTasksByUserId(userId);
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const weights = await getWeights(userId);
  
  const prioritized: PrioritizedTask[] = pendingTasks.map(task => {
    // Calculate component scores (0-100 each)
    const urgency = calculateUrgencyScore(task);
    const importance = calculateImportanceScore(task);
    const effort = calculateEffortScore(task);
    const deadline = calculateDeadlineScore(task);
    
    // Apply weights
    const score = Math.round(
      urgency * weights.urgencyWeight +
      importance * weights.importanceWeight +
      effort * weights.effortWeight +
      deadline * weights.deadlineWeight
    );
    
    // Generate recommendation
    const recommendation = generateRecommendation(task, { urgency, importance, effort, deadline });
    
    return {
      task,
      score,
      breakdown: { urgency, importance, effort, deadline },
      recommendation,
    };
  });
  
  // Sort by score descending
  prioritized.sort((a, b) => b.score - a.score);
  
  return prioritized;
}

function calculateUrgencyScore(task: Task): number {
  // Based on postponement count and status
  let score = 50;
  const postponedCount = task.postponedCount ?? 0;
  
  if (task.status === 'in_progress') score += 20;
  if (postponedCount > 0) score -= postponedCount * 10;
  if (postponedCount >= 3) score -= 20; // Heavily penalize frequently postponed
  
  // Overdue boost
  if (task.dueDate) {
    const daysUntil = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0) score = 100; // Overdue
    else if (daysUntil < 1) score += 30;
    else if (daysUntil < 3) score += 15;
  }
  
  return Math.max(0, Math.min(100, score));
}

function calculateImportanceScore(task: Task): number {
  let score = 50;
  
  switch (task.priority) {
    case 'high': score = 90; break;
    case 'medium': score = 50; break;
    case 'low': score = 20; break;
  }
  
  // Tag boosts
  if (task.tags?.includes('investor')) score += 10;
  if (task.tags?.includes('customer')) score += 8;
  if (task.tags?.includes('blocker')) score += 15;
  
  // Strategic keyword boost
  const strategicWords = ['revenue', 'launch', 'critical', 'blocker', 'investor'];
  if (strategicWords.some(w => task.title.toLowerCase().includes(w))) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function calculateEffortScore(task: Task): number {
  // Higher score for easier tasks (quick wins)
  const minutes = task.estimatedMinutes || 30;
  
  if (minutes <= 15) return 100;  // Very quick
  if (minutes <= 30) return 80;
  if (minutes <= 60) return 60;
  if (minutes <= 120) return 40;
  return 20;  // Long tasks
}

function calculateDeadlineScore(task: Task): number {
  if (!task.dueDate) return 40; // No deadline = moderate
  
  const daysUntil = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  
  if (daysUntil < 0) return 100;    // Overdue
  if (daysUntil < 1) return 95;     // Today
  if (daysUntil < 2) return 80;     // Tomorrow
  if (daysUntil < 7) return 60;     // This week
  if (daysUntil < 14) return 40;    // Next week
  return 20;                         // Later
}

function generateRecommendation(
  task: Task,
  scores: { urgency: number; importance: number; effort: number; deadline: number }
): string {
  const highest = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a);
  
  switch (highest[0]) {
    case 'urgency':
      if (task.postponedCount && task.postponedCount > 2) {
        return '⚠️ Frequently postponed. Complete today to avoid buildup.';
      }
      return '🔥 High urgency. Tackle soon.';
    
    case 'importance':
      return '⭐ High impact task. Schedule during peak energy.';
    
    case 'effort':
      if (scores.effort >= 80) {
        return '🚀 Quick win! Great for building momentum.';
      }
      return '⚡ Reasonable effort. Good candidate for focus time.';
    
    case 'deadline':
      const daysUntil = task.dueDate 
        ? (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : 999;
      if (daysUntil < 0) return '🚨 OVERDUE! Address immediately.';
      if (daysUntil < 1) return '📅 Due today. Prioritize now.';
      return '📆 Deadline approaching. Plan ahead.';
    
    default:
      return '📋 Standard priority task.';
  }
}

// ==================== ANALYTICS ====================

export async function getTaskStats(userId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  avgCompletionTime: number | null;
  frequentTags: { tag: string; count: number }[];
  postponementRate: number;
}> {
  const tasks = await getTasksByUserId(userId);
  const overdueTasks = await getOverdueTasks(userId);
  
  const completed = tasks.filter(t => t.status === 'completed');
  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  
  // Calculate average completion time
  let avgCompletionTime: number | null = null;
  const completedWithTime = completed.filter(t => t.actualMinutes);
  if (completedWithTime.length > 0) {
    avgCompletionTime = completedWithTime.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / completedWithTime.length;
  }
  
  // Count tags
  const tagCounts: Record<string, number> = {};
  tasks.forEach(t => {
    (t.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  const frequentTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Postponement rate
  const totalPostponements = tasks.reduce((sum, t) => sum + (t.postponedCount || 0), 0);
  const postponementRate = tasks.length > 0 ? totalPostponements / tasks.length : 0;
  
  return {
    total: tasks.length,
    completed: completed.length,
    pending: pending.length,
    overdue: overdueTasks.length,
    completionRate: tasks.length > 0 ? completed.length / tasks.length : 0,
    avgCompletionTime,
    frequentTags,
    postponementRate,
  };
}
