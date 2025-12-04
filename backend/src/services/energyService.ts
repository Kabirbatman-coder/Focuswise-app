import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'energy.db');

let db: Database | null = null;

// ==================== TYPES ====================

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
export type TimePeriod = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface EnergyCheckIn {
  id: string;
  userId: string;
  level: EnergyLevel;
  mood?: string | undefined;
  note?: string | undefined;
  timestamp: string;
  timePeriod: TimePeriod;
  dayOfWeek: number;        // NEW: 0-6 (Sunday-Saturday)
  contextTags?: string[];   // NEW: what activity before/after
  createdAt: string;
}

// NEW: Confidence-scored energy prediction
export interface EnergyPrediction {
  period: TimePeriod;
  predictedLevel: number;
  confidence: number;       // 0-1 based on data quality
  dataPoints: number;       // Number of check-ins for this prediction
  trend: 'up' | 'down' | 'stable';
}

// NEW: Pattern detection result
export interface EnergyPattern {
  type: 'weekday_variation' | 'fatigue_curve' | 'peak_shift' | 'consistency';
  description: string;
  strength: number;         // 0-1 how strong the pattern is
  insight: string;          // Actionable recommendation
  data?: any;
}

// NEW: Daily suggestion
export interface DailySuggestion {
  bestTimeForDeepWork: { period: TimePeriod; confidence: number };
  bestTimeForMeetings: { period: TimePeriod; confidence: number };
  warningPeriods: { period: TimePeriod; reason: string }[];
  personalizedTip: string;
}

export interface EnergyProfile {
  userId: string;
  averages: {
    early_morning: number | null;
    morning: number | null;
    midday: number | null;
    afternoon: number | null;
    evening: number | null;
    night: number | null;
  };
  // NEW: Confidence scores for each period
  confidence: {
    early_morning: number;
    morning: number;
    midday: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  peakPeriod: TimePeriod | null;
  lowPeriod: TimePeriod | null;
  totalCheckIns: number;
  lastCheckIn: string | null;
  weeklyTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  recentCheckIns: EnergyCheckIn[];
  // NEW: Adaptive learning fields
  patterns: EnergyPattern[];
  predictions: EnergyPrediction[];
  weekdayAnalysis?: WeekdayAnalysis | undefined;
  suggestions: DailySuggestion;
  profileStrength: number;  // 0-100 how reliable the profile is
}

// NEW: Weekday-specific analysis
export interface WeekdayAnalysis {
  bestDay: { day: string; avgEnergy: number };
  worstDay: { day: string; avgEnergy: number };
  weekdayAverage: number;
  weekendAverage: number;
  variance: number;
}

export interface EnergyTrend {
  date: string;
  averageLevel: number;
  checkInCount: number;
}

// ==================== DATABASE ====================

async function initDB(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[EnergyService] Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('[EnergyService] Created new database');
  }
  
  // Enhanced schema with new fields
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_checkins (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      level INTEGER NOT NULL CHECK(level >= 1 AND level <= 5),
      mood TEXT,
      note TEXT,
      timestamp TEXT NOT NULL,
      timePeriod TEXT NOT NULL,
      dayOfWeek INTEGER DEFAULT 0,
      contextTags TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL
    )
  `);
  
  // NEW: Pattern history table
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_patterns (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      patternType TEXT NOT NULL,
      data TEXT NOT NULL,
      detectedAt TEXT NOT NULL,
      strength REAL DEFAULT 0.5
    )
  `);
  
  // NEW: User preferences learned from behavior
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_preferences (
      userId TEXT PRIMARY KEY,
      preferredCheckInTimes TEXT DEFAULT '[]',
      learningWeights TEXT DEFAULT '{}',
      lastPatternAnalysis TEXT,
      adaptiveSettings TEXT DEFAULT '{}'
    )
  `);
  
  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_energy_userId ON energy_checkins(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_energy_timestamp ON energy_checkins(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_energy_timePeriod ON energy_checkins(timePeriod)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_energy_dayOfWeek ON energy_checkins(dayOfWeek)`);
  
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
  return `energy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== HELPERS ====================

export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 7) return 'early_morning';
  if (hour >= 7 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 13) return 'midday';
  if (hour >= 13 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

export function getEnergyEmoji(level: EnergyLevel): string {
  const emojis: Record<EnergyLevel, string> = {
    1: '😴', 2: '😔', 3: '😐', 4: '😊', 5: '⚡',
  };
  return emojis[level];
}

export function getEnergyLabel(level: EnergyLevel): string {
  const labels: Record<EnergyLevel, string> = {
    1: 'Very Low', 2: 'Low', 3: 'Moderate', 4: 'Good', 5: 'Peak Energy',
  };
  return labels[level];
}

export function formatTimePeriod(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    early_morning: 'Early Morning (5-7 AM)',
    morning: 'Morning (7-10 AM)',
    midday: 'Midday (10 AM - 1 PM)',
    afternoon: 'Afternoon (1-5 PM)',
    evening: 'Evening (5-8 PM)',
    night: 'Night (8 PM - 12 AM)',
  };
  return labels[period];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==================== CORE FUNCTIONS ====================

export async function saveEnergyCheckIn(
  userId: string,
  level: EnergyLevel,
  options?: { mood?: string; note?: string; timestamp?: string; contextTags?: string[] }
): Promise<EnergyCheckIn> {
  const database = await initDB();
  
  const id = generateId();
  const now = new Date();
  const timestamp = options?.timestamp || now.toISOString();
  const timestampDate = new Date(timestamp);
  const timePeriod = getTimePeriod(timestampDate.getHours());
  const dayOfWeek = timestampDate.getDay();
  
  const checkIn: EnergyCheckIn = {
    id,
    userId,
    level,
    mood: options?.mood,
    note: options?.note,
    timestamp,
    timePeriod,
    dayOfWeek,
    contextTags: options?.contextTags || [],
    createdAt: now.toISOString(),
  };
  
  database.run(
    `INSERT INTO energy_checkins (id, userId, level, mood, note, timestamp, timePeriod, dayOfWeek, contextTags, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checkIn.id,
      checkIn.userId,
      checkIn.level,
      checkIn.mood || null,
      checkIn.note || null,
      checkIn.timestamp,
      checkIn.timePeriod,
      checkIn.dayOfWeek,
      JSON.stringify(checkIn.contextTags),
      checkIn.createdAt,
    ]
  );
  
  saveDB();
  console.log(`[EnergyService] Check-in: ${userId} - Level ${level} (${getEnergyEmoji(level)}) at ${timePeriod}, ${DAY_NAMES[dayOfWeek]}`);
  
  // Trigger pattern re-analysis if enough data
  const totalCheckIns = await getCheckInCount(userId);
  if (totalCheckIns % 10 === 0) {
    console.log(`[EnergyService] Triggering pattern analysis (${totalCheckIns} check-ins)`);
    // Async pattern analysis
    detectPatterns(userId).catch(console.error);
  }
  
  return checkIn;
}

async function getCheckInCount(userId: string): Promise<number> {
  const database = await initDB();
  const result = database.exec(
    `SELECT COUNT(*) FROM energy_checkins WHERE userId = ?`,
    [userId]
  );
  return result[0]?.values[0]?.[0] as number || 0;
}

export async function getCheckInsByUserId(
  userId: string,
  limit: number = 100
): Promise<EnergyCheckIn[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM energy_checkins WHERE userId = ? ORDER BY timestamp DESC LIMIT ?`,
    [userId, limit]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const checkIn: any = {};
    columns.forEach((col: string, idx: number) => {
      checkIn[col] = row[idx];
    });
    checkIn.contextTags = JSON.parse(checkIn.contextTags || '[]');
    return checkIn as EnergyCheckIn;
  });
}

export async function getCheckInsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<EnergyCheckIn[]> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT * FROM energy_checkins 
     WHERE userId = ? AND timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC`,
    [userId, startDate, endDate]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  const columns = firstResult.columns;
  return firstResult.values.map((row) => {
    const checkIn: any = {};
    columns.forEach((col: string, idx: number) => {
      checkIn[col] = row[idx];
    });
    checkIn.contextTags = JSON.parse(checkIn.contextTags || '[]');
    return checkIn as EnergyCheckIn;
  });
}

export async function getTodayCheckIns(userId: string): Promise<EnergyCheckIn[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return getCheckInsByDateRange(userId, today.toISOString(), tomorrow.toISOString());
}

// ==================== CONFIDENCE-WEIGHTED AVERAGES ====================

async function getAverageForPeriod(
  userId: string,
  timePeriod: TimePeriod,
  daysBack: number = 14
): Promise<{ average: number | null; confidence: number; dataPoints: number }> {
  const database = await initDB();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const result = database.exec(
    `SELECT level, timestamp FROM energy_checkins 
     WHERE userId = ? AND timePeriod = ? AND timestamp >= ?
     ORDER BY timestamp DESC`,
    [userId, timePeriod, cutoffDate.toISOString()]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return { average: null, confidence: 0, dataPoints: 0 };
  }
  
  const levels = firstResult.values.map(row => row[0] as number);
  const dataPoints = levels.length;
  
  // Apply recency weighting - more recent = higher weight
  let weightedSum = 0;
  let weightTotal = 0;
  
  levels.forEach((level, index) => {
    const weight = Math.pow(0.9, index); // Exponential decay
    weightedSum += level * weight;
    weightTotal += weight;
  });
  
  const average = weightTotal > 0 ? weightedSum / weightTotal : null;
  
  // Calculate confidence based on:
  // 1. Number of data points (more = better)
  // 2. Consistency (lower variance = higher confidence)
  // 3. Recency (fresher data = higher confidence)
  
  const variance = calculateVariance(levels);
  const consistencyScore = Math.max(0, 1 - variance / 2); // 0-1
  const quantityScore = Math.min(1, dataPoints / 10);     // 0-1
  
  // Check recency - any check-in in last 3 days?
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentResult = database.exec(
    `SELECT COUNT(*) FROM energy_checkins 
     WHERE userId = ? AND timePeriod = ? AND timestamp >= ?`,
    [userId, timePeriod, threeDaysAgo.toISOString()]
  );
  const recentCount = recentResult[0]?.values[0]?.[0] as number || 0;
  const recencyScore = Math.min(1, recentCount / 2);      // 0-1
  
  // Combined confidence
  const confidence = (consistencyScore * 0.4 + quantityScore * 0.35 + recencyScore * 0.25);
  
  return {
    average: average ? Math.round(average * 10) / 10 : null,
    confidence: Math.round(confidence * 100) / 100,
    dataPoints,
  };
}

function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

// ==================== PATTERN DETECTION ====================

export async function detectPatterns(userId: string): Promise<EnergyPattern[]> {
  const database = await initDB();
  const patterns: EnergyPattern[] = [];
  
  // Need at least 14 check-ins for pattern detection
  const checkIns = await getCheckInsByUserId(userId, 100);
  if (checkIns.length < 14) {
    return [];
  }
  
  // 1. WEEKDAY VARIATION PATTERN
  const weekdayPattern = await detectWeekdayVariation(userId, database);
  if (weekdayPattern) patterns.push(weekdayPattern);
  
  // 2. FATIGUE CURVE PATTERN (energy decline throughout day)
  const fatiguePattern = await detectFatigueCurve(userId, database);
  if (fatiguePattern) patterns.push(fatiguePattern);
  
  // 3. CONSISTENCY PATTERN
  const consistencyPattern = await detectConsistency(userId, database);
  if (consistencyPattern) patterns.push(consistencyPattern);
  
  // 4. PEAK SHIFT PATTERN (peak moving over time)
  const peakShiftPattern = await detectPeakShift(userId, database);
  if (peakShiftPattern) patterns.push(peakShiftPattern);
  
  // Store patterns
  const now = new Date().toISOString();
  for (const pattern of patterns) {
    const id = generateId();
    database.run(
      `INSERT OR REPLACE INTO energy_patterns (id, userId, patternType, data, detectedAt, strength)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, pattern.type, JSON.stringify(pattern.data), now, pattern.strength]
    );
  }
  
  saveDB();
  console.log(`[EnergyService] Detected ${patterns.length} patterns for ${userId}`);
  
  return patterns;
}

async function detectWeekdayVariation(userId: string, database: Database): Promise<EnergyPattern | null> {
  const result = database.exec(
    `SELECT dayOfWeek, AVG(level) as avg, COUNT(*) as cnt
     FROM energy_checkins WHERE userId = ?
     GROUP BY dayOfWeek
     HAVING cnt >= 2`,
    [userId]
  );
  
  if (!result[0] || result[0].values.length < 5) return null;
  
  const dayAverages: Record<number, number> = {};
  result[0].values.forEach(row => {
    dayAverages[row[0] as number] = row[1] as number;
  });
  
  const values = Object.values(dayAverages);
  const variance = calculateVariance(values);
  
  if (variance < 0.3) return null; // Not significant
  
  const bestDay = Object.entries(dayAverages).reduce((acc, [dayStr, avg]) => 
    avg > acc.avg ? { day: Number(dayStr), avg } : acc,
    { day: 0, avg: 0 }
  );
  
  const worstDay = Object.entries(dayAverages).reduce((acc, [dayStr, avg]) => 
    avg < acc.avg ? { day: Number(dayStr), avg } : acc,
    { day: 0, avg: 5 }
  );
  
  return {
    type: 'weekday_variation',
    description: `Energy varies significantly by day of week`,
    strength: Math.min(1, variance / 0.8),
    insight: `Your best day is ${DAY_NAMES[bestDay.day]} (avg ${bestDay.avg.toFixed(1)}/5). ` +
             `Consider scheduling important work on ${DAY_NAMES[bestDay.day]}s and lighter tasks on ${DAY_NAMES[worstDay.day]}s.`,
    data: { dayAverages, bestDay, worstDay },
  };
}

async function detectFatigueCurve(userId: string, database: Database): Promise<EnergyPattern | null> {
  const periods: TimePeriod[] = ['morning', 'midday', 'afternoon', 'evening'];
  const periodAverages: Record<string, number> = {};
  
  for (const period of periods) {
    const result = database.exec(
      `SELECT AVG(level) as avg FROM energy_checkins 
       WHERE userId = ? AND timePeriod = ?`,
      [userId, period]
    );
    periodAverages[period] = result[0]?.values[0]?.[0] as number || 3;
  }
  
  // Check if there's a consistent decline
  const values = periods.map(p => periodAverages[p]);
  let declineCount = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! < values[i-1]!) declineCount++;
  }
  
  if (declineCount < 2) return null; // Not a clear decline
  
  const dropAmount = values[0]! - values[values.length - 1]!;
  if (dropAmount < 0.5) return null; // Not significant
  
  return {
    type: 'fatigue_curve',
    description: `Your energy tends to decline throughout the day`,
    strength: Math.min(1, dropAmount / 2),
    insight: `You lose about ${dropAmount.toFixed(1)} energy points from morning to evening. ` +
             `Front-load demanding tasks before ${periodAverages['midday']! < 3.5 ? 'midday' : 'afternoon'}.`,
    data: { periodAverages, dropAmount },
  };
}

async function detectConsistency(userId: string, database: Database): Promise<EnergyPattern | null> {
  const result = database.exec(
    `SELECT level FROM energy_checkins WHERE userId = ?
     ORDER BY timestamp DESC LIMIT 30`,
    [userId]
  );
  
  if (!result[0] || result[0].values.length < 10) return null;
  
  const levels = result[0].values.map(row => row[0] as number);
  const variance = calculateVariance(levels);
  
  if (variance > 1) {
    return {
      type: 'consistency',
      description: `Your energy levels are quite variable`,
      strength: Math.min(1, variance / 2),
      insight: `High variability suggests external factors are affecting your energy. ` +
               `Consider tracking sleep, diet, and exercise to find correlations.`,
      data: { variance, average: levels.reduce((a, b) => a + b, 0) / levels.length },
    };
  }
  
  return {
    type: 'consistency',
    description: `Your energy levels are relatively stable`,
    strength: 1 - variance,
    insight: `Consistent energy is great! Your routines are working. ` +
             `Average: ${(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1)}/5`,
    data: { variance, average: levels.reduce((a, b) => a + b, 0) / levels.length },
  };
}

async function detectPeakShift(userId: string, database: Database): Promise<EnergyPattern | null> {
  // Compare peak period from last 2 weeks vs previous 2 weeks
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  const periods: TimePeriod[] = ['morning', 'midday', 'afternoon', 'evening'];
  
  const getWeekPeak = async (start: string, end: string): Promise<TimePeriod | null> => {
    let maxAvg = 0;
    let peakPeriod: TimePeriod | null = null;
    
    for (const period of periods) {
      const result = database.exec(
        `SELECT AVG(level) as avg, COUNT(*) as cnt FROM energy_checkins 
         WHERE userId = ? AND timePeriod = ? AND timestamp >= ? AND timestamp < ?`,
        [userId, period, start, end]
      );
      const avg = result[0]?.values[0]?.[0] as number || 0;
      const cnt = result[0]?.values[0]?.[1] as number || 0;
      
      if (cnt >= 2 && avg > maxAvg) {
        maxAvg = avg;
        peakPeriod = period;
      }
    }
    return peakPeriod;
  };
  
  const recentPeak = await getWeekPeak(twoWeeksAgo.toISOString(), now.toISOString());
  const olderPeak = await getWeekPeak(fourWeeksAgo.toISOString(), twoWeeksAgo.toISOString());
  
  if (!recentPeak || !olderPeak || recentPeak === olderPeak) return null;
  
  return {
    type: 'peak_shift',
    description: `Your peak energy time has shifted`,
    strength: 0.7,
    insight: `Your peak has moved from ${formatTimePeriod(olderPeak)} to ${formatTimePeriod(recentPeak)}. ` +
             `Update your schedule to match your new rhythm.`,
    data: { olderPeak, recentPeak },
  };
}

// ==================== WEEKDAY ANALYSIS ====================

async function analyzeWeekdays(userId: string): Promise<WeekdayAnalysis | undefined> {
  const database = await initDB();
  
  const result = database.exec(
    `SELECT dayOfWeek, AVG(level) as avg, COUNT(*) as cnt
     FROM energy_checkins WHERE userId = ?
     GROUP BY dayOfWeek
     HAVING cnt >= 2`,
    [userId]
  );
  
  if (!result[0] || result[0].values.length < 3) return undefined;
  
  const dayAverages: Record<number, { avg: number; cnt: number }> = {};
  result[0].values.forEach(row => {
    dayAverages[row[0] as number] = {
      avg: row[1] as number,
      cnt: row[2] as number,
    };
  });
  
  let bestDay = { day: '', avgEnergy: 0 };
  let worstDay = { day: '', avgEnergy: 5 };
  let weekdaySum = 0, weekdayCount = 0;
  let weekendSum = 0, weekendCount = 0;
  
  Object.entries(dayAverages).forEach(([dayStr, data]) => {
    const day = Number(dayStr);
    const dayName = DAY_NAMES[day]!;
    
    if (data.avg > bestDay.avgEnergy) {
      bestDay = { day: dayName, avgEnergy: data.avg };
    }
    if (data.avg < worstDay.avgEnergy) {
      worstDay = { day: dayName, avgEnergy: data.avg };
    }
    
    if (day >= 1 && day <= 5) {
      weekdaySum += data.avg * data.cnt;
      weekdayCount += data.cnt;
    } else {
      weekendSum += data.avg * data.cnt;
      weekendCount += data.cnt;
    }
  });
  
  const allValues = Object.values(dayAverages).map(d => d.avg);
  
  return {
    bestDay,
    worstDay,
    weekdayAverage: weekdayCount > 0 ? weekdaySum / weekdayCount : 0,
    weekendAverage: weekendCount > 0 ? weekendSum / weekendCount : 0,
    variance: calculateVariance(allValues),
  };
}

// ==================== DAILY SUGGESTIONS ====================

async function generateDailySuggestions(
  userId: string,
  averages: EnergyProfile['averages'],
  confidence: EnergyProfile['confidence'],
  patterns: EnergyPattern[]
): Promise<DailySuggestion> {
  const periods: TimePeriod[] = ['morning', 'midday', 'afternoon', 'evening'];
  
  // Find best time for deep work (high energy + high confidence)
  let bestDeepWork: { period: TimePeriod; score: number } = { period: 'morning', score: 0 };
  for (const period of periods) {
    const avg = averages[period];
    const conf = confidence[period];
    if (avg !== null) {
      const score = avg * conf;
      if (score > bestDeepWork.score) {
        bestDeepWork = { period, score };
      }
    }
  }
  
  // Find best time for meetings (moderate energy, avoid peak)
  let bestMeetings: { period: TimePeriod; score: number } = { period: 'afternoon', score: 0 };
  for (const period of periods) {
    const avg = averages[period];
    const conf = confidence[period];
    if (avg !== null && period !== bestDeepWork.period) {
      // Prefer moderate energy periods
      const score = (3 - Math.abs(avg - 3)) * conf;
      if (score > bestMeetings.score) {
        bestMeetings = { period, score };
      }
    }
  }
  
  // Warning periods (low energy)
  const warningPeriods: { period: TimePeriod; reason: string }[] = [];
  for (const period of periods) {
    const avg = averages[period];
    if (avg !== null && avg < 2.5) {
      warningPeriods.push({
        period,
        reason: `Average energy is ${avg.toFixed(1)}/5 - avoid scheduling important work`,
      });
    }
  }
  
  // Generate personalized tip
  let personalizedTip = 'Keep logging your energy to unlock personalized insights!';
  
  if (patterns.length > 0) {
    const strongestPattern = patterns.reduce((a, b) => b.strength > a.strength ? b : a);
    personalizedTip = strongestPattern.insight;
  } else if (averages[bestDeepWork.period] !== null) {
    personalizedTip = `Your peak time is ${formatTimePeriod(bestDeepWork.period)}. Schedule your most important work then.`;
  }
  
  return {
    bestTimeForDeepWork: {
      period: bestDeepWork.period,
      confidence: confidence[bestDeepWork.period] || 0.5,
    },
    bestTimeForMeetings: {
      period: bestMeetings.period,
      confidence: confidence[bestMeetings.period] || 0.5,
    },
    warningPeriods,
    personalizedTip,
  };
}

// ==================== MAIN PROFILE FUNCTION ====================

export async function getEnergyProfile(userId: string): Promise<EnergyProfile> {
  const database = await initDB();
  
  const periods: TimePeriod[] = ['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night'];
  
  const averages: EnergyProfile['averages'] = {
    early_morning: null, morning: null, midday: null,
    afternoon: null, evening: null, night: null,
  };
  
  const confidence: EnergyProfile['confidence'] = {
    early_morning: 0, morning: 0, midday: 0,
    afternoon: 0, evening: 0, night: 0,
  };
  
  // Get confidence-weighted averages for each period
  for (const period of periods) {
    const result = await getAverageForPeriod(userId, period);
    averages[period] = result.average;
    confidence[period] = result.confidence;
  }
  
  // Find peak and low periods
  let peakPeriod: TimePeriod | null = null;
  let lowPeriod: TimePeriod | null = null;
  let maxAvg = -1;
  let minAvg = 6;
  
  for (const period of periods) {
    const avg = averages[period];
    if (avg !== null) {
      if (avg > maxAvg) { maxAvg = avg; peakPeriod = period; }
      if (avg < minAvg) { minAvg = avg; lowPeriod = period; }
    }
  }
  
  // Total check-ins
  const countResult = database.exec(
    `SELECT COUNT(*) FROM energy_checkins WHERE userId = ?`,
    [userId]
  );
  const totalCheckIns = countResult[0]?.values[0]?.[0] as number || 0;
  
  // Last check-in
  const lastResult = database.exec(
    `SELECT timestamp FROM energy_checkins WHERE userId = ? ORDER BY timestamp DESC LIMIT 1`,
    [userId]
  );
  const lastCheckIn = lastResult[0]?.values[0]?.[0] as string || null;
  
  // Weekly trend
  const weeklyTrend = await calculateWeeklyTrend(userId);
  
  // Recent check-ins
  const recentCheckIns = await getCheckInsByUserId(userId, 10);
  
  // Pattern detection
  const patterns = await detectPatterns(userId);
  
  // Weekday analysis
  const weekdayAnalysis = await analyzeWeekdays(userId);
  
  // Generate predictions for each period
  const predictions: EnergyPrediction[] = periods
    .filter(period => averages[period] !== null)
    .map(period => ({
      period,
      predictedLevel: averages[period]!,
      confidence: confidence[period],
      dataPoints: 0, // Would need to track this
      trend: 'stable' as const, // Would calculate from recent data
    }));
  
  // Daily suggestions
  const suggestions = await generateDailySuggestions(userId, averages, confidence, patterns);
  
  // Profile strength (0-100)
  const profileStrength = Math.min(100, Math.round(
    (totalCheckIns / 50 * 50) +           // Up to 50 points for quantity
    (Object.values(confidence).reduce((a, b) => a + b, 0) / 6 * 30) + // Up to 30 for confidence
    (patterns.length * 5)                  // Up to 20 for patterns detected
  ));
  
  return {
    userId,
    averages,
    confidence,
    peakPeriod,
    lowPeriod,
    totalCheckIns,
    lastCheckIn,
    weeklyTrend,
    recentCheckIns,
    patterns,
    predictions,
    weekdayAnalysis,
    suggestions,
    profileStrength,
  };
}

async function calculateWeeklyTrend(userId: string): Promise<EnergyProfile['weeklyTrend']> {
  const database = await initDB();
  
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const thisWeekResult = database.exec(
    `SELECT AVG(level) as avg, COUNT(*) as count FROM energy_checkins 
     WHERE userId = ? AND timestamp >= ?`,
    [userId, oneWeekAgo.toISOString()]
  );
  
  const lastWeekResult = database.exec(
    `SELECT AVG(level) as avg, COUNT(*) as count FROM energy_checkins 
     WHERE userId = ? AND timestamp >= ? AND timestamp < ?`,
    [userId, twoWeeksAgo.toISOString(), oneWeekAgo.toISOString()]
  );
  
  const thisWeekAvg = thisWeekResult[0]?.values[0]?.[0] as number | null;
  const thisWeekCount = thisWeekResult[0]?.values[0]?.[1] as number || 0;
  const lastWeekAvg = lastWeekResult[0]?.values[0]?.[0] as number | null;
  const lastWeekCount = lastWeekResult[0]?.values[0]?.[1] as number || 0;
  
  if (thisWeekCount < 3 || lastWeekCount < 3) {
    return 'insufficient_data';
  }
  
  if (thisWeekAvg === null || lastWeekAvg === null) {
    return 'insufficient_data';
  }
  
  const diff = thisWeekAvg - lastWeekAvg;
  
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

// ==================== TRENDS & OPTIMAL SLOTS ====================

export async function getEnergyTrends(
  userId: string,
  daysBack: number = 14
): Promise<EnergyTrend[]> {
  const database = await initDB();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const result = database.exec(
    `SELECT 
      date(timestamp) as date,
      AVG(level) as averageLevel,
      COUNT(*) as checkInCount
     FROM energy_checkins 
     WHERE userId = ? AND timestamp >= ?
     GROUP BY date(timestamp)
     ORDER BY date ASC`,
    [userId, cutoffDate.toISOString()]
  );
  
  const firstResult = result[0];
  if (!result.length || !firstResult || !firstResult.values.length) {
    return [];
  }
  
  return firstResult.values.map((row) => ({
    date: row[0] as string,
    averageLevel: Math.round((row[1] as number) * 10) / 10,
    checkInCount: row[2] as number,
  }));
}

export async function getOptimalTimeSlots(
  userId: string,
  requiredEnergyLevel: 'high' | 'medium' | 'low' = 'high'
): Promise<{ period: TimePeriod; averageEnergy: number; confidence: number; recommendation: string }[]> {
  const profile = await getEnergyProfile(userId);
  
  const periods: TimePeriod[] = ['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night'];
  const slots: { period: TimePeriod; averageEnergy: number; confidence: number; recommendation: string }[] = [];
  
  const thresholds = { high: 4, medium: 3, low: 2 };
  const threshold = thresholds[requiredEnergyLevel];
  
  for (const period of periods) {
    const avg = profile.averages[period];
    const conf = profile.confidence[period];
    
    if (avg !== null && avg >= threshold) {
      let recommendation = '';
      if (avg >= 4.5 && conf > 0.6) recommendation = '🔥 Excellent for complex, creative work';
      else if (avg >= 4) recommendation = '✨ Great for challenging tasks';
      else if (avg >= 3.5) recommendation = '👍 Good for focused work';
      else if (avg >= 3) recommendation = '📋 Suitable for routine tasks';
      else recommendation = '☕ Better for light tasks or breaks';
      
      slots.push({
        period,
        averageEnergy: avg,
        confidence: conf,
        recommendation,
      });
    }
  }
  
  // Sort by weighted score (energy * confidence)
  slots.sort((a, b) => (b.averageEnergy * b.confidence) - (a.averageEnergy * a.confidence));
  
  return slots;
}

export async function deleteCheckIn(checkInId: string): Promise<boolean> {
  const database = await initDB();
  
  database.run(`DELETE FROM energy_checkins WHERE id = ?`, [checkInId]);
  saveDB();
  
  console.log(`[EnergyService] Deleted check-in: ${checkInId}`);
  return true;
}
