import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'focus_sessions.db');

let db: Database | null = null;

// ==================== TYPES ====================

export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

// NEW: Blocking modes
export type BlockingMode = 
  | 'standard'      // Show overlay, user can dismiss
  | 'strict'        // Can't dismiss, must wait or complete micro-task
  | 'nuclear'       // App completely blocked, no bypass
  | 'gradual';      // Adds increasing delay on each unlock attempt

// NEW: Unlock friction types
export type FrictionType = 
  | 'none'
  | 'timer'         // Wait X seconds
  | 'typing'        // Type a phrase
  | 'math'          // Solve a math problem
  | 'reflection';   // Write why you need the app

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string | undefined;
  taskTitle?: string | undefined;
  startTime: string;
  endTime?: string | undefined;
  plannedDuration: number;
  actualDuration?: number | undefined;
  status: SessionStatus;
  distractionCount: number;
  blockedAttempts: number;          // NEW: Total blocked attempts
  unblockedCount: number;           // NEW: Times user bypassed
  blockedApps: string[];
  allowedApps: string[];
  blockingMode: BlockingMode;       // NEW
  focusScore?: number | undefined;  // NEW: 0-100 score for the session
  breaks: SessionBreak[];           // NEW: Scheduled breaks
  createdAt: string;
  updatedAt: string;
}

// NEW: Break tracking
export interface SessionBreak {
  startTime: string;
  endTime?: string;
  type: 'scheduled' | 'manual' | 'distraction';
  durationMinutes: number;
}

export interface DistractionLog {
  id: string;
  sessionId: string;
  userId: string;
  appPackageName: string;
  appName: string;
  timestamp: string;
  wasBlocked: boolean;
  bypassedWith?: FrictionType | undefined;    // NEW: How they bypassed (if they did)
  frictionCompleted?: boolean | undefined;    // NEW: Did they complete the friction task?
  timeSpent?: number | undefined;             // NEW: Seconds spent on blocked attempt
}

// NEW: Violation analytics
export interface ViolationStats {
  userId: string;
  period: string; // 'day' | 'week' | 'month'
  totalViolations: number;
  mostAttemptedApps: { app: string; count: number }[];
  peakViolationHours: { hour: number; count: number }[];
  avgViolationsPerSession: number;
  successfulBlocks: number;
  bypasses: number;
  blockEffectiveness: number; // 0-100%
  frictionEffectiveness: { type: FrictionType; stopRate: number }[];
  recommendations: string[];
}

export interface ShieldSettings {
  userId: string;
  isEnabled: boolean;
  blockedApps: string[];
  allowedApps: string[];
  showOverlay: boolean;
  playSound: boolean;
  vibrate: boolean;
  strictMode: boolean;
  // NEW: Advanced settings
  blockingMode: BlockingMode;
  frictionType: FrictionType;
  frictionDelay: number;          // Seconds for timer friction
  frictionPhrase?: string;        // Phrase for typing friction
  gradualDelayMultiplier: number; // Multiplier for gradual mode
  maxDailyBypasses: number;       // Limit bypasses per day
  breakReminder: boolean;         // Remind to take breaks
  breakInterval: number;          // Minutes between break reminders
  breakDuration: number;          // Recommended break length
  autoEndOnComplete: boolean;     // End session when task completed
  motivationalQuotes: boolean;    // Show quotes on overlay
  scheduleEnabled: boolean;       // Auto-enable during scheduled hours
  scheduleStart?: string;         // HH:MM
  scheduleEnd?: string;           // HH:MM
  scheduleDays?: number[];        // 0-6 (Sunday-Saturday)
  updatedAt: string;
}

// NEW: Micro-tasks for unlock friction
export interface FrictionChallenge {
  type: FrictionType;
  challenge: string;
  answer?: string;
  timeoutSeconds?: number;
}

// Motivational quotes
const MOTIVATIONAL_QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus on being productive instead of busy.",
  "Your future is created by what you do today.",
  "Deep work is the superpower of the 21st century.",
  "Discipline is choosing between what you want now and what you want most.",
  "The only way to do great work is to love what you do.",
  "Don't let yesterday take up too much of today.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Stay focused, go after your dreams and keep moving toward your goals.",
  "Starve your distractions, feed your focus.",
];

// Common distracting apps
export const DEFAULT_BLOCKED_APPS = [
  { packageName: 'com.instagram.android', name: 'Instagram', category: 'social' },
  { packageName: 'com.facebook.katana', name: 'Facebook', category: 'social' },
  { packageName: 'com.twitter.android', name: 'Twitter/X', category: 'social' },
  { packageName: 'com.zhiliaoapp.musically', name: 'TikTok', category: 'social' },
  { packageName: 'com.snapchat.android', name: 'Snapchat', category: 'social' },
  { packageName: 'com.reddit.frontpage', name: 'Reddit', category: 'social' },
  { packageName: 'com.google.android.youtube', name: 'YouTube', category: 'entertainment' },
  { packageName: 'com.netflix.mediaclient', name: 'Netflix', category: 'entertainment' },
  { packageName: 'com.spotify.music', name: 'Spotify', category: 'entertainment' },
  { packageName: 'com.whatsapp', name: 'WhatsApp', category: 'messaging' },
  { packageName: 'org.telegram.messenger', name: 'Telegram', category: 'messaging' },
  { packageName: 'com.discord', name: 'Discord', category: 'messaging' },
  { packageName: 'com.linkedin.android', name: 'LinkedIn', category: 'social' },
  { packageName: 'com.pinterest', name: 'Pinterest', category: 'social' },
  { packageName: 'com.amazon.mShop.android.shopping', name: 'Amazon', category: 'shopping' },
];

// ==================== DATABASE ====================

async function initDB(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[FocusSession] Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('[FocusSession] Created new database');
  }
  
  // Enhanced focus_sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      taskId TEXT,
      taskTitle TEXT,
      startTime TEXT NOT NULL,
      endTime TEXT,
      plannedDuration INTEGER NOT NULL,
      actualDuration INTEGER,
      status TEXT DEFAULT 'active',
      distractionCount INTEGER DEFAULT 0,
      blockedAttempts INTEGER DEFAULT 0,
      unblockedCount INTEGER DEFAULT 0,
      blockedApps TEXT DEFAULT '[]',
      allowedApps TEXT DEFAULT '[]',
      blockingMode TEXT DEFAULT 'standard',
      focusScore INTEGER,
      breaks TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  
  // Enhanced distraction_logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS distraction_logs (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      appPackageName TEXT NOT NULL,
      appName TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      wasBlocked INTEGER DEFAULT 1,
      bypassedWith TEXT,
      frictionCompleted INTEGER DEFAULT 0,
      timeSpent INTEGER DEFAULT 0
    )
  `);
  
  // Enhanced shield_settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS shield_settings (
      userId TEXT PRIMARY KEY,
      isEnabled INTEGER DEFAULT 1,
      blockedApps TEXT DEFAULT '[]',
      allowedApps TEXT DEFAULT '[]',
      showOverlay INTEGER DEFAULT 1,
      playSound INTEGER DEFAULT 0,
      vibrate INTEGER DEFAULT 1,
      strictMode INTEGER DEFAULT 0,
      blockingMode TEXT DEFAULT 'standard',
      frictionType TEXT DEFAULT 'none',
      frictionDelay INTEGER DEFAULT 5,
      frictionPhrase TEXT,
      gradualDelayMultiplier REAL DEFAULT 1.5,
      maxDailyBypasses INTEGER DEFAULT 5,
      breakReminder INTEGER DEFAULT 1,
      breakInterval INTEGER DEFAULT 50,
      breakDuration INTEGER DEFAULT 10,
      autoEndOnComplete INTEGER DEFAULT 0,
      motivationalQuotes INTEGER DEFAULT 1,
      scheduleEnabled INTEGER DEFAULT 0,
      scheduleStart TEXT,
      scheduleEnd TEXT,
      scheduleDays TEXT,
      updatedAt TEXT NOT NULL
    )
  `);
  
  // NEW: Daily bypass tracking
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_bypasses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      bypassCount INTEGER DEFAULT 0,
      UNIQUE(userId, date)
    )
  `);
  
  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_userId ON focus_sessions(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON focus_sessions(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_distractions_sessionId ON distraction_logs(sessionId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_distractions_timestamp ON distraction_logs(timestamp)`);
  
  saveDB();
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== FOCUS SESSIONS ====================

export async function startFocusSession(
  userId: string,
  options: {
    taskId?: string;
    taskTitle?: string;
    plannedDuration: number;
    blockedApps?: string[];
    allowedApps?: string[];
    blockingMode?: BlockingMode;
  }
): Promise<FocusSession> {
  const database = await initDB();
  
  // End any active sessions first
  await endActiveSession(userId);
  
  const id = generateId('session');
  const now = new Date().toISOString();
  const settings = await getShieldSettings(userId);
  
  const session: FocusSession = {
    id,
    userId,
    taskId: options.taskId,
    taskTitle: options.taskTitle,
    startTime: now,
    plannedDuration: options.plannedDuration,
    status: 'active',
    distractionCount: 0,
    blockedAttempts: 0,
    unblockedCount: 0,
    blockedApps: options.blockedApps || settings.blockedApps,
    allowedApps: options.allowedApps || settings.allowedApps,
    blockingMode: options.blockingMode || settings.blockingMode,
    breaks: [],
    createdAt: now,
    updatedAt: now,
  };
  
  database.run(
    `INSERT INTO focus_sessions 
     (id, userId, taskId, taskTitle, startTime, plannedDuration, status, distractionCount, blockedAttempts, unblockedCount, blockedApps, allowedApps, blockingMode, breaks, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.userId,
      session.taskId || null,
      session.taskTitle || null,
      session.startTime,
      session.plannedDuration,
      session.status,
      session.distractionCount,
      session.blockedAttempts,
      session.unblockedCount,
      JSON.stringify(session.blockedApps),
      JSON.stringify(session.allowedApps),
      session.blockingMode,
      JSON.stringify(session.breaks),
      session.createdAt,
      session.updatedAt,
    ]
  );
  
  saveDB();
  console.log(`[FocusSession] Started: ${id} (${options.plannedDuration}min, ${session.blockingMode} mode)`);
  
  return session;
}

export async function getActiveSession(userId: string): Promise<FocusSession | null> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM focus_sessions WHERE userId = ? AND status = 'active' ORDER BY startTime DESC LIMIT 1`,
    [userId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return null;
  }
  
  const row = firstResult.values[0];
  if (!row) return null;
  
  return parseSessionRow(firstResult.columns, row);
}

function parseSessionRow(columns: string[], row: any[]): FocusSession {
  const session: any = {};
  columns.forEach((col: string, idx: number) => {
    session[col] = row[idx];
  });
  
  session.blockedApps = JSON.parse(session.blockedApps || '[]');
  session.allowedApps = JSON.parse(session.allowedApps || '[]');
  session.breaks = JSON.parse(session.breaks || '[]');
  
  return session as FocusSession;
}

export async function endActiveSession(userId: string): Promise<FocusSession | null> {
  const database = await initDB();
  
  const activeSession = await getActiveSession(userId);
  if (!activeSession) return null;
  
  const now = new Date();
  const startTime = new Date(activeSession.startTime);
  const actualDuration = Math.round((now.getTime() - startTime.getTime()) / 60000);
  
  // Calculate focus score
  const focusScore = calculateFocusScore(activeSession, actualDuration);
  
  database.run(
    `UPDATE focus_sessions SET status = 'completed', endTime = ?, actualDuration = ?, focusScore = ?, updatedAt = ? WHERE id = ?`,
    [now.toISOString(), actualDuration, focusScore, now.toISOString(), activeSession.id]
  );
  
  saveDB();
  console.log(`[FocusSession] Ended: ${activeSession.id} (Score: ${focusScore}/100)`);
  
  return { 
    ...activeSession, 
    status: 'completed', 
    endTime: now.toISOString(), 
    actualDuration,
    focusScore,
  };
}

function calculateFocusScore(session: FocusSession, actualDuration: number): number {
  let score = 100;
  
  // Deduct for distractions
  score -= session.distractionCount * 3;
  
  // Deduct more for bypasses
  score -= session.unblockedCount * 10;
  
  // Bonus for blocked attempts (resisted temptation)
  score += Math.min(10, (session.blockedAttempts - session.unblockedCount) * 2);
  
  // Duration factor
  if (actualDuration >= session.plannedDuration) {
    score += 5; // Bonus for completing planned duration
  } else {
    const completionRatio = actualDuration / session.plannedDuration;
    if (completionRatio < 0.5) score -= 15;
    else if (completionRatio < 0.8) score -= 5;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function pauseSession(userId: string): Promise<FocusSession | null> {
  const database = await initDB();
  
  const activeSession = await getActiveSession(userId);
  if (!activeSession) return null;
  
  const now = new Date().toISOString();
  
  // Add break record
  const breaks = [...activeSession.breaks, {
    startTime: now,
    type: 'manual' as const,
    durationMinutes: 0,
  }];
  
  database.run(
    `UPDATE focus_sessions SET status = 'paused', breaks = ?, updatedAt = ? WHERE id = ?`,
    [JSON.stringify(breaks), now, activeSession.id]
  );
  
  saveDB();
  return { ...activeSession, status: 'paused', breaks, updatedAt: now };
}

export async function resumeSession(userId: string): Promise<FocusSession | null> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM focus_sessions WHERE userId = ? AND status = 'paused' ORDER BY updatedAt DESC LIMIT 1`,
    [userId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return null;
  }
  
  const sessionRow = firstResult.values[0];
  if (!sessionRow) return null;
  
  const session = parseSessionRow(firstResult.columns, sessionRow);
  const now = new Date().toISOString();
  
  // Update last break's end time
  const breaks = session.breaks;
  if (breaks.length > 0) {
    const lastBreak = breaks[breaks.length - 1]!;
    lastBreak.endTime = now;
    const startTime = new Date(lastBreak.startTime);
    lastBreak.durationMinutes = Math.round((new Date(now).getTime() - startTime.getTime()) / 60000);
  }
  
  database.run(
    `UPDATE focus_sessions SET status = 'active', breaks = ?, updatedAt = ? WHERE id = ?`,
    [JSON.stringify(breaks), now, session.id]
  );
  
  saveDB();
  return { ...session, status: 'active', breaks, updatedAt: now };
}

// ==================== DISTRACTION LOGGING ====================

export async function logDistraction(
  userId: string,
  sessionId: string,
  appPackageName: string,
  appName: string,
  wasBlocked: boolean,
  options?: {
    bypassedWith?: FrictionType;
    frictionCompleted?: boolean;
    timeSpent?: number;
  }
): Promise<DistractionLog> {
  const database = await initDB();
  
  const id = generateId('distraction');
  const timestamp = new Date().toISOString();
  
  const log: DistractionLog = {
    id,
    sessionId,
    userId,
    appPackageName,
    appName,
    timestamp,
    wasBlocked,
    bypassedWith: options?.bypassedWith,
    frictionCompleted: options?.frictionCompleted,
    timeSpent: options?.timeSpent,
  };
  
  database.run(
    `INSERT INTO distraction_logs (id, sessionId, userId, appPackageName, appName, timestamp, wasBlocked, bypassedWith, frictionCompleted, timeSpent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.sessionId,
      log.userId,
      log.appPackageName,
      log.appName,
      log.timestamp,
      wasBlocked ? 1 : 0,
      log.bypassedWith || null,
      log.frictionCompleted ? 1 : 0,
      log.timeSpent || 0,
    ]
  );
  
  // Update session counts
  if (wasBlocked) {
    database.run(
      `UPDATE focus_sessions SET 
        distractionCount = distractionCount + 1, 
        blockedAttempts = blockedAttempts + 1,
        unblockedCount = unblockedCount + ${options?.bypassedWith ? 1 : 0},
        updatedAt = ? 
       WHERE id = ?`,
      [timestamp, sessionId]
    );
  } else {
    database.run(
      `UPDATE focus_sessions SET distractionCount = distractionCount + 1, updatedAt = ? WHERE id = ?`,
      [timestamp, sessionId]
    );
  }
  
  // Track daily bypasses
  if (options?.bypassedWith) {
    await trackDailyBypass(userId);
  }
  
  saveDB();
  console.log(`[FocusSession] Distraction: ${appName} (blocked: ${wasBlocked}, bypassed: ${options?.bypassedWith || 'no'})`);
  
  return log;
}

async function trackDailyBypass(userId: string): Promise<void> {
  const database = await initDB();
  const today = new Date().toISOString().split('T')[0] ?? '';
  
  database.run(
    `INSERT INTO daily_bypasses (id, userId, date, bypassCount) 
     VALUES (?, ?, ?, 1)
     ON CONFLICT(userId, date) DO UPDATE SET bypassCount = bypassCount + 1`,
    [generateId('bypass'), userId, today]
  );
}

export async function getDailyBypassCount(userId: string): Promise<number> {
  const database = await initDB();
  const today = new Date().toISOString().split('T')[0] ?? '';
  
  const result = database.exec(
    `SELECT bypassCount FROM daily_bypasses WHERE userId = ? AND date = ?`,
    [userId, today]
  );
  
  return result[0]?.values[0]?.[0] as number || 0;
}

// ==================== UNLOCK FRICTION ====================

export function generateFrictionChallenge(type: FrictionType, settings: ShieldSettings): FrictionChallenge {
  switch (type) {
    case 'timer':
      return {
        type: 'timer',
        challenge: `Wait ${settings.frictionDelay} seconds to continue`,
        timeoutSeconds: settings.frictionDelay,
      };
    
    case 'typing':
      const phrase = settings.frictionPhrase || 'I choose to stay focused on my goals';
      return {
        type: 'typing',
        challenge: `Type this phrase to continue:\n"${phrase}"`,
        answer: phrase,
      };
    
    case 'math':
      const a = Math.floor(Math.random() * 50) + 10;
      const b = Math.floor(Math.random() * 50) + 10;
      const operators = ['+', '-', '*'];
      const op = operators[Math.floor(Math.random() * operators.length)]!;
      let result: number;
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        default: result = a + b;
      }
      return {
        type: 'math',
        challenge: `Solve: ${a} ${op} ${b} = ?`,
        answer: result.toString(),
        timeoutSeconds: 30,
      };
    
    case 'reflection':
      const prompts = [
        'Why do you need this app right now?',
        'Will this help you achieve your goal today?',
        'Can this wait until your focus session ends?',
        'What would your future self think about this?',
      ];
      return {
        type: 'reflection',
        challenge: prompts[Math.floor(Math.random() * prompts.length)]!,
        timeoutSeconds: 60,
      };
    
    default:
      return { type: 'none', challenge: '' };
  }
}

export async function canBypass(userId: string): Promise<{ allowed: boolean; reason?: string; remainingBypasses?: number }> {
  const settings = await getShieldSettings(userId);
  
  // Nuclear mode = no bypass allowed
  if (settings.blockingMode === 'nuclear') {
    return { allowed: false, reason: 'Nuclear mode is active. No bypasses allowed.' };
  }
  
  // Check daily bypass limit
  const dailyBypasses = await getDailyBypassCount(userId);
  if (dailyBypasses >= settings.maxDailyBypasses) {
    return { 
      allowed: false, 
      reason: `Daily bypass limit reached (${settings.maxDailyBypasses}/day)` 
    };
  }
  
  return { 
    allowed: true, 
    remainingBypasses: settings.maxDailyBypasses - dailyBypasses 
  };
}

// ==================== VIOLATION ANALYTICS ====================

export async function getViolationStats(
  userId: string,
  days: number = 7
): Promise<ViolationStats> {
  const database = await initDB();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString();
  
  // Total violations
  const totalResult = database.exec(
    `SELECT COUNT(*) FROM distraction_logs WHERE userId = ? AND timestamp >= ?`,
    [userId, cutoff]
  );
  const totalViolations = totalResult[0]?.values[0]?.[0] as number || 0;
  
  // Successful blocks
  const blockedResult = database.exec(
    `SELECT COUNT(*) FROM distraction_logs WHERE userId = ? AND timestamp >= ? AND wasBlocked = 1 AND bypassedWith IS NULL`,
    [userId, cutoff]
  );
  const successfulBlocks = blockedResult[0]?.values[0]?.[0] as number || 0;
  
  // Bypasses
  const bypassResult = database.exec(
    `SELECT COUNT(*) FROM distraction_logs WHERE userId = ? AND timestamp >= ? AND bypassedWith IS NOT NULL`,
    [userId, cutoff]
  );
  const bypasses = bypassResult[0]?.values[0]?.[0] as number || 0;
  
  // Most attempted apps
  const appsResult = database.exec(
    `SELECT appName, COUNT(*) as count FROM distraction_logs 
     WHERE userId = ? AND timestamp >= ?
     GROUP BY appName ORDER BY count DESC LIMIT 5`,
    [userId, cutoff]
  );
  const mostAttemptedApps = (appsResult[0]?.values || []).map((row) => ({
    app: row[0] as string,
    count: row[1] as number,
  }));
  
  // Peak violation hours
  const hoursResult = database.exec(
    `SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as count 
     FROM distraction_logs 
     WHERE userId = ? AND timestamp >= ?
     GROUP BY hour ORDER BY count DESC LIMIT 5`,
    [userId, cutoff]
  );
  const peakViolationHours = (hoursResult[0]?.values || []).map((row) => ({
    hour: row[0] as number,
    count: row[1] as number,
  }));
  
  // Avg per session
  const sessionResult = database.exec(
    `SELECT COUNT(*) FROM focus_sessions WHERE userId = ? AND startTime >= ?`,
    [userId, cutoff]
  );
  const sessionCount = sessionResult[0]?.values[0]?.[0] as number || 1;
  const avgViolationsPerSession = Math.round((totalViolations / sessionCount) * 10) / 10;
  
  // Block effectiveness
  const blockEffectiveness = totalViolations > 0 
    ? Math.round((successfulBlocks / totalViolations) * 100)
    : 100;
  
  // Friction effectiveness
  const frictionResult = database.exec(
    `SELECT bypassedWith, COUNT(*) as total, SUM(frictionCompleted) as completed
     FROM distraction_logs 
     WHERE userId = ? AND timestamp >= ? AND bypassedWith IS NOT NULL
     GROUP BY bypassedWith`,
    [userId, cutoff]
  );
  
  const frictionEffectiveness: { type: FrictionType; stopRate: number }[] = 
    (frictionResult[0]?.values || []).map((row) => {
      const total = row[1] as number;
      const completed = row[2] as number || 0;
      return {
        type: row[0] as FrictionType,
        stopRate: Math.round((1 - completed / total) * 100),
      };
    });
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (avgViolationsPerSession > 5) {
    recommendations.push('Consider enabling Strict Mode to reduce distractions.');
  }
  
  if (mostAttemptedApps.length > 0 && mostAttemptedApps[0]!.count > 10) {
    recommendations.push(`${mostAttemptedApps[0]!.app} is your biggest distraction. Consider uninstalling or moving it off your home screen.`);
  }
  
  if (peakViolationHours.length > 0) {
    const peakHour = peakViolationHours[0]!.hour;
    recommendations.push(`Most distractions happen around ${peakHour}:00. Plan important work at different times.`);
  }
  
  if (bypasses > successfulBlocks) {
    recommendations.push('You bypass blocks often. Try increasing friction level or enabling Nuclear Mode for important sessions.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Great focus discipline! Keep it up.');
  }
  
  return {
    userId,
    period: `${days}_days`,
    totalViolations,
    mostAttemptedApps,
    peakViolationHours,
    avgViolationsPerSession,
    successfulBlocks,
    bypasses,
    blockEffectiveness,
    frictionEffectiveness,
    recommendations,
  };
}

export async function getSessionHistory(userId: string, limit: number = 20): Promise<FocusSession[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM focus_sessions WHERE userId = ? ORDER BY startTime DESC LIMIT ?`,
    [userId, limit]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  return firstResult.values.map(row => parseSessionRow(firstResult.columns, row));
}

export async function getDistractionStats(userId: string, days: number = 7): Promise<{
  totalDistractions: number;
  mostDistractingApps: { app: string; count: number }[];
  avgDistractionsPerSession: number;
}> {
  const stats = await getViolationStats(userId, days);
  
  return {
    totalDistractions: stats.totalViolations,
    mostDistractingApps: stats.mostAttemptedApps,
    avgDistractionsPerSession: stats.avgViolationsPerSession,
  };
}

// ==================== SHIELD SETTINGS ====================

export async function getShieldSettings(userId: string): Promise<ShieldSettings> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM shield_settings WHERE userId = ?`,
    [userId]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return createDefaultShieldSettings(userId);
  }
  
  const columns = firstResult.columns;
  const row = firstResult.values[0];
  if (!row) return createDefaultShieldSettings(userId);
  
  const settings: any = {};
  columns.forEach((col: string, idx: number) => {
    settings[col] = row[idx];
  });
  
  // Parse JSON and boolean fields
  settings.blockedApps = JSON.parse(settings.blockedApps || '[]');
  settings.allowedApps = JSON.parse(settings.allowedApps || '[]');
  settings.scheduleDays = settings.scheduleDays ? JSON.parse(settings.scheduleDays) : undefined;
  settings.isEnabled = !!settings.isEnabled;
  settings.showOverlay = !!settings.showOverlay;
  settings.playSound = !!settings.playSound;
  settings.vibrate = !!settings.vibrate;
  settings.strictMode = !!settings.strictMode;
  settings.breakReminder = !!settings.breakReminder;
  settings.autoEndOnComplete = !!settings.autoEndOnComplete;
  settings.motivationalQuotes = !!settings.motivationalQuotes;
  settings.scheduleEnabled = !!settings.scheduleEnabled;
  
  return settings as ShieldSettings;
}

async function createDefaultShieldSettings(userId: string): Promise<ShieldSettings> {
  const database = await initDB();
  
  const now = new Date().toISOString();
  const defaultBlockedApps = DEFAULT_BLOCKED_APPS.map((a) => a.packageName);
  
  const settings: ShieldSettings = {
    userId,
    isEnabled: true,
    blockedApps: defaultBlockedApps,
    allowedApps: [],
    showOverlay: true,
    playSound: false,
    vibrate: true,
    strictMode: false,
    blockingMode: 'standard',
    frictionType: 'timer',
    frictionDelay: 5,
    gradualDelayMultiplier: 1.5,
    maxDailyBypasses: 5,
    breakReminder: true,
    breakInterval: 50,
    breakDuration: 10,
    autoEndOnComplete: false,
    motivationalQuotes: true,
    scheduleEnabled: false,
    updatedAt: now,
  };
  
  database.run(
    `INSERT INTO shield_settings 
     (userId, isEnabled, blockedApps, allowedApps, showOverlay, playSound, vibrate, strictMode, blockingMode, frictionType, frictionDelay, gradualDelayMultiplier, maxDailyBypasses, breakReminder, breakInterval, breakDuration, autoEndOnComplete, motivationalQuotes, scheduleEnabled, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      settings.userId,
      settings.isEnabled ? 1 : 0,
      JSON.stringify(settings.blockedApps),
      JSON.stringify(settings.allowedApps),
      settings.showOverlay ? 1 : 0,
      settings.playSound ? 1 : 0,
      settings.vibrate ? 1 : 0,
      settings.strictMode ? 1 : 0,
      settings.blockingMode,
      settings.frictionType,
      settings.frictionDelay,
      settings.gradualDelayMultiplier,
      settings.maxDailyBypasses,
      settings.breakReminder ? 1 : 0,
      settings.breakInterval,
      settings.breakDuration,
      settings.autoEndOnComplete ? 1 : 0,
      settings.motivationalQuotes ? 1 : 0,
      settings.scheduleEnabled ? 1 : 0,
      settings.updatedAt,
    ]
  );
  
  saveDB();
  console.log(`[FocusSession] Created default settings for ${userId}`);
  
  return settings;
}

export async function updateShieldSettings(
  userId: string,
  updates: Partial<Omit<ShieldSettings, 'userId' | 'updatedAt'>>
): Promise<ShieldSettings> {
  const database = await initDB();
  
  const current = await getShieldSettings(userId);
  const now = new Date().toISOString();
  
  const updated: ShieldSettings = {
    ...current,
    ...updates,
    updatedAt: now,
  };
  
  database.run(
    `UPDATE shield_settings SET 
     isEnabled = ?, blockedApps = ?, allowedApps = ?, showOverlay = ?, playSound = ?, 
     vibrate = ?, strictMode = ?, blockingMode = ?, frictionType = ?, frictionDelay = ?,
     frictionPhrase = ?, gradualDelayMultiplier = ?, maxDailyBypasses = ?, breakReminder = ?,
     breakInterval = ?, breakDuration = ?, autoEndOnComplete = ?, motivationalQuotes = ?,
     scheduleEnabled = ?, scheduleStart = ?, scheduleEnd = ?, scheduleDays = ?, updatedAt = ?
     WHERE userId = ?`,
    [
      updated.isEnabled ? 1 : 0,
      JSON.stringify(updated.blockedApps),
      JSON.stringify(updated.allowedApps),
      updated.showOverlay ? 1 : 0,
      updated.playSound ? 1 : 0,
      updated.vibrate ? 1 : 0,
      updated.strictMode ? 1 : 0,
      updated.blockingMode,
      updated.frictionType,
      updated.frictionDelay,
      updated.frictionPhrase || null,
      updated.gradualDelayMultiplier,
      updated.maxDailyBypasses,
      updated.breakReminder ? 1 : 0,
      updated.breakInterval,
      updated.breakDuration,
      updated.autoEndOnComplete ? 1 : 0,
      updated.motivationalQuotes ? 1 : 0,
      updated.scheduleEnabled ? 1 : 0,
      updated.scheduleStart || null,
      updated.scheduleEnd || null,
      updated.scheduleDays ? JSON.stringify(updated.scheduleDays) : null,
      updated.updatedAt,
      userId,
    ]
  );
  
  saveDB();
  console.log(`[FocusSession] Updated settings for ${userId}`);
  
  return updated;
}

// ==================== APP BLOCKING ====================

export async function shouldBlockApp(userId: string, appPackageName: string): Promise<{
  shouldBlock: boolean;
  reason: string;
  session: FocusSession | null;
  friction?: FrictionChallenge | undefined;
  quote?: string | undefined;
}> {
  const session = await getActiveSession(userId);
  
  if (!session) {
    return { shouldBlock: false, reason: 'No active focus session', session: null };
  }
  
  const settings = await getShieldSettings(userId);
  
  if (!settings.isEnabled) {
    return { shouldBlock: false, reason: 'Distraction Shield is disabled', session };
  }
  
  // Whitelist check
  if (session.allowedApps.includes(appPackageName) || settings.allowedApps.includes(appPackageName)) {
    return { shouldBlock: false, reason: 'App is allowed', session };
  }
  
  // Blocklist check
  if (!session.blockedApps.includes(appPackageName) && !settings.blockedApps.includes(appPackageName)) {
    return { shouldBlock: false, reason: 'App not in blocked list', session };
  }
  
  // Generate friction challenge
  const friction = settings.frictionType !== 'none' 
    ? generateFrictionChallenge(settings.frictionType, settings)
    : undefined;
  
  // Get motivational quote
  const quote = settings.motivationalQuotes
    ? MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
    : undefined;
  
  return {
    shouldBlock: true,
    reason: `App is blocked during focus session (${session.blockingMode} mode)`,
    session,
    friction,
    quote,
  };
}

export function getDefaultBlockedApps(): typeof DEFAULT_BLOCKED_APPS {
  return DEFAULT_BLOCKED_APPS;
}

export function getMotivationalQuote(): string {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]!;
}
